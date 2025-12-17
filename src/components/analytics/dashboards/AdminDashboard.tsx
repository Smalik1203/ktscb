import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { BookOpen, Calendar, TrendingUp } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { AdminAnalytics, SuperAdminAnalytics, TimePeriod, DateRange } from '../types';
import type { DataPoint } from '../TrendChart';
import { KPICard, TrendChart } from '../';
import { LoadingState, TimePeriodFilter } from '../shared';
import { formatDateRange } from '../../../utils/analytics.utils';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/types';

export interface AdminDashboardProps {
  data: AdminAnalytics | SuperAdminAnalytics;
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
 * Admin/Teacher Dashboard Component
 * Memoized to prevent unnecessary re-renders
 */
export const AdminDashboard = React.memo<AdminDashboardProps>(({ 
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

  // Adapt data - handle both AdminAnalytics and SuperAdminAnalytics
  const isSuperAdminData = 'attendance' in data && !('presence' in data);
  
  const weeklyTrendData: DataPoint[] = useMemo(() => {
    if (isSuperAdminData) {
      const superData = data as SuperAdminAnalytics;
      return superData?.attendance?.trend7Days?.map((t) => ({
        label: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: t.rate,
      })) || [];
    } else {
      const adminData = data as AdminAnalytics;
      return adminData?.presence?.weeklyTrend?.map((t) => ({
        label: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: t.rate,
      })) || [];
    }
  }, [data, isSuperAdminData]);

  const summaryData = useMemo(() => {
    if (isSuperAdminData) {
      const superData = data as SuperAdminAnalytics;
      // For admin viewing their class, we'll show class info from the first class in classesByConsistency
      const firstClass = superData?.attendance?.classesByConsistency?.[0];
      return {
        className: firstClass?.className || 'Class',
        totalStudents: superData?.summary?.totalStudents || 0,
        classTeacher: 'Class Teacher', // This would need to come from profile or another source
      };
    } else {
      const adminData = data as AdminAnalytics;
      return adminData?.summary || { className: '', totalStudents: 0, classTeacher: '' };
    }
  }, [data, isSuperAdminData]);

  const steadyParticipation = useMemo(() => {
    if (isSuperAdminData) {
      const superData = data as SuperAdminAnalytics;
      return superData?.attendance?.avgRate || 0;
    } else {
      const adminData = data as AdminAnalytics;
      return adminData?.presence?.steadyParticipation || 0;
    }
  }, [data, isSuperAdminData]);

  const assignmentOnTimeRate = useMemo(() => {
    if (isSuperAdminData) {
      const superData = data as SuperAdminAnalytics;
      return superData?.engagement?.testParticipation || 0;
    } else {
      const adminData = data as AdminAnalytics;
      return adminData?.learning?.assignmentOnTimeRate || 0;
    }
  }, [data, isSuperAdminData]);

  const coveragePercent = useMemo(() => {
    if (isSuperAdminData) {
      const superData = data as SuperAdminAnalytics;
      return superData?.operations?.timetableCoverage || 0;
    } else {
      const adminData = data as AdminAnalytics;
      return adminData?.operations?.coveragePercent || 0;
    }
  }, [data, isSuperAdminData]);

  const syllabusProgress = useMemo(() => {
    if (isSuperAdminData) {
      const superData = data as SuperAdminAnalytics;
      return superData?.syllabus?.progressBySubject || [];
    } else {
      const adminData = data as AdminAnalytics;
      return adminData?.syllabus?.progressBySubject || [];
    }
  }, [data, isSuperAdminData]);

  const quizParticipation = useMemo(() => {
    if (isSuperAdminData) {
      const superData = data as SuperAdminAnalytics;
      return superData?.engagement?.testParticipation || 0;
    } else {
      const adminData = data as AdminAnalytics;
      return adminData?.engagement?.quizParticipation || 0;
    }
  }, [data, isSuperAdminData]);

  const assignmentParticipation = useMemo(() => {
    if (isSuperAdminData) {
      const superData = data as SuperAdminAnalytics;
      return superData?.engagement?.taskSubmissionRate || 0;
    } else {
      const adminData = data as AdminAnalytics;
      return adminData?.engagement?.assignmentParticipation || 0;
    }
  }, [data, isSuperAdminData]);

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
          {summaryData.className}
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {summaryData.totalStudents} students • {summaryData.classTeacher}
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

      {/* KPI Cards Grid */}
      <Animated.View entering={FadeInDown.delay(150)} style={[isFetching && styles.fetchingContent]}>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.success[50] }]}>
              <BookOpen size={20} color={colors.success[600]} />
            </View>
            <Text variant="headlineMedium" style={styles.kpiValue}>
              {Math.round(assignmentOnTimeRate)}%
            </Text>
            <Text variant="bodySmall" style={styles.kpiLabel}>Assignment On-Time</Text>
          </View>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.primary[50] }]}>
              <Calendar size={20} color={colors.primary[600]} />
            </View>
            <Text variant="headlineMedium" style={styles.kpiValue}>
              {Math.round(coveragePercent)}%
            </Text>
            <Text variant="bodySmall" style={styles.kpiLabel}>Timetable Coverage</Text>
          </View>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.info[50] }]}>
              <TrendingUp size={20} color={colors.info[600]} />
            </View>
            <Text variant="headlineMedium" style={styles.kpiValue}>
              {Math.round(quizParticipation)}%
            </Text>
            <Text variant="bodySmall" style={styles.kpiLabel}>Quiz Participation</Text>
          </View>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.warning[50] }]}>
              <BookOpen size={20} color={colors.warning[600]} />
            </View>
            <Text variant="headlineMedium" style={styles.kpiValue}>
              {Math.round(assignmentParticipation)}%
            </Text>
            <Text variant="bodySmall" style={styles.kpiLabel}>Assignment Participation</Text>
          </View>
        </View>
      </Animated.View>

      {/* Attendance Trend */}
      <Animated.View entering={FadeInDown.delay(200)} style={[isFetching && styles.fetchingContent]}>
        <View style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Weekly Attendance Trend
        </Text>
        <TrendChart data={weeklyTrendData} showLabels showDots />
          <View style={styles.metricBadge}>
            <Text variant="bodySmall" style={styles.metricText}>
              {Math.round(steadyParticipation)}% students with steady participation
        </Text>
          </View>
      </View>
      </Animated.View>

      {/* Syllabus Progress */}
      <Animated.View entering={FadeInDown.delay(250)} style={[isFetching && styles.fetchingContent]}>
        <View style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Syllabus Progress by Subject
        </Text>
          {syllabusProgress.map((subject) => (
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
    </View>
  );
});

AdminDashboard.displayName = 'AdminDashboard';

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
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    kpiCard: {
      width: '48%',
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
    metricBadge: {
      backgroundColor: colors.primary[50],
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
      marginTop: spacing.md,
      alignSelf: 'center',
    },
    metricText: {
      color: colors.primary[700],
      fontWeight: typography.fontWeight.medium,
      textAlign: 'center',
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
