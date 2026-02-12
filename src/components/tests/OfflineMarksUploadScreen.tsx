import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTestMarks, useCreateBulkMarks } from '../../hooks/tests';
import { useStudents } from '../../hooks/useStudents';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import {
  SearchBar,
  ProgressBar,
  Menu,
  Card,
  Button,
  LoadingView,
  ErrorView,
} from '../../ui';

export function OfflineMarksUploadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const { colors, typography, shadows, borderRadius, spacing } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, shadows, borderRadius, spacing), [colors, typography, shadows, borderRadius, spacing]);

  const testId = params.testId as string;
  const testTitle = params.testTitle as string;
  const maxMarks = parseInt(params.maxMarks as string) || 100;
  const classInstanceId = params.classInstanceId as string;

  const { data: existingMarks = [], isLoading: marksLoading } = useTestMarks(testId);
  const { data: studentsResponse, isLoading: studentsLoading } = useStudents(
    classInstanceId,
    profile?.school_code || ''
  );
  const students = studentsResponse?.data || [];
  const createBulkMarks = useCreateBulkMarks();

  const [marks, setMarks] = useState<Record<string, { marks: string; remarks: string }>>({});
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRemarks, setExpandedRemarks] = useState<Record<string, boolean>>({});
  const [quickMenuVisible, setQuickMenuVisible] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});
  const flatListRef = useRef<FlatList>(null);

  // Initialize marks from existing data
  React.useEffect(() => {
    if (existingMarks.length > 0) {
      const marksMap: Record<string, { marks: string; remarks: string }> = {};
      existingMarks.forEach((mark: any) => {
        marksMap[mark.student_id] = {
          marks: String(mark.marks_obtained),
          remarks: mark.remarks || '',
        };
      });
      setMarks(marksMap);
      setLastSavedAt(new Date());
    }
  }, [existingMarks]);

  const updateMarks = useCallback((studentId: string, marksValue: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { marks: marksValue, remarks: prev[studentId]?.remarks || '' },
    }));
  }, []);

  const updateRemarks = useCallback((studentId: string, remarksValue: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { marks: prev[studentId]?.marks || '', remarks: remarksValue },
    }));
  }, []);

  const [bulkMarksValue, setBulkMarksValue] = useState('');

  const handleBulkFill = useCallback(() => {
    if (!bulkMarksValue.trim()) {
      Alert.alert('Enter Marks', 'Please enter a marks value in the bulk fill input first');
      return;
    }
    const marksNum = parseFloat(bulkMarksValue);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > maxMarks) {
      Alert.alert('Invalid', `Enter a number between 0 and ${maxMarks}`);
      return;
    }
    Alert.alert('Bulk Fill', `Fill ${bulkMarksValue} for all unmarked students?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Fill',
        onPress: () => {
          const val = String(marksNum);
          students.forEach((student: any) => {
            const existing = marks[student.id];
            if (!existing || !existing.marks) {
              updateMarks(student.id, val);
            }
          });
          setBulkMarksValue('');
        },
      },
    ]);
  }, [bulkMarksValue, maxMarks, students, marks, updateMarks]);

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear All Marks', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setMarks({}) },
    ]);
  }, []);

  const toggleRemarks = useCallback((studentId: string) => {
    setExpandedRemarks(prev => ({ ...prev, [studentId]: !prev[studentId] }));
  }, []);

  // Filtered students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter((student: any) =>
      student.full_name?.toLowerCase().includes(q) ||
      student.student_code?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // Progress
  const progress = useMemo(() => {
    const markedCount = students.filter((s: any) => {
      const m = marks[s.id];
      return m?.marks && m.marks.trim() !== '';
    }).length;

    const totalMarksSum = students.reduce((sum: number, s: any) => {
      const m = marks[s.id];
      if (m?.marks?.trim()) {
        const num = parseFloat(m.marks);
        return sum + (isNaN(num) ? 0 : num);
      }
      return sum;
    }, 0);

    const avg = markedCount > 0 ? Math.round((totalMarksSum / markedCount) * 10) / 10 : 0;
    const pct = students.length > 0 ? Math.round((markedCount / students.length) * 100) : 0;

    return { marked: markedCount, total: students.length, pct, avg };
  }, [students, marks]);

  const hasChanges = useMemo(() => {
    // Check if marks differ from existingMarks
    return students.some((s: any) => {
      const current = marks[s.id];
      const existing = existingMarks.find((m: any) => m.student_id === s.id);
      if (!current?.marks?.trim() && !existing) return false;
      if (!current?.marks?.trim() && existing) return true;
      if (current?.marks?.trim() && !existing) return true;
      return String(existing?.marks_obtained) !== current?.marks || (existing?.remarks || '') !== (current?.remarks || '');
    });
  }, [students, marks, existingMarks]);

  const handleSaveMarks = async () => {
    // Validate
    const invalidStudents = students.filter((s: any) => {
      const m = marks[s.id];
      if (!m?.marks?.trim()) return false;
      const num = parseFloat(m.marks);
      return isNaN(num) || num < 0 || num > maxMarks;
    });

    if (invalidStudents.length > 0) {
      Alert.alert('Validation Error', `${invalidStudents.length} student(s) have invalid marks (must be 0-${maxMarks})`);
      return;
    }

    if (progress.marked === 0) {
      Alert.alert('No Marks', 'Please enter marks for at least one student');
      return;
    }

    Alert.alert('Save Marks', `Save marks for ${progress.marked} students?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: async () => {
          setSaving(true);
          try {
            const marksToSave = students
              .filter((s: any) => marks[s.id]?.marks?.trim())
              .map((s: any) => ({
                test_id: testId,
                student_id: s.id,
                marks_obtained: parseFloat(marks[s.id].marks),
                max_marks: maxMarks,
                remarks: marks[s.id].remarks || undefined,
                created_by: user?.id,
              }));

            await createBulkMarks.mutateAsync(marksToSave);
            setLastSavedAt(new Date());
            Alert.alert('Success', 'Marks saved successfully!', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save marks');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // renderStudentCard must be defined before early returns to avoid hooks-order violation
  const renderStudentCard = useCallback(({ item, index }: { item: any; index: number }) => {
    const studentMarks = marks[item.id] || { marks: '', remarks: '' };
    const hasMarks = !!studentMarks.marks?.trim();
    const marksNum = hasMarks ? parseFloat(studentMarks.marks) : null;
    const isValid = marksNum !== null && !isNaN(marksNum) && marksNum >= 0 && marksNum <= maxMarks;
    const isExpanded = expandedRemarks[item.id];
    const hasRemarks = !!studentMarks.remarks?.trim();

    return (
      <Card
        variant="outlined"
        padding="sm"
        style={hasMarks && isValid ? styles.cardFilled : hasMarks && !isValid ? styles.cardError : undefined}
      >
        <View style={styles.studentRow}>
          <View style={styles.studentInfo}>
            <Text style={styles.studentNumber}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.studentDetails}>
              <Text style={styles.studentName} numberOfLines={1}>{item.student_code} · {item.full_name}</Text>
            </View>
          </View>

          <View style={styles.marksInputWrapper}>
            <TextInput
              ref={(ref) => { inputRefs.current[item.id] = ref; }}
              style={[
                styles.marksInput,
                hasMarks && isValid && styles.marksInputFilled,
                hasMarks && !isValid && styles.marksInputError,
              ]}
              placeholder="—"
              value={studentMarks.marks}
              onChangeText={(text) => updateMarks(item.id, text)}
              keyboardType="number-pad"
              maxLength={String(maxMarks).length + 1}
              placeholderTextColor={colors.text.tertiary}
              returnKeyType="next"
              onSubmitEditing={() => {
                // Focus next student's input
                const nextStudent = filteredStudents[index + 1];
                if (nextStudent) inputRefs.current[nextStudent.id]?.focus();
              }}
            />
            <Text style={styles.maxMarksLabel}>/{maxMarks}</Text>
          </View>
        </View>

        {/* Expandable remarks */}
        <TouchableOpacity style={styles.remarksToggle} onPress={() => toggleRemarks(item.id)} activeOpacity={0.7}>
          <MaterialIcons name="chat-bubble-outline" size={12} color={hasRemarks ? colors.primary[600] : colors.text.tertiary} />
          <Text style={[styles.remarksToggleText, hasRemarks && { color: colors.primary[600] }]}>
            {hasRemarks ? 'Remarks added' : 'Add remarks'}
          </Text>
        </TouchableOpacity>
        {isExpanded && (
          <TextInput
            style={styles.remarksInput}
            placeholder="Optional remarks..."
            value={studentMarks.remarks}
            onChangeText={(text) => updateRemarks(item.id, text)}
            multiline
            placeholderTextColor={colors.text.tertiary}
          />
        )}
      </Card>
    );
  }, [marks, expandedRemarks, maxMarks, colors, filteredStudents, updateMarks, updateRemarks, toggleRemarks, styles]);

  // Early returns AFTER all hooks to satisfy React's rules of hooks
  if (studentsLoading || marksLoading) {
    return <LoadingView message="Loading students..." />;
  }

  if (!studentsLoading && students.length === 0) {
    return <ErrorView message="No students found for this class" onRetry={() => router.back()} />;
  }

  const savedTimeStr = lastSavedAt ? `Saved · ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>{testTitle}</Text>
            <Text style={styles.headerSubtitle}>Max: {maxMarks} · {progress.marked}/{progress.total} marked</Text>
          </View>
          {/* Quick action menu */}
          <Menu
            visible={quickMenuVisible}
            onDismiss={() => setQuickMenuVisible(false)}
            anchor={
              <TouchableOpacity onPress={() => setQuickMenuVisible(true)} style={styles.quickActionBtn}>
                <MaterialIcons name="bolt" size={20} color={colors.primary[600]} />
              </TouchableOpacity>
            }
          >
            <Menu.Item title="Bulk Fill Unmarked" icon="edit" onPress={() => { setQuickMenuVisible(false); setTimeout(handleBulkFill, 300); }} />
            <Menu.Item title="Clear All" icon="delete-sweep" onPress={() => { setQuickMenuVisible(false); handleClearAll(); }} destructive />
          </Menu>
        </View>

        {/* Progress bar */}
        <View style={styles.progressSection}>
          <ProgressBar
            progress={progress.pct}
            variant={progress.pct >= 100 ? 'success' : progress.pct >= 50 ? 'primary' : 'warning'}
            size="xs"
          />
          <View style={styles.progressStats}>
            <Text style={styles.progressText}>{progress.marked}/{progress.total} students · Avg {progress.avg}/{maxMarks}</Text>
            {savedTimeStr ? <Text style={styles.savedText}>{savedTimeStr}</Text> : null}
          </View>
        </View>

        {/* Search + bulk fill */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search students..."
                onClear={() => setSearchQuery('')}
              />
            </View>
            <View style={styles.bulkFillRow}>
              <TextInput
                style={styles.bulkInput}
                placeholder="0"
                value={bulkMarksValue}
                onChangeText={setBulkMarksValue}
                keyboardType="number-pad"
                placeholderTextColor={colors.text.tertiary}
              />
              <TouchableOpacity
                style={[styles.bulkFillBtn, !bulkMarksValue && { opacity: 0.5 }]}
                onPress={handleBulkFill}
                disabled={!bulkMarksValue}
              >
                <MaterialIcons name="bolt" size={14} color={colors.text.inverse} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Student list */}
        <FlatList
          ref={flatListRef}
          data={filteredStudents}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderStudentCard}
          removeClippedSubviews={true}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No students found</Text>
              </View>
            ) : null
          }
        />

        {/* Save bar */}
        <View style={[styles.saveBar, progress.pct >= 100 && styles.saveBarComplete]}>
          <View style={styles.saveBarContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.saveBarText}>
                {progress.marked} student{progress.marked !== 1 ? 's' : ''} marked
              </Text>
            </View>
            <Button
              onPress={handleSaveMarks}
              loading={saving}
              disabled={saving || progress.marked === 0}
              size="sm"
            >
              Save Marks
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, typography: any, shadows: any, borderRadius: any, spacing: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2,
  },
  quickActionBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  progressSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.light,
    gap: spacing.xs,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  savedText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.light,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bulkFillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bulkInput: {
    width: 40,
    height: 36,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 4,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  bulkFillBtn: {
    width: 30,
    height: 36,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 100,
    gap: spacing.xs,
  },
  cardFilled: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success[500],
  },
  cardError: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error[500],
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  studentNumber: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.tertiary,
    width: 24,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  studentDetails: {
    flex: 1,
    minWidth: 0,
  },
  studentName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  marksInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  marksInput: {
    width: 56,
    height: 40,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.DEFAULT,
  },
  marksInputFilled: {
    borderColor: colors.success[500],
    backgroundColor: colors.success[50],
    color: colors.success[700],
  },
  marksInputError: {
    borderColor: colors.error[500],
    backgroundColor: colors.error[50],
    color: colors.error[700],
  },
  maxMarksLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  remarksToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: colors.border.light,
  },
  remarksToggleText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  remarksInput: {
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    minHeight: 44,
    textAlignVertical: 'top',
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border.light,
    marginTop: spacing.xs,
  },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface.primary,
    borderTopWidth: 0.5,
    borderTopColor: colors.border.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.sm,
    ...shadows.md,
  },
  saveBarComplete: {
    backgroundColor: colors.success[50],
    borderTopColor: colors.success[200],
  },
  saveBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveBarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptyState: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
});
