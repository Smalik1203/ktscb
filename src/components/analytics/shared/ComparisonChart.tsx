import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, typography, spacing, borderRadius } from '../../../../lib/design-system';

interface ComparisonItem {
  label: string;
  value: number;
  color: string;
  percentage?: number;
  subtext?: string;
}

interface ComparisonChartProps {
  title: string;
  subtitle?: string;
  items: ComparisonItem[];
  variant?: 'default' | 'syllabus';
}

export const ComparisonChart = React.memo<ComparisonChartProps>(({
  title,
  subtitle,
  items,
  variant = 'syllabus',
}) => {
  const isSyllabusStyle = variant === 'syllabus';

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.chartTitle}>{title}</Text>
      {subtitle && (
        <Text variant="bodySmall" style={styles.chartSubtitle}>{subtitle}</Text>
      )}

      <View style={isSyllabusStyle ? styles.syllabusBreakdown : undefined}>
        {items.map((item, index) => (
          <View
            key={index}
            style={isSyllabusStyle ? styles.syllabusItem : styles.comparisonItem}
          >
            <View style={isSyllabusStyle ? styles.syllabusHeader : undefined}>
              <Text
                variant="bodyMedium"
                style={isSyllabusStyle ? styles.syllabusLabel : styles.comparisonLabel}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {isSyllabusStyle && (
                <Text style={styles.syllabusProgress}>
                  {Math.round(item.value)}%
                </Text>
              )}
            </View>
            <View style={isSyllabusStyle ? styles.syllabusProgressBar : styles.comparisonBarContainer}>
              <View
                style={[
                  isSyllabusStyle ? styles.syllabusProgressFill : styles.comparisonBar,
                  {
                    width: `${item.percentage || item.value}%`,
                    backgroundColor: item.color,
                  },
                ]}
              />
              {!isSyllabusStyle && (
                <Text variant="labelMedium" style={[styles.comparisonValue, { color: item.color }]}>
                  {typeof item.value === 'number' && item.value > 1000
                    ? `₹${(item.value / 100).toLocaleString('en-IN')}`
                    : `${Math.round(item.value)}%`}
                </Text>
              )}
            </View>
            {isSyllabusStyle && item.subtext && (
              <Text style={styles.syllabusSubtext}>{item.subtext}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}));

const styles = StyleSheet.create({
  container: {
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
  // Default variant styles
  comparisonItem: {
    marginBottom: spacing.md,
  },
  comparisonLabel: {
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: typography.fontSize.sm,
  },
  comparisonBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonBar: {
    height: 24,
    borderRadius: borderRadius.sm,
    minWidth: 2,
  },
  comparisonValue: {
    fontWeight: typography.fontWeight.bold,
    minWidth: 45,
    textAlign: 'right',
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
  // Syllabus variant styles (matching student dashboard pattern)
  syllabusBreakdown: {
    gap: spacing.md,
  },
  syllabusItem: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  syllabusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  syllabusLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  syllabusProgress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    marginLeft: spacing.sm,
  },
  syllabusProgressBar: {
    height: 6,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  syllabusProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  syllabusSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
});

