import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCapabilities } from './useCapabilities';
import { useSuperAdminAnalytics, useStudentAggregatedAnalytics } from './analytics';
import type { TimePeriod, AnalyticsFeature, DateRange } from '../components/analytics/types';
import { getDateRangeForPeriod } from '../components/analytics/types';

export interface UseAnalyticsScreenReturn {
  // Data
  analyticsData: unknown;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  
  // State
  timePeriod: TimePeriod;
  selectedFeature: AnalyticsFeature;
  refreshing: boolean;
  dateRange: DateRange;
  
  // Computed
  canViewAnalytics: boolean;
  isSuperAdmin: boolean;
  isStudent: boolean;
  startDate: string;
  endDate: string;
  
  // Actions
  setTimePeriod: (period: TimePeriod) => void;
  setSelectedFeature: (feature: AnalyticsFeature) => void;
  setDateRange: (range: DateRange) => void;
  handleRefresh: () => Promise<void>;
  refetch: () => Promise<unknown>;
}

/**
 * Custom hook for analytics screen data and state management
 * Separates business logic from UI components
 */
export function useAnalyticsScreen(): UseAnalyticsScreenReturn {
  const { profile } = useAuth();
  const { can } = useCapabilities();
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriodState] = useState<TimePeriod>('week');
  const [selectedFeature, setSelectedFeature] = useState<AnalyticsFeature>('overview');
  
  // Initialize with default date range
  const [customDateRange, setCustomDateRange] = useState<DateRange>(() => 
    getDateRangeForPeriod('week')
  );

  // Capability-based computed values
  const canViewSchoolAnalytics = can('analytics.read_school');
  const canViewOwnAnalytics = can('analytics.read_own');
  
  const canViewAnalytics = useMemo(
    () => canViewSchoolAnalytics || canViewOwnAnalytics,
    [canViewSchoolAnalytics, canViewOwnAnalytics]
  );

  // isSuperAdmin = can view school-wide analytics
  const isSuperAdmin = useMemo(
    () => canViewSchoolAnalytics,
    [canViewSchoolAnalytics]
  );

  // isStudent = can only view own analytics (not school-wide)
  const isStudent = useMemo(() => canViewOwnAnalytics && !canViewSchoolAnalytics, [canViewOwnAnalytics, canViewSchoolAnalytics]);

  // Calculate date range based on time period or custom range
  const dateRange = useMemo(() => {
    if (timePeriod === 'custom') {
      return customDateRange;
    }
    return getDateRangeForPeriod(timePeriod);
  }, [timePeriod, customDateRange]);

  const { startDate, endDate } = dateRange;

  // Handle time period change
  const setTimePeriod = useCallback((period: TimePeriod) => {
    setTimePeriodState(period);
    if (period !== 'custom') {
      // Update custom date range to match preset for seamless switching
      setCustomDateRange(getDateRangeForPeriod(period));
    }
  }, []);

  // Handle custom date range change
  const setDateRange = useCallback((range: DateRange) => {
    setCustomDateRange(range);
    setTimePeriodState('custom');
  }, []);

  // Fetch analytics based on role
  const superAdminQuery = useSuperAdminAnalytics({
    timePeriod,
    classInstanceId: profile?.class_instance_id || undefined,
    customDateRange: timePeriod === 'custom' ? customDateRange : undefined,
  });

  const studentQuery = useStudentAggregatedAnalytics({
    timePeriod,
    customDateRange: timePeriod === 'custom' ? customDateRange : undefined,
  });

  // Select the appropriate query based on role
  // Admin uses superAdminQuery filtered to their class, SuperAdmin uses it for all classes
  const analyticsQuery = !canViewAnalytics 
    ? { data: null, isLoading: false, isFetching: false, error: null, refetch: async () => null }
    : isStudent
    ? studentQuery
    : superAdminQuery; // Both admin and superadmin use superAdminQuery

  // Safely extract query properties
  const analyticsData = analyticsQuery?.data ?? null;
  const isLoading = analyticsQuery?.isLoading ?? false;
  const isFetching = analyticsQuery?.isFetching ?? false;
  const error = (analyticsQuery?.error as Error | null) ?? null;
  const refetch = analyticsQuery?.refetch ?? (async () => null);

  // Memoized refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return {
    analyticsData,
    isLoading,
    isFetching,
    error,
    timePeriod,
    selectedFeature,
    refreshing,
    dateRange,
    canViewAnalytics,
    isSuperAdmin,
    isStudent,
    startDate,
    endDate,
    setTimePeriod,
    setSelectedFeature,
    setDateRange,
    handleRefresh,
    refetch,
  };
}
