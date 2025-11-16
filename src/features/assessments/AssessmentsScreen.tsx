import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, Modal } from 'react-native';
import { Text, Card, SegmentedButtons, ActivityIndicator } from 'react-native-paper';
import { Plus, BookOpen, ChevronDown, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTests, useCreateTest, useUpdateTest, useDeleteTest, useStudentAttempts, useStudentMarks } from '../../hooks/tests';
import { useAuth } from '../../contexts/AuthContext';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { TestInput, TestWithDetails } from '../../types/test.types';
import { colors, spacing, typography, borderRadius, shadows } from '../../../lib/design-system';
import { TestList } from '../../components/tests/TestList';
import { CreateTestForm } from '../../components/tests/CreateTestForm';
import { Card as UICard, LoadingView, ErrorView, EmptyState } from '../../components/ui';
import { EmptyStateIllustration } from '../../components/ui/EmptyStateIllustration';

export default function AssessmentsScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTest, setEditingTest] = useState<TestWithDetails | undefined>(undefined);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [assessmentView, setAssessmentView] = useState<'online' | 'offline'>('online');
  
  // Animated values for bottom sheet
  const classSlideAnim = React.useRef(new Animated.Value(0)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  const isStudent = profile?.role === 'student';
  const studentId = isStudent ? user?.id : undefined;

  // Fetch data
  const { data: tests = [], isLoading: testsLoading, error: testsError } = useTests(
    profile?.school_code || '',
    selectedClassId || (isStudent ? profile?.class_instance_id || undefined : undefined)
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
      answers: typeof attempt.answers === 'object' && attempt.answers !== null 
        ? attempt.answers 
        : (typeof attempt.answers === 'string' ? JSON.parse(attempt.answers || '{}') : {}),
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

  // Filter tests based on online/offline selection
  const filteredTests = React.useMemo(() => {
    return tests.filter((test: TestWithDetails) => test.test_mode === assessmentView);
  }, [tests, assessmentView]);

  // Mutations
  const createTest = useCreateTest();
  const updateTest = useUpdateTest();
  const deleteTest = useDeleteTest();

  const canCreateTest = profile?.role === 'admin' || profile?.role === 'superadmin';
  const canManageTests = canCreateTest;

  // Animation effects for bottom sheet
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
    Alert.alert('Test Details', `View details for: ${test.title}`);
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

  const getSelectedClassName = () => {
    if (!selectedClassId) return 'All Classes';
    const selectedClass = classes.find((c) => c.id === selectedClassId);
    return selectedClass ? `${selectedClass.grade}-${selectedClass.section}` : 'All Classes';
  };

  const handleCreateNewTest = () => {
    setEditingTest(undefined);
    setShowCreateModal(true);
  };

  if (testsError) {
    return <ErrorView message={testsError.message} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Online/Offline Toggle */}
        <View style={styles.tabContainer}>
          <SegmentedButtons
            value={assessmentView}
            onValueChange={(value) => setAssessmentView(value as 'online' | 'offline')}
            buttons={[
              { value: 'online', label: 'Online' },
              { value: 'offline', label: 'Offline' },
            ]}
            style={styles.tabSwitcher}
          />
        </View>

        {/* Filter Section */}
        {canCreateTest && (
          <View style={styles.filterSection}>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={styles.filterItem}
                onPress={() => setShowClassPicker(true)}
              >
                <View style={styles.filterIcon}>
                  <BookOpen size={16} color={colors.text.inverse} />
                </View>
                <View style={styles.filterContent}>
                  <Text style={styles.filterValue} numberOfLines={1}>
                    {getSelectedClassName()}
                  </Text>
                </View>
                <ChevronDown size={14} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* AI Test Generator Button */}
        {canCreateTest && (
          <View style={styles.aiButtonContainer}>
            <TouchableOpacity
              style={styles.aiGeneratorButton}
              onPress={() => router.push('/ai-test-generator')}
            >
              <Sparkles size={20} color={colors.primary[600]} />
              <Text style={styles.aiGeneratorButtonText}>Generate Test with AI</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assessments</Text>
          <Text style={styles.sectionCount}>{filteredTests.length} {filteredTests.length === 1 ? 'test' : 'tests'}</Text>
        </View>

        {/* Loading State */}
        {testsLoading && (
          <LoadingView message="Loading assessments..." />
        )}

        {/* Empty State */}
        {!testsLoading && filteredTests.length === 0 && (
          <EmptyStateIllustration
            type="tests"
            title="No Tests"
            description={canCreateTest
              ? "Get started by creating your first assessment"
              : "No assessments available yet"
            }
            action={canCreateTest ? (
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateNewTest}
              >
                <Plus size={20} color={colors.text.inverse} />
                <Text style={styles.createButtonText}>Create Test</Text>
              </TouchableOpacity>
            ) : undefined}
          />
        )}

        {/* Test List */}
        {!testsLoading && filteredTests.length > 0 && (
          <View style={styles.testsContent}>
            <TestList
              tests={filteredTests}
              loading={testsLoading}
              onTestPress={handleTestPress}
              onTestEdit={canManageTests ? handleEditTest : undefined}
              onTestDelete={canManageTests ? handleDeleteTest : undefined}
              onManageQuestions={canManageTests ? handleManageQuestions : undefined}
              onUploadMarks={canManageTests ? handleUploadMarks : undefined}
              showActions={canManageTests}
              isStudentView={isStudent}
              studentAttempts={studentAttempts}
              studentMarks={studentMarks}
            />
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      {canCreateTest && filteredTests.length > 0 && (
        <TouchableOpacity onPress={handleCreateNewTest} style={styles.floatingButton}>
          <Plus size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  scrollView: {
    flex: 1,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface.primary,
  },
  tabSwitcher: {
    backgroundColor: colors.background.secondary,
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  filterRow: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  filterContent: {
    flex: 1,
  },
  filterValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  aiButtonContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  aiGeneratorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  aiGeneratorButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  testsContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
    elevation: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
  },
  createButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    backgroundColor: '#D1D5DB',
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
    backgroundColor: '#F9FAFB',
  },
  sheetItemActive: {
    backgroundColor: '#EEF2FF',
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
