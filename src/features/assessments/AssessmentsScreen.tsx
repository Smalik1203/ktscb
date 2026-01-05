import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, Modal } from 'react-native';
import { Text, Card, SegmentedButtons, ActivityIndicator , Portal, Modal as PaperModal } from 'react-native-paper';
import { Plus, Sparkles, FileText, X, Monitor, FileCheck, BookOpen, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTests, useCreateTest, useUpdateTest, useDeleteTest, useStudentAttempts, useStudentMarks } from '../../hooks/tests';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { TestInput, TestWithDetails } from '../../types/test.types';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';
import { TestList } from '../../components/tests/TestList';
import { CreateTestForm } from '../../components/tests/CreateTestForm';
import { LoadingView, ErrorView } from '../../components/ui';
import { EmptyStateIllustration } from '../../components/ui/EmptyStateIllustration';

export default function AssessmentsScreen() {
  const { profile, user } = useAuth();
  const { colors, isDark } = useTheme();
  const { can, isLoading: capabilitiesLoading } = useCapabilities();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Capability-based checks (NO role checks in UI)
  const canCreateTest = can('assessments.create');
  const canManageTests = can('assessments.manage');
  const canTakeTest = can('assessments.take_test');
  const canViewOwnAssessments = can('assessments.read_own') && !can('assessments.read');
  const canUploadMarks = can('assessments.upload_marks');
  
  // Create dynamic styles based on theme
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [editingTest, setEditingTest] = useState<TestWithDetails | undefined>(undefined);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [assessmentView, setAssessmentView] = useState<'online' | 'offline'>('online');
  const [showCreateActionsModal, setShowCreateActionsModal] = useState(false);
  
  // Animated values for bottom sheets
  const classSlideAnim = React.useRef(new Animated.Value(0)).current;
  const modeSlideAnim = React.useRef(new Animated.Value(0)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  const studentId = canViewOwnAssessments ? user?.id : undefined;

  // OPTIMIZED: Filter by test_mode in SQL query, not JavaScript
  const { data: tests = [], isLoading: testsLoading, error: testsError } = useTests(
    profile?.school_code || '',
    selectedClassId || (canViewOwnAssessments ? profile?.class_instance_id || undefined : undefined),
    { test_mode: assessmentView } // Filter in query
  );
  const { data: classes = [] } = useClasses(profile?.school_code || '');
  const { data: subjectsResult } = useSubjects(profile?.school_code || '');
  const subjects = subjectsResult?.data || [];

  // Fetch student attempts if user is a student (for online tests)
  const { data: rawStudentAttempts = [] } = useStudentAttempts(studentId || '', undefined);
  
  // Fetch student marks if user is a student (for offline tests)
  const { data: rawStudentMarks = [] } = useStudentMarks(studentId || '');
  
  // Map student attempts to match TestAttempt type
  const studentAttempts = React.useMemo(() => {
    if (!rawStudentAttempts || !Array.isArray(rawStudentAttempts)) return [];
    return rawStudentAttempts.map((attempt: any) => ({
      id: attempt.id,
      test_id: attempt.test_id,
      student_id: attempt.student_id,
      answers: (() => {
        // Runtime-safe JSON parsing with fallback
        if (typeof attempt.answers === 'object' && attempt.answers !== null) {
          return attempt.answers;
        }
        if (typeof attempt.answers === 'string' && attempt.answers.trim().length > 0) {
          try {
            return JSON.parse(attempt.answers);
          } catch (parseError) {
            // Invalid JSON - return empty object
            console.warn('Failed to parse attempt answers JSON:', parseError);
            return {};
          }
        }
        return {};
      })(),
      score: attempt.score,
      status: attempt.status,
      started_at: attempt.started_at,
      completed_at: attempt.completed_at,
      earned_points: attempt.earned_points,
      total_points: attempt.total_points,
      time_taken_seconds: attempt.time_taken_seconds,
    }));
  }, [rawStudentAttempts]);

  // Map student marks for offline tests
  const studentMarks = React.useMemo(() => {
    if (!rawStudentMarks || !Array.isArray(rawStudentMarks)) return {};
    return rawStudentMarks.reduce((acc: Record<string, any>, mark: any) => {
      acc[mark.test_id] = {
        marks_obtained: mark.marks_obtained,
        max_marks: mark.max_marks,
        remarks: mark.remarks,
        test_mode: mark.tests?.test_mode,
      };
      return acc;
    }, {});
  }, [rawStudentMarks]);

  // Tests are already filtered by test_mode in the query
  const filteredTests = tests;

  // Calculate test counts for header
  const onlineCount = React.useMemo(() => 
    tests.filter((test: TestWithDetails) => test.test_mode === 'online').length,
    [tests]
  );
  const offlineCount = React.useMemo(() => 
    tests.filter((test: TestWithDetails) => test.test_mode === 'offline').length,
    [tests]
  );

  // Animation effects for bottom sheets
  React.useEffect(() => {
    if (showClassPicker) {
      classSlideAnim.setValue(0);
      overlayOpacity.setValue(0);
      
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(classSlideAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(classSlideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showClassPicker]);

  React.useEffect(() => {
    if (showModePicker) {
      modeSlideAnim.setValue(0);
      overlayOpacity.setValue(0);
      
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(modeSlideAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(modeSlideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showModePicker]);

  // Mutations
  const createTest = useCreateTest();
  const updateTest = useUpdateTest();
  const deleteTest = useDeleteTest();

  const handleCreateTest = async (testData: TestInput) => {
    try {
      await createTest.mutateAsync(testData);
      Alert.alert('Success', 'Test created successfully');
      setShowCreateModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create test');
      throw error;
    }
  };

  const handleUpdateTest = async (testData: TestInput) => {
    if (!editingTest) return;

    try {
      await updateTest.mutateAsync({ testId: editingTest.id, testData });
      Alert.alert('Success', 'Test updated successfully');
      setEditingTest(undefined);
      setShowCreateModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update test');
      throw error;
    }
  };

  const handleDeleteTest = async (test: TestWithDetails) => {
    try {
      await deleteTest.mutateAsync(test.id);
      Alert.alert('Success', 'Test deleted successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete test');
    }
  };

  const handleTestPress = (test: TestWithDetails) => {
    // For admins/superadmins
    if (canManageTests) {
      // For offline tests, navigate to marks screen (student list)
      if (test.test_mode === 'offline') {
        router.push(
          `/test/${test.id}/marks?testTitle=${encodeURIComponent(test.title)}&maxMarks=${test.max_marks || 100}&classInstanceId=${test.class_instance_id}`
        );
      } else {
        // For online tests, navigate to questions screen
        router.push(`/test/${test.id}/questions?testTitle=${encodeURIComponent(test.title)}`);
      }
    } else {
      // For students, show alert or navigate to appropriate screen
      Alert.alert('Test Details', `View details for: ${test.title}`);
    }
  };

  const handleEditTest = (test: TestWithDetails) => {
    setEditingTest(test);
    setShowCreateModal(true);
  };

  const handleManageQuestions = (test: TestWithDetails) => {
    router.push(`/test/${test.id}/questions?testTitle=${encodeURIComponent(test.title)}`);
  };

  const handleUploadMarks = (test: TestWithDetails) => {
    router.push(
      `/test/${test.id}/marks?testTitle=${encodeURIComponent(test.title)}&maxMarks=${test.max_marks || 100}&classInstanceId=${test.class_instance_id}`
    );
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingTest(undefined);
  };


  const handleCreateNewTest = () => {
    setShowCreateActionsModal(false);
    setEditingTest(undefined);
    setShowCreateModal(true);
  };

  const handleAIGenerate = () => {
    setShowCreateActionsModal(false);
    router.push('/ai-test-generator');
  };

  const getSelectedClassName = () => {
    if (!selectedClassId) return 'All Classes';
    const selectedClass = classes.find((c) => c.id === selectedClassId);
    return selectedClass ? `${selectedClass.grade}-${selectedClass.section}` : 'All Classes';
  };

  // Three-state handling
  if (testsLoading && filteredTests.length === 0 && !tests) {
    return <LoadingView message="Loading assessments..." />;
  }

  if (testsError && !testsLoading) {
    return <ErrorView message={testsError.message} />;
  }

  // Professional header with visual hierarchy
  const renderHeader = () => (
    <>
      {/* Filter Section - Matching Other Screens */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          {/* Mode Filter */}
          <TouchableOpacity
            style={styles.filterItem}
            onPress={() => setShowModePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.filterIcon}>
              {assessmentView === 'online' ? (
                <Monitor size={16} color={colors.text.inverse} />
              ) : (
                <FileCheck size={16} color={colors.text.inverse} />
              )}
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterLabel}>Mode</Text>
              <Text style={styles.filterValue} numberOfLines={1}>
                {assessmentView === 'online' ? 'Online' : 'Offline'}
                {assessmentView === 'online' && onlineCount > 0 && ` (${onlineCount})`}
                {assessmentView === 'offline' && offlineCount > 0 && ` (${offlineCount})`}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Divider */}
          {canCreateTest && <View style={styles.filterDivider} />}

          {/* Class Filter - Only for admins */}
          {canCreateTest && (
            <TouchableOpacity
              style={styles.filterItem}
              onPress={() => setShowClassPicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.filterIcon}>
                <BookOpen size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterLabel}>Class</Text>
                <Text style={styles.filterValue} numberOfLines={1}>
                  {getSelectedClassName()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>


    </>
  );

  return (
    <View style={styles.container}>
      {/* Loading State */}
      {testsLoading ? (
        <LoadingView message="Loading assessments..." />
      ) : filteredTests.length === 0 ? (
        /* Empty State with Header */
        <>
          {renderHeader()}
          <EmptyStateIllustration
            type="tests"
            title="No Tests"
            description={canCreateTest
              ? "Get started by creating your first assessment"
              : "No assessments available yet"
            }
            action={canCreateTest ? (
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleCreateNewTest}
              >
                <Plus size={20} color={colors.text.inverse} />
                <Text style={styles.emptyStateButtonText}>Create Test</Text>
              </TouchableOpacity>
            ) : undefined}
          />
        </>
      ) : (
        /* Test List with Header */
        <>
          {renderHeader()}
          <View style={styles.testsContainer}>
            <TestList
              tests={filteredTests}
              loading={testsLoading}
              onTestPress={handleTestPress}
              onTestEdit={canManageTests ? handleEditTest : undefined}
              onTestDelete={canManageTests ? handleDeleteTest : undefined}
              onManageQuestions={canManageTests ? handleManageQuestions : undefined}
              onUploadMarks={canManageTests ? handleUploadMarks : undefined}
              showActions={canManageTests}
              isStudentView={canViewOwnAssessments}
              studentAttempts={studentAttempts}
              studentMarks={studentMarks}
              filteredCount={filteredTests.length}
            />
          </View>
        </>
      )}

      {/* Floating Action Button */}
      {canCreateTest && (
        <TouchableOpacity
          style={[styles.fab, { bottom: 16 + Math.max(insets.bottom, 0) }]}
          onPress={() => setShowCreateActionsModal(true)}
          activeOpacity={0.85}
        >
          <Plus size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      )}

      {/* Create Actions Modal */}
      <Portal>
        <PaperModal
          visible={showCreateActionsModal}
          onDismiss={() => setShowCreateActionsModal(false)}
          contentContainerStyle={styles.actionsModalContainer}
        >
          <View style={styles.actionsModalHeader}>
            <Text style={styles.actionsModalTitle}>Create Assessment</Text>
            <TouchableOpacity 
              onPress={() => setShowCreateActionsModal(false)} 
              style={styles.actionsModalCloseButton}
            >
              <X size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionsList}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleCreateNewTest}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                <Plus size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Create Test Manually</Text>
                <Text style={styles.actionDescription}>Build your test step by step</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleAIGenerate}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.accent[50] }]}>
                <Sparkles size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Generate with AI</Text>
                <Text style={styles.actionDescription}>Let AI create questions for you</Text>
              </View>
            </TouchableOpacity>
          </View>
        </PaperModal>
      </Portal>

      {/* Mode Picker Modal - Bottom Sheet */}
      <Modal
        visible={showModePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModePicker(false)}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity 
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => setShowModePicker(false)}
          />
          <Animated.View 
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    translateY: modeSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Mode</Text>
            <ScrollView style={styles.sheetContent}>
              <TouchableOpacity
                style={[styles.sheetItem, assessmentView === 'online' && styles.sheetItemActive]}
                onPress={() => {
                  setAssessmentView('online');
                  setShowModePicker(false);
                }}
              >
                <View style={styles.sheetItemLeft}>
                  <Monitor size={20} color={assessmentView === 'online' ? colors.primary[600] : colors.text.secondary} />
                  <Text style={[styles.sheetItemText, assessmentView === 'online' && styles.sheetItemTextActive]}>
                    Online
                  </Text>
                </View>
                {assessmentView === 'online' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetItem, assessmentView === 'offline' && styles.sheetItemActive]}
                onPress={() => {
                  setAssessmentView('offline');
                  setShowModePicker(false);
                }}
              >
                <View style={styles.sheetItemLeft}>
                  <FileCheck size={20} color={assessmentView === 'offline' ? colors.primary[600] : colors.text.secondary} />
                  <Text style={[styles.sheetItemText, assessmentView === 'offline' && styles.sheetItemTextActive]}>
                    Offline
                  </Text>
                </View>
                {assessmentView === 'offline' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Class Picker Modal - Bottom Sheet */}
      <Modal
        visible={showClassPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowClassPicker(false)}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity 
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => setShowClassPicker(false)}
          />
          <Animated.View 
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    translateY: classSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Class</Text>
            <ScrollView style={styles.sheetContent}>
              <TouchableOpacity
                style={[styles.sheetItem, !selectedClassId && styles.sheetItemActive]}
                onPress={() => {
                  setSelectedClassId(undefined);
                  setShowClassPicker(false);
                }}
              >
                <Text style={[styles.sheetItemText, !selectedClassId && styles.sheetItemTextActive]}>
                  All Classes
                </Text>
                {!selectedClassId && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.sheetItem, selectedClassId === cls.id && styles.sheetItemActive]}
                  onPress={() => {
                    setSelectedClassId(cls.id);
                    setShowClassPicker(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, selectedClassId === cls.id && styles.sheetItemTextActive]}>
                    Grade {cls.grade} - {cls.section}
                  </Text>
                  {selectedClassId === cls.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Create/Edit Test Modal */}
      {showCreateModal && (
        <CreateTestForm
          visible={showCreateModal}
          onClose={handleCloseModal}
          onSubmit={editingTest ? handleUpdateTest : handleCreateTest}
          initialData={editingTest}
          classes={classes}
          subjects={subjects}
          schoolCode={profile?.school_code || ''}
          userId={user?.id || ''}
        />
      )}

    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  filterRow: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
    elevation: 2,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border.DEFAULT,
  },
  filterItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  filterContent: {
    flex: 1,
    minWidth: 0,
  },
  filterLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  filterValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  filterDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.sm,
  },
  testsContainer: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
    elevation: 8,
    zIndex: 1000,
  },
  actionsModalContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    margin: spacing.lg,
    maxWidth: 480,
    alignSelf: 'center',
    width: '90%',
    ...shadows.lg,
  },
  actionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  actionsModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  actionsModalCloseButton: {
    padding: spacing.xs,
  },
  actionsList: {
    padding: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  actionDescription: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
  },
  emptyStateButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border.DEFAULT,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    maxHeight: 400,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface.secondary,
  },
  sheetItemActive: {
    backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  sheetItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  sheetItemTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  checkmark: {
    fontSize: typography.fontSize.lg,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
});
