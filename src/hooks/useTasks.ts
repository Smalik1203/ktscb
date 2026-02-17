import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Task {
  id: string;
  school_code: string;
  academic_year_id: string | null;
  class_instance_id: string | null;
  subject_id: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_date: string;
  due_date: string;
  max_marks: number | null;
  attachments: {
    bucket: string;
    path: string;
    name: string;
    size: number;
    mime: string;
  }[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Relations
  subjects?: { subject_name: string };
  class_instances?: { grade: number; section: string };
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string | null;
  attachments: {
    bucket: string;
    path: string;
    name: string;
    size: number;
    mime: string;
  }[];
  submitted_at: string;
  status: 'submitted' | 'graded' | 'returned' | 'late';
  marks_obtained: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
}

interface TaskFilters {
  classInstanceId?: string;
  subjectId?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Fetch tasks for admin/teacher (all tasks for school)
 */
export function useTasks(schoolCode: string, filters?: TaskFilters) {
  return useQuery({
    queryKey: ['tasks', schoolCode, filters],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          subjects(subject_name),
          class_instances(grade, section)
        `)
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .order('due_date', { ascending: true })
        .limit(200);

      if (filters?.classInstanceId) {
        query = query.eq('class_instance_id', filters.classInstanceId);
      }
      if (filters?.subjectId) {
        query = query.eq('subject_id', filters.subjectId);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.startDate) {
        query = query.gte('assigned_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('due_date', filters.endDate);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!schoolCode,
  });
}

/**
 * Fetch tasks for a student (their class only)
 */
export function useStudentTasks(studentId: string) {
  return useQuery({
    queryKey: ['student-tasks', studentId],
    queryFn: async () => {
      // First get student's class
      const { data: student, error: studentError } = await supabase
        .from('student')
        .select('class_instance_id, school_code')
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;
      if (!student?.school_code) {
        throw new Error('Student school code not found');
      }

      const studentSchoolCode = student.school_code;

      // Then get tasks for that class
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          subjects(subject_name),
          class_instances(grade, section)
        `)
        .eq('school_code', studentSchoolCode)
        .eq('class_instance_id', student.class_instance_id || '')
        .eq('is_active', true)
        .order('due_date', { ascending: true })
        .limit(100);

      if (tasksError) throw tasksError;

      // Get submission status for each task
      const { data: submissions, error: submissionsError } = await supabase
        .from('task_submissions')
        .select('task_id, status, submitted_at')
        .eq('student_id', studentId)
        .limit(200);

      if (submissionsError) throw submissionsError;

      // Merge tasks with submission status
      const submissionMap = new Map(
        submissions?.map(s => [s.task_id, s]) || []
      );

      return (tasks as Task[]).map(task => ({
        ...task,
        submission: submissionMap.get(task.id) || null,
      }));
    },
    enabled: !!studentId,
  });
}

/**
 * Get single task by ID
 */
export function useTask(taskId: string) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          subjects(subject_name),
          class_instances(grade, section)
        `)
        .eq('id', taskId)
        .single();

      if (error) throw error;
      return data as Task;
    },
    enabled: !!taskId,
  });
}

/**
 * Get task statistics
 */
export function useTaskStats(schoolCode: string, classInstanceId?: string) {
  return useQuery({
    queryKey: ['task-stats', schoolCode, classInstanceId],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('priority, due_date, assigned_date')
        .eq('school_code', schoolCode)
        .eq('is_active', true);

      if (classInstanceId) {
        query = query.eq('class_instance_id', classInstanceId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      
      const stats = {
        total: data.length,
        byPriority: {} as Record<string, number>,
        overdue: 0,
        dueToday: 0,
        upcoming: 0,
      };

      data.forEach(task => {
        // Count by priority
        if (task.priority) {
          stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
        }
        
        // Count by due date
        if (task.due_date < today) {
          stats.overdue++;
        } else if (task.due_date === today) {
          stats.dueToday++;
        } else {
          stats.upcoming++;
        }
      });

      return stats;
    },
    enabled: !!schoolCode,
  });
}

/**
 * Create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
      // Sanitize UUID fields - convert empty strings and undefined to null
      const sanitizeUUID = (value: any): string | null => {
        if (!value || value === '' || value === 'undefined') return null;
        return value;
      };

      const sanitizedData = {
        ...taskData,
        academic_year_id: sanitizeUUID(taskData.academic_year_id),
        class_instance_id: sanitizeUUID(taskData.class_instance_id),
        subject_id: sanitizeUUID(taskData.subject_id),
        created_by: sanitizeUUID(taskData.created_by),
      };

      // Validate required UUID field
      if (!sanitizedData.created_by) {
        throw new Error('User ID (created_by) is required to create a task. Please ensure you are logged in.');
      }

      // Ensure created_by is a string (not null) for the insert
      const insertData = {
        ...sanitizedData,
        created_by: sanitizedData.created_by, // TypeScript now knows this is not null due to check above
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([insertData])
        .select('id, school_code, academic_year_id, class_instance_id, subject_id, title, description, priority, assigned_date, due_date, max_marks, instructions, attachments, is_active, created_by, created_at, updated_at')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
    },
  });
}

/**
 * Update a task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...taskData }: Partial<Task> & { id: string }) => {
      // Sanitize UUID fields - convert empty strings and undefined to null
      const sanitizeUUID = (value: any): string | null | undefined => {
        if (value === '' || value === 'undefined') return null;
        return value;
      };

      const sanitizedData = {
        ...taskData,
        academic_year_id: sanitizeUUID(taskData.academic_year_id),
        class_instance_id: sanitizeUUID(taskData.class_instance_id),
        subject_id: sanitizeUUID(taskData.subject_id),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('tasks')
        .update(sanitizedData)
        .eq('id', id)
        .select('id, school_code, academic_year_id, class_instance_id, subject_id, title, description, priority, assigned_date, due_date, max_marks, instructions, attachments, is_active, created_by, created_at, updated_at')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

/**
 * Delete a task (soft delete)
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
    },
  });
}

/**
 * Submit a task (student)
 */
export function useSubmitTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionData: Omit<TaskSubmission, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('task_submissions')
        .upsert(
          {
            task_id: submissionData.task_id,
            student_id: submissionData.student_id,
            submission_text: submissionData.submission_text,
            attachments: submissionData.attachments,
            status: submissionData.status,
            submitted_at: submissionData.submitted_at,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'task_id,student_id' }
        )
        .select('id, task_id, student_id, submission_text, attachments, submitted_at, marks_obtained, max_marks, feedback, status, graded_by, graded_at, created_at, updated_at')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['task-overview'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
    },
  });
}

/**
 * Unsubmit a task (delete submission)
 * Only works if task hasn't been graded yet
 */
export function useUnsubmitTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, studentId }: { 
      taskId: string; 
      studentId: string;
    }) => {
      // Delete the submission
      const { error } = await supabase
        .from('task_submissions')
        .delete()
        .eq('task_id', taskId)
        .eq('student_id', studentId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['task-overview'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
    },
  });
}

/**
 * Get submissions for a task (teacher view)
 * Fetches students in the task's class with their submission status (paginated)
 */
export function useTaskSubmissions(taskId: string, options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 50; // Default to 50 (was unlimited)
  const offset = options?.offset ?? 0;
  
  return useQuery({
    queryKey: ['task-submissions', taskId, limit, offset],
    queryFn: async () => {
      // First, get the task to find the class_instance_id
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('class_instance_id')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      
      // If task has no class assigned, return empty array
      if (!task?.class_instance_id) {
        return [];
      }

      // Get paginated students in the class with their submission status
      const { data: students, error: studentsError } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .eq('class_instance_id', task.class_instance_id)
        .order('full_name')
        .range(offset, offset + limit - 1);

      if (studentsError) throw studentsError;

      // Get all submissions for this task (for the paginated students)
      const studentIds = students?.map(s => s.id) || [];
      let submissions: any[] = [];
      
      if (studentIds.length > 0) {
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('task_submissions')
          .select('id, task_id, student_id, submission_text, submitted_at, marks_obtained, max_marks, feedback, status')
          .eq('task_id', taskId)
          .in('student_id', studentIds);

        if (submissionsError) throw submissionsError;
        submissions = submissionsData || [];
      }

      // Create a map of submissions by student_id
      const submissionMap = new Map(
        submissions?.map(s => [s.student_id, s]) || []
      );

      // Merge students with their submission status
      return students?.map(student => {
        const submission = submissionMap.get(student.id);
        return {
          id: submission?.id || `no-sub-${student.id}`,
          student_id: student.id,
          task_id: taskId,
          status: submission?.status || 'not_submitted',
          submitted_at: submission?.submitted_at || null,
          marks_obtained: submission?.marks_obtained || null,
          max_marks: submission?.max_marks || null,
          submission_text: submission?.submission_text || null,
          feedback: submission?.feedback || null,
          student: {
            id: student.id,
            full_name: student.full_name,
            student_code: student.student_code,
          },
        };
      }) || [];
    },
    enabled: !!taskId,
  });
}
