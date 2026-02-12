import React, { useState , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, Text, StyleSheet, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card, Menu, IconButton } from '../../ui';
import { format } from 'date-fns';
import { Task } from '../../hooks/useTasks';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';

interface StudentTaskCardProps {
  task: Task & { submission?: any; subjects?: any; class_instances?: any };
  onViewDetail?: () => void;
  onViewAttachments?: () => void;
  onSubmit?: () => void;
  onUnsubmit?: (taskId: string) => void;
  isSubmitted?: boolean;
}

export function StudentTaskCard({
  task,
  onViewDetail,
  onViewAttachments,
  onSubmit,
  onUnsubmit,
  isSubmitted = false
}: StudentTaskCardProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const [menuVisible, setMenuVisible] = useState(false);

  const isCompleted = task.submission?.status === 'submitted' || task.submission?.status === 'graded';
  const isGraded = task.submission?.status === 'graded';
  const hasAttachments = task.attachments && Array.isArray(task.attachments) && task.attachments.length > 0;

  const getDueDateStatus = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'overdue', text: 'Overdue', color: colors.error[600] };
    if (diffDays === 0) return { status: 'today', text: 'Due Today', color: colors.warning[600] };
    if (diffDays <= 3) return { status: 'soon', text: 'Due Soon', color: colors.warning[500] };
    return { status: 'upcoming', text: 'Upcoming', color: colors.success[600] };
  };

  const dueDateStatus = getDueDateStatus();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return colors.error[600];
      case 'high': return colors.error[500];
      case 'medium': return colors.warning[500];
      case 'low': return colors.success[500];
      default: return colors.neutral[500];
    }
  };

  const toggleMenu = () => setMenuVisible(!menuVisible);
  const closeMenu = () => setMenuVisible(false);

  const handleUnsubmit = () => {
    closeMenu();
    Alert.alert(
      'Unsubmit Task',
      'Are you sure you want to unsubmit this task? You can resubmit it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsubmit',
          style: 'destructive',
          onPress: () => {
            onUnsubmit?.(task.id);
          },
        },
      ]
    );
  };

  return (
    <Card style={StyleSheet.flatten([styles.card, isSubmitted && styles.cardSubmitted])}>
      <View style={[styles.cardContent, isSubmitted && styles.cardContentSubmitted]}>
        {/* Header with title and actions */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={2}>
                {task.title}
              </Text>
            </View>
          </View>

          {/* Right side: 3-dot menu */}
          <View style={styles.headerRight}>
            {/* 3-dot menu */}
            <View style={styles.menuContainer}>
            <Menu
              visible={menuVisible}
              onDismiss={closeMenu}
              anchor={
                <IconButton
                  icon={<MaterialIcons name="more-vert" size={20} color={colors.text.tertiary} />}
                  onPress={toggleMenu}
                  style={styles.menuButton}
                  accessibilityLabel="Task menu"
                />
              }
            >
              <Menu.Item
                onPress={() => {
                  closeMenu();
                  onViewDetail?.();
                }}
                title="View Details"
                icon="visibility"
              />
              {hasAttachments && (
                <Menu.Item
                  onPress={() => {
                    closeMenu();
                    onViewAttachments?.();
                  }}
                  title="View Attachments"
                  icon="description"
                />
              )}
              {!isCompleted && (
                <Menu.Item
                  onPress={() => {
                    closeMenu();
                    onSubmit?.();
                  }}
                  title="Submit Task"
                  icon="upload"
                />
              )}
              {isCompleted && !isGraded && (
                <Menu.Item
                  onPress={handleUnsubmit}
                  title="Unsubmit Task"
                  icon="cancel"
                  destructive
                />
              )}
            </Menu>
            </View>
          </View>
        </View>

        {/* Metadata */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            {task.subjects && (
              <View style={styles.metaChip}>
                <MaterialIcons name="menu-book" size={14} color={colors.primary[600]} />
                <Text style={styles.metaChipText}>{task.subjects.subject_name}</Text>
              </View>
            )}
            <View style={[styles.metaChip, { backgroundColor: getPriorityColor(task.priority) + '15' }]}>
              <MaterialIcons name="error" size={14} color={getPriorityColor(task.priority)} />
              <Text style={[styles.metaChipText, { color: getPriorityColor(task.priority) }]}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={14} color={dueDateStatus.color} />
              <Text style={styles.metaLabel}>Due:</Text>
              <Text style={[styles.metaValue, { color: dueDateStatus.color }]}>
                {format(new Date(task.due_date), 'MMM dd, yyyy')}
              </Text>
            </View>
            {hasAttachments && (
              <>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <MaterialIcons name="description" size={14} color={colors.text.tertiary} />
                  <Text style={styles.metaValue}>
                    {task.attachments.length} {task.attachments.length === 1 ? 'file' : 'files'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Status Badge */}
        {isCompleted && (
          <View style={styles.statusBadge}>
            <MaterialIcons name="check-circle" size={16} color={colors.success[600]} />
            <Text style={styles.statusText}>Submitted</Text>
            {task.submission?.submitted_at && (
              <Text style={styles.statusDate}>
                on {format(new Date(task.submission.submitted_at), 'MMM dd, yyyy')}
              </Text>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  cardContent: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: 20,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  cardSubmitted: {
    backgroundColor: colors.neutral[50],
    opacity: 0.7,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cardContentSubmitted: {
    opacity: 0.8,
  },
  menuContainer: {
    marginLeft: spacing.xs,
  },
  menuButton: {
    margin: -spacing.xs,
  },
  metaSection: {
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
  },
  metaChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  metaValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  metaDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  statusDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
});

