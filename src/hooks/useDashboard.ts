import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DB } from '../types/db.constants';

export interface DashboardStats {
  todaysClasses: number;
  attendancePercentage: number;
  pendingAssignments: number;
  achievements: number;
  totalStudents?: number;
  upcomingTests: number;
  weekAttendance: number;
}

export interface RecentActivity {
  id: string;
  type: 'attendance' | 'assignment' | 'achievement' | 'test' | 'event';
  title: string;
  subtitle: string;
  timestamp: string;
  icon: string;
  color?: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  type: string;
  description?: string;
  color: string;
}

export interface FeeOverview {
  totalFee: number;
  paidAmount: number;
  pendingAmount: number;
  nextDueDate?: string;
}

export interface TaskOverview {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  dueThisWeek: number;
}

export interface SyllabusProgressOverview {
  overallProgress: number;
  totalSubjects: number;
  subjectBreakdown: {
    subjectId: string;
    subjectName: string;
    progress: number;
    totalTopics: number;
    completedTopics: number;
  }[];
}

export function useDashboardStats(userId: string, classInstanceId?: string, role?: string) {
  return useQuery({
    queryKey: ['dashboard-stats', userId, classInstanceId, role],
    queryFn: async (): Promise<DashboardStats> => {
      // Guard against invalid UUID values
      if (!userId || !classInstanceId) {
        return {
          todaysClasses: 0,
          attendancePercentage: 0,
          weekAttendance: 0,
          pendingAssignments: 0,
          upcomingTests: 0,
          achievements: 0,
          totalStudents: 0,
        };
      }

      const today = new Date().toISOString().split('T')[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      // For students, get student ID first (required for subsequent queries)
      let studentId = userId;
      if (role === 'student') {
        const { data: studentData } = await supabase
          .from('student')
          .select('id')
          .eq('auth_user_id', userId)
          .maybeSingle();

        if (studentData) {
          studentId = studentData.id;
        } else {
          // If student not found, return early with zeros
          return {
            todaysClasses: 0,
            attendancePercentage: 0,
            weekAttendance: 0,
            pendingAssignments: 0,
            upcomingTests: 0,
            achievements: 0,
            totalStudents: 0,
          };
        }
      }

      // ⚡ OPTIMIZED: Batch all independent queries in parallel
      const currentMonth = new Date().toISOString().substring(0, 7);

      if (role === 'student') {
        // Run all student queries in parallel
        const [
          todaysClassesResult,
          attendanceResult,
          weekAttendanceResult,
          tasksResult,
          submissionsResult,
          upcomingTestsResult,
        ] = await Promise.all([
          supabase
            .from(DB.tables.timetableSlots)
            .select('id', { count: 'exact', head: true })
            .eq('class_instance_id', classInstanceId)
            .eq('class_date', today),
          supabase
            .from(DB.tables.attendance)
            .select('status')
            .eq('student_id', studentId)
            .gte('date', `${currentMonth}-01`)
            .lt('date', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split('T')[0]),
          supabase
            .from(DB.tables.attendance)
            .select('status')
            .eq('student_id', studentId)
            .gte('date', weekStartStr)
            .lte('date', today),
          supabase
            .from('tasks')
            .select('id')
            .eq('class_instance_id', classInstanceId)
            .eq('is_active', true),
          supabase
            .from('task_submissions')
            .select('task_id, status')
            .eq('student_id', studentId),
          supabase
            .from('tests')
            .select('id')
            .eq('class_instance_id', classInstanceId)
            .gte('test_date', today)
            .lte('test_date', nextWeekStr)
            .eq('status', 'active'),
        ]);

        // Calculate attendance
        const totalAttendance = attendanceResult.data?.length || 0;
        const presentCount = attendanceResult.data?.filter(a => a.status === 'present').length || 0;
        const attendancePercentage = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

        const weekTotal = weekAttendanceResult.data?.length || 0;
        const weekPresent = weekAttendanceResult.data?.filter(a => a.status === 'present').length || 0;
        const weekAttendance = weekTotal > 0 ? Math.round((weekPresent / weekTotal) * 100) : 0;

        // Calculate pending assignments
        const submittedOrGradedTaskIds = new Set(
          submissionsResult.data?.filter(s => s.status === 'submitted' || s.status === 'graded').map(s => s.task_id) || []
        );
        const pendingAssignments = tasksResult.data?.filter(task => !submittedOrGradedTaskIds.has(task.id)).length || 0;

        return {
          todaysClasses: todaysClassesResult.count || 0,
          attendancePercentage,
          weekAttendance,
          pendingAssignments,
          upcomingTests: upcomingTestsResult.data?.length || 0,
          achievements: 0,
          totalStudents: 0,
        };
      } else {
        // Run all admin queries in parallel
        const [
          todaysClassesResult,
          tasksResult,
          upcomingTestsResult,
          studentsResult,
        ] = await Promise.all([
          supabase
            .from(DB.tables.timetableSlots)
            .select('id', { count: 'exact', head: true })
            .eq('class_instance_id', classInstanceId)
            .eq('class_date', today),
          supabase
            .from('tasks')
            .select('id')
            .eq('class_instance_id', classInstanceId)
            .eq('is_active', true),
          supabase
            .from('tests')
            .select('id')
            .eq('class_instance_id', classInstanceId)
            .gte('test_date', today)
            .lte('test_date', nextWeekStr)
            .eq('status', 'active'),
          supabase
            .from('student')
            .select('id', { count: 'exact', head: true })
            .eq('class_instance_id', classInstanceId),
        ]);

        return {
          todaysClasses: todaysClassesResult.count || 0,
          attendancePercentage: 0,
          weekAttendance: 0,
          pendingAssignments: tasksResult.data?.length || 0,
          upcomingTests: upcomingTestsResult.data?.length || 0,
          achievements: 0,
          totalStudents: studentsResult.count || 0,
        };
      }
    },
    enabled: !!userId && !!classInstanceId,
    staleTime: 2 * 60 * 1000, // 2 minutes - fresh data without aggressive polling
    refetchOnWindowFocus: true, // ✅ Fresh data when user returns
    refetchOnMount: true, // ✅ Fresh data on screen load
  });
}

export function useRecentActivity(userId: string, classInstanceId?: string) {
  return useQuery({
    queryKey: ['recent-activity', userId, classInstanceId],
    queryFn: async (): Promise<RecentActivity[]> => {
      // Guard against invalid UUID values
      if (!userId) {
        return [];
      }

      // Get student ID from auth_user_id
      const { data: studentData } = await supabase
        .from('student')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (!studentData) {
        return [];
      }

      const studentId = studentData.id;
      const activities: RecentActivity[] = [];
      
      // Get recent attendance records
      try {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from(DB.tables.attendance)
          .select('id, status, date, created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(2);
        
        if (!attendanceError && attendanceData) {
          attendanceData.forEach(record => {
            activities.push({
              id: record.id,
              type: 'attendance',
              title: `Attendance marked`,
              subtitle: `${new Date(record.date).toLocaleDateString()} - ${record.status === 'present' ? 'Present' : record.status === 'absent' ? 'Absent' : 'Late'}`,
              timestamp: record.created_at || new Date().toISOString(),
              icon: 'CheckSquare',
              color: record.status === 'present' ? 'success' : 'error',
            });
          });
        }
      } catch (error) {
        console.warn('Error fetching recent attendance:', error);
      }

      // Get recent tasks (only if classInstanceId is provided)
      if (classInstanceId) {
        try {
          const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select('id, title, due_date, created_at, subjects(subject_name)')
            .eq('class_instance_id', classInstanceId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(2);

          if (!tasksError && tasksData) {
            tasksData.forEach((task: any) => {
              activities.push({
                id: task.id,
                type: 'assignment',
                title: task.title,
                subtitle: `${task.subjects?.subject_name || 'General'} - Due ${new Date(task.due_date).toLocaleDateString()}`,
                timestamp: task.created_at,
                icon: 'BookOpen',
                color: 'info',
              });
            });
          }
        } catch (error) {
          console.warn('Error fetching recent tasks:', error);
        }
      }

      // Get recent test scores
      try {
        const { data: testScoresData, error: testScoresError } = await supabase
          .from('test_marks')
          .select('id, marks_obtained, max_marks, created_at, tests(title)')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(2);

        if (!testScoresError && testScoresData) {
          testScoresData.forEach((score: any) => {
            activities.push({
              id: score.id,
              type: 'test',
              title: `Test graded: ${score.tests?.title}`,
              subtitle: `Score: ${score.marks_obtained}/${score.max_marks}`,
              timestamp: score.created_at,
              icon: 'Award',
              color: 'secondary',
            });
          });
        }
      } catch (error) {
        console.warn('Error fetching recent test scores:', error);
      }
      
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5); // Limit to 5 most recent
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });
}

export function useUpcomingEvents(schoolCode: string, classInstanceId?: string) {
  return useQuery({
    queryKey: ['upcoming-events', schoolCode, classInstanceId],
    queryFn: async (): Promise<UpcomingEvent[]> => {
      // Guard against invalid school code
      if (!schoolCode) {
        return [];
      }

      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      const nextMonthStr = nextMonth.toISOString().split('T')[0];

      let query = supabase
        .from('school_calendar_events')
        .select('id, title, start_date, event_type, description, color')
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .gte('start_date', today)
        .lte('start_date', nextMonthStr)
        .order('start_date', { ascending: true });

      if (classInstanceId) {
        query = query.or(`class_instance_id.is.null,class_instance_id.eq.${classInstanceId}`);
      }

      const { data, error } = await query.limit(5);
      
      if (error) throw error;
      
      return (data || []).map(event => ({
        id: event.id,
        title: event.title,
        date: event.start_date,
        type: event.event_type,
        description: event.description || undefined,
        color: event.color || '#6366f1',
      }));
    },
    enabled: !!schoolCode,
    staleTime: 5 * 60 * 1000, // 5 minutes - events change less frequently
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });
}

export function useFeeOverview(authUserId: string) {
  return useQuery({
    queryKey: ['fee-overview', authUserId],
    queryFn: async (): Promise<FeeOverview> => {
      // Guard against invalid auth user ID
      if (!authUserId) {
        return { totalFee: 0, paidAmount: 0, pendingAmount: 0 };
      }

      // Get student ID from auth_user_id
      const { data: studentData } = await supabase
        .from('student')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (!studentData) {
        return { totalFee: 0, paidAmount: 0, pendingAmount: 0 };
      }

      const studentId = studentData.id;

      // Get active fee plan for student
      const { data: feePlan } = await supabase
        .from('fee_student_plans')
        .select(`
          id,
          fee_student_plan_items(amount_inr, quantity)
        `)
        .eq('student_id', studentId)
        .eq('status', 'active')
        .single();

      if (!feePlan) {
        return { totalFee: 0, paidAmount: 0, pendingAmount: 0 };
      }

      // Calculate total fee
      const totalFee = (feePlan.fee_student_plan_items || []).reduce(
        (sum: number, item: any) => sum + (item.amount_inr * (item.quantity || 1)),
        0
      );

      // Get total paid amount
      const { data: payments } = await supabase
        .from('fee_payments')
        .select('amount_inr')
        .eq('student_id', studentId)
        .eq('plan_id', feePlan.id);

      const paidAmount = (payments || []).reduce(
        (sum, payment) => sum + payment.amount_inr,
        0
      );

      const pendingAmount = totalFee - paidAmount;

      return {
        totalFee,
        paidAmount,
        pendingAmount,
      };
    },
    enabled: !!authUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes - fees change less frequently
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useTaskOverview(authUserId: string, classInstanceId?: string) {
  return useQuery({
    queryKey: ['task-overview', authUserId, classInstanceId],
    queryFn: async (): Promise<TaskOverview> => {
      // Guard against invalid ID values
      if (!authUserId || !classInstanceId) {
        return {
          total: 0,
          completed: 0,
          pending: 0,
          overdue: 0,
          dueThisWeek: 0,
        };
      }

      // Get student ID from auth_user_id
      const { data: studentData } = await supabase
        .from('student')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (!studentData) {
        return {
          total: 0,
          completed: 0,
          pending: 0,
          overdue: 0,
          dueThisWeek: 0,
        };
      }

      const studentId = studentData.id;
      const today = new Date().toISOString().split('T')[0];
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // Get all tasks for student's class
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, due_date')
        .eq('class_instance_id', classInstanceId)
        .eq('is_active', true);

      // Get student submissions (only submitted or graded count as completed)
      const { data: submissions } = await supabase
        .from('task_submissions')
        .select('task_id, status')
        .eq('student_id', studentId);

      const submittedTaskIds = new Set(
        submissions?.filter(s => s.status === 'submitted' || s.status === 'graded').map(s => s.task_id) || []
      );
      
      const overview: TaskOverview = {
        total: tasks?.length || 0,
        completed: submittedTaskIds.size,
        pending: 0,
        overdue: 0,
        dueThisWeek: 0,
      };

      // Only count unsubmitted tasks for pending/overdue/dueThisWeek
      tasks?.forEach(task => {
        if (!submittedTaskIds.has(task.id)) {
          overview.pending++;
          if (task.due_date < today) {
            overview.overdue++;
          } else if (task.due_date <= weekEndStr) {
            overview.dueThisWeek++;
          }
        }
      });

      return overview;
    },
    enabled: !!authUserId && !!classInstanceId,
    staleTime: 2 * 60 * 1000, // 2 minutes - task data changes frequently
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useSyllabusOverview(classInstanceId: string) {
  return useQuery({
    queryKey: ['syllabus-overview', classInstanceId],
    queryFn: async (): Promise<SyllabusProgressOverview> => {
      if (!classInstanceId) {
        return {
          overallProgress: 0,
          totalSubjects: 0,
          subjectBreakdown: [],
        };
      }

      // Fetch all subjects for this class from timetable
      const { data: timetableData } = await supabase
        .from(DB.tables.timetableSlots)
        .select('subject_id, subjects!inner(subject_name, id)')
        .eq('class_instance_id', classInstanceId);

      if (!timetableData || timetableData.length === 0) {
        return {
          overallProgress: 0,
          totalSubjects: 0,
          subjectBreakdown: [],
        };
      }

      // Get unique subjects
      const uniqueSubjects = new Map<string, any>();
      timetableData.forEach((item: any) => {
        if (item.subjects) {
          uniqueSubjects.set(item.subjects.id, item.subjects);
        }
      });

      const subjects = Array.from(uniqueSubjects.values());
      const subjectIds = subjects.map(s => s.id);

      // ⚡ OPTIMIZED: Batch fetch all data at once (4 queries instead of 31+)
      const [syllabiResult, allProgressResult] = await Promise.all([
        // Query 1: Get all syllabi for all subjects
        supabase
          .from('syllabi')
          .select('id, subject_id')
          .eq('class_instance_id', classInstanceId)
          .in('subject_id', subjectIds),

        // Query 2: Get all progress for this class
        supabase
          .from('syllabus_progress')
          .select('syllabus_topic_id, subject_id')
          .eq('class_instance_id', classInstanceId)
          .in('subject_id', subjectIds)
          .not('syllabus_topic_id', 'is', null),
      ]);

      const syllabusMap = new Map(
        (syllabiResult.data || []).map(s => [s.subject_id, s.id])
      );
      const syllabusIds = Array.from(syllabusMap.values());

      // Query 3 & 4: Batch fetch all chapters and topics
      const [chaptersResult, allProgressBySubject] = await Promise.all([
        syllabusIds.length > 0
          ? supabase
              .from('syllabus_chapters')
              .select('id, syllabus_id')
              .in('syllabus_id', syllabusIds)
          : Promise.resolve({ data: [] }),
        // Group progress by subject
        Promise.resolve(
          (allProgressResult.data || []).reduce((acc: any, p: any) => {
            if (!acc[p.subject_id]) acc[p.subject_id] = new Set();
            acc[p.subject_id].add(p.syllabus_topic_id);
            return acc;
          }, {} as Record<string, Set<string>>)
        ),
      ]);

      // Build chapter -> syllabus mapping
      const chapterToSyllabusMap = new Map(
        (chaptersResult.data || []).map(c => [c.id, c.syllabus_id])
      );
      const chapterIds = Array.from(chapterToSyllabusMap.keys());

      // Query 4: Fetch all topics at once
      const { data: allTopics } = chapterIds.length > 0
        ? await supabase
            .from('syllabus_topics')
            .select('id, chapter_id')
            .in('chapter_id', chapterIds)
        : { data: [] };

      // Group topics by syllabus_id
      const topicsBySyllabus = (allTopics || []).reduce((acc: any, topic: any) => {
        const syllabusId = chapterToSyllabusMap.get(topic.chapter_id);
        if (syllabusId) {
          if (!acc[syllabusId]) acc[syllabusId] = [];
          acc[syllabusId].push(topic.id);
        }
        return acc;
      }, {} as Record<string, string[]>);

      // Build subject progress (all in memory - no more queries!)
      const subjectProgress = subjects.map((subject: any) => {
        const syllabusId = syllabusMap.get(subject.id);
        const totalTopics = syllabusId ? (topicsBySyllabus[syllabusId]?.length || 0) : 0;
        const completedTopics = (allProgressBySubject[subject.id]?.size || 0);
        const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

        return {
          subjectId: subject.id,
          subjectName: subject.subject_name,
          progress,
          totalTopics,
          completedTopics,
        };
      });

      // Calculate overall progress
      const totalTopics = subjectProgress.reduce((sum, s) => sum + s.totalTopics, 0);
      const completedTopics = subjectProgress.reduce((sum, s) => sum + s.completedTopics, 0);
      const overallProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      return {
        overallProgress,
        totalSubjects: subjects.length,
        subjectBreakdown: subjectProgress,
      };
    },
    enabled: !!classInstanceId,
    staleTime: 3 * 60 * 1000, // 3 minutes - syllabus progress changes moderately
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

