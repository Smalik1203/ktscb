import { log } from '../../lib/logger';

// Typed hook for Fees analytics using direct table queries

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type {
  AnalyticsQueryFilters,
  FeeRow,
  RankedRow,
  FeeAggregation,
  AgingBucket,
  FeeStatus,
} from '../../lib/analytics-table-types';
import { analyticsUtils } from '../../lib/analytics-utils';

// ==============================================================================
// FEES ANALYTICS HOOK
// ==============================================================================

interface UseFeesAnalyticsOptions extends AnalyticsQueryFilters {
  limit?: number; // For dashboard preview (top-N)
  classInstanceId?: string; // Optional: filter by specific class
}

export function useFeesAnalytics(options: UseFeesAnalyticsOptions) {
  const { school_code, academic_year_id, start_date, end_date, limit, classInstanceId } = options;

  return useQuery({
    queryKey: ['analytics', 'fees', school_code, academic_year_id, start_date, end_date, classInstanceId, limit],
    queryFn: async () => {
      // 1. Fetch fee data from student_fee_summary view (includes plan amounts and collected amounts)
      let feeQuery = supabase
        .from('student_fee_summary')
        .select('*')
        .not('student_id', 'is', null);

      // Note: student_fee_summary doesn't have school_code or academic_year_id directly
      // We need to filter by student_id from a students query first

      // First, get students in scope
      let studentsQuery = supabase
        .from('student')
        .select(`
          id,
          full_name,
          class_instance_id,
          school_code,
          class_instances!inner(
            id,
            grade,
            section,
            academic_year_id
          )
        `)
        .eq('school_code', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id);

      if (classInstanceId) {
        studentsQuery = studentsQuery.eq('class_instance_id', classInstanceId);
      }

      const { data: studentsData, error: studentsError } = await studentsQuery;

      if (studentsError) throw studentsError;
      if (!studentsData || studentsData.length === 0) {
        return {
          aggregation: {
            totalBilled: 0,
            totalCollected: 0,
            totalOutstanding: 0,
            realizationRate: 0,
            agingBreakdown: { current: 0, '30-60': 0, '60-90': 0, '90+': 0 },
            studentSummaries: [],
          },
          rankedRows: [],
        };
      }

      // 2. Fetch fee summary for these students
      const studentIds = studentsData.map((s: any) => s.id);

      const { data: feeSummaryData, error: feeError } = await supabase
        .from('student_fee_summary')
        .select('*')
        .in('student_id', studentIds);

      if (feeError) throw feeError;

      // 3. Fetch payment dates for lastPaymentDate tracking
      const { data: paymentsData } = await supabase
        .from('fee_payments')
        .select('student_id, created_at')
        .in('student_id', studentIds)
        .gte('created_at', new Date(start_date).toISOString())
        .lte('created_at', new Date(end_date).toISOString())
        .order('created_at', { ascending: false });

      // 4. Build last payment date map
      const lastPaymentMap = new Map<string, string>();
      paymentsData?.forEach((payment: any) => {
        if (!lastPaymentMap.has(payment.student_id)) {
          lastPaymentMap.set(payment.student_id, payment.created_at);
        }
      });

      // 5. Group fee summary by student (sum across all components)
      const studentFeeMap = new Map<string, { totalBilled: number; totalCollected: number; totalOutstanding: number }>();

      feeSummaryData?.forEach((feeSummary: any) => {
        const studentId = feeSummary.student_id;
        if (!studentFeeMap.has(studentId)) {
          studentFeeMap.set(studentId, { totalBilled: 0, totalCollected: 0, totalOutstanding: 0 });
        }
        const record = studentFeeMap.get(studentId)!;
        // Amounts are in paise, need to keep as-is for calculations
        record.totalBilled += feeSummary.plan_amount_inr || 0;
        record.totalCollected += feeSummary.collected_amount_inr || 0;
        record.totalOutstanding += feeSummary.outstanding_amount_inr || 0;
      });

      // 4. Helper function to calculate aging bucket
      const calculateAgingBucket = (dueDate: string | null): AgingBucket => {
        if (!dueDate) return 'current';

        const due = new Date(dueDate);
        const now = new Date();
        const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue < 0) return 'current';
        if (daysOverdue <= 30) return 'current';
        if (daysOverdue <= 60) return '30-60';
        if (daysOverdue <= 90) return '60-90';
        return '90+';
      };

      // Helper function to determine fee status
      const calculateFeeStatus = (totalBilled: number, totalPaid: number, dueDate: string | null): FeeStatus => {
        if (totalBilled === 0) return 'no_billing';
        if (totalPaid >= totalBilled) return 'paid';

        if (!dueDate) return 'current';

        const due = new Date(dueDate);
        const now = new Date();

        return now > due ? 'overdue' : 'current';
      };

      // 6. Build student rows with actual billing data
      const studentMap = new Map<string, FeeRow>();

      studentsData.forEach((student: any) => {
        const studentId = student.id;
        const studentName = student.full_name;
        const classInfo = student.class_instances;
        const className = classInfo?.grade !== null && classInfo?.grade !== undefined
          ? `Grade ${classInfo.grade}${classInfo.section ? ` - ${classInfo.section}` : ''}`
          : 'Unknown Class';

        const feeInfo = studentFeeMap.get(studentId) || { totalBilled: 0, totalCollected: 0, totalOutstanding: 0 };
        const dueDate = null; // Note: Due dates not available in current schema

        const agingBucket = calculateAgingBucket(dueDate);
        const agingDays = dueDate
          ? Math.max(0, Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        const status = calculateFeeStatus(feeInfo.totalBilled, feeInfo.totalCollected, dueDate);

        studentMap.set(studentId, {
          studentId,
          studentName,
          className,
          totalBilled: feeInfo.totalBilled,
          totalPaid: feeInfo.totalCollected,
          totalDue: feeInfo.totalOutstanding,
          status,
          agingDays,
          agingBucket,
          lastPaymentDate: lastPaymentMap.get(studentId) || null,
        });
      });

      // 7. Fetch previous period data (for trend) - using fee_summary as well
      const { startDate: prevStartDate, endDate: prevEndDate } = analyticsUtils.calculatePreviousPeriod(
        start_date,
        end_date
      );

      // For previous period, we'll use the current fee_summary totals but with previous payment data
      // This gives us a comparison of collection performance
      const { data: prevPaymentsData } = await supabase
        .from('fee_payments')
        .select('student_id, amount_inr')
        .in('student_id', studentIds)
        .gte('created_at', new Date(prevStartDate).toISOString())
        .lte('created_at', new Date(prevEndDate).toISOString());

      const prevPaymentMap = new Map<string, number>();
      prevPaymentsData?.forEach((payment: any) => {
        const studentId = payment.student_id;
        prevPaymentMap.set(studentId, (prevPaymentMap.get(studentId) || 0) + (payment.amount_inr || 0));
      });

      // 8. Build previous rows for trend comparison
      const currentRows = Array.from(studentMap.values());
      const previousRows = Array.from(prevPaymentMap.entries()).map(([studentId, totalPaid]): FeeRow => {
        const student = studentsData.find((s: any) => s.id === studentId);
        const feeInfo = studentFeeMap.get(studentId) || { totalBilled: 0, totalCollected: 0, totalOutstanding: 0 };
        const classInfo = student?.class_instances;
        const className = classInfo?.grade !== null && classInfo?.grade !== undefined
          ? `Grade ${classInfo.grade}${classInfo.section ? ` - ${classInfo.section}` : ''}`
          : 'Unknown Class';
        return {
          studentId,
          studentName: student?.full_name || '',
          className,
          totalBilled: feeInfo.totalBilled,
          totalPaid,
          totalDue: feeInfo.totalBilled - totalPaid,
          status: 'current',
          agingDays: 0,
          agingBucket: 'current',
          lastPaymentDate: null,
        };
      });

      const rankedRows = analyticsUtils.rankRowsWithTrend(
        currentRows,
        previousRows,
        (row) => row.studentId,
        (row) => row.totalDue,
        'desc'
      );

      // 8. Apply limit if specified
      const limitedRows = limit ? rankedRows.slice(0, limit) : rankedRows;

      // 9. Calculate aggregation metrics
      const totalBilled = analyticsUtils.calculateSum(currentRows.map((r) => r.totalBilled));
      const totalCollected = analyticsUtils.calculateSum(currentRows.map((r) => r.totalPaid));
      const totalOutstanding = totalBilled - totalCollected;
      const realizationRate = analyticsUtils.calculatePercentage(totalCollected, totalBilled);

      const agingBreakdown = {
        current: currentRows.filter((r) => r.agingBucket === 'current').length,
        '30-60': currentRows.filter((r) => r.agingBucket === '30-60').length,
        '60-90': currentRows.filter((r) => r.agingBucket === '60-90').length,
        '90+': currentRows.filter((r) => r.agingBucket === '90+').length,
      };

      const aggregation: FeeAggregation = {
        totalBilled,
        totalCollected,
        totalOutstanding,
        realizationRate,
        agingBreakdown,
        studentSummaries: currentRows,
      };

      return {
        aggregation,
        rankedRows: limitedRows,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!(school_code && school_code !== '') && typeof academic_year_id === 'string' && !!(start_date && start_date !== '') && !!(end_date && end_date !== ''),
  });
}
