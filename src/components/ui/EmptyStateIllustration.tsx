import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { typography, spacing, borderRadius, colors } from '../../../lib/design-system';
import {
  BookOpen,
  CheckCircle2,
  Calendar,
  FileText,
  Users,
  TrendingUp,
  Award,
  Bell,
  Inbox,
  Search,
} from 'lucide-react-native';

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
    | 'general';
  title: string;
  description: string;
  action?: React.ReactNode;
}

const iconMap = {
  tasks: CheckCircle2,
  tests: FileText,
  syllabus: BookOpen,
  attendance: Users,
  calendar: Calendar,
  notifications: Bell,
  resources: Inbox,
  analytics: TrendingUp,
  search: Search,
  general: Award,
};

export function EmptyStateIllustration({
  type,
  title,
  description,
  action,
}: EmptyStateIllustrationProps) {
  const { colors, isDark } = useTheme();
  const Icon = iconMap[type] || iconMap.general;
  
  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={styles.container}>
      {/* Icon container with gradient background */}
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <Icon size={48} color={colors.primary[600]} strokeWidth={1.5} />
        </View>
      </View>

      {/* Text content */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {/* Action button */}
      {action && <View style={styles.actionContainer}>{action}</View>}
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
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
