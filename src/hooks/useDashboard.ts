import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase as supabaseClient } from '../lib/supabase';
import { DB } from '../types/db.constants';

export interface DashboardStats {
  todaysClasses: number;
  attendancePercentage: number;
  pendingAssignments: number;
  achievements: number;
  totalStudents?: number;
  upcomingTests: number;
  weekAttendance: number;
  markedClassesCount?: number;
  totalClassesCount?: number;
  isPartialData?: boolean;
}

export interface RecentActivity {
  id: string;
  type: 'attendance' | 'assignment' | 'achievement' | 'test' | 'event' | 'task';
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

export interface DashboardBundle {
  stats: DashboardStats;
  recentActivity: RecentActivity[];
  upcomingEvents: UpcomingEvent[];
  feeOverview: FeeOverview;
  taskOverview: TaskOverview;
  syllabusOverview: SyllabusProgressOverview;
  classInfo: { classInstanceId: string; grade: number | null; section: string | null } | null;
}

const supabase = supabaseClient as any;

export function useDashboardBundle(userId?: string) {
  return useQuery({
    queryKey: ['dashboard-bundle', userId],
    queryFn: async (): Promise<DashboardBundle> => {
      if (!userId) {
        return {
          stats: {
            todaysClasses: 0,
            attendancePercentage: 0,
            pendingAssignments: 0,
            achievements: 0,
            totalStudents: 0,
            upcomingTests: 0,
            weekAttendance: 0,
          },
          recentActivity: [],
          upcomingEvents: [],
          feeOverview: { totalFee: 0, paidAmount: 0, pendingAmount: 0 },
          taskOverview: { total: 0, completed: 0, pending: 0, overdue: 0, dueThisWeek: 0 },
          syllabusOverview: { overallProgress: 0, totalSubjects: 0, subjectBreakdown: [] },
          classInfo: null,
        };
      }

      const { data, error } = await supabase.rpc('get_dashboard_bundle');
      if (error) throw error;

      return (data || {}) as DashboardBundle;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

export function useDashboardStats(userId: string, classInstanceId?: string, role?: string) {
  return useQuery({
    queryKey: ['dashboard-stats', userId, classInstanceId, role],
    queryFn: async (): Promise<DashboardStats> => {
      // For SuperAdmins without classInstanceId, fetch school-wide stats
      const isSuperAdmin = role === 'superadmin' && !classInstanceId;

      // Guard against invalid UUID values (but allow SuperAdmin without classInstanceId)
      if (!userId || (!classInstanceId && !isSuperAdmin)) {
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

      const now = new Date();
      // Adjust to local timezone
      const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
      const today = localDate.toISOString().split('T')[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      // Get user profile to get school_code for SuperAdmin
      const { data: profileData } = await supabase
        .from('users')
        .select('school_code')
        .eq('id', userId)  // Fixed: users table has 'id', not 'auth_id'
        .maybeSingle();

      const schoolCode = profileData?.school_code;

      // SUPERADMIN: Fetch school-wide consolidated data
      if (isSuperAdmin && schoolCode) {
        // First, get all class instances for this school
        const { data: classInstances } = await supabase
          .from('class_instances')
          .select('id')
          .eq('school_code', schoolCode);

        const classInstanceIds = classInstances?.map(ci => ci.id) || [];

        if (classInstanceIds.length === 0) {
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

        const [
          todaysClassesResult,
          tasksResult,
          upcomingTestsResult,
          studentsResult,
          attendanceResult,
        ] = await Promise.all([
          // All today's classes across the school
          supabase
            .from(DB.tables.timetableSlots)
            .select('class_instance_id') // Changed: Select class_instance_id to count unique classes
            .eq('class_date', today)
            .in('class_instance_id', classInstanceIds)
            .limit(1000),
          // All active tasks across the school
          supabase
            .from('tasks')
            .select('id')
            .eq('is_active', true)
            .in('class_instance_id', classInstanceIds)
            .limit(1000),
          // All upcoming tests school-wide
          supabase
            .from('tests')
            .select('id')
            .gte('test_date', today)
            .lte('test_date', nextWeekStr)
            .eq('status', 'active')
            .in('class_instance_id', classInstanceIds)
            .limit(1000),
          // Total students in the school
          supabase
            .from('student')
            .select('id', { count: 'exact', head: true })
            .eq('school_code', schoolCode)
            .limit(1),
          // School-wide attendance TODAY only - fetching class info to count marked classes
          supabase
            .from(DB.tables.attendance)
            .select('status, student!inner(school_code, class_instance_id)')
            .eq('date', today)
            .eq('student.school_code', schoolCode)
            .limit(10000),
        ]);

        // Calculate school-wide attendance percentage
        const totalAttendance = attendanceResult.data?.length || 0;
        const presentCount = attendanceResult.data?.filter(a => a.status === 'present').length || 0;
        const attendancePercentage = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

        // Completeness Check (User Requirement: Detect if all classes are marked)
        const scheduledData = todaysClassesResult.data || [];
        const attendanceData = attendanceResult.data || [];

        const scheduledClassIds = new Set(scheduledData.map((t: any) => t.class_instance_id).filter(Boolean));
        const markedClassIds = new Set(attendanceData.map((a: any) => a.student?.class_instance_id).filter(Boolean));

        const totalClassesCount = scheduledClassIds.size;
        const markedClassesCount = markedClassIds.size;
        // Logic: specific rule from user "If not all classes are marked" (marked < total)
        // Also ensure total > 0 to avoid showing badge when no classes scheduled
        const isPartialData = totalClassesCount > 0 && markedClassesCount < totalClassesCount;

        return {
          todaysClasses: todaysClassesResult.data?.length || 0, // Keep showing total slots count for 'Classes Scheduled'
          attendancePercentage,
          weekAttendance: 0,
          pendingAssignments: tasksResult.data?.length || 0,
          upcomingTests: upcomingTestsResult.data?.length || 0,
          achievements: 0,
          totalStudents: studentsResult.count || 0,
          markedClassesCount,
          totalClassesCount,
          isPartialData,
        };
      }

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
      const currentMonth = today.substring(0, 7);

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
            .eq('class_instance_id', classInstanceId!)
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
            .eq('class_instance_id', classInstanceId!)
            .eq('is_active', true),
          supabase
            .from('task_submissions')
            .select('task_id, status')
            .eq('student_id', studentId),
          supabase
            .from('tests')
            .select('id')
            .eq('class_instance_id', classInstanceId!)
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
            .eq('class_instance_id', classInstanceId!)
            .eq('class_date', today),
          supabase
            .from('tasks')
            .select('id')
            .eq('class_instance_id', classInstanceId!)
            .eq('is_active', true),
          supabase
            .from('tests')
            .select('id')
            .eq('class_instance_id', classInstanceId!)
            .gte('test_date', today)
            .lte('test_date', nextWeekStr)
            .eq('status', 'active'),
          supabase
            .from('student')
            .select('id', { count: 'exact', head: true })
            .eq('class_instance_id', classInstanceId!),
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
    // Enable for SuperAdmins without classInstanceId, or anyone with userId AND classInstanceId
    enabled: !!userId && (role === 'superadmin' || !!classInstanceId),
    staleTime: 5 * 60 * 1000, // 5 minutes (was 2 minutes - too aggressive)
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on every focus
    refetchOnMount: true,
    placeholderData: keepPreviousData, // Keep old data while fetching
  });
}

export function useRecentActivity(userId: string, classInstanceId?: string, role?: string) {
  return useQuery({
    queryKey: ['recent-activity', userId, classInstanceId, role],
    queryFn: async (): Promise<RecentActivity[]> => {
      // Guard against invalid UUID values
      if (!userId) {
        return [];
      }

      const activities: RecentActivity[] = [];

      // SUPERADMIN LOGIC
      if (role === 'superadmin') {
        // Get school code
        const { data: profileData } = await supabase
          .from('users')
          .select('school_code')
          .eq('id', userId)
          .maybeSingle();

        const schoolCode = (profileData as any)?.school_code;

        if (!schoolCode) return [];

        // 1. Get recent tasks across the school
        try {
          // First get class instances for this school to filter tasks
          const { data: classInstances } = await supabase
            .from('class_instances')
            .select('id')
            .eq('school_code', schoolCode);

          const classInstanceIds = classInstances?.map((c: any) => c.id) || [];

          if (classInstanceIds.length > 0) {
            const { data: tasksData } = await supabase
              .from('tasks')
              .select('id, title, due_date, created_at, subjects(subject_name), class_instance_id, class_instances(grade, section)')
              .in('class_instance_id', classInstanceIds)
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(5);

            (tasksData as any[])?.forEach((task: any) => {
              activities.push({
                id: task.id,
                type: 'task',
                title: `New Task: ${task.title}`,
                subtitle: `Class ${task.class_instances?.grade}-${task.class_instances?.section} • Due ${new Date(task.due_date).toLocaleDateString()}`,
                timestamp: task.created_at,
                icon: 'FileText',
                color: 'info',
              });
            });
          }
        } catch (e) {
          // Non-critical: skip tasks in activity feed
        }

        // 2. Get recent events
        try {
          const { data: eventsData } = await supabase
            .from('school_calendar_events')
            .select('id, title, start_date, event_type, created_at')
            .eq('school_code', schoolCode)
            .order('created_at', { ascending: false })
            .limit(3);

          (eventsData as any[])?.forEach((event: any) => {
            activities.push({
              id: event.id,
              type: 'event',
              title: `New Event: ${event.title}`,
              subtitle: `${event.event_type} • ${new Date(event.start_date).toLocaleDateString()}`,
              timestamp: event.created_at || new Date().toISOString(), // Fallback if created_at missing
              icon: 'Calendar',
              color: 'secondary'
            });
          });
        } catch (e) {
          // Non-critical: skip events in activity feed
        }

        // Return sorted activities
        return activities
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5);
      }

      // STUDENT LOGIC (Existing)
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

      // Get recent attendance records
      try {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from(DB.tables.attendance)
          .select('id, status, date, created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(2);

        if (!attendanceError && attendanceData) {
          (attendanceData as any[]).forEach(record => {
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
        // Non-critical: skip attendance in activity feed
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
            (tasksData as any[])?.forEach((task: any) => {
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
          // Non-critical: skip tasks in activity feed
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
          (testScoresData as any[]).forEach((score: any) => {
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
        // Non-critical: skip test scores in activity feed
      }

      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5); // Limit to 5 most recent
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
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

      // Get student ID and school_code from auth_user_id
      const { data: studentData } = await supabase
        .from('student')
        .select('id, school_code')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (!studentData) {
        return { totalFee: 0, paidAmount: 0, pendingAmount: 0 };
      }

      // Calculate totals from fee_invoices (source of truth)
      const { data: invoices } = await supabase
        .from('fee_invoices')
        .select('total_amount, paid_amount')
        .eq('student_id', studentData.id)
        .eq('school_code', studentData.school_code);

      const totalFee = (invoices || []).reduce(
        (sum: number, inv: any) => sum + (inv.total_amount || 0),
        0
      );
      const paidAmount = (invoices || []).reduce(
        (sum: number, inv: any) => sum + (inv.paid_amount || 0),
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
      const topicsBySyllabus = (allTopics || []).reduce((acc: Record<string, string[]>, topic: any) => {
        const syllabusId = chapterToSyllabusMap.get(topic.chapter_id);
        if (syllabusId) {
          const syllabusKey = String(syllabusId);
          if (!acc[syllabusKey]) acc[syllabusKey] = [];
          acc[syllabusKey].push(topic.id);
        }
        return acc;
      }, {} as Record<string, string[]>);

      // Build subject progress (all in memory - no more queries!)
      const subjectProgress = subjects.map((subject: any) => {
        const syllabusId = syllabusMap.get(subject.id);
        const syllabusKey = syllabusId ? String(syllabusId) : '';
        const subjectKey = String(subject.id);
        const totalTopics = syllabusKey ? (topicsBySyllabus[syllabusKey]?.length || 0) : 0;
        const completedTopics = (allProgressBySubject[subjectKey]?.size || 0);
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
    refetchOnMount: true,
  });
}

