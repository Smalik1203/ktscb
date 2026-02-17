import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TestCard } from './TestCard';
import { StudentTestCard } from './StudentTestCard';
import { TestWithDetails, TestAttempt } from '../../types/test.types';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { SearchBar, EmptyStateIllustration, Chip, SkeletonCard } from '../../ui';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type StudentFilter = 'all' | 'upcoming' | 'completed';
type AdminSort = 'date_desc' | 'date_asc' | 'name_asc';

interface TestListProps {
  tests: TestWithDetails[];
  loading?: boolean;
  onTestPress?: (test: TestWithDetails) => void;
  onTestEdit?: (test: TestWithDetails) => void;
  onTestDelete?: (test: TestWithDetails) => void;
  onManageQuestions?: (test: TestWithDetails) => void;
  onUploadMarks?: (test: TestWithDetails) => void;
  showActions?: boolean;
  isStudentView?: boolean;
  studentAttempts?: TestAttempt[];
  studentMarks?: Record<string, { marks_obtained: number; max_marks: number; remarks?: string | null; test_mode?: string }>;
  headerComponent?: React.ComponentType<any> | React.ReactElement | null;
  filteredCount?: number;
}

export function TestList({
  tests,
  loading = false,
  onTestPress,
  onTestEdit,
  onTestDelete,
  onManageQuestions,
  onUploadMarks,
  showActions = true,
  isStudentView = false,
  studentAttempts = [],
  studentMarks = {},
  filteredCount,
}: TestListProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, spacing, typography, borderRadius } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
  const [adminSort, setAdminSort] = useState<AdminSort>('date_desc');

  const styles = useMemo(() => createStyles(colors, isDark, spacing, typography, borderRadius), [colors, isDark]);

  // Search + filter + sort
  const processedTests = useMemo(() => {
    let result = tests;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.subject_name?.toLowerCase().includes(q) ||
        t.class_name?.toLowerCase().includes(q)
      );
    }

    // Student filter
    if (isStudentView && studentFilter !== 'all') {
      result = result.filter((t) => {
        const attempt = studentAttempts.find((a) => a.test_id === t.id);
        const mark = studentMarks[t.id];
        if (studentFilter === 'completed') {
          return attempt?.status === 'completed' || !!mark;
        }
        // upcoming = not completed
        return attempt?.status !== 'completed' && !mark;
      });
    }

    // Admin sort
    if (!isStudentView) {
      result = [...result].sort((a, b) => {
        switch (adminSort) {
          case 'date_asc':
            return (a.test_date || '').localeCompare(b.test_date || '');
          case 'name_asc':
            return a.title.localeCompare(b.title);
          case 'date_desc':
          default:
            return (b.test_date || '').localeCompare(a.test_date || '');
        }
      });
    }

    return result;
  }, [tests, searchQuery, studentFilter, adminSort, isStudentView, studentAttempts, studentMarks]);

  const renderTestCard = useCallback((item: TestWithDetails) => {
    if (isStudentView) {
      const attempt = studentAttempts.find((a) => a.test_id === item.id);
      const mark = studentMarks[item.id];
      return <StudentTestCard test={item} attempt={attempt} mark={mark} />;
    }
    return (
      <TestCard
        test={item}
        onPress={() => onTestPress?.(item)}
        onEdit={onTestEdit ? () => onTestEdit(item) : undefined}
        onDelete={onTestDelete ? () => onTestDelete(item) : undefined}
        onManageQuestions={onManageQuestions ? () => onManageQuestions(item) : undefined}
        onUploadMarks={onUploadMarks ? () => onUploadMarks(item) : undefined}
        showActions={showActions}
      />
    );
  }, [isStudentView, studentAttempts, studentMarks, onTestPress, onTestEdit, onTestDelete, onManageQuestions, onUploadMarks, showActions]);

  const renderItem = useCallback(({ item }: { item: TestWithDetails }) => {
    return <View style={styles.testItem}>{renderTestCard(item)}</View>;
  }, [renderTestCard, styles]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      {tests.length > 0 && (
        <View style={styles.searchSection}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search assessments..."
            onClear={() => setSearchQuery('')}
          />
        </View>
      )}

      {/* Filter chips (student view) / Sort chips (admin view) */}
      {tests.length > 0 && (
        <View style={styles.chipRow}>
          {isStudentView ? (
            <>
              <Chip
                size="sm"
                selected={studentFilter === 'all'}
                onPress={() => setStudentFilter('all')}
                variant={studentFilter === 'all' ? 'primary' : 'default'}
              >
                All ({tests.length})
              </Chip>
              <Chip
                size="sm"
                selected={studentFilter === 'upcoming'}
                onPress={() => setStudentFilter('upcoming')}
                variant={studentFilter === 'upcoming' ? 'info' : 'default'}
              >
                Upcoming
              </Chip>
              <Chip
                size="sm"
                selected={studentFilter === 'completed'}
                onPress={() => setStudentFilter('completed')}
                variant={studentFilter === 'completed' ? 'success' : 'default'}
              >
                Completed
              </Chip>
            </>
          ) : (
            <>
              <Chip
                size="sm"
                selected={adminSort === 'date_desc'}
                onPress={() => setAdminSort('date_desc')}
                variant={adminSort === 'date_desc' ? 'primary' : 'default'}
                icon={<MaterialIcons name="arrow-downward" size={12} color={adminSort === 'date_desc' ? colors.primary[600] : colors.text.secondary} />}
              >
                Newest
              </Chip>
              <Chip
                size="sm"
                selected={adminSort === 'date_asc'}
                onPress={() => setAdminSort('date_asc')}
                variant={adminSort === 'date_asc' ? 'primary' : 'default'}
                icon={<MaterialIcons name="arrow-upward" size={12} color={adminSort === 'date_asc' ? colors.primary[600] : colors.text.secondary} />}
              >
                Oldest
              </Chip>
              <Chip
                size="sm"
                selected={adminSort === 'name_asc'}
                onPress={() => setAdminSort('name_asc')}
                variant={adminSort === 'name_asc' ? 'primary' : 'default'}
                icon={<MaterialIcons name="sort-by-alpha" size={12} color={adminSort === 'name_asc' ? colors.primary[600] : colors.text.secondary} />}
              >
                A-Z
              </Chip>
            </>
          )}
        </View>
      )}

      {/* List */}
      {processedTests.length === 0 ? (
        <EmptyStateIllustration
          type="tests"
          title={searchQuery ? 'No results' : isStudentView && studentFilter !== 'all' ? `No ${studentFilter} tests` : 'No tests'}
          description={searchQuery
            ? 'Try adjusting your search'
            : 'No assessments available'
          }
        />
      ) : (
        <FlatList
          data={processedTests}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.flatList}
          contentContainerStyle={[styles.listContent, { paddingBottom: spacing.xl * 2 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean, spacing: any, typography: any, borderRadius: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.sm,
  },
  skeletonContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  testItem: {},
});
