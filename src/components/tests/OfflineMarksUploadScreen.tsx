import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, Check, Search, X, Users, MessageSquare, Zap } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTestMarks, useCreateBulkMarks } from '../../hooks/tests';
import { useStudents } from '../../hooks/useStudents';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { spacing, borderRadius } from '../../../lib/design-system';

export function OfflineMarksUploadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const { colors, typography: themeTypography, shadows: themeShadows, borderRadius: themeBorderRadius } = useTheme();
  const styles = useMemo(() => createStyles(colors, themeTypography, themeShadows, themeBorderRadius), [colors, themeTypography, themeShadows, themeBorderRadius]);

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
  const [bulkMarksValue, setBulkMarksValue] = useState('');
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
    }
  }, [existingMarks]);

  const updateMarks = (studentId: string, marksValue: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: {
        marks: marksValue,
        remarks: prev[studentId]?.remarks || '',
      },
    }));
  };

  const updateRemarks = (studentId: string, remarksValue: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: {
        marks: prev[studentId]?.marks || '',
        remarks: remarksValue,
      },
    }));
  };

  const handleBulkFill = () => {
    if (!bulkMarksValue.trim()) {
      Alert.alert('Invalid Input', 'Please enter marks value');
      return;
    }

    const marksNum = parseFloat(bulkMarksValue);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > maxMarks) {
      Alert.alert('Invalid Marks', `Please enter a value between 0 and ${maxMarks}`);
      return;
    }

    Alert.alert(
      'Bulk Fill Marks',
      `Fill ${bulkMarksValue} marks for all unmarked students?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fill',
          onPress: () => {
            students.forEach((student: any) => {
              const existing = marks[student.id];
              if (!existing || !existing.marks) {
                updateMarks(student.id, bulkMarksValue);
              }
            });
            setBulkMarksValue('');
            Alert.alert('Success', 'Marks filled for all unmarked students');
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Marks',
      'Are you sure you want to clear all entered marks?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setMarks({});
            Alert.alert('Cleared', 'All marks have been cleared');
          },
        },
      ]
    );
  };

  const toggleRemarks = (studentId: string) => {
    setExpandedRemarks(prev => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter((student: any) => 
      student.full_name?.toLowerCase().includes(query) ||
      student.student_code?.toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  // Calculate progress and statistics
  const progress = useMemo(() => {
    const markedCount = students.filter((student: any) => {
      const studentMarks = marks[student.id];
      return studentMarks?.marks && studentMarks.marks.trim() !== '';
    }).length;

    const totalMarks = students.reduce((sum: number, student: any) => {
      const studentMarks = marks[student.id];
      if (studentMarks?.marks && studentMarks.marks.trim() !== '') {
        const marksNum = parseFloat(studentMarks.marks);
        return sum + (isNaN(marksNum) ? 0 : marksNum);
      }
      return sum;
    }, 0);

    const averageMarks = markedCount > 0 ? totalMarks / markedCount : 0;

    return {
      marked: markedCount,
      total: students.length,
      percentage: students.length > 0 ? Math.round((markedCount / students.length) * 100) : 0,
      totalMarks,
      averageMarks: Math.round(averageMarks * 10) / 10,
    };
  }, [students, marks]);

  const validateMarks = () => {
    const errors: string[] = [];

    students.forEach((student: any) => {
      const studentMarks = marks[student.id];
      if (studentMarks?.marks && studentMarks.marks.trim() !== '') {
        const marksNum = parseFloat(studentMarks.marks);
        if (isNaN(marksNum)) {
          errors.push(`Invalid marks for ${student.full_name}`);
        } else if (marksNum < 0 || marksNum > maxMarks) {
          errors.push(`Marks for ${student.full_name} must be between 0 and ${maxMarks}`);
        }
      }
    });

    if (errors.length > 0) {
      Alert.alert('Validation Errors', errors.join('\n'));
      return false;
    }

    if (progress.marked === 0) {
      Alert.alert('No Marks Entered', 'Please enter marks for at least one student');
      return false;
    }

    return true;
  };

  const handleSaveMarks = async () => {
    if (!validateMarks()) return;

    Alert.alert(
      'Confirm Save',
      `Save marks for ${progress.marked} students?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          style: 'default',
          onPress: async () => {
            setSaving(true);
            try {
              // Prepare marks data for bulk insert
              const marksToSave = students
                .filter((student: any) => {
                  const studentMarks = marks[student.id];
                  return studentMarks?.marks && studentMarks.marks.trim() !== '';
                })
                .map((student: any) => {
                  const studentMarks = marks[student.id];
                  return {
                    test_id: testId,
                    student_id: student.id,
                    marks_obtained: parseFloat(studentMarks.marks),
                    max_marks: maxMarks,
                    remarks: studentMarks.remarks || undefined,
                    created_by: user?.id,
                  };
                });

              await createBulkMarks.mutateAsync(marksToSave);
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
      ]
    );
  };

  if (studentsLoading || marksLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error if no students found
  if (!studentsLoading && students.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Upload Marks</Text>
            <Text style={styles.headerSubtitle}>{testTitle}</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>No students found for this class.</Text>
          <Text style={styles.errorSubtext}>
            Class ID: {classInstanceId || 'Not provided'}
          </Text>
          <Text style={styles.errorSubtext}>
            School: {profile?.school_code || 'Not found'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>{testTitle}</Text>
            <Text style={styles.headerSubtitle}>Max: {maxMarks} marks</Text>
          </View>
        </View>

        {/* Progress Bar & Statistics */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressInfo}>
              <Users size={16} color={colors.primary[600]} />
              <Text style={styles.progressText}>
                {progress.marked} of {progress.total} students
              </Text>
            </View>
            <Text style={styles.progressPercentage}>{progress.percentage}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress.percentage}%` }]} />
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Search size={18} color={colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search students..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.text.tertiary}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Quick Actions */}
        {(
          <View style={styles.quickActionsSection}>
            <View style={styles.quickActionsRow}>
              <View style={styles.bulkInputContainer}>
                <TextInput
                  style={styles.bulkInput}
                  placeholder="Bulk fill"
                  value={bulkMarksValue}
                  onChangeText={setBulkMarksValue}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.text.tertiary}
                />
                <TouchableOpacity
                  style={[styles.quickActionButton, !bulkMarksValue && styles.quickActionButtonDisabled]}
                  onPress={handleBulkFill}
                  disabled={!bulkMarksValue}
                >
                  <Zap size={16} color={colors.text.inverse} />
                  <Text style={styles.quickActionText}>Fill</Text>
                </TouchableOpacity>
              </View>
              {progress.marked > 0 && (
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.clearButton]}
                  onPress={handleClearAll}
                >
                  <X size={16} color={colors.error[600]} />
                  <Text style={[styles.quickActionText, { color: colors.error[600] }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Student List */}
        <FlatList
          ref={flatListRef}
          data={filteredStudents}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const studentMarks = marks[item.id] || { marks: '', remarks: '' };
            const hasMarks = studentMarks.marks && studentMarks.marks.trim() !== '';
            const marksNum = hasMarks ? parseFloat(studentMarks.marks) : null;
            const isValidMarks = marksNum !== null && !isNaN(marksNum) && marksNum >= 0 && marksNum <= maxMarks;
            const hasRemarks = studentMarks.remarks && studentMarks.remarks.trim() !== '';
            const isExpanded = expandedRemarks[item.id];

            return (
              <View style={[styles.studentCard, hasMarks && isValidMarks && styles.studentCardFilled]}>
                <View style={styles.studentRow}>
                  {/* Left: Student Info */}
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentNumber}>{String(index + 1).padStart(2, '0')}</Text>
                    <View style={styles.studentDetails}>
                      <Text style={styles.studentName} numberOfLines={1}>{item.full_name}</Text>
                      <Text style={styles.studentCode}>{item.student_code}</Text>
                    </View>
                  </View>

                  {/* Right: Marks Input */}
                  <View style={styles.marksInputWrapper}>
                    <TextInput
                      ref={(ref) => { inputRefs.current[item.id] = ref; }}
                      style={[
                        styles.marksInput,
                        hasMarks && isValidMarks && styles.marksInputFilled,
                        hasMarks && !isValidMarks && styles.marksInputError
                      ]}
                      placeholder="—"
                      value={studentMarks.marks}
                      onChangeText={(text) => updateMarks(item.id, text)}
                      keyboardType="number-pad"
                      maxLength={String(maxMarks).length}
                      placeholderTextColor={colors.text.tertiary}
                    />
                    {hasMarks && isValidMarks && (
                      <View style={styles.checkIndicator}>
                        <Check size={10} color={colors.text.inverse} strokeWidth={2.5} />
                      </View>
                    )}
                  </View>
                </View>

                {/* Remarks - Always visible, compact */}
                <View style={styles.remarksRow}>
                  <TouchableOpacity
                    style={styles.remarksButton}
                    onPress={() => toggleRemarks(item.id)}
                    activeOpacity={0.7}
                  >
                    <MessageSquare size={12} color={hasRemarks ? colors.primary[600] : colors.text.tertiary} />
                    <Text style={[styles.remarksButtonText, hasRemarks && styles.remarksButtonTextActive]}>
                      {hasRemarks ? 'Remarks added' : 'Add remarks'}
                    </Text>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.remarksInputWrapper}>
                      <TextInput
                        style={styles.remarksInput}
                        placeholder="Optional remarks..."
                        value={studentMarks.remarks}
                        onChangeText={(text) => updateRemarks(item.id, text)}
                        multiline
                        numberOfLines={2}
                        placeholderTextColor={colors.text.tertiary}
                        autoFocus={false}
                      />
                    </View>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No students found</Text>
                <Text style={styles.emptyStateSubtext}>Try a different search term</Text>
              </View>
            ) : null
          }
        />

        {/* Fixed Save Button */}
        <View style={styles.saveBar}>
          <View style={styles.saveBarContent}>
            <View style={styles.saveBarStats}>
              <Text style={styles.saveBarStatsText}>
                {progress.marked} student{progress.marked !== 1 ? 's' : ''} marked
              </Text>
              {progress.marked > 0 && (
                <Text style={styles.saveBarStatsSubtext}>
                  Avg: {progress.averageMarks} / {maxMarks}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.saveButton, (saving || progress.marked === 0) && styles.saveButtonDisabled]}
              onPress={handleSaveMarks}
              disabled={saving || progress.marked === 0}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <>
                  <Save size={18} color={colors.text.inverse} />
                  <Text style={styles.saveButtonText}>Save Marks</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, typography: any, shadows: any, borderRadius: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
    marginTop: 2,
  },
  progressSection: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.light,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  progressPercentage: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.full,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.light,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    gap: spacing.xs,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    padding: 0,
  },
  quickActionsSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.light,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  bulkInputContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  bulkInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
  },
  quickActionButtonDisabled: {
    opacity: 0.5,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  clearButton: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  studentCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  studentCardFilled: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success[500],
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
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
    width: 28,
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
    marginBottom: 2,
  },
  studentCode: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  marksInputWrapper: {
    position: 'relative',
  },
  marksInput: {
    width: 70,
    height: 48,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.fontSize.xl,
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
    borderWidth: 2,
  },
  marksInputError: {
    borderColor: colors.error[500],
    backgroundColor: colors.error[50],
    color: colors.error[700],
    borderWidth: 2,
  },
  checkIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface.primary,
    ...shadows.sm,
  },
  remarksRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: colors.border.light,
  },
  remarksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  remarksButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
  remarksButtonTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  remarksInputWrapper: {
    marginTop: spacing.xs,
  },
  remarksInput: {
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    minHeight: 52,
    textAlignVertical: 'top',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border.light,
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
  saveBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveBarStats: {
    flex: 1,
  },
  saveBarStatsText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  saveBarStatsSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  emptyState: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  errorSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
    textAlign: 'center',
  },
});
