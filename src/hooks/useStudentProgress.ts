/**
 * useStudentProgress - Hook to fetch and compute detailed student progress data
 * Used for the Progress Tracking screen
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { log } from '../lib/logger';

export interface SubjectProgress {
  subject_id: string;
  subject_name: string;
  total_tests: number;
  average_percentage: number;
  grade: string;
  trend: 'up' | 'down' | 'stable';
  tests: TestResult[];
}

export interface TestResult {
  id: string;
  title: string;
  date: string;
  marks_obtained: number;
  max_marks: number;
  percentage: number;
  grade: string;
  test_mode: 'online' | 'offline';
  subject_name: string;
}

export interface ProgressStats {
  total_tests: number;
  overall_average: number;
  overall_grade: string;
  highest_score: number;
  lowest_score: number;
  tests_this_month: number;
  improvement_rate: number; // % change from last month
  subjects_count: number;
}

export interface AttendanceStats {
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

export interface StudentProgressData {
  student_id: string;
  student_name: string;
  class_info: {
    grade: string;
    section: string;
  } | null;
  academic_year: string | null;
  stats: ProgressStats;
  subjects: SubjectProgress[];
  recent_tests: TestResult[];
  attendance: AttendanceStats | null;
}

const getGrade = (percentage: number): string => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
};

const getTrend = (tests: TestResult[]): 'up' | 'down' | 'stable' => {
  if (tests.length < 2) return 'stable';
  
  // Compare average of last 2 tests vs previous 2 tests
  const sorted = [...tests].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recent = sorted.slice(0, 2);
  const previous = sorted.slice(2, 4);
  
  if (previous.length === 0) return 'stable';
  
  const recentAvg = recent.reduce((sum, t) => sum + t.percentage, 0) / recent.length;
  const prevAvg = previous.reduce((sum, t) => sum + t.percentage, 0) / previous.length;
  
  const diff = recentAvg - prevAvg;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
};

export function useStudentProgress(studentId?: string) {
  const { user, profile } = useAuth();
  
  // If no studentId provided, use current user's student record
  const targetStudentId = studentId;

  return useQuery<StudentProgressData>({
    queryKey: ['student-progress', targetStudentId || user?.id],
    queryFn: async () => {
      let actualStudentId = targetStudentId;
      
      // If no studentId provided and user is a student, get their student record
      if (!actualStudentId && user?.id) {
        const { data: studentRecord } = await supabase
          .from('student')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
        
        if (studentRecord) {
          actualStudentId = studentRecord.id;
        }
      }

      if (!actualStudentId) {
        throw new Error('No student ID available');
      }

      // Fetch student details (including school_code for security filtering)
      const { data: student, error: studentError } = await supabase
        .from('student')
        .select(`
          id,
          full_name,
          class_instance_id,
          school_code,
          class_instances (
            id,
            grade,
            section,
            academic_year_id,
            academic_years (
              year_start,
              year_end
            )
          )
        `)
        .eq('id', actualStudentId)
        .single();

      if (studentError || !student) {
        log.error('Failed to fetch student:', studentError);
        throw new Error('Student not found');
      }

      // Fetch offline test marks - filter by school_code through tests join for security
      const { data: testMarks } = await supabase
        .from('test_marks')
        .select(`
          id,
          marks_obtained,
          max_marks,
          created_at,
          tests!inner (
            id,
            title,
            test_date,
            test_mode,
            subject_id,
            school_code,
            subjects (
              id,
              subject_name
            )
          )
        `)
        .eq('student_id', actualStudentId)
        .eq('tests.school_code', student.school_code); // Security: Filter by school_code

      // Fetch online test attempts - filter by school_code through tests join for security
      const { data: testAttempts } = await supabase
        .from('test_attempts')
        .select(`
          id,
          earned_points,
          total_points,
          completed_at,
          tests!inner (
            id,
            title,
            test_date,
            test_mode,
            subject_id,
            school_code,
            subjects (
              id,
              subject_name
            )
          )
        `)
        .eq('student_id', actualStudentId)
        .eq('status', 'completed')
        .eq('tests.school_code', student.school_code); // Security: Filter by school_code

      // Fetch attendance
      let attendance: AttendanceStats | null = null;
      if (student.class_instance_id) {
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', actualStudentId)
          .eq('class_instance_id', student.class_instance_id)
          .eq('school_code', student.school_code); // Security: Filter by school_code

        if (attendanceData && attendanceData.length > 0) {
          const present = attendanceData.filter(a => a.status === 'present').length;
          const absent = attendanceData.filter(a => a.status === 'absent').length;
          attendance = {
            present,
            absent,
            total: attendanceData.length,
            percentage: (present / attendanceData.length) * 100,
          };
        }
      }

      // Process all test results
      const allTests: TestResult[] = [];
      const subjectMap = new Map<string, TestResult[]>();

      // Process offline tests
      if (testMarks) {
        for (const mark of testMarks) {
          const test = mark.tests as any;
          if (!test) continue;
          
          const subject = test.subjects as any;
          const percentage = mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks) * 100 : 0;
          
          const testResult: TestResult = {
            id: test.id,
            title: test.title,
            date: test.test_date || mark.created_at,
            marks_obtained: mark.marks_obtained,
            max_marks: mark.max_marks,
            percentage,
            grade: getGrade(percentage),
            test_mode: 'offline',
            subject_name: subject?.subject_name || 'Unknown',
          };
          
          allTests.push(testResult);
          
          const subjectId = subject?.id || 'unknown';
          if (!subjectMap.has(subjectId)) {
            subjectMap.set(subjectId, []);
          }
          subjectMap.get(subjectId)!.push(testResult);
        }
      }

      // Process online tests
      if (testAttempts) {
        for (const attempt of testAttempts) {
          const test = attempt.tests as any;
          if (!test) continue;
          
          const subject = test.subjects as any;
          const totalPoints = attempt.total_points ?? 0;
          const earnedPoints = attempt.earned_points ?? 0;
          const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
          
          const testResult: TestResult = {
            id: test.id,
            title: test.title,
            date: test.test_date || attempt.completed_at,
            marks_obtained: earnedPoints,
            max_marks: totalPoints,
            percentage,
            grade: getGrade(percentage),
            test_mode: 'online',
            subject_name: subject?.subject_name || 'Unknown',
          };
          
          allTests.push(testResult);
          
          const subjectId = subject?.id || 'unknown';
          if (!subjectMap.has(subjectId)) {
            subjectMap.set(subjectId, []);
          }
          subjectMap.get(subjectId)!.push(testResult);
        }
      }

      // Calculate subject-wise progress
      const subjects: SubjectProgress[] = [];
      for (const [subjectId, tests] of subjectMap) {
        const totalPercentage = tests.reduce((sum, t) => sum + t.percentage, 0);
        const avgPercentage = tests.length > 0 ? totalPercentage / tests.length : 0;
        
        subjects.push({
          subject_id: subjectId,
          subject_name: tests[0]?.subject_name || 'Unknown',
          total_tests: tests.length,
          average_percentage: avgPercentage,
          grade: getGrade(avgPercentage),
          trend: getTrend(tests),
          tests: tests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        });
      }

      // Sort subjects alphabetically
      subjects.sort((a, b) => a.subject_name.localeCompare(b.subject_name));

      // Calculate overall stats
      const allPercentages = allTests.map(t => t.percentage);
      const now = new Date();
      const thisMonth = allTests.filter(t => {
        const testDate = new Date(t.date);
        return testDate.getMonth() === now.getMonth() && testDate.getFullYear() === now.getFullYear();
      });
      const lastMonth = allTests.filter(t => {
        const testDate = new Date(t.date);
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return testDate.getMonth() === lastMonthDate.getMonth() && testDate.getFullYear() === lastMonthDate.getFullYear();
      });

      const thisMonthAvg = thisMonth.length > 0 
        ? thisMonth.reduce((sum, t) => sum + t.percentage, 0) / thisMonth.length 
        : 0;
      const lastMonthAvg = lastMonth.length > 0 
        ? lastMonth.reduce((sum, t) => sum + t.percentage, 0) / lastMonth.length 
        : 0;
      
      const improvementRate = lastMonthAvg > 0 
        ? ((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100 
        : 0;

      const stats: ProgressStats = {
        total_tests: allTests.length,
        overall_average: allPercentages.length > 0 
          ? allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length 
          : 0,
        overall_grade: getGrade(
          allPercentages.length > 0 
            ? allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length 
            : 0
        ),
        highest_score: allPercentages.length > 0 ? Math.max(...allPercentages) : 0,
        lowest_score: allPercentages.length > 0 ? Math.min(...allPercentages) : 0,
        tests_this_month: thisMonth.length,
        improvement_rate: improvementRate,
        subjects_count: subjects.length,
      };

      // Get recent tests (last 5)
      const recentTests = [...allTests]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      // Extract class info
      const classInstance = student.class_instances as any;
      const academicYear = classInstance?.academic_years as any;

      return {
        student_id: student.id,
        student_name: student.full_name,
        class_info: classInstance ? {
          grade: classInstance.grade,
          section: classInstance.section,
        } : null,
        academic_year: academicYear ? `${academicYear.year_start}-${academicYear.year_end}` : null,
        stats,
        subjects,
        recent_tests: recentTests,
        attendance,
      };
    },
    enabled: !!(targetStudentId || user?.id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

