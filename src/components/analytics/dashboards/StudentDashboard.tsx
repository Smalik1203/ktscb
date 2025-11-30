import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { BookOpen, TrendingUp } from 'lucide-react-native';
import type { StudentAnalytics } from '../types';
import type { DataPoint } from '../TrendChart';
import { KPICard, TrendChart, ProgressRing } from '../';
import { LoadingState } from '../shared';
import { formatCurrency } from '../../../utils/analytics.utils';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/types';

export interface StudentDashboardProps {
  data: StudentAnalytics;
  isLoading: boolean;
}

/**
 * Student Dashboard Component
 * Memoized to prevent unnecessary re-renders
 */
export const StudentDashboard = React.memo<StudentDashboardProps>(({ data, isLoading }) => {
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

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <View style={styles.container}>
      <Card style={styles.summaryCard}>
        <Text variant="titleLarge" style={styles.className}>
          {data?.summary?.studentName}
        </Text>
        <Text variant="bodyMedium" style={styles.classInfo}>
          {data?.summary?.className}
        </Text>
      </Card>

      <Card style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Attendance This Month
        </Text>
        <View style={styles.attendanceContainer}>
          <ProgressRing progress={attendanceProgress} size={120} label="Days Present" />
          <View style={styles.attendanceStats}>
            <Text variant="headlineMedium" style={styles.attendanceValue}>
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
      </Card>

      {data?.progressHighlights?.closestToPersonalBest && (
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Personal Best
          </Text>
          <View style={styles.personalBest}>
            <Text variant="bodyLarge" style={styles.subjectName}>
              {data.progressHighlights.closestToPersonalBest.subjectName}
            </Text>
            <Text variant="headlineSmall" style={styles.bestScore}>
              {Math.round(data.progressHighlights.closestToPersonalBest.bestScore)}%
            </Text>
            <Text variant="bodySmall" style={styles.scoreLabel}>
              Your highest score
            </Text>
          </View>
        </Card>
      )}

      <View style={styles.statsRow}>
        <KPICard
          title="Assignments On-Time"
          value={data?.learning?.assignmentOnTimeStreak || 0}
          subtitle={`out of ${data?.learning?.totalAssignments || 0} total`}
          icon={BookOpen}
          iconColor={colors.success[600]}
          iconBackgroundColor={colors.success[50]}
        />
        <KPICard
          title="Overall Attendance"
          value={`${Math.round(data?.attendanceRhythm?.currentRate || 0)}%`}
          icon={TrendingUp}
          iconColor={colors.primary[600]}
          iconBackgroundColor={colors.primary[50]}
        />
      </View>

      {data?.fees && data.fees.status !== 'no_billing' && (
        <Card style={styles.sectionCard}>
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
        </Card>
      )}

      <Card style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Syllabus Progress
        </Text>
        {data?.progressHighlights?.syllabusProgress?.slice(0, 5).map((subject) => (
          <View key={subject.subjectId} style={styles.progressItem}>
            <Text variant="bodyMedium" style={styles.subjectName}>
              {subject.subjectName}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${subject.progress}%`, backgroundColor: colors.primary[600] },
                ]}
              />
            </View>
            <Text variant="bodySmall" style={styles.progressText}>
              {Math.round(subject.progress)}% complete
            </Text>
          </View>
        ))}
      </Card>
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
    },
    summaryCard: {
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: borderRadius.card,
      backgroundColor: colors.surface.primary,
    },
    className: {
      color: colors.text.primary,
      fontWeight: typography.fontWeight.bold,
      marginBottom: spacing.xs,
    },
    classInfo: {
      color: colors.text.secondary,
    },
    sectionCard: {
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: borderRadius.card,
      backgroundColor: colors.surface.primary,
    },
    sectionTitle: {
      color: colors.text.primary,
      fontWeight: typography.fontWeight.semibold,
      marginBottom: spacing.md,
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
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.md,
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
      fontWeight: typography.fontWeight.medium,
    },
    progressItem: {
      marginBottom: spacing.md,
    },
    subjectName: {
      color: colors.text.primary,
      marginBottom: spacing.xs,
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
    },
  });
