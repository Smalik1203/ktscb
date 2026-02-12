/**
 * EmptyState Component
 * 
 * Simple empty state with icon, title, message, and optional action.
 * 
 * @example
 * ```tsx
 * <EmptyState title="No items" message="Create your first item to get started" />
 * <EmptyState
 *   title="No results"
 *   message="Try a different search"
 *   actionLabel="Clear Search"
 *   onAction={clearSearch}
 * />
 * ```
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './Button';

export interface EmptyStateProps {
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
  const { colors, typography, spacing } = useTheme();

  const styles = useMemo(
    () => createStyles(colors, typography, spacing),
    [colors, typography, spacing],
  );

  return (
    <View style={variant === 'card' ? styles.cardContainer : styles.container}>
      {icon || <MaterialIcons name="inbox" size={64} color={colors.neutral[300]} />}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <Button onPress={onAction} style={styles.button}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const createStyles = (colors: any, typography: any, spacing: any) =>
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
      fontWeight: typography.fontWeight.bold as any,
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
