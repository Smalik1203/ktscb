import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { View, StyleSheet } from 'react-native';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/types';

/**
 * Skeleton loader component for analytics cards
 * Memoized to prevent unnecessary re-renders
 */
export const SkeletonCard = React.memo(() => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  return (
  <View style={styles.card}>
    <View style={styles.title} />
    <View style={styles.line} />
    <View style={[styles.line, styles.lineShort]} />
  </View>
  );
});

SkeletonCard.displayName = 'SkeletonCard';

const createStyles = (
  colors: ThemeColors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows
) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  title: {
    height: 24,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    width: '60%',
  },
  line: {
    height: 16,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    width: '100%',
  },
  lineShort: {
    width: '60%',
  },
});
