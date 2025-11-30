import React, { useMemo, useCallback } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { BarChart3, Users, DollarSign, Calendar, Target, ChevronLeft } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { SuperAdminAnalytics, TimePeriod, AnalyticsFeature } from '../types';
import { AttendanceDetailView, FeesDetailView, LearningDetailView, SyllabusProgressDetailView } from '../features';
import { SummaryCard, CategoryCards, EmptyState, LoadingState, TimePeriodFilter } from '../shared';
import { formatDateRange } from '../../../utils/analytics.utils';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/types';

export interface SuperAdminDashboardProps {
  data: SuperAdminAnalytics;
  isLoading: boolean;
  isFetching: boolean;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  startDate: string;
  endDate: string;
  dateRange: { startDate: string; endDate: string };
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
  selectedFeature: AnalyticsFeature;
  setSelectedFeature: (feature: AnalyticsFeature) => void;
}

/**
 * Super Admin Dashboard Component
 * Memoized to prevent unnecessary re-renders
 */
export const SuperAdminDashboard = React.memo<SuperAdminDashboardProps>(({
  data,
  isLoading,
  isFetching,
  timePeriod,
  setTimePeriod,
  startDate,
  endDate,
  dateRange,
  onDateRangeChange,
  selectedFeature,
  setSelectedFeature,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const hasData = useMemo(
    () => data?.summary?.totalStudents > 0,
    [data?.summary?.totalStudents]
  );

  const attendanceRate = useMemo(
    () => data?.attendance?.avgRate || 0,
    [data?.attendance?.avgRate]
  );

  const getAttendanceColor = useCallback((rate: number) => {
    if (rate >= 90) return colors.success[600];
    if (rate >= 80) return colors.warning[600];
    return colors.error[600];
  }, [colors]);

  const categoryCards = useMemo(() => {
    if (!hasData) return [];
    
    return [
      {
        id: 'attendance' as AnalyticsFeature,
        title: 'Attendance',
        metric: `${Math.round(attendanceRate)}%`,
        subtext: 'Avg attendance rate',
        icon: Users,
        iconColor: colors.success[600],
        iconBackgroundColor: colors.success[50],
        metricColor: getAttendanceColor(attendanceRate),
        onPress: () => setSelectedFeature('attendance'),
      },
      {
        id: 'fees' as AnalyticsFeature,
        title: 'Fee Collection',
        metric: `${Math.round(data?.fees?.realizationRate || 0)}%`,
        subtext: 'Realization rate',
        icon: DollarSign,
        iconColor: colors.primary[600],
        iconBackgroundColor: colors.primary[50],
        metricColor: colors.primary[600],
        onPress: () => setSelectedFeature('fees'),
      },
      {
        id: 'learning' as AnalyticsFeature,
        title: 'Learning',
        metric: `${Math.round(data?.academics?.participationRate || 0)}%`,
        subtext: 'Test participation',
        icon: Target,
        iconColor: colors.info[600],
        iconBackgroundColor: colors.info[50],
        metricColor: colors.info[600],
        onPress: () => setSelectedFeature('learning'),
      },
      {
        id: 'operations' as AnalyticsFeature,
        title: 'Syllabus Progress',
        metric: `${Math.round(data?.syllabus?.overallProgress || 0)}%`,
        subtext: 'Overall completion',
        icon: Calendar,
        iconColor: colors.warning[600],
        iconBackgroundColor: colors.warning[50],
        metricColor: colors.warning[600],
        onPress: () => setSelectedFeature('operations'),
      },
    ];
  }, [hasData, attendanceRate, data, colors, getAttendanceColor, setSelectedFeature]);

  const handleBackPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedFeature('overview');
  }, [setSelectedFeature]);

  const handleCategoryPress = useCallback((onPress: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, []);

  const renderFeatureView = useCallback(() => {
    const content = (() => {
      switch (selectedFeature) {
        case 'attendance':
          return <AttendanceDetailView data={data} timePeriod={timePeriod} setTimePeriod={setTimePeriod} dateRange={dateRange} onDateRangeChange={onDateRangeChange} />;
        case 'fees':
          return <FeesDetailView data={data} timePeriod={timePeriod} setTimePeriod={setTimePeriod} dateRange={dateRange} onDateRangeChange={onDateRangeChange} />;
        case 'learning':
          return <LearningDetailView data={data} timePeriod={timePeriod} setTimePeriod={setTimePeriod} dateRange={dateRange} onDateRangeChange={onDateRangeChange} />;
        case 'operations':
          return <SyllabusProgressDetailView data={data} timePeriod={timePeriod} setTimePeriod={setTimePeriod} dateRange={dateRange} onDateRangeChange={onDateRangeChange} />;
        default:
          return null;
      }
    })();

    return (
      <>
        {isFetching && (
          <View style={styles.topFetchingBar}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.topFetchingText}>
              Loading {timePeriod} data...
            </Text>
          </View>
        )}
        <View style={[isFetching && styles.fetchingContent]}>
          {content}
        </View>
      </>
    );
  }, [selectedFeature, data, timePeriod, setTimePeriod, dateRange, onDateRangeChange, isFetching, styles, colors]);

  const getFeatureTitle = useCallback(() => {
    switch (selectedFeature) {
      case 'attendance':
        return 'Attendance Analytics';
      case 'fees':
        return 'Fee Collection Analytics';
      case 'learning':
        return 'Learning Analytics';
      case 'operations':
        return 'Syllabus Progress Analytics';
      default:
        return '';
    }
  }, [selectedFeature]);

  if (isLoading && !data) {
    return <LoadingState />;
  }

  if (!hasData && !isFetching) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon={BarChart3}
          title="No Analytics Data Yet"
          message="Analytics will appear here once students start using the system. Data refreshes automatically each day."
        />
      </View>
    );
  }

  if (selectedFeature === 'overview') {
    return (
      <View style={styles.container}>
        {isFetching && (
          <View style={styles.topFetchingBar}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.topFetchingText}>
              Loading {timePeriod} data...
            </Text>
          </View>
        )}

        <View style={[isFetching && styles.fetchingContent]}>
          <Animated.View entering={FadeInDown.delay(0)}>
            <SummaryCard
              academicYear={data?.summary?.activeAcademicYear || '2025–2026'}
              totalStudents={data?.summary?.totalStudents || 0}
              totalClasses={data?.summary?.totalClasses || 0}
              totalTeachers={data?.summary?.totalTeachers || 0}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(50)} style={styles.filterContainer}>
            <TimePeriodFilter 
              timePeriod={timePeriod} 
              setTimePeriod={setTimePeriod}
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100)} style={styles.dateRangeContainer}>
            <View style={styles.dateRangeBadge}>
              <Calendar size={14} color={colors.primary[600]} />
              <Text variant="bodySmall" style={styles.dateRangeText}>
                {formatDateRange(startDate, endDate)}
              </Text>
            </View>
          </Animated.View>

          {categoryCards.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200)}>
              <CategoryCards
                cards={categoryCards.map((card) => ({
                  ...card,
                  onPress: () => handleCategoryPress(card.onPress),
                }))}
              />
            </Animated.View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBackPress}
        activeOpacity={0.8}
      >
        <View style={styles.backButtonIconContainer}>
          <ChevronLeft size={18} color={colors.primary[600]} strokeWidth={2.5} />
        </View>
        <Text style={styles.backButtonText}>
          Back to Overview
        </Text>
      </TouchableOpacity>

      <View style={styles.featureHeader}>
        <Text variant="headlineSmall" style={styles.featureTitle}>
          {getFeatureTitle()}
        </Text>
      </View>

      {renderFeatureView()}
    </View>
  );
});

SuperAdminDashboard.displayName = 'SuperAdminDashboard';

const createStyles = (
  colors: ThemeColors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.md,
    },
    topFetchingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
      backgroundColor: colors.primary[50],
      borderRadius: borderRadius.md,
    },
    topFetchingText: {
      marginLeft: spacing.sm,
      color: colors.primary[600],
      fontSize: typography.fontSize.sm,
    },
    fetchingContent: {
      opacity: 0.7,
    },
    filterContainer: {
      marginBottom: spacing.md,
    },
    dateRangeContainer: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    dateRangeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary[50],
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      gap: spacing.xs,
    },
    dateRangeText: {
      color: colors.primary[600],
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    backButtonIconContainer: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary[50],
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    backButtonText: {
      color: colors.primary[600],
      fontWeight: typography.fontWeight.medium,
    },
    featureHeader: {
      marginBottom: spacing.lg,
    },
    featureTitle: {
      color: colors.text.primary,
      fontWeight: typography.fontWeight.bold,
    },
  });
