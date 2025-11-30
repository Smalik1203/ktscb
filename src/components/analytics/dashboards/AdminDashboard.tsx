import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { BookOpen, Calendar, TrendingUp } from 'lucide-react-native';
import type { AdminAnalytics } from '../types';
import type { DataPoint } from '../TrendChart';
import { KPICard, TrendChart } from '../';
import { LoadingState } from '../shared';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/types';

export interface AdminDashboardProps {
  data: AdminAnalytics;
  isLoading: boolean;
}

/**
 * Admin/Teacher Dashboard Component
 * Memoized to prevent unnecessary re-renders
 */
export const AdminDashboard = React.memo<AdminDashboardProps>(({ data, isLoading }) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const weeklyTrendData: DataPoint[] = useMemo(
    () =>
      data?.presence?.weeklyTrend?.map((t) => ({
        label: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: t.rate,
      })) || [],
    [data?.presence?.weeklyTrend]
  );

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <View style={styles.container}>
      <Card style={styles.summaryCard}>
        <Text variant="titleLarge" style={styles.className}>
          {data?.summary?.className}
        </Text>
        <Text variant="bodyMedium" style={styles.classInfo}>
          {data?.summary?.totalStudents} students • {data?.summary?.classTeacher}
        </Text>
      </Card>

      <Card style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Weekly Attendance Trend
        </Text>
        <TrendChart data={weeklyTrendData} showLabels showDots />
        <Text variant="bodyMedium" style={styles.metricHighlight}>
          {Math.round(data?.presence?.steadyParticipation || 0)}% students with steady participation
        </Text>
      </Card>

      <View style={styles.statsRow}>
        <KPICard
          title="Assignment On-Time"
          value={`${Math.round(data?.learning?.assignmentOnTimeRate || 0)}%`}
          icon={BookOpen}
          iconColor={colors.success[600]}
          iconBackgroundColor={colors.success[50]}
        />
        <KPICard
          title="Timetable Coverage"
          value={`${Math.round(data?.operations?.coveragePercent || 0)}%`}
          icon={Calendar}
          iconColor={colors.primary[600]}
          iconBackgroundColor={colors.primary[50]}
        />
      </View>

      <Card style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Syllabus Progress by Subject
        </Text>
        {data?.syllabus?.progressBySubject?.map((subject) => (
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
              {subject.completedTopics}/{subject.totalTopics} topics ({Math.round(subject.progress)}%)
            </Text>
          </View>
        ))}
      </Card>

      <View style={styles.statsRow}>
        <KPICard
          title="Quiz Participation"
          value={`${Math.round(data?.engagement?.quizParticipation || 0)}%`}
          icon={TrendingUp}
          iconColor={colors.info[600]}
          iconBackgroundColor={colors.info[50]}
        />
        <KPICard
          title="Assignment Participation"
          value={`${Math.round(data?.engagement?.assignmentParticipation || 0)}%`}
          icon={BookOpen}
          iconColor={colors.warning[600]}
          iconBackgroundColor={colors.warning[50]}
        />
      </View>
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
    metricHighlight: {
      color: colors.text.secondary,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.md,
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
