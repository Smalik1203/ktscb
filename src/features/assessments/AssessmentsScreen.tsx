import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useTests, useCreateTest, useUpdateTest, useDeleteTest, useStudentAttempts, useStudentMarks } from '../../hooks/tests';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { TestInput, TestWithDetails } from '../../types/test.types';
import { TestList } from '../../components/tests/TestList';
import { CreateTestForm } from '../../components/tests/CreateTestForm';
import {
  LoadingView,
  ErrorView,
  EmptyStateIllustration,
  FAB,
  SegmentedControl,
  Menu,
  SkeletonCard,
  Button,
} from '../../ui';
import { AccessDenied } from '../../components/common/AccessDenied';

export default function AssessmentsScreen() {
  const { profile, user } = useAuth();
  const { colors, isDark, spacing, typography, borderRadius, shadows } = useTheme();
  const { can } = useCapabilities();
  const router = useRouter();

  // Capability-based checks
  const canCreateTest = can('assessments.create');
  const canManageTests = can('assessments.manage');
  const canTakeTest = can('assessments.take_test');
  const canViewOwnAssessments = can('assessments.read_own') && !can('assessments.read');
  const canReadAssessments = can('assessments.read') || can('assessments.read_own');

  // State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTest, setEditingTest] = useState<TestWithDetails | undefined>(undefined);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [assessmentView, setAssessmentView] = useState<'online' | 'offline'>('online');
  const [classMenuVisible, setClassMenuVisible] = useState(false);

  const styles = useMemo(() => createStyles(colors, isDark, spacing, typography, borderRadius, shadows), [colors, isDark]);

  const studentId = canViewOwnAssessments ? user?.id : undefined;

  // Data fetching — filter by test_mode in SQL
  const { data: tests = [], isLoading: testsLoading, error: testsError } = useTests(
    profile?.school_code || '',
    selectedClassId || (canViewOwnAssessments ? profile?.class_instance_id || undefined : undefined),
    { test_mode: assessmentView }
  );
  const { data: classes = [] } = useClasses(profile?.school_code || '');
  const { data: subjectsResult } = useSubjects(profile?.school_code || '');
  const subjects = subjectsResult?.data || [];

  // Student data
  const { data: rawStudentAttempts = [] } = useStudentAttempts(studentId || '', undefined);
  const { data: rawStudentMarks = [] } = useStudentMarks(studentId || '');

  const studentAttempts = useMemo(() => {
    if (!rawStudentAttempts || !Array.isArray(rawStudentAttempts)) return [];
    return rawStudentAttempts.map((attempt: any) => ({
      id: attempt.id,
      test_id: attempt.test_id,
      student_id: attempt.student_id,
      answers: (() => {
        if (typeof attempt.answers === 'object' && attempt.answers !== null) return attempt.answers;
        if (typeof attempt.answers === 'string' && attempt.answers.trim().length > 0) {
          try { return JSON.parse(attempt.answers); } catch { return {}; }
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

  const studentMarks = useMemo(() => {
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
    if (canManageTests) {
      if (test.test_mode === 'offline') {
        router.push(
          `/test/${test.id}/marks?testTitle=${encodeURIComponent(test.title)}&maxMarks=${test.max_marks || 100}&classInstanceId=${test.class_instance_id}`
        );
      } else {
        router.push(`/test/${test.id}/questions?testTitle=${encodeURIComponent(test.title)}`);
      }
    } else if (canTakeTest) {
      // Student: navigate to test taking or results
      const attempt = studentAttempts.find((a: any) => a.test_id === test.id);
      if (test.test_mode === 'online') {
        if (attempt?.status === 'completed') {
          router.push(`/test/${test.id}/results?attemptId=${attempt.id}`);
        } else if (attempt?.status === 'in_progress') {
          router.push(`/test/${test.id}/take?attemptId=${attempt.id}`);
        } else {
          router.push(`/test/${test.id}/take`);
        }
      } else {
        // Offline test — student can view marks if available
        const mark = studentMarks[test.id];
        if (mark) {
          Alert.alert('Your Score', `${mark.marks_obtained}/${mark.max_marks}${mark.remarks ? `\n\n${mark.remarks}` : ''}`);
        } else {
          Alert.alert('Marks Pending', 'Your marks for this test have not been uploaded yet.');
        }
      }
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

  const getSelectedClassName = () => {
    if (!selectedClassId) return 'All Classes';
    const selectedClass = classes.find((c) => c.id === selectedClassId);
    return selectedClass ? `${selectedClass.grade}-${selectedClass.section}` : 'All Classes';
  };

  // Access guard
  if (!canReadAssessments) {
    return <AccessDenied message="You don't have access to assessments." />;
  }

  // Error state
  if (testsError && !testsLoading) {
    return <ErrorView message={testsError.message} />;
  }

  // Mode segment options
  const modeOptions = [
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
  ];

  return (
    <View style={styles.container}>
      {/* Filter Bar: SegmentedControl + Class Menu */}
      <View style={styles.filterBar}>
        <View style={styles.segmentWrapper}>
          <SegmentedControl
            options={modeOptions}
            value={assessmentView}
            onChange={(val) => setAssessmentView(val as 'online' | 'offline')}
          />
        </View>

        {/* Class filter — admin only */}
        {canCreateTest && (
          <Menu
            visible={classMenuVisible}
            onDismiss={() => setClassMenuVisible(false)}
            anchor={
              <TouchableOpacity
                onPress={() => setClassMenuVisible(true)}
                activeOpacity={0.7}
                style={styles.classButton}
              >
                <MaterialIcons name="school" size={16} color={colors.primary[600]} />
                <Text style={styles.classButtonText} numberOfLines={1}>{getSelectedClassName()}</Text>
                <MaterialIcons name="keyboard-arrow-down" size={16} color={colors.text.tertiary} />
              </TouchableOpacity>
            }
          >
            <Menu.Item
              title="All Classes"
              icon={!selectedClassId ? 'check' : undefined}
              onPress={() => { setSelectedClassId(undefined); setClassMenuVisible(false); }}
            />
            <Menu.Divider />
            {classes.map((cls) => (
              <Menu.Item
                key={cls.id}
                title={`Grade ${cls.grade} - ${cls.section}`}
                icon={selectedClassId === cls.id ? 'check' : undefined}
                onPress={() => { setSelectedClassId(cls.id); setClassMenuVisible(false); }}
              />
            ))}
          </Menu>
        )}
      </View>

      {/* Content: Loading / Empty / List */}
      {testsLoading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : tests.length === 0 ? (
        <EmptyStateIllustration
          type="tests"
          title={assessmentView === 'online' ? 'No Online Tests' : 'No Offline Tests'}
          description={canCreateTest
            ? `Create your first ${assessmentView} assessment to get started`
            : 'No assessments available yet'
          }
          action={canCreateTest ? (
            <Button onPress={() => { setEditingTest(undefined); setShowCreateModal(true); }}>
              Create Test
            </Button>
          ) : undefined}
        />
      ) : (
        <View style={styles.testsContainer}>
          <TestList
            tests={tests}
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
            filteredCount={tests.length}
          />
        </View>
      )}

      {/* FAB.Group — speed dial with two actions */}
      <FAB.Group
        icon="add"
        visible={canCreateTest}
        actions={[
          {
            icon: 'edit',
            label: 'Create Manually',
            onPress: () => { setEditingTest(undefined); setShowCreateModal(true); },
          },
          {
            icon: 'auto-awesome',
            label: 'Generate with AI',
            onPress: () => router.push('/ai-test-generator'),
          },
        ]}
      />

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

const createStyles = (colors: ThemeColors, isDark: boolean, spacing: any, typography: any, borderRadius: any, shadows: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.sm,
  },
  segmentWrapper: {
    flex: 1,
  },
  classButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.secondary,
  },
  classButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    maxWidth: 100,
  },
  skeletonContainer: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  testsContainer: {
    flex: 1,
  },
});
