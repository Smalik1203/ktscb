import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, Menu, IconButton } from 'react-native-paper';
import { Clock, Eye, FileText, MoreVertical, BarChart3, HelpCircle, Hash, TrendingUp, Calendar, Trash2, Edit } from 'lucide-react-native';
import { format } from 'date-fns';
import { TestWithDetails } from '../../types/test.types';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';

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
  const { colors, isDark } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const handleDelete = () => {
    setMenuVisible(false);
    onDelete?.();
  };

  const closeMenu = () => setMenuVisible(false);

  const isOnline = test.test_mode === 'online';
  const completionRate = isOnline && test.total_students 
    ? Math.round((test.attempts_count || 0) / test.total_students * 100)
    : test.total_students 
    ? Math.round((test.marks_uploaded || 0) / test.total_students * 100)
    : 0;

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
        {/* Top Row: Title & Menu */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title} numberOfLines={1}>
              {test.title}
            </Text>
            <View style={styles.subHeader}>
              <Text style={styles.subjectText}>{test.subject_name}</Text>
              {test.class_name && (
                <>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Text style={styles.classText}>{test.class_name}</Text>
                </>
              )}
            </View>
          </View>

          {showActions && (
            <Menu
              visible={menuVisible}
              onDismiss={closeMenu}
              anchor={
                <IconButton
                  icon={() => <MoreVertical size={20} color={colors.text.tertiary} />}
                  size={20}
                  onPress={() => setMenuVisible(true)}
                  style={styles.menuButton}
                />
              }
            >
              <Menu.Item 
                onPress={() => { closeMenu(); onPress?.(); }} 
                title={isOnline ? "View Questions" : "Manage Marks"} 
                leadingIcon={() => <Eye size={16} />} 
              />
              {onEdit && <Menu.Item onPress={() => { closeMenu(); onEdit(); }} title="Edit" leadingIcon={() => <Edit size={16} />} />}
              {onDelete && <Menu.Item onPress={handleDelete} title="Delete" leadingIcon={() => <Trash2 size={16} />} />}
            </Menu>
          )}
        </View>

        {/* Stats Row - Single Line */}
        <View style={styles.statsRow}>
          {isOnline ? (
            <>
              <Text style={styles.statText}>{test.question_count || 0} Questions</Text>
              {(test.attempts_count || 0) > 0 && (
                <>
                  <Text style={styles.statSeparator}>•</Text>
                  <Text style={styles.statText}>{test.attempts_count} Attempts</Text>
                </>
              )}
              {test.time_limit_seconds && (
                <>
                  <Text style={styles.statSeparator}>•</Text>
                  <Text style={styles.statText}>{Math.floor(test.time_limit_seconds / 60)}m</Text>
                </>
              )}
            </>
          ) : (
            <>
              <Text style={styles.statText}>Max: {test.max_marks || 100}</Text>
              {(test.total_students || 0) > 0 && (
                <>
                  <Text style={styles.statSeparator}>•</Text>
                  <Text style={styles.statText}>{test.marks_uploaded || 0}/{test.total_students} Graded</Text>
                </>
              )}
            </>
          )}
          
          {/* Progress pushes to the right */}
          {completionRate > 0 && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>{completionRate}%</Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    ...shadows.none,
    elevation: 0,
  },
  cardContent: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  classText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  dotSeparator: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginHorizontal: 6,
  },
  menuButton: {
    margin: -8,
    marginTop: -4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontWeight: '400',
  },
  statSeparator: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginHorizontal: 6,
  },
  progressContainer: {
    marginLeft: 'auto',
    backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[700],
  },
});
