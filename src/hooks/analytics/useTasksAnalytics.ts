// Typed hook for Tasks analytics using direct table queries

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type {
  AnalyticsQueryFilters,
  TaskRow,
  RankedRow,
  TaskAggregation,
  TaskStatus,
} from '../../lib/analytics-table-types';
import { analyticsUtils } from '../../lib/analytics-utils';

interface UseTasksAnalyticsOptions extends AnalyticsQueryFilters {
  limit?: number;
  classInstanceId?: string;
}

export function useTasksAnalytics(options: UseTasksAnalyticsOptions) {
  const { school_code, academic_year_id, start_date, end_date, limit, classInstanceId } = options;

  return useQuery({
    queryKey: ['analytics', 'tasks', school_code, academic_year_id, start_date, end_date, classInstanceId, limit],
    queryFn: async () => {
      // 1. Fetch tasks
      let tasksQuery = supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          due_date,
          subject_id,
          class_instance_id,
          created_at,
          subjects(id, name),
          class_instances!inner(
            id,
            grade,
            section,
            school_code,
            academic_year_id,
            students:student(count)
          )
        `)
        .filter('class_instances.school_code', 'eq', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id)
        .gte('due_date', start_date)
        .lte('due_date', end_date);

      if (classInstanceId) tasksQuery = tasksQuery.eq('class_instance_id', classInstanceId);

      const { data: tasksData, error: tasksError } = await tasksQuery;

      if (tasksError) throw tasksError;
      if (!tasksData || tasksData.length === 0) {
        return {
          aggregation: {
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            overdueTasks: 0,
            avgOnTimeRate: 0,
            taskSummaries: [],
          },
          rankedRows: [],
        };
      }

      // 2. Fetch task submissions
      const taskIds = tasksData.map((t: any) => t.id);

      const { data: submissionsData, error: submissionsError } = await supabase
        .from('task_submissions')
        .select('id, task_id, student_id, submitted_at, created_at')
        .in('task_id', taskIds);

      if (submissionsError) throw submissionsError;

      // 3. Aggregate by task
      const taskMap = new Map<string, TaskRow>();

      tasksData.forEach((task: any) => {
        const taskId = task.id;
        const taskName = task.title;
        const classId = task.class_instance_id;
        const classInfo = task.class_instances;
        const className = classInfo?.grade !== null && classInfo?.grade !== undefined
          ? `Grade ${classInfo.grade}${classInfo.section ? ` - ${classInfo.section}` : ''}`
          : 'Unknown Class';
        const subjectId = task.subject_id;
        const subjectName = task.subjects.name;
        const dueDate = task.due_date;
        const totalStudents = task.class_instances.students?.[0]?.count || 0;

        const submissions = submissionsData?.filter((s: any) => s.task_id === taskId) || [];
        const submittedCount = submissions.length;
        const onTimeCount = submissions.filter((s: any) => s.submitted_at <= dueDate).length;
        const onTimeRate = analyticsUtils.calculatePercentage(onTimeCount, submittedCount);

        const now = new Date();
        const due = new Date(dueDate);
        let status: TaskStatus = 'pending';

        if (submittedCount >= totalStudents) {
          status = 'completed';
        } else if (now > due) {
          status = 'overdue';
        }

        taskMap.set(taskId, {
          taskId,
          taskName,
          classId,
          className,
          subjectId,
          subjectName,
          dueDate,
          totalStudents,
          submittedCount,
          onTimeCount,
          onTimeRate,
          status,
        });
      });

      // 4. Fetch previous period data for trend
      const { startDate: prevStartDate, endDate: prevEndDate } = analyticsUtils.calculatePreviousPeriod(
        start_date,
        end_date
      );

      let prevTasksQuery = supabase
        .from('tasks')
        .select(`
          id,
          due_date,
          class_instances!inner(school_code, academic_year_id)
        `)
        .filter('class_instances.school_code', 'eq', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id)
        .gte('due_date', prevStartDate)
        .lte('due_date', prevEndDate);

      if (classInstanceId) prevTasksQuery = prevTasksQuery.eq('class_instance_id', classInstanceId);

      const { data: prevTasksData } = await prevTasksQuery;

      if (prevTasksData && prevTasksData.length > 0) {
        const prevTaskIds = prevTasksData.map((t: any) => t.id);

        const { data: prevSubmissionsData } = await supabase
          .from('task_submissions')
          .select('task_id, submitted_at')
          .in('task_id', prevTaskIds);

        const prevMap = new Map<string, number>();

        prevTasksData.forEach((task: any) => {
          const submissions = prevSubmissionsData?.filter((s: any) => s.task_id === task.id) || [];
          const onTimeCount = submissions.filter((s: any) => s.submitted_at <= task.due_date).length;
          const onTimeRate = analyticsUtils.calculatePercentage(onTimeCount, submissions.length);
          prevMap.set(task.id, onTimeRate);
        });

        // 5. Rank rows with trends (by on-time rate)
        const currentRows = Array.from(taskMap.values());
        const previousRows = Array.from(prevMap.entries()).map(([taskId, onTimeRate]) => ({
          taskId,
          onTimeRate,
        }));

        const rankedRows = analyticsUtils.rankRowsWithTrend(
          currentRows,
          previousRows,
          (row) => row.taskId,
          (row) => row.onTimeRate,
          'desc'
        );

        const limitedRows = limit ? rankedRows.slice(0, limit) : rankedRows;

        // 6. Calculate aggregation
        const completedTasks = currentRows.filter((r) => r.status === 'completed').length;
        const pendingTasks = currentRows.filter((r) => r.status === 'pending').length;
        const overdueTasks = currentRows.filter((r) => r.status === 'overdue').length;

        const aggregation: TaskAggregation = {
          totalTasks: currentRows.length,
          completedTasks,
          pendingTasks,
          overdueTasks,
          avgOnTimeRate: analyticsUtils.calculateAverage(currentRows.map((r) => r.onTimeRate)),
          taskSummaries: currentRows,
        };

        return { aggregation, rankedRows: limitedRows };
      }

      // No previous data
      const currentRows = Array.from(taskMap.values());
      const rankedRows = currentRows.map((row, index) => ({
        rank: index + 1,
        data: row,
        trend: analyticsUtils.calculateTrend(row.onTimeRate, row.onTimeRate),
      }));

      const limitedRows = limit ? rankedRows.slice(0, limit) : rankedRows;

      const aggregation: TaskAggregation = {
        totalTasks: currentRows.length,
        completedTasks: currentRows.filter((r) => r.status === 'completed').length,
        pendingTasks: currentRows.filter((r) => r.status === 'pending').length,
        overdueTasks: currentRows.filter((r) => r.status === 'overdue').length,
        avgOnTimeRate: analyticsUtils.calculateAverage(currentRows.map((r) => r.onTimeRate)),
        taskSummaries: currentRows,
      };

      return { aggregation, rankedRows: limitedRows };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!(school_code && school_code !== '') && typeof academic_year_id === 'string' && !!(start_date && start_date !== '') && !!(end_date && end_date !== ''),
  });
}
