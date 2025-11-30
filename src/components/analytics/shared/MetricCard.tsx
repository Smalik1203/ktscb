import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import type { ThemeColors } from '../../../theme/types';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { typography, spacing, borderRadius, colors } from '../../../../lib/design-system';
import { ProgressRing } from '../ProgressRing';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  valueColor?: string;
  variant?: 'default' | 'ring';
  progress?: number;
}

export const MetricCard = React.memo<MetricCardProps>(({
  label,
  value,
  subtext,
  valueColor,
  variant = 'default',
  progress,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const finalValueColor = valueColor || colors.text.primary;
  if (variant === 'ring' && typeof progress === 'number') {
    return (
      <Surface style={styles.metricCard} elevation={2}>
        <View style={styles.ringContainer}>
          <View style={styles.progressRingWrapper}>
            <ProgressRing
              progress={progress}
              size={80}
              strokeWidth={8}
              color={colors.primary[600]}
              backgroundColor={colors.neutral[100]}
              showPercentage={false}
            />
            <Text style={styles.ringValue}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.ringDetails}>
            <Text style={styles.ringLabel}>{label}</Text>
            {subtext && <Text style={styles.ringSubtext}>{subtext}</Text>}
          </View>
        </View>
      </Surface>
    );
  }

  return (
    <Surface style={styles.metricCard} elevation={2}>
      <Text variant="labelLarge" style={styles.metricCardLabel}>{label}</Text>
      <Text variant="headlineMedium" style={[styles.metricCardValue, { color: finalValueColor }]}>
        {value}
      </Text>
      {subtext && (
        <Text variant="bodySmall" style={styles.metricCardSubtext}>{subtext}</Text>
      )}
    </Surface>
  );
});

MetricCard.displayName = 'MetricCard';

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  metricCard: {
    backgroundColor: colors.background.app,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  // Default variant styles
  metricCardLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  metricCardValue: {
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
    fontSize: typography.fontSize['3xl'],
  },
  metricCardSubtext: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
  },
  // Ring variant styles (matching syllabus pattern)
  ringContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressRingWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    position: 'absolute',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  ringDetails: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  ringLabel: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  ringSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
});

