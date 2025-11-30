import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { TestCard } from './TestCard';
import { StudentTestCard } from './StudentTestCard';
import { TestWithDetails, TestAttempt } from '../../types/test.types';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';

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
  headerComponent,
  filteredCount,
}: TestListProps) {
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Filter and search tests
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      // Search filter only
      const matchesSearch =
        searchQuery === '' ||
        test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.class_name?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [tests, searchQuery]);

  // Flatten data for FlatList (no section headers)
  const flatListData = useMemo(() => {
    return filteredTests.map(test => ({ type: 'item' as const, data: test }));
  }, [filteredTests]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No Tests Found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? 'Try adjusting your search'
          : 'Create your first test to get started'}
      </Text>
    </View>
  );

  const renderTestCard = (item: TestWithDetails) => {
    if (isStudentView) {
      const attempt = studentAttempts.find((a) => a.test_id === item.id);
      const mark = studentMarks[item.id];
      return <StudentTestCard test={item} attempt={attempt} mark={mark} />;
    }

    return (
      <TestCard
        test={item}
        onPress={() => onTestPress?.(item)}
        onEdit={() => onTestEdit?.(item)}
        onDelete={() => onTestDelete?.(item)}
        onManageQuestions={() => onManageQuestions?.(item)}
        onUploadMarks={() => onUploadMarks?.(item)}
        showActions={showActions}
      />
    );
  };

  const renderItem = ({ item }: { item: { type: 'item'; data: any } }) => {
    return (
      <View style={styles.testItem}>
        {renderTestCard(item.data)}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Prominent Search Bar - Always visible and anchored */}
      {tests.length > 0 && (
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <Search size={18} color={colors.primary[600]} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search assessments..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={colors.text.tertiary}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                  <X size={18} color={colors.text.secondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {filteredCount !== undefined && filteredCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{filteredCount}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Test List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading tests...</Text>
        </View>
      ) : (
        <>
          {flatListData.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={flatListData}
              renderItem={renderItem}
              keyExtractor={(item, index) => `test-${item.data.id}-${index}`}
              style={styles.scrollView}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={10}
              ListEmptyComponent={renderEmptyState}
            />
          )}
        </>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  scrollView: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.app,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border.DEFAULT,
    ...shadows.sm,
    elevation: 2,
  },
  countBadge: {
    backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    alignSelf: 'stretch',
  },
  countBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    lineHeight: typography.fontSize.sm,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    padding: 0,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyState: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  testItem: {
    marginBottom: spacing.sm,
  },
});
