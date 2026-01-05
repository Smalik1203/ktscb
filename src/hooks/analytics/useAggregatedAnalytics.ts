// Aggregated analytics hook that combines all analytics data in a single query
// This ensures data updates properly when time period changes

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { SuperAdminAnalytics, StudentAnalytics, TimePeriod, DateRange } from '../../components/analytics/types';
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../useCapabilities';
import { getDateRangeForPeriod } from '../../components/analytics/types';
import { useActiveAcademicYear } from '../useAcademicYears';
import { supabase } from '../../lib/supabase';

interface UseAggregatedAnalyticsOptions {
  timePeriod: TimePeriod;
  classInstanceId?: string;
  customDateRange?: DateRange;
}

/**
 * Fetch attendance data for a school within a date range
 */
async function fetchAttendanceData(
  schoolCode: string,
  academicYearId: string,
  startDate: string,
  endDate: string,
  classInstanceId?: string
) {
  // Get class instances for this school and academic year
  let classQuery = supabase
    .from('class_instances')
    .select('id, grade, section')
    .eq('school_code', schoolCode)
    .eq('academic_year_id', academicYearId);

  if (classInstanceId) {
    classQuery = classQuery.eq('id', classInstanceId);
  }

  const { data: classInstances } = await classQuery;
  if (!classInstances || classInstances.length === 0) {
    return { avgRate: 0, classSummaries: [], totalPresent: 0, totalAbsent: 0 };
  }

  const classIds = classInstances.map(c => c.id);
  const classMap = new Map(classInstances.map(c => [c.id, c]));

  // Fetch attendance records
  const { data: attendanceData, error: attendanceError } = await supabase
    .from('attendance')
    .select('id, class_instance_id, student_id, date, status')
    .in('class_instance_id', classIds)
    .gte('date', startDate)
    .lte('date', endDate);

  if (attendanceError) {
    // Error logged silently
  }

  if (!attendanceData || attendanceData.length === 0) {
    return { avgRate: 0, classSummaries: [], totalPresent: 0, totalAbsent: 0 };
  }

  // Aggregate by class
  const classAggregation = new Map<string, { present: number; total: number }>();

  attendanceData.forEach(record => {
    const classId = record.class_instance_id;
    if (!classId) return; // Skip records without class_instance_id
    if (!classAggregation.has(classId)) {
      classAggregation.set(classId, { present: 0, total: 0 });
    }
    const stats = classAggregation.get(classId)!;
    stats.total++;
    if (record.status === 'present') stats.present++;
  });

  const classSummaries = Array.from(classAggregation.entries()).map(([classId, stats]) => {
    const classInfo = classMap.get(classId);
    const className = classInfo
      ? `Grade ${classInfo.grade}${classInfo.section ? ` - ${classInfo.section}` : ''}`
      : 'Unknown Class';
    const rate = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
    return { classId, className, rate, presentCount: stats.present, totalCount: stats.total };
  });

  const totalPresent = attendanceData.filter(r => r.status === 'present').length;
  const totalAbsent = attendanceData.filter(r => r.status === 'absent').length;
  const avgRate = classSummaries.length > 0
    ? classSummaries.reduce((sum, c) => sum + c.rate, 0) / classSummaries.length
    : 0;

  return { avgRate, classSummaries, totalPresent, totalAbsent };
}

/**
 * Fetch fees data for a school
 */
async function fetchFeesData(
  schoolCode: string,
  academicYearId: string,
  classInstanceId?: string
) {
  // Fetch from analytics_fees_summary table (pre-aggregated data)
  // Using type assertion as the table exists but may not be in generated types
  let feesQuery = (supabase as any)
    .from('analytics_fees_summary')
    .select('student_id, total_billed_paise, total_collected_paise, total_outstanding_paise, last_payment_date')
    .eq('school_code', schoolCode);

  if (academicYearId) {
    feesQuery = feesQuery.eq('academic_year_id', academicYearId);
  }

  if (classInstanceId) {
    feesQuery = feesQuery.eq('class_instance_id', classInstanceId);
  }

  const { data: feeSummary, error } = await feesQuery;

  if (error) {
    console.error('[fetchFeesData] Error:', error);
    return {
      realizationRate: 0,
      totalBilled: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      agingBreakdown: { current: 0, '30-60': 0, '60-90': 0, '90+': 0 },
    };
  }

  if (!feeSummary || feeSummary.length === 0) {
    return {
      realizationRate: 0,
      totalBilled: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      agingBreakdown: { current: 0, '30-60': 0, '60-90': 0, '90+': 0 },
    };
  }

  // Aggregate fee data (values are in paise, convert to INR)
  let totalBilledPaise = 0;
  let totalCollectedPaise = 0;
  let totalOutstandingPaise = 0;
  let studentsWithOutstanding = 0;

  feeSummary.forEach(fee => {
    totalBilledPaise += Number(fee.total_billed_paise) || 0;
    totalCollectedPaise += Number(fee.total_collected_paise) || 0;
    totalOutstandingPaise += Number(fee.total_outstanding_paise) || 0;
    if ((Number(fee.total_outstanding_paise) || 0) > 0) {
      studentsWithOutstanding++;
    }
  });

  // Convert paise to INR (divide by 100)
  const totalBilled = totalBilledPaise / 100;
  const totalCollected = totalCollectedPaise / 100;
  const totalOutstanding = totalOutstandingPaise / 100;

  const realizationRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  return {
    realizationRate,
    totalBilled,
    totalCollected,
    totalOutstanding,
    agingBreakdown: {
      current: studentsWithOutstanding,
      '30-60': 0,
      '60-90': 0,
      '90+': 0
    },
  };
}

/**
 * Fetch academics data (tests) for a school within a date range
 */
async function fetchAcademicsData(
  schoolCode: string,
  academicYearId: string,
  startDate: string,
  endDate: string,
  classInstanceId?: string
) {
  // OPTIMIZED: Filter by date range in SQL, not JavaScript
  // Use test_date if available, otherwise created_at
  let testsQuery = supabase
    .from('tests')
    .select(`
      id,
      title,
      subject_id,
      class_instance_id,
      created_at,
      test_date,
      subjects(id, subject_name),
      class_instances!inner(school_code, academic_year_id)
    `)
    .eq('class_instances.school_code', schoolCode)
    .eq('class_instances.academic_year_id', academicYearId)
    // Filter: (test_date in range) OR (test_date is null AND created_at in range)
    .or(`and(test_date.gte.${startDate},test_date.lte.${endDate}),and(test_date.is.null,created_at.gte.${startDate},created_at.lte.${endDate})`);

  if (classInstanceId) {
    testsQuery = testsQuery.eq('class_instance_id', classInstanceId);
  }

  const { data: tests } = await testsQuery;

  if (!tests || tests.length === 0) {
    return {
      avgScore: 0,
      participationRate: 0,
      subjectSummaries: [],
    };
  }

  const testIds = tests.map(t => t.id);

  // Get test marks
  const { data: marks } = await supabase
    .from('test_marks')
    .select('test_id, student_id, marks_obtained, max_marks')
    .in('test_id', testIds);

  if (!marks || marks.length === 0) {
    return {
      avgScore: 0,
      participationRate: 0,
      subjectSummaries: tests.map((t: any) => ({
        subjectId: t.subject_id,
        subjectName: t.subjects?.subject_name || 'Unknown',
        avgScore: 0,
        testCount: 1,
      })),
    };
  }

  // Calculate subject summaries
  const subjectMap = new Map<string, { subjectName: string; totalScore: number; count: number }>();

  marks.forEach((mark: any) => {
    const test = tests.find((t: any) => t.id === mark.test_id);
    if (!test) return;

    const subjectId = test.subject_id;
    const subjectName = (test as any).subjects?.subject_name || 'Unknown';
    const scorePercent = mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks) * 100 : 0;

    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, { subjectName, totalScore: 0, count: 0 });
    }
    const stats = subjectMap.get(subjectId)!;
    stats.totalScore += scorePercent;
    stats.count++;
  });

  const subjectSummaries = Array.from(subjectMap.entries()).map(([subjectId, stats]) => ({
    subjectId,
    subjectName: stats.subjectName,
    avgScore: stats.count > 0 ? stats.totalScore / stats.count : 0,
    testCount: stats.count,
  }));

  const totalScores = marks.map((m: any) => {
    return m.max_marks > 0 ? (m.marks_obtained / m.max_marks) * 100 : 0;
  });
  const avgScore = totalScores.length > 0
    ? totalScores.reduce((a: number, b: number) => a + b, 0) / totalScores.length
    : 0;

  return {
    avgScore,
    participationRate: tests.length > 0 ? (marks.length / tests.length) * 10 : 0, // Rough estimate
    subjectSummaries,
  };
}

/**
 * Fetch syllabus progress data for a school
 */
async function fetchSyllabusData(
  schoolCode: string,
  academicYearId: string,
  classInstanceId?: string
) {
  // Get class instances
  let classQuery = supabase
    .from('class_instances')
    .select('id, grade, section')
    .eq('school_code', schoolCode)
    .eq('academic_year_id', academicYearId);

  if (classInstanceId) {
    classQuery = classQuery.eq('id', classInstanceId);
  }

  const { data: classInstances } = await classQuery;
  if (!classInstances || classInstances.length === 0) {
    return { overallProgress: 0, progressByClass: [], progressBySubject: [] };
  }

  const classIds = classInstances.map(c => c.id);
  const classMap = new Map(classInstances.map(c => [c.id, c]));

  // Get syllabus progress
  const { data: progressData } = await supabase
    .from('syllabus_progress')
    .select('id, syllabus_chapter_id, syllabus_topic_id, class_instance_id, subject_id')
    .in('class_instance_id', classIds);

  if (!progressData || progressData.length === 0) {
    return { overallProgress: 0, progressByClass: [], progressBySubject: [] };
  }

  // Get subjects
  const subjectIds = [...new Set(progressData.map(p => p.subject_id).filter(Boolean))];
  const { data: subjects } = subjectIds.length > 0
    ? await supabase.from('subjects').select('id, subject_name').in('id', subjectIds)
    : { data: [] };

  const subjectMap = new Map((subjects || []).map((s: any) => [s.id, s.subject_name]));

  // Get total chapters per subject via syllabi
  const { data: syllabi } = await supabase
    .from('syllabi')
    .select('id, subject_id')
    .in('class_instance_id', classIds);

  const syllabusIds = (syllabi || []).map(s => s.id);
  const { data: chapters } = syllabusIds.length > 0
    ? await supabase.from('syllabus_chapters').select('id, syllabus_id').in('syllabus_id', syllabusIds)
    : { data: [] };

  // Build total chapters per subject
  const syllabusToSubject = new Map((syllabi || []).map(s => [s.id, s.subject_id]));
  const totalChaptersBySubject = new Map<string, number>();

  (chapters || []).forEach((chapter: any) => {
    const subjectId = syllabusToSubject.get(chapter.syllabus_id);
    if (subjectId) {
      totalChaptersBySubject.set(subjectId, (totalChaptersBySubject.get(subjectId) || 0) + 1);
    }
  });

  // Calculate progress by class
  const classProgress = new Map<string, Set<string>>();
  progressData.forEach(p => {
    if (!classProgress.has(p.class_instance_id)) {
      classProgress.set(p.class_instance_id, new Set());
    }
    if (p.syllabus_chapter_id) {
      classProgress.get(p.class_instance_id)!.add(p.syllabus_chapter_id);
    }
  });

  const totalChapters = (chapters || []).length;
  const progressByClass = Array.from(classProgress.entries()).map(([classId, chaptersSet]) => {
    const classInfo = classMap.get(classId);
    const className = classInfo
      ? `Grade ${classInfo.grade}${classInfo.section ? ` - ${classInfo.section}` : ''}`
      : 'Unknown Class';
    const progress = totalChapters > 0 ? (chaptersSet.size / totalChapters) * 100 : 0;
    return { classId, className, progress };
  });

  // Calculate progress by subject
  const subjectProgress = new Map<string, Set<string>>();
  progressData.forEach(p => {
    if (!p.subject_id) return;
    if (!subjectProgress.has(p.subject_id)) {
      subjectProgress.set(p.subject_id, new Set());
    }
    if (p.syllabus_chapter_id) {
      subjectProgress.get(p.subject_id)!.add(p.syllabus_chapter_id);
    }
  });

  const progressBySubject = Array.from(subjectProgress.entries()).map(([subjectId, chaptersSet]) => {
    const subjectName = subjectMap.get(subjectId) || 'Unknown Subject';
    const totalTopics = totalChaptersBySubject.get(subjectId) || 0;
    const completedTopics = chaptersSet.size;
    const progress = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
    return { subjectId, subjectName, completedTopics, totalTopics, progress };
  });

  const overallProgress = progressByClass.length > 0
    ? progressByClass.reduce((sum, c) => sum + c.progress, 0) / progressByClass.length
    : 0;

  return { overallProgress, progressByClass, progressBySubject };
}

/**
 * Hook to aggregate all analytics data for Super Admin dashboard
 * All data is fetched in a single query to ensure consistency when time period changes
 */
export function useSuperAdminAnalytics(options: UseAggregatedAnalyticsOptions) {
  const { timePeriod, classInstanceId, customDateRange } = options;
  const { profile } = useAuth();
  const { can } = useCapabilities();

  const { startDate, endDate } = getDateRangeForPeriod(timePeriod, customDateRange);

  const schoolCode = profile?.school_code || null;
  // Capability-based access check - user must be able to view school analytics
  const canViewSchoolAnalytics = can('analytics.read_school');

  // Fetch active academic year
  const activeAcademicYearQuery = useActiveAcademicYear(schoolCode);
  const academicYearId = activeAcademicYearQuery.data?.id || null;

  const hasValidParams = !!schoolCode && !!academicYearId;
  const enabled = hasValidParams && canViewSchoolAnalytics && activeAcademicYearQuery.isSuccess;

  return useQuery({
    // Include timePeriod in queryKey to ensure refetch when it changes
    queryKey: ['aggregated-analytics', 'superadmin', schoolCode, academicYearId, timePeriod, startDate, endDate, classInstanceId],
    queryFn: async (): Promise<SuperAdminAnalytics> => {
      if (!schoolCode || !academicYearId) {
        throw new Error('Missing required parameters');
      }

      // Fetch all data in parallel
      const [attendance, fees, academics, syllabus] = await Promise.all([
        fetchAttendanceData(schoolCode, academicYearId, startDate, endDate, classInstanceId),
        fetchFeesData(schoolCode, academicYearId, classInstanceId),
        fetchAcademicsData(schoolCode, academicYearId, startDate, endDate, classInstanceId),
        fetchSyllabusData(schoolCode, academicYearId, classInstanceId),
      ]);

      // Fetch summary counts
      const { data: classInstances } = await supabase
        .from('class_instances')
        .select('id')
        .eq('school_code', schoolCode)
        .eq('academic_year_id', academicYearId);

      const totalClasses = classInstances?.length || 0;
      let totalStudents = 0;

      if (classInstances && classInstances.length > 0) {
        const classIds = classInstances.map(c => c.id);
        const { count } = await supabase
          .from('student')
          .select('id', { count: 'exact', head: true })
          .eq('school_code', schoolCode)
          .in('class_instance_id', classIds);
        totalStudents = count || 0;
      }

      const { count: teacherCount } = await supabase
        .from('admin')
        .select('id', { count: 'exact', head: true })
        .eq('school_code', schoolCode);

      const activeYear = activeAcademicYearQuery.data;

      return {
        summary: {
          activeAcademicYear: activeYear
            ? `${activeYear.year_start}–${activeYear.year_end}`
            : 'N/A',
          totalStudents,
          totalClasses,
          totalTeachers: teacherCount || 0,
        },
        attendance: {
          avgRate: attendance.avgRate,
          trend7Days: [],
          trend30Days: [],
          classesByConsistency: attendance.classSummaries.map(cls => ({
            classId: cls.classId,
            className: cls.className,
            avgRate: cls.rate,
            trend: 'stable' as const,
          })),
        },
        fees: {
          realizationRate: fees.realizationRate,
          totalBilled: fees.totalBilled,
          totalCollected: fees.totalCollected,
          totalOutstanding: fees.totalOutstanding,
          agingBuckets: {
            current: fees.agingBreakdown.current,
            '30to60': fees.agingBreakdown['30-60'],
            '60to90': fees.agingBreakdown['60-90'],
            over90: fees.agingBreakdown['90+'],
          },
        },
        academics: {
          avgScoreBySubject: academics.subjectSummaries.map(subj => ({
            subjectId: subj.subjectId,
            subjectName: subj.subjectName,
            avgScore: subj.avgScore,
            participationRate: 0,
          })),
          participationRate: academics.participationRate,
        },
        syllabus: {
          overallProgress: syllabus.overallProgress,
          progressByClass: syllabus.progressByClass,
          progressBySubject: syllabus.progressBySubject,
        },
        operations: {
          timetableCoverage: 0,
          teacherLoadBalance: [],
        },
        engagement: {
          testParticipation: 0,
          taskSubmissionRate: 0,
        },
      };
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter for better responsiveness
    gcTime: 10 * 60 * 1000,
    // Keep showing previous data while fetching new data (prevents blank screen)
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch student attendance data
 */
async function fetchStudentAttendanceData(
  schoolCode: string,
  academicYearId: string,
  studentId: string,
  startDate: string,
  endDate: string
) {
  const { data: attendanceData } = await supabase
    .from('attendance')
    .select(`
      id,
      date,
      status,
      class_instances!inner(school_code, academic_year_id)
    `)
    .eq('student_id', studentId)
    .eq('class_instances.school_code', schoolCode)
    .eq('class_instances.academic_year_id', academicYearId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (!attendanceData || attendanceData.length === 0) {
    return {
      rate: 0,
      presentCount: 0,
      totalCount: 0,
      weeklyTrend: [],
    };
  }

  const presentCount = attendanceData.filter(r => r.status === 'present').length;
  const totalCount = attendanceData.length;
  const rate = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

  // Group by week for trend
  const weeklyMap = new Map<string, { present: number; total: number }>();
  attendanceData.forEach(record => {
    const date = new Date(record.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, { present: 0, total: 0 });
    }
    const stats = weeklyMap.get(weekKey)!;
    stats.total++;
    if (record.status === 'present') stats.present++;
  });

  const weeklyTrend = Array.from(weeklyMap.entries()).map(([week, stats]) => ({
    week,
    presentCount: stats.present,
    totalCount: stats.total,
    rate: stats.total > 0 ? (stats.present / stats.total) * 100 : 0,
  }));

  return { rate, presentCount, totalCount, weeklyTrend };
}

async function fetchStudentLearningData(
  schoolCode: string,
  academicYearId: string,
  studentId: string,
  startDate: string,
  endDate: string
) {
  // Fetch test marks for the student
  const { data: testMarks } = await supabase
    .from('test_marks')
    .select(`
      *,
      tests!inner(
        id,
        title,
        subject_id,
        test_date,
        max_marks,
        subjects(subject_name)
      )
    `)
    .eq('student_id', studentId)
    .gte('tests.test_date', startDate)
    .lte('tests.test_date', endDate)
    .order('tests.test_date', { ascending: false });

  // Fetch tasks/assignments
  const { data: student } = await supabase
    .from('student')
    .select('class_instance_id')
    .eq('id', studentId)
    .single();

  let assignmentOnTimeStreak = 0;
  let totalAssignments = 0;
  const subjectScoreMap = new Map<string, { scores: number[]; subjectName: string; dates: string[] }>();

  if (student?.class_instance_id) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select(`
        *,
        subjects(subject_name)
      `)
      .eq('class_instance_id', student.class_instance_id)
      .gte('due_date', startDate)
      .lte('due_date', endDate);

    if (tasks && tasks.length > 0) {
      // Get submissions for these tasks
      const taskIds = tasks.map(t => t.id);
      const { data: submissions } = await supabase
        .from('task_submissions')
        .select('task_id, status, submitted_at')
        .eq('student_id', studentId)
        .in('task_id', taskIds);

      const submissionMap = new Map(
        submissions?.map(s => [s.task_id, s]) || []
      );

      totalAssignments = tasks.length;
      assignmentOnTimeStreak = tasks.filter(task => {
        const submission = submissionMap.get(task.id);
        if (!submission || submission.status !== 'submitted' || !submission.submitted_at) return false;
        const dueDate = new Date(task.due_date);
        const submittedDate = new Date(submission.submitted_at);
        return submittedDate <= dueDate;
      }).length;
    }
  }

  // Process test marks by subject
  if (testMarks) {
    testMarks.forEach((mark: any) => {
      const test = mark.tests;
      if (!test) return;

      const subjectId = test.subject_id;
      const subjectName = test.subjects?.subject_name || 'Unknown';
      const score = test.max_marks > 0
        ? (mark.marks_obtained / test.max_marks) * 100
        : mark.marks_obtained;

      if (!subjectScoreMap.has(subjectId)) {
        subjectScoreMap.set(subjectId, { scores: [], subjectName, dates: [] });
      }
      const subjectData = subjectScoreMap.get(subjectId)!;
      subjectData.scores.push(score);
      subjectData.dates.push(test.test_date);
    });
  }

  const subjectScoreTrend = Array.from(subjectScoreMap.entries()).map(([subjectId, data]) => {
    const avgScore = data.scores.length > 0
      ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      : 0;

    // Get recent trend (last 5 tests)
    const recentTrend = data.scores.slice(-5).map((score, index) => ({
      date: data.dates[data.dates.length - 5 + index] || '',
      score,
    }));

    return {
      subjectId,
      subjectName: data.subjectName,
      avgScore,
      testCount: data.scores.length,
      recentTrend,
    };
  });

  return {
    subjectScoreTrend,
    assignmentOnTimeStreak,
    totalAssignments,
  };
}

async function fetchStudentFeesData(
  studentId: string,
  academicYearId: string
) {
  const { data: feeSummary } = await supabase
    .from('student_fee_summary')
    .select('student_id, class_instance_id, component_code, base_paise, collected_amount_inr, collection_percentage, balance_paise')
    .eq('student_id', studentId)
    .single();

  if (!feeSummary) {
    return {
      totalBilled: 0,
      totalPaid: 0,
      totalDue: 0,
      lastPaymentDate: null,
      status: 'no_billing' as const,
    };
  }

  const totalBilled = (feeSummary as any).total_billed ?? (feeSummary as any).billed_amount ?? 0;
  const totalPaid = (feeSummary as any).total_paid ?? (feeSummary as any).collected_amount_inr ?? 0;
  const totalDue = totalBilled - totalPaid;

  let status: 'paid' | 'current' | 'overdue' | 'no_billing' = 'no_billing';
  if (totalBilled > 0) {
    if (totalDue <= 0) {
      status = 'paid';
    } else {
      // Check if overdue (simplified - would need due dates)
      status = 'current';
    }
  }

  // Get last payment date
  const { data: lastPayment } = await supabase
    .from('fee_payments')
    .select('payment_date')
    .eq('student_id', studentId)
    .order('payment_date', { ascending: false })
    .limit(1)
    .single();

  return {
    totalBilled,
    totalPaid,
    totalDue,
    lastPaymentDate: lastPayment?.payment_date || null,
    status,
  };
}

async function fetchStudentSyllabusProgress(
  schoolCode: string,
  academicYearId: string,
  studentId: string
) {
  // Get student's class
  const { data: student } = await supabase
    .from('student')
    .select('class_instance_id')
    .eq('id', studentId)
    .single();

  if (!student?.class_instance_id) {
    return {
      closestToPersonalBest: {
        subjectId: '',
        subjectName: 'No data available',
        bestScore: 0,
        recentScore: 0,
      },
      syllabusProgress: [],
    };
  }

  // Get syllabus progress for the class
  const { data: progress } = await supabase
    .from('syllabus_progress')
    .select(`
      *,
      syllabus_chapters!inner(
        id,
        chapter_name,
        subjects!inner(id, subject_name)
      )
    `)
    .eq('class_instance_id', student.class_instance_id);

  // Get test scores to find personal best
  const { data: testMarks } = await supabase
    .from('test_marks')
    .select(`
      *,
      tests!inner(
        subject_id,
        max_marks,
        subjects(subject_name)
      )
    `)
    .eq('student_id', studentId);

  // Calculate syllabus progress by subject
  const progressBySubject = new Map<string, { completed: number; total: number; subjectName: string }>();
  const subjectScores = new Map<string, number[]>();

  if (progress) {
    progress.forEach((p: any) => {
      const subjectId = p.syllabus_chapters?.subjects?.id;
      const subjectName = p.syllabus_chapters?.subjects?.subject_name || 'Unknown';
      if (subjectId) {
        if (!progressBySubject.has(subjectId)) {
          progressBySubject.set(subjectId, { completed: 0, total: 0, subjectName });
        }
        const subjData = progressBySubject.get(subjectId)!;
        subjData.total++;
        if (p.date) subjData.completed++;
      }
    });
  }

  // Process test scores
  if (testMarks) {
    testMarks.forEach((mark: any) => {
      const test = mark.tests;
      if (!test) return;
      const subjectId = test.subject_id;
      const score = test.max_marks > 0
        ? (mark.marks_obtained / test.max_marks) * 100
        : mark.marks_obtained;

      if (!subjectScores.has(subjectId)) {
        subjectScores.set(subjectId, []);
      }
      subjectScores.get(subjectId)!.push(score);
    });
  }

  // Find personal best
  let personalBest = {
    subjectId: '',
    subjectName: 'No data available',
    bestScore: 0,
    recentScore: 0,
  };

  subjectScores.forEach((scores, subjectId) => {
    const best = Math.max(...scores);
    const recent = scores[scores.length - 1] || 0;
    if (best > personalBest.bestScore) {
      const subjectName = Array.from(progressBySubject.values()).find(s => s.subjectName)?.subjectName || 'Unknown';
      personalBest = {
        subjectId,
        subjectName,
        bestScore: best,
        recentScore: recent,
      };
    }
  });

  // Format syllabus progress
  const syllabusProgress = Array.from(progressBySubject.entries()).map(([subjectId, data]) => ({
    subjectId,
    subjectName: data.subjectName,
    completedTopics: data.completed,
    totalTopics: data.total,
    progress: data.total > 0 ? (data.completed / data.total) * 100 : 0,
  }));

  return {
    closestToPersonalBest: personalBest,
    syllabusProgress,
  };
}

/**
 * Hook to aggregate all analytics data for Student dashboard
 */
export function useStudentAggregatedAnalytics(options: UseAggregatedAnalyticsOptions) {
  const { timePeriod, customDateRange } = options;
  const { profile } = useAuth();
  const { can } = useCapabilities();

  const { startDate, endDate } = getDateRangeForPeriod(timePeriod, customDateRange);

  const schoolCode = profile?.school_code || null;
  const studentId = profile?.auth_id || null;
  // Capability-based access check - user must be able to view their own analytics
  const canViewOwnAnalytics = can('analytics.read_own');
  const canViewSchoolAnalytics = can('analytics.read_school');
  // Only enable for users who can view own but NOT school analytics (students)
  const isStudentView = canViewOwnAnalytics && !canViewSchoolAnalytics;

  const activeAcademicYearQuery = useActiveAcademicYear(schoolCode);
  const academicYearId = activeAcademicYearQuery.data?.id || null;

  const hasValidParams = !!schoolCode && !!studentId && !!academicYearId;
  const enabled = hasValidParams && isStudentView && activeAcademicYearQuery.isSuccess;

  return useQuery({
    // Include timePeriod in queryKey for proper refetching
    queryKey: ['aggregated-analytics', 'student', schoolCode, academicYearId, studentId, timePeriod, startDate, endDate],
    queryFn: async (): Promise<StudentAnalytics> => {
      if (!schoolCode || !academicYearId || !studentId) {
        throw new Error('Missing required parameters');
      }

      // Fetch all data in parallel
      const [attendance, learning, fees, progress] = await Promise.all([
        fetchStudentAttendanceData(schoolCode, academicYearId, studentId, startDate, endDate),
        fetchStudentLearningData(schoolCode, academicYearId, studentId, startDate, endDate),
        fetchStudentFeesData(studentId, academicYearId),
        fetchStudentSyllabusProgress(schoolCode, academicYearId, studentId),
      ]);

      // Get student's class name
      const { data: student } = await supabase
        .from('student')
        .select(`
          full_name,
          class_instances!inner(grade, section)
        `)
        .eq('id', studentId)
        .single();

      const className = student?.class_instances
        ? `Grade ${student.class_instances.grade}${student.class_instances.section ? ` - ${student.class_instances.section}` : ''}`
        : '';

      return {
        summary: {
          studentName: profile?.full_name || student?.full_name || 'Student',
          className,
          schoolName: profile?.school_name || '',
        },
        attendanceRhythm: {
          currentRate: attendance.rate,
          daysAttendedThisMonth: attendance.presentCount,
          totalDaysThisMonth: attendance.totalCount,
          fourWeekTrend: attendance.weeklyTrend.slice(0, 4).map((week, index) => ({
            week: index + 1,
            presentDays: week.presentCount,
            totalDays: week.totalCount,
            rate: week.rate,
          })),
        },
        learning: {
          subjectScoreTrend: learning.subjectScoreTrend,
          assignmentOnTimeStreak: learning.assignmentOnTimeStreak,
          totalAssignments: learning.totalAssignments,
        },
        fees: fees,
        progressHighlights: progress,
      };
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // Keep showing previous data while fetching new data (prevents blank screen)
    placeholderData: keepPreviousData,
  });
}
