import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Inbox } from 'lucide-react-native';
import { spacing, typography, colors } from '../../../lib/design-system';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'screen' | 'card';
}

export function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
  variant = 'screen',
}: EmptyStateProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  return (
    <View style={variant === 'card' ? styles.cardContainer : styles.container}>
      {icon || <Inbox size={64} color={colors.neutral[300]} />}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          style={styles.button}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    marginTop: spacing.lg,
  },
});
