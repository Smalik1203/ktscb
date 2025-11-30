// Typed hook for Operations analytics using direct table queries

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type {
  AnalyticsQueryFilters,
  OperationsRow,
  RankedRow,
  OperationsAggregation,
} from '../../lib/analytics-table-types';
import { analyticsUtils } from '../../lib/analytics-utils';

interface UseOperationsAnalyticsOptions extends AnalyticsQueryFilters {
  limit?: number;
  teacherId?: string;
}

export function useOperationsAnalytics(options: UseOperationsAnalyticsOptions) {
  const { school_code, academic_year_id, start_date, end_date, limit, teacherId } = options;

  return useQuery({
    queryKey: ['analytics', 'operations', school_code, academic_year_id, start_date, end_date, teacherId, limit],
    queryFn: async () => {
      // 1. Fetch timetable slots
      let slotsQuery = supabase
        .from('timetable_slots')
        .select(`
          id,
          teacher_id,
          period_number,
          class_date,
          is_conducted,
          subject_id,
          class_instance_id,
          created_at,
          admin!inner(id, full_name),
          subjects(id, name),
          class_instances!inner(
            id,
            grade,
            section,
            school_code,
            academic_year_id
          )
        `)
        .filter('class_instances.school_code', 'eq', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id)
        .gte('class_date', start_date)
        .lte('class_date', end_date);

      if (teacherId) slotsQuery = slotsQuery.eq('teacher_id', teacherId);

      const { data: slotsData, error: slotsError } = await slotsQuery;

      if (slotsError) throw slotsError;
      if (!slotsData || slotsData.length === 0) {
        return {
          aggregation: {
            totalTeachers: 0,
            totalPeriods: 0,
            conductedPeriods: 0,
            avgCoverage: 0,
            teacherSummaries: [],
          },
          rankedRows: [],
        };
      }

      // 2. Aggregate by teacher
      const teacherMap = new Map<string, OperationsRow>();

      slotsData.forEach((slot: any) => {
        const teacherId = slot.teacher_id;
        const teacherName = slot.admin?.full_name || 'Unknown Teacher';
        const isConducted = slot.is_conducted;
        const classId = slot.class_instance_id;
        const classInfo = slot.class_instances;
        const className = classInfo?.grade !== null && classInfo?.grade !== undefined
          ? `Grade ${classInfo.grade}${classInfo.section ? ` - ${classInfo.section}` : ''}`
          : 'Unknown Class';
        const subjectId = slot.subject_id;
        const subjectName = slot.subjects?.name || 'Unknown Subject';

        if (!teacherMap.has(teacherId)) {
          teacherMap.set(teacherId, {
            teacherId,
            teacherName,
            totalPeriods: 0,
            conductedPeriods: 0,
            coveragePercent: 0,
            classCount: 0,
            subjectCount: 0,
          });
        }

        const row = teacherMap.get(teacherId)!;
        row.totalPeriods++;
        if (isConducted) row.conductedPeriods++;
      });

      // 3. Calculate coverage percentages and unique counts
      teacherMap.forEach((row) => {
        row.coveragePercent = analyticsUtils.calculatePercentage(row.conductedPeriods, row.totalPeriods);

        // Count unique classes and subjects
        const teacherSlots = slotsData.filter((s: any) => s.teacher_id === row.teacherId);
        row.classCount = new Set(teacherSlots.map((s: any) => s.class_instance_id)).size;
        row.subjectCount = new Set(teacherSlots.map((s: any) => s.subject_id)).size;
      });

      // 4. Fetch previous period data for trend
      const { startDate: prevStartDate, endDate: prevEndDate } = analyticsUtils.calculatePreviousPeriod(
        start_date,
        end_date
      );

      let prevSlotsQuery = supabase
        .from('timetable_slots')
        .select(`
          teacher_id,
          is_conducted,
          class_instances!inner(school_code, academic_year_id)
        `)
        .filter('class_instances.school_code', 'eq', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id)
        .gte('class_date', prevStartDate)
        .lte('class_date', prevEndDate);

      if (teacherId) prevSlotsQuery = prevSlotsQuery.eq('teacher_id', teacherId);

      const { data: prevSlotsData } = await prevSlotsQuery;

      const prevMap = new Map<string, { total: number; conducted: number }>();

      prevSlotsData?.forEach((slot: any) => {
        const teacherId = slot.teacher_id;

        if (!prevMap.has(teacherId)) {
          prevMap.set(teacherId, { total: 0, conducted: 0 });
        }

        const stats = prevMap.get(teacherId)!;
        stats.total++;
        if (slot.is_conducted) stats.conducted++;
      });

      // 5. Rank rows with trends
      const currentRows = Array.from(teacherMap.values());
      const previousRows = Array.from(prevMap.entries()).map(([teacherId, stats]) => {
        const coveragePercent = analyticsUtils.calculatePercentage(stats.conducted, stats.total);
        return { teacherId, coveragePercent };
      });

      const rankedRows = analyticsUtils.rankRowsWithTrend(
        currentRows,
        previousRows,
        (row) => row.teacherId,
        (row) => row.coveragePercent,
        'desc'
      );

      const limitedRows = limit ? rankedRows.slice(0, limit) : rankedRows;

      // 6. Calculate aggregation
      const totalTeachers = teacherMap.size;
      const totalPeriods = analyticsUtils.calculateSum(currentRows.map((r) => r.totalPeriods));
      const conductedPeriods = analyticsUtils.calculateSum(currentRows.map((r) => r.conductedPeriods));
      const avgCoverage = analyticsUtils.calculateAverage(currentRows.map((r) => r.coveragePercent));

      const aggregation: OperationsAggregation = {
        totalTeachers,
        totalPeriods,
        conductedPeriods,
        avgCoverage,
        teacherSummaries: currentRows,
      };

      return { aggregation, rankedRows: limitedRows };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!(school_code && school_code !== '') && typeof academic_year_id === 'string' && !!(start_date && start_date !== '') && !!(end_date && end_date !== ''),
  });
}
