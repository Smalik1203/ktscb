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
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTestMarks, useCreateBulkMarks } from '../../hooks/tests';
import { useStudents } from '../../hooks/useStudents';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { spacing, borderRadius, colors } from '../../../lib/design-system';

export function OfflineMarksUploadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quickMarks, setQuickMarks] = useState('');
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});
  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

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

  const handleQuickMarkSubmit = () => {
    if (!quickMarks.trim() || currentIndex >= students.length) return;

    const currentStudent = students[currentIndex];
    const marksNum = parseFloat(quickMarks);

    if (isNaN(marksNum) || marksNum < 0 || marksNum > maxMarks) {
      Alert.alert('Invalid Marks', `Please enter a value between 0 and ${maxMarks}`);
      return;
    }

    updateMarks(currentStudent.id, quickMarks);
    setQuickMarks('');

    // Move to next student
    if (currentIndex < students.length - 1) {
      setCurrentIndex(currentIndex + 1);
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
    }
  };

  const handleNext = () => {
    if (currentIndex < students.length - 1) {
      // Slide animation
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      setCurrentIndex(currentIndex + 1);
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  // Swipe gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          // Swipe right - previous
          handlePrevious();
        } else if (gestureState.dx < -50) {
          // Swipe left - next
          handleNext();
        }
      },
    })
  ).current;

  const handleQuickFillAll = () => {
    Alert.alert(
      'Quick Fill',
      'Fill same marks for all unmarked students?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fill',
          onPress: () => {
            const marksValue = quickMarks.trim();
            if (!marksValue) return;

            students.forEach((student: any) => {
              const existing = marks[student.id];
              if (!existing || !existing.marks) {
                updateMarks(student.id, marksValue);
              }
            });
            setQuickMarks('');
            Alert.alert('Success', 'Marks filled for all unmarked students');
          },
        },
      ]
    );
  };

  // Calculate progress
  const progress = useMemo(() => {
    const markedCount = students.filter((student: any) => {
      const studentMarks = marks[student.id];
      return studentMarks?.marks && studentMarks.marks.trim() !== '';
    }).length;

    return {
      marked: markedCount,
      total: students.length,
      percentage: students.length > 0 ? Math.round((markedCount / students.length) * 100) : 0,
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
              console.error('Save error:', error);
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
        {/* Simple Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{testTitle}</Text>
            <Text style={styles.headerSubtitle}>Max: {maxMarks} marks</Text>
          </View>
          <Text style={styles.progressText}>{progress.marked}/{progress.total}</Text>
        </View>

        {/* Student List */}
        <FlatList
          data={students}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const studentMarks = marks[item.id] || { marks: '', remarks: '' };
            const hasMarks = studentMarks.marks && studentMarks.marks.trim() !== '';

            return (
              <View style={styles.studentRow}>
                {/* Student Info */}
                <View style={styles.studentLeft}>
                  <Text style={styles.studentNumber}>{index + 1}</Text>
                  <View style={styles.studentDetails}>
                    <Text style={styles.studentName}>{item.full_name}</Text>
                    <Text style={styles.studentCode}>{item.student_code}</Text>
                  </View>
                </View>

                {/* Marks Input */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.marksInput, hasMarks && styles.marksInputFilled]}
                    placeholder="—"
                    value={studentMarks.marks}
                    onChangeText={(text) => updateMarks(item.id, text)}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholderTextColor={colors.text.tertiary}
                  />
                  {hasMarks && (
                    <View style={styles.checkIcon}>
                      <Check size={14} color={colors.success[600]} strokeWidth={3} />
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />

        {/* Fixed Save Button */}
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={[styles.saveButton, (saving || progress.marked === 0) && styles.saveButtonDisabled]}
            onPress={handleSaveMarks}
            disabled={saving || progress.marked === 0}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.surface.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Save All Marks</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  backButton: {
    padding: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
    gap: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
    marginTop: 2,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.main,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.surface.primary,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: colors.surface.overlay,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  studentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  studentNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.tertiary,
    width: 24,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  studentCode: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  inputWrapper: {
    position: 'relative',
  },
  marksInput: {
    width: 56,
    height: 48,
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.DEFAULT,
  },
  marksInputFilled: {
    borderColor: colors.success[600],
    backgroundColor: colors.success[50],
    color: colors.success[600],
  },
  checkIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.surface.overlay,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 2,
  },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
    shadowColor: colors.surface.overlay,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButton: {
    paddingVertical: 16,
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: colors.primary.main,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
    textAlign: 'center',
  },
});
