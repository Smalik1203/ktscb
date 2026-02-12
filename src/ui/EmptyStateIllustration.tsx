/**
 * EmptyStateIllustration Component
 * 
 * Type-based empty state with icon, title, description, and optional action.
 * 
 * @example
 * ```tsx
 * <EmptyStateIllustration
 *   type="tasks"
 *   title="No tasks yet"
 *   description="Create a task to get started"
 *   action={<Button onPress={create}>Create Task</Button>}
 * />
 * ```
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import type { MaterialIconName } from './iconMap';

interface EmptyStateIllustrationProps {
  type:
    | 'tasks'
    | 'tests'
    | 'syllabus'
    | 'attendance'
    | 'calendar'
    | 'notifications'
    | 'resources'
    | 'analytics'
    | 'search'
    | 'inventory'
    | 'general';
  title: string;
  description: string;
  action?: React.ReactNode;
}

const typeToIcon: Record<string, MaterialIconName> = {
  tasks: 'check-circle',
  tests: 'description',
  syllabus: 'menu-book',
  attendance: 'group',
  calendar: 'event',
  notifications: 'notifications',
  resources: 'inbox',
  analytics: 'trending-up',
  search: 'search',
  inventory: 'inventory-2',
  general: 'emoji-events',
};

export function EmptyStateIllustration({
  type,
  title,
  description,
  action,
}: EmptyStateIllustrationProps) {
  const { colors, isDark, typography, spacing } = useTheme();
  const iconName = typeToIcon[type] || typeToIcon.general;

  const styles = useMemo(
    () => createStyles(colors, isDark, typography, spacing),
    [colors, isDark, typography, spacing],
  );

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <MaterialIcons name={iconName} size={48} color={colors.primary.main} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action && <View style={styles.actionContainer}>{action}</View>}
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, typography: any, spacing: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing['2xl'],
    },
    iconContainer: {
      marginBottom: spacing.lg,
    },
    iconCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary[200],
    },
    title: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold as any,
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.normal as any,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: typography.lineHeight.relaxed * typography.fontSize.base,
      maxWidth: 320,
    },
    actionContainer: {
      marginTop: spacing.lg,
    },
  });
