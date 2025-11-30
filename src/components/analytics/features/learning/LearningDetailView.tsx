import React, { useMemo } from 'react';
import { useTheme } from '../../../../contexts/ThemeContext';
import type { ThemeColors } from '../../../../theme/types';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { typography, spacing, borderRadius, colors } from '../../../../../lib/design-system';
import { SuperAdminAnalytics, TimePeriod } from '../../types';
import { TimePeriodFilter } from '../../shared/TimePeriodFilter';
import { MetricCard } from '../../shared/MetricCard';

interface LearningDetailViewProps {
  data: SuperAdminAnalytics;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  dateRange: { startDate: string; endDate: string };
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
}

export const LearningDetailView: React.FC<LearningDetailViewProps> = ({
  data,
  timePeriod,
  setTimePeriod,
  dateRange,
  onDateRangeChange,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const participationRate = Math.round(data?.academics?.participationRate || 0);

  const getScoreColor = (score: number) => {
    if (score >= 80) return colors.success[600];
    if (score >= 50) return colors.info[600];
    return colors.warning[600];
  };

  return (
    <>
      <TimePeriodFilter 
        timePeriod={timePeriod} 
        setTimePeriod={setTimePeriod}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
      />

      <MetricCard
        label="Test Participation"
        value={`${participationRate}%`}
        subtext="students taking tests"
        progress={participationRate}
        variant="ring"
      />

      {data?.academics?.avgScoreBySubject && data.academics.avgScoreBySubject.length > 0 && (
        <Surface style={styles.chartCard} elevation={1}>
          <Text variant="titleMedium" style={styles.chartTitle}>Subject Performance</Text>
          <Text variant="bodySmall" style={styles.chartSubtitle}>Average scores by subject</Text>

          <View style={styles.subjectBreakdown}>
            {data.academics.avgScoreBySubject.map((subject) => {
              const scoreColor = getScoreColor(subject.avgScore);

              return (
                <View key={subject.subjectId} style={styles.subjectItem}>
                  <View style={styles.subjectHeader}>
                    <Text style={styles.subjectLabel} numberOfLines={1}>
                      {subject.subjectName}
                    </Text>
                    <Text style={styles.subjectProgress}>
                      {Math.round(subject.avgScore)}%
                    </Text>
                  </View>
                  <View style={styles.subjectProgressBar}>
                    <View
                      style={[
                        styles.subjectProgressFill,
                        {
                          width: `${subject.avgScore}%`,
                          backgroundColor: scoreColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.subjectSubtext}>
                    {Math.round(subject.participationRate)}% participation
                  </Text>
                </View>
              );
            })}
          </View>
        </Surface>
      )}
    </>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  chartCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  chartTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  chartSubtitle: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
    fontSize: typography.fontSize.xs,
  },
  // Syllabus pattern styles
  subjectBreakdown: {
    gap: spacing.md,
  },
  subjectItem: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  subjectLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  subjectProgress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    marginLeft: spacing.sm,
  },
  subjectProgressBar: {
    height: 6,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  subjectProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  subjectSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
});

