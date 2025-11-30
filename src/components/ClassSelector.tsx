import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { Users, ChevronDown } from 'lucide-react-native';
import { useClassSelection } from '../contexts/ClassSelectionContext';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../theme/types';

interface ClassSelectorProps {
  style?: any;
}

export const ClassSelector: React.FC<ClassSelectorProps> = ({ style }) => {
  const {
    selectedClass,
    setSelectedClass,
    classes,
    isLoading,
    shouldShowClassSelector,
    error
  } = useClassSelection();

  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);


  if (!shouldShowClassSelector) {
    return null;
  }

  if (isLoading) {
    return (
      <Card style={[styles.container, style]}>
        <Card.Content style={styles.content}>
          <Text variant="bodyMedium" style={styles.loadingText}>Loading classes...</Text>
        </Card.Content>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={[styles.container, style]}>
        <Card.Content style={styles.content}>
          <Text variant="bodyMedium" style={styles.errorText}>Error loading classes: {error.message}</Text>
        </Card.Content>
      </Card>
    );
  }

  if (classes.length === 0) {
    return (
      <Card style={[styles.container, style]}>
        <Card.Content style={styles.content}>
          <Text variant="bodyMedium" style={styles.emptyText}>No classes found</Text>
        </Card.Content>
      </Card>
    );
  }

  const handleClassSelect = (classItem: any) => {
    setSelectedClass(classItem);
  };

  return (
    <Card style={[styles.container, style]}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Users size={20} color={colors.primary[500]} />
            <Text variant="titleMedium" style={styles.title}>Select Class</Text>
          </View>
          <ChevronDown size={20} color={colors.neutral[500]} />
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* All Classes Option - only for superadmin/cb_admin */}
          {shouldShowClassSelector && (
            <TouchableOpacity
              style={[
                styles.classChip,
                !selectedClass && styles.classChipSelected
              ]}
              onPress={() => setSelectedClass(null)}
            >
              <Text style={[
                styles.classChipText,
                !selectedClass && styles.classChipTextSelected
              ]}>
                All Classes
              </Text>
              <Text style={[
                styles.studentCount,
                !selectedClass && styles.studentCountSelected
              ]}>
                {classes.reduce((total, cls) => total + (cls.student_count || 0), 0)} students
              </Text>
            </TouchableOpacity>
          )}
          
          {classes.map((classItem) => (
            <TouchableOpacity
              key={classItem.id}
              style={[
                styles.classChip,
                selectedClass?.id === classItem.id && styles.classChipSelected
              ]}
              onPress={() => handleClassSelect(classItem)}
            >
              <Text style={[
                styles.classChipText,
                selectedClass?.id === classItem.id && styles.classChipTextSelected
              ]}>
                Grade {classItem.grade}-{classItem.section}
              </Text>
              {(classItem.student_count ?? 0) > 0 && (
                <Text style={[
                  styles.studentCount,
                  selectedClass?.id === classItem.id && styles.studentCountSelected
                ]}>
                  {classItem.student_count} students
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.selectedInfo}>
          <Text variant="bodySmall" style={styles.selectedText}>
            Viewing data for: <Text style={styles.selectedClassText}>
              {selectedClass ? `Grade ${selectedClass.grade}-${selectedClass.section}` : 'All Classes'}
            </Text>
          </Text>
          {selectedClass?.class_teacher_name && (
            <Text variant="bodySmall" style={styles.teacherText}>
              Class Teacher: {selectedClass.class_teacher_name}
            </Text>
          )}
          {!selectedClass && (
            <Text variant="bodySmall" style={styles.teacherText}>
              Showing data from all {classes.length} classes
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    margin: spacing['4'],
    marginBottom: spacing['2'],
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
  },
  content: {
    padding: spacing['4'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['3'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
  },
  title: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  scrollView: {
    marginBottom: spacing['3'],
  },
  scrollContent: {
    paddingRight: spacing['4'],
  },
  classChip: {
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 2,
    borderColor: colors.neutral[300],
    marginRight: spacing['2'],
    minWidth: 120,
    alignItems: 'center',
  },
  classChipSelected: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[500],
  },
  classChipText: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing['1'],
  },
  classChipTextSelected: {
    color: colors.primary[600],
  },
  studentCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  studentCountSelected: {
    color: colors.primary[500],
  },
  selectedInfo: {
    paddingTop: spacing['3'],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  selectedText: {
    color: colors.text.secondary,
    marginBottom: spacing['1'],
  },
  selectedClassText: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  teacherText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.text.secondary,
    paddingVertical: spacing['4'],
  },
  errorText: {
    textAlign: 'center',
    color: colors.error[500],
    paddingVertical: spacing['4'],
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.secondary,
    paddingVertical: spacing['4'],
  },
});
