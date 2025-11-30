import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import type { ThemeColors } from '../../../theme/types';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { typography, spacing, borderRadius, shadows, colors } from '../../../../lib/design-system';

interface SummaryCardProps {
  academicYear: string;
  totalStudents: number;
  totalClasses: number;
  totalTeachers: number;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  academicYear,
  totalStudents,
  totalClasses,
  totalTeachers,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  return (
    <Surface style={styles.summaryCard} elevation={3}>
      <View style={styles.summaryCardHeader}>
        <View>
          <Text variant="bodySmall" style={styles.summaryCardLabel}>Academic Year</Text>
          <Text variant="headlineSmall" style={styles.summaryCardTitle}>
            {academicYear || '2025–2026'}
          </Text>
        </View>
      </View>
      <View style={styles.summaryMetricsRow}>
        <View style={styles.summaryMetric}>
          <Text variant="headlineMedium" style={styles.summaryMetricValue}>
            {totalStudents || 0}
          </Text>
          <Text variant="bodySmall" style={styles.summaryMetricLabel}>Students</Text>
        </View>
        <View style={styles.summaryMetricDivider} />
        <View style={styles.summaryMetric}>
          <Text variant="headlineMedium" style={styles.summaryMetricValue}>
            {totalClasses || 0}
          </Text>
          <Text variant="bodySmall" style={styles.summaryMetricLabel}>Classes</Text>
        </View>
        <View style={styles.summaryMetricDivider} />
        <View style={styles.summaryMetric}>
          <Text variant="headlineMedium" style={styles.summaryMetricValue}>
            {totalTeachers || 0}
          </Text>
          <Text variant="bodySmall" style={styles.summaryMetricLabel}>Teachers</Text>
        </View>
      </View>
    </Surface>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  summaryCardHeader: {
    marginBottom: spacing.md,
  },
  summaryCardLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryCardTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
  },
  summaryMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  summaryMetric: {
    alignItems: 'center',
    flex: 1,
  },
  summaryMetricValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    fontSize: typography.fontSize['2xl'],
    marginBottom: spacing.xs,
  },
  summaryMetricLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  summaryMetricDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.light,
  },
});

