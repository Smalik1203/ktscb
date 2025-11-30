import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { LucideIcon } from 'lucide-react-native';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/types';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
}

/**
 * Reusable empty state component
 * Memoized to prevent unnecessary re-renders
 */
export const EmptyState = React.memo<EmptyStateProps>(({ icon: Icon, title, message }) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  return (
  <View style={styles.container}>
    <View style={styles.iconContainer}>
      <Icon size={48} color={colors.text.tertiary} strokeWidth={1.5} />
    </View>
    <Text variant="titleMedium" style={styles.title}>
      {title}
    </Text>
    <Text variant="bodyMedium" style={styles.message}>
      {message}
    </Text>
  </View>
  );
});

EmptyState.displayName = 'EmptyState';

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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
    paddingHorizontal: spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
