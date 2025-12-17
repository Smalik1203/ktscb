import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { BookOpen, TrendingUp, Calendar } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { StudentAnalytics, TimePeriod, DateRange } from '../types';
import type { DataPoint } from '../TrendChart';
import { KPICard, TrendChart, ProgressRing } from '../';
import { LoadingState, TimePeriodFilter } from '../shared';
import { formatCurrency , formatDateRange } from '../../../utils/analytics.utils';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/types';

export interface StudentDashboardProps {
  data: StudentAnalytics;
  isLoading: boolean;
  isFetching?: boolean;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  startDate: string;
  endDate: string;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

/**
 * Student Dashboard Component
 * Memoized to prevent unnecessary re-renders
 */
export const StudentDashboard = React.memo<StudentDashboardProps>(({ 
  data, 
  isLoading, 
  isFetching = false,
  timePeriod,
  setTimePeriod,
  startDate,
  endDate,
  dateRange,
  onDateRangeChange,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const fourWeekTrendData: DataPoint[] = useMemo(
    () =>
      data?.attendanceRhythm?.fourWeekTrend?.map((t) => ({
        label: `Week ${t.week}`,
        value: t.rate,
      })) || [],
    [data?.attendanceRhythm?.fourWeekTrend]
  );

  const attendanceProgress = useMemo(() => {
    const daysAttended = data?.attendanceRhythm?.daysAttendedThisMonth || 0;
    const totalDays = Math.max(data?.attendanceRhythm?.totalDaysThisMonth || 0, 1);
    return (daysAttended / totalDays) * 100;
  }, [data?.attendanceRhythm?.daysAttendedThisMonth, data?.attendanceRhythm?.totalDaysThisMonth]);

  const getAttendanceTitle = () => {
    switch (timePeriod) {
      case 'today':
        return 'Attendance Today';
      case 'week':
        return 'Attendance This Week';
      case 'month':
        return 'Attendance This Month';
      default:
        return 'Attendance';
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <View style={styles.container}>
      {isFetching && (
        <View style={styles.topFetchingBar}>
          <Text style={styles.topFetchingText}>
            Loading {timePeriod} data...
          </Text>
        </View>
      )}

      {/* Header */}
      <Animated.View entering={FadeInDown.delay(0)} style={styles.headerSection}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          {data?.summary?.studentName || 'Student'}
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {data?.summary?.className || 'Class'}
        </Text>
      </Animated.View>

      {/* Filters */}
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

      {/* Attendance Section */}
      <Animated.View entering={FadeInDown.delay(150)} style={[isFetching && styles.fetchingContent]}>
        <View style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
            {getAttendanceTitle()}
        </Text>
        <View style={styles.attendanceContainer}>
            <ProgressRing progress={attendanceProgress} size={100} label="Days Present" />
          <View style={styles.attendanceStats}>
              <Text variant="headlineLarge" style={styles.attendanceValue}>
              {data?.attendanceRhythm?.daysAttendedThisMonth || 0}/
              {data?.attendanceRhythm?.totalDaysThisMonth || 0}
            </Text>
            <Text variant="bodySmall" style={styles.attendanceLabel}>
              days attended
            </Text>
          </View>
        </View>
        {fourWeekTrendData.length > 0 && (
          <>
            <Text variant="titleSmall" style={styles.subSectionTitle}>
              4-Week Trend
            </Text>
            <TrendChart data={fourWeekTrendData} height={150} showLabels showDots />
          </>
        )}
        </View>
      </Animated.View>

      {/* Personal Best */}
      {data?.progressHighlights?.closestToPersonalBest && data.progressHighlights.closestToPersonalBest.bestScore > 0 && (
        <Animated.View entering={FadeInDown.delay(200)} style={[isFetching && styles.fetchingContent]}>
          <View style={styles.sectionCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Personal Best
          </Text>
          <View style={styles.personalBest}>
            <Text variant="bodyLarge" style={styles.subjectName}>
              {data.progressHighlights.closestToPersonalBest.subjectName}
            </Text>
              <Text variant="headlineLarge" style={styles.bestScore}>
              {Math.round(data.progressHighlights.closestToPersonalBest.bestScore)}%
            </Text>
            <Text variant="bodySmall" style={styles.scoreLabel}>
              Your highest score
            </Text>
          </View>
          </View>
        </Animated.View>
      )}

      {/* KPI Cards */}
      <Animated.View entering={FadeInDown.delay(250)} style={[isFetching && styles.fetchingContent]}>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.success[50] }]}>
              <BookOpen size={20} color={colors.success[600]} />
            </View>
            <Text variant="headlineMedium" style={styles.kpiValue}>
              {data?.learning?.assignmentOnTimeStreak || 0}
            </Text>
            <Text variant="bodySmall" style={styles.kpiLabel}>Assignments On-Time</Text>
            {data?.learning?.totalAssignments && (
              <Text variant="bodySmall" style={styles.kpiSubtext}>
                of {data.learning.totalAssignments} total
              </Text>
            )}
          </View>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.primary[50] }]}>
              <TrendingUp size={20} color={colors.primary[600]} />
            </View>
            <Text variant="headlineMedium" style={styles.kpiValue}>
              {Math.round(data?.attendanceRhythm?.currentRate || 0)}%
            </Text>
            <Text variant="bodySmall" style={styles.kpiLabel}>Overall Attendance</Text>
          </View>
        </View>
      </Animated.View>

      {/* Test Performance */}
      {data?.learning?.subjectScoreTrend && data.learning.subjectScoreTrend.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300)} style={[isFetching && styles.fetchingContent]}>
          <View style={styles.sectionCard}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Test Performance
            </Text>
            {data.learning.subjectScoreTrend.slice(0, 5).map((subject) => (
              <View key={subject.subjectId} style={styles.progressItem}>
                <View style={styles.subjectHeader}>
                  <Text variant="bodyMedium" style={styles.subjectName}>
                    {subject.subjectName}
                  </Text>
                  <Text variant="bodySmall" style={styles.testCount}>
                    {subject.testCount} test{subject.testCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.scoreContainer}>
                  <Text variant="headlineMedium" style={styles.avgScore}>
                    {Math.round(subject.avgScore)}%
                  </Text>
                  <Text variant="bodySmall" style={styles.scoreLabel}>
                    Average
                  </Text>
                </View>
              </View>
            ))}
      </View>
        </Animated.View>
      )}

      {/* Fee Status */}
      {data?.fees && data.fees.status !== 'no_billing' && (
        <Animated.View entering={FadeInDown.delay(350)} style={[isFetching && styles.fetchingContent]}>
          <View style={styles.sectionCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Fee Status
          </Text>
          <View style={styles.feesOverview}>
            <View style={styles.feeRow}>
              <Text variant="bodyMedium" style={styles.feeLabel}>
                Total Billed
              </Text>
              <Text variant="bodyMedium" style={styles.feeValue}>
                {formatCurrency(data.fees.totalBilled || 0)}
              </Text>
            </View>
            <View style={styles.feeRow}>
              <Text variant="bodyMedium" style={styles.feeLabel}>
                Paid
              </Text>
              <Text variant="bodyMedium" style={[styles.feeValue, { color: colors.success[600] }]}>
                {formatCurrency(data.fees.totalPaid || 0)}
              </Text>
            </View>
            {data.fees.totalDue > 0 && (
              <View style={styles.feeRow}>
                <Text variant="bodyMedium" style={styles.feeLabel}>
                  Due
                </Text>
                <Text variant="bodyMedium" style={[styles.feeValue, { color: colors.error[600] }]}>
                  {formatCurrency(data.fees.totalDue || 0)}
                </Text>
              </View>
            )}
          </View>
          </View>
        </Animated.View>
      )}

      {/* Syllabus Progress */}
      {data?.progressHighlights?.syllabusProgress && data.progressHighlights.syllabusProgress.length > 0 && (
        <Animated.View entering={FadeInDown.delay(400)} style={[isFetching && styles.fetchingContent]}>
          <View style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Syllabus Progress
        </Text>
            {data.progressHighlights.syllabusProgress.slice(0, 5).map((subject) => (
          <View key={subject.subjectId} style={styles.progressItem}>
                <View style={styles.progressHeader}>
            <Text variant="bodyMedium" style={styles.subjectName}>
              {subject.subjectName}
            </Text>
                  <Text variant="bodySmall" style={styles.progressPercent}>
                    {Math.round(subject.progress)}%
                  </Text>
                </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${subject.progress}%`, backgroundColor: colors.primary[600] },
                ]}
              />
            </View>
            <Text variant="bodySmall" style={styles.progressText}>
                  {subject.completedTopics}/{subject.totalTopics} topics completed
            </Text>
          </View>
        ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
});

StudentDashboard.displayName = 'StudentDashboard';

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
      backgroundColor: colors.background.app,
    },
    headerSection: {
      marginBottom: spacing.lg,
    },
    headerTitle: {
      color: colors.text.primary,
      fontWeight: typography.fontWeight.bold,
      marginBottom: spacing.xs,
    },
    headerSubtitle: {
      color: colors.text.secondary,
    },
    kpiGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      alignItems: 'center',
      ...shadows.sm,
      borderWidth: 0.5,
      borderColor: colors.border.light,
    },
    kpiIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    kpiValue: {
      color: colors.text.primary,
      fontWeight: typography.fontWeight.bold,
      marginBottom: spacing.xs,
    },
    kpiLabel: {
      color: colors.text.secondary,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      textAlign: 'center',
    },
    kpiSubtext: {
      color: colors.text.tertiary,
      fontSize: typography.fontSize.xs,
      marginTop: 2,
    },
    sectionCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.sm,
      borderWidth: 0.5,
      borderColor: colors.border.light,
    },
    sectionTitle: {
      color: colors.text.primary,
      fontWeight: typography.fontWeight.bold,
      marginBottom: spacing.md,
      fontSize: typography.fontSize.lg,
    },
    subSectionTitle: {
      color: colors.text.secondary,
      fontWeight: typography.fontWeight.medium,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    attendanceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      marginBottom: spacing.md,
    },
    attendanceStats: {
      alignItems: 'center',
    },
    attendanceValue: {
      color: colors.primary[600],
      fontWeight: typography.fontWeight.bold,
    },
    attendanceLabel: {
      color: colors.text.tertiary,
      fontSize: typography.fontSize.xs,
    },
    personalBest: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    bestScore: {
      color: colors.success[600],
      fontWeight: typography.fontWeight.bold,
      marginVertical: spacing.xs,
    },
    scoreLabel: {
      color: colors.text.tertiary,
      fontSize: typography.fontSize.xs,
    },
    feesOverview: {
      gap: spacing.sm,
    },
    feeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
    },
    feeLabel: {
      color: colors.text.secondary,
    },
    feeValue: {
      color: colors.text.primary,
      fontWeight: typography.fontWeight.semibold,
    },
    progressItem: {
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border.light,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    subjectName: {
      color: colors.text.primary,
      fontWeight: typography.fontWeight.semibold,
    },
    progressPercent: {
      color: colors.primary[600],
      fontWeight: typography.fontWeight.bold,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.surface.tertiary,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      marginBottom: spacing.xs,
    },
    progressFill: {
      height: '100%',
      borderRadius: borderRadius.full,
    },
    progressText: {
      color: colors.text.tertiary,
      fontSize: typography.fontSize.xs,
    },
    subjectHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    testCount: {
      color: colors.text.tertiary,
      fontSize: typography.fontSize.xs,
    },
    scoreContainer: {
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    avgScore: {
      color: colors.primary[600],
      fontWeight: typography.fontWeight.bold,
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
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.full,
      gap: spacing.xs,
    },
    dateRangeText: {
      color: colors.primary[600],
      fontWeight: typography.fontWeight.medium,
    },
  });
