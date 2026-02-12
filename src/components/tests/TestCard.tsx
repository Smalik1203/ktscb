import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card, Menu, Badge, ProgressBar, Chip } from '../../ui';
import { format } from 'date-fns';
import { TestWithDetails } from '../../types/test.types';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';

interface TestCardProps {
  test: TestWithDetails;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onManageQuestions?: () => void;
  onUploadMarks?: () => void;
  showActions?: boolean;
}

export function TestCard({
  test,
  onPress,
  onEdit,
  onDelete,
  onManageQuestions,
  onUploadMarks,
  showActions = true,
}: TestCardProps) {
  const { colors, isDark, spacing, typography, borderRadius } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const styles = useMemo(() => createStyles(colors, isDark, spacing, typography, borderRadius), [colors, isDark]);

  const closeMenu = () => setMenuVisible(false);
  const isOnline = test.test_mode === 'online';

  // Completion rate
  const completionRate = isOnline && test.total_students
    ? Math.round((test.attempts_count || 0) / test.total_students * 100)
    : test.total_students
      ? Math.round((test.marks_uploaded || 0) / test.total_students * 100)
      : 0;

  const completionCount = isOnline
    ? `${test.attempts_count || 0}/${test.total_students || 0}`
    : `${test.marks_uploaded || 0}/${test.total_students || 0}`;

  // Status
  const isPublished = test.status === 'active';
  const isDraft = test.status === 'draft';

  return (
    <Card style={styles.card} onPress={onPress} padding="none">
      <View style={styles.cardContent}>
        {/* Row 1: Title + badges + menu */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title} numberOfLines={2}>{test.title}</Text>
          </View>

          <View style={styles.headerRight}>
            {/* Status badge */}
            <Badge
              variant={isPublished ? 'success' : isDraft ? 'warning' : 'default'}
              size="xs"
            >
              {isPublished ? 'Published' : isDraft ? 'Draft' : test.status}
            </Badge>

            {showActions && (
              <Menu
                visible={menuVisible}
                onDismiss={closeMenu}
                anchor={
                  <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}>
                    <MaterialIcons name="more-vert" size={20} color={colors.text.tertiary} />
                  </TouchableOpacity>
                }
              >
                <Menu.Item
                  onPress={() => { closeMenu(); onPress?.(); }}
                  title={isOnline ? 'View Questions' : 'Manage Marks'}
                  icon="visibility"
                />
                {onManageQuestions && isOnline && (
                  <Menu.Item onPress={() => { closeMenu(); onManageQuestions(); }} title="Manage Questions" icon="quiz" />
                )}
                {onUploadMarks && !isOnline && (
                  <Menu.Item onPress={() => { closeMenu(); onUploadMarks(); }} title="Upload Marks" icon="upload" />
                )}
                {onEdit && <Menu.Item onPress={() => { closeMenu(); onEdit(); }} title="Edit" icon="edit" />}
                {onDelete && <Menu.Item onPress={() => { closeMenu(); onDelete(); }} title="Delete" icon="delete" destructive />}
              </Menu>
            )}
          </View>
        </View>

        {/* Row 2: Meta chips (subject, class, date, mode) */}
        <View style={styles.chipRow}>
          {/* Mode indicator */}
          <Chip
            size="sm"
            variant={isOnline ? 'primary' : 'secondary'}
            compact
            icon={<MaterialIcons name={isOnline ? 'desktop-windows' : 'fact-check'} size={12} color={isOnline ? colors.primary[600] : colors.secondary[600]} />}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Chip>

          {test.subject_name ? (
            <Chip size="sm" compact>
              {test.subject_name}
            </Chip>
          ) : null}

          {test.class_name ? (
            <Chip size="sm" compact>
              {test.class_name}
            </Chip>
          ) : null}

          {test.test_date ? (
            <Chip
              size="sm"
              compact
              icon={<MaterialIcons name="event" size={12} color={colors.text.secondary} />}
            >
              {format(new Date(test.test_date), 'MMM dd, yyyy')}
            </Chip>
          ) : null}
        </View>

        {/* Row 3: Stats + progress bar */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            {isOnline ? (
              <>
                <Text style={styles.statText}>{test.question_count || 0} Qs</Text>
                {test.time_limit_seconds ? (
                  <>
                    <Text style={styles.statDot}> · </Text>
                    <Text style={styles.statText}>{Math.floor(test.time_limit_seconds / 60)}m</Text>
                  </>
                ) : null}
              </>
            ) : (
              <Text style={styles.statText}>Max: {test.max_marks || 100}</Text>
            )}
            {(test.total_students || 0) > 0 && (
              <Text style={styles.completionText}>{completionCount} done</Text>
            )}
          </View>

          {/* Progress bar for completion rate */}
          {(test.total_students || 0) > 0 && (
            <ProgressBar
              progress={completionRate}
              variant={completionRate >= 100 ? 'success' : completionRate >= 50 ? 'primary' : 'warning'}
              size="xs"
            />
          )}
        </View>
      </View>
    </Card>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean, spacing: any, typography: any, borderRadius: any) => StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  cardContent: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
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
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: typography.fontSize.base * 1.4,
  },
  menuButton: {
    padding: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statsSection: {
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  statDot: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  completionText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
    marginLeft: 'auto',
  },
});
