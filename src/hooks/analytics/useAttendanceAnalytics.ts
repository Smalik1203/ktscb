// Typed hook for Attendance analytics using direct table queries

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type {
  AnalyticsQueryFilters,
  AttendanceRow,
  RankedRow,
  AttendanceAggregation,
} from '../../lib/analytics-table-types';
import { analyticsUtils } from '../../lib/analytics-utils';

// ==============================================================================
// ATTENDANCE ANALYTICS HOOK
// ==============================================================================

interface UseAttendanceAnalyticsOptions extends AnalyticsQueryFilters {
  limit?: number; // For dashboard preview (top-N)
  classInstanceId?: string; // Optional: filter by specific class
}

export function useAttendanceAnalytics(options: UseAttendanceAnalyticsOptions) {
  const { school_code, academic_year_id, start_date, end_date, limit, classInstanceId } = options;

  return useQuery({
    queryKey: ['analytics', 'attendance', school_code, academic_year_id, start_date, end_date, classInstanceId, limit],
    queryFn: async () => {
      // 1. Fetch current period attendance data
      let currentQuery = supabase
        .from('attendance')
        .select(`
          id,
          class_instance_id,
          student_id,
          date,
          status,
          created_at,
          class_instances!inner(
            id,
            grade,
            section,
            school_code,
            academic_year_id,
            class_id
          )
        `)
        .filter('class_instances.school_code', 'eq', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id)
        .gte('date', start_date)
        .lte('date', end_date);

      // Apply optional class filter
      if (classInstanceId) {
        currentQuery = currentQuery.eq('class_instance_id', classInstanceId);
      }

      const { data: currentData, error: currentError } = await currentQuery;

      if (currentError) throw currentError;
      if (!currentData || currentData.length === 0) {
        return {
          aggregation: {
            totalClasses: 0,
            totalPresent: 0,
            totalAbsent: 0,
            avgRate: 0,
            classSummaries: [],
          },
          rankedRows: [],
        };
      }

      // 2. Fetch previous period data for trend calculation
      const { startDate: prevStartDate, endDate: prevEndDate } = analyticsUtils.calculatePreviousPeriod(
        start_date,
        end_date
      );

      let prevQuery = supabase
        .from('attendance')
        .select(`
          id,
          class_instance_id,
          status,
          class_instances!inner(
            school_code,
            academic_year_id
          )
        `)
        .filter('class_instances.school_code', 'eq', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id)
        .gte('date', prevStartDate)
        .lte('date', prevEndDate);

      if (classInstanceId) {
        prevQuery = prevQuery.eq('class_instance_id', classInstanceId);
      }

      const { data: prevData } = await prevQuery;

      // 3. Aggregate by class
      const classMap = new Map<string, AttendanceRow>();

      currentData.forEach((record: any) => {
        const classId = record.class_instance_id;
        const classInfo = record.class_instances;
        const className = classInfo?.grade !== null && classInfo?.grade !== undefined
          ? `Grade ${classInfo.grade}${classInfo.section ? ` - ${classInfo.section}` : ''}`
          : 'Unknown Class';

        if (!classMap.has(classId)) {
          classMap.set(classId, {
            classId,
            className,
            presentCount: 0,
            totalCount: 0,
            rate: 0,
            lastUpdated: record.date,
          });
        }

        const row = classMap.get(classId)!;
        row.totalCount++;
        if (record.status === 'present') row.presentCount++;
        if (record.date > row.lastUpdated) row.lastUpdated = record.date;
      });

      // 4. Calculate rates for current period
      classMap.forEach((row) => {
        row.rate = analyticsUtils.calculatePercentage(row.presentCount, row.totalCount);
      });

      // 5. Build previous period map for trend calculation
      const prevClassMap = new Map<string, { present: number; total: number }>();

      prevData?.forEach((record: any) => {
        const classId = record.class_instance_id;

        if (!prevClassMap.has(classId)) {
          prevClassMap.set(classId, { present: 0, total: 0 });
        }

        const stats = prevClassMap.get(classId)!;
        stats.total++;
        if (record.status === 'present') stats.present++;
      });

      // 6. Calculate rates for previous period
      const prevRates = new Map<string, number>();
      prevClassMap.forEach((stats, classId) => {
        const rate = analyticsUtils.calculatePercentage(stats.present, stats.total);
        prevRates.set(classId, rate);
      });

      // 7. Rank rows with trends
      const currentRows = Array.from(classMap.values());
      const previousRows = Array.from(prevRates.entries()).map(([classId, rate]) => ({
        classId,
        rate,
      }));

      const rankedRows = analyticsUtils.rankRowsWithTrend(
        currentRows,
        previousRows,
        (row) => row.classId,
        (row) => row.rate,
        'desc'
      );

      // 8. Apply limit if specified (for dashboard preview)
      const limitedRows = limit ? rankedRows.slice(0, limit) : rankedRows;

      // 9. Calculate aggregation metrics
      const aggregation: AttendanceAggregation = {
        totalClasses: classMap.size,
        totalPresent: currentData.filter((r: any) => r.status === 'present').length,
        totalAbsent: currentData.filter((r: any) => r.status === 'absent').length,
        avgRate: analyticsUtils.calculateAverage(currentRows.map((r) => r.rate)),
        classSummaries: currentRows,
      };

      return {
        aggregation,
        rankedRows: limitedRows,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!(school_code && school_code !== '') && typeof academic_year_id === 'string' && !!(start_date && start_date !== '') && !!(end_date && end_date !== ''),
  });
}

// ==============================================================================
// STUDENT-LEVEL ATTENDANCE ANALYTICS
// ==============================================================================

interface UseStudentAttendanceAnalyticsOptions extends AnalyticsQueryFilters {
  studentId: string;
}

export function useStudentAttendanceAnalytics(options: UseStudentAttendanceAnalyticsOptions) {
  const { school_code, academic_year_id, start_date, end_date, studentId } = options;

  return useQuery({
    queryKey: ['analytics', 'attendance', 'student', studentId, start_date, end_date],
    queryFn: async () => {
      // 1. Fetch student's attendance data
      const { data: currentData, error: currentError } = await supabase
        .from('attendance')
        .select(`
          id,
          date,
          status,
          created_at,
          class_instances!inner(
            grade,
            section,
            school_code,
            academic_year_id
          )
        `)
        .eq('student_id', studentId)
        .filter('class_instances.school_code', 'eq', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id)
        .gte('date', start_date)
        .lte('date', end_date)
        .order('date', { ascending: true });

      if (currentError) throw currentError;

      // 2. Fetch previous period data
      const { startDate: prevStartDate, endDate: prevEndDate } = analyticsUtils.calculatePreviousPeriod(
        start_date,
        end_date
      );

      const { data: prevData } = await supabase
        .from('attendance')
        .select('id, status')
        .eq('student_id', studentId)
        .gte('date', prevStartDate)
        .lte('date', prevEndDate);

      // 3. Calculate metrics
      const presentCount = currentData?.filter((r) => r.status === 'present').length || 0;
      const totalCount = currentData?.length || 0;
      const currentRate = analyticsUtils.calculatePercentage(presentCount, totalCount);

      const prevPresentCount = prevData?.filter((r) => r.status === 'present').length || 0;
      const prevTotalCount = prevData?.length || 0;
      const prevRate = analyticsUtils.calculatePercentage(prevPresentCount, prevTotalCount);

      const trend = analyticsUtils.calculateTrend(currentRate, prevRate);

      // 4. Group by week for trend chart
      const weeklyData = analyticsUtils.groupByPeriod(currentData || [], 'date', 'week');
      const weeklyTrend = Object.entries(weeklyData).map(([week, records]) => {
        const present = records.filter((r: any) => r.status === 'present').length;
        const total = records.length;
        const rate = analyticsUtils.calculatePercentage(present, total);

        return {
          week,
          presentCount: present,
          totalCount: total,
          rate,
        };
      });

      return {
        presentCount,
        totalCount,
        rate: currentRate,
        trend,
        weeklyTrend,
        records: currentData || [],
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!(studentId && studentId !== '') && !!(school_code && school_code !== '') && typeof academic_year_id === 'string' && !!(start_date && start_date !== '') && !!(end_date && end_date !== ''),
  });
}
