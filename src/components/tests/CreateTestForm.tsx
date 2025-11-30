import React, { useState, useEffect , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Portal, Modal } from 'react-native-paper';
import { X, Calendar as CalendarIcon, Clock } from 'lucide-react-native';
import { format } from 'date-fns';
import { TestInput, TestMode, TestWithDetails } from '../../types/test.types';
import { DatePickerModal } from '../common/DatePickerModal';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';

interface CreateTestFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (testData: TestInput) => Promise<void>;
  initialData?: TestWithDetails;
  classes: { id: string; grade: number | null; section: string | null }[];
  subjects: { id: string; subject_name: string }[];
  schoolCode: string;
  userId: string;
}

const TEST_TYPES = ['Unit Test', 'Chapter Test', 'Assignment', 'Practical', 'Project', 'Quiz'];

export function CreateTestForm({
  visible,
  onClose,
  onSubmit,
  initialData,
  classes,
  subjects,
  schoolCode,
  userId,
}: CreateTestFormProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classInstanceId, setClassInstanceId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [testType, setTestType] = useState('Unit Test');
  const [testMode, setTestMode] = useState<TestMode>('online');
  const [testDate, setTestDate] = useState<Date>(new Date());
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('60');
  const [maxMarks, setMaxMarks] = useState('100');
  const [allowReattempts, setAllowReattempts] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setClassInstanceId(initialData.class_instance_id);
      setSubjectId(initialData.subject_id);
      setTestType(initialData.test_type);
      setTestMode(initialData.test_mode);
      if (initialData.test_date) {
        setTestDate(new Date(initialData.test_date));
      }
      if (initialData.time_limit_seconds) {
        setTimeLimitMinutes(String(Math.floor(initialData.time_limit_seconds / 60)));
      }
      if (initialData.max_marks) {
        setMaxMarks(String(initialData.max_marks));
      }
      setAllowReattempts(initialData.allow_reattempts || false);
    }
  }, [initialData]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setClassInstanceId('');
    setSubjectId('');
    setTestType('Unit Test');
    setTestMode('online');
    setTestDate(new Date());
    setTimeLimitMinutes('60');
    setMaxMarks('100');
    setAllowReattempts(false);
  };

  const validate = () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter test title');
      return false;
    }
    if (!classInstanceId) {
      Alert.alert('Validation Error', 'Please select a class');
      return false;
    }
    if (!subjectId) {
      Alert.alert('Validation Error', 'Please select a subject');
      return false;
    }
    if (testMode === 'online') {
      const timeLimit = parseInt(timeLimitMinutes);
      if (isNaN(timeLimit) || timeLimit <= 0) {
        Alert.alert('Validation Error', 'Please enter a valid time limit');
        return false;
      }
    } else {
      const marks = parseInt(maxMarks);
      if (isNaN(marks) || marks <= 0) {
        Alert.alert('Validation Error', 'Please enter valid max marks');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const testData: TestInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      class_instance_id: classInstanceId,
      subject_id: subjectId,
      school_code: schoolCode,
      test_type: testType,
      test_mode: testMode,
      test_date: format(testDate, 'yyyy-MM-dd'),
      status: 'active',
      created_by: userId,
    };

    if (testMode === 'online') {
      testData.time_limit_seconds = parseInt(timeLimitMinutes) * 60;
      testData.allow_reattempts = allowReattempts;
    } else {
      testData.max_marks = parseInt(maxMarks);
    }

    try {
      setSubmitting(true);
      await onSubmit(testData);
      resetForm();
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save test');
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedClassName = () => {
    const selectedClass = classes.find((c) => c.id === classInstanceId);
    return selectedClass ? `Grade ${selectedClass.grade} - ${selectedClass.section}` : 'Select Class';
  };

  const getSelectedSubjectName = () => {
    const selectedSubject = subjects.find((s) => s.id === subjectId);
    return selectedSubject ? selectedSubject.subject_name : 'Select Subject';
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {initialData ? 'Edit Test' : 'Create New Test'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Test Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Mathematics Unit Test 1"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={colors.text.secondary}
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter test description..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.text.secondary}
              />
            </View>

            {/* Class */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Class *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowClassPicker(true)}
              >
                <Text style={[styles.pickerText, !classInstanceId && styles.pickerPlaceholder]}>
                  {getSelectedClassName()}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Subject */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Subject *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowSubjectPicker(true)}
              >
                <Text style={[styles.pickerText, !subjectId && styles.pickerPlaceholder]}>
                  {getSelectedSubjectName()}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Test Type */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Test Type *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowTypePicker(true)}
              >
                <Text style={styles.pickerText}>{testType}</Text>
              </TouchableOpacity>
            </View>

            {/* Test Mode */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Test Mode *</Text>
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeButton, testMode === 'online' && styles.modeButtonActive]}
                  onPress={() => setTestMode('online')}
                >
                  <Text style={[styles.modeButtonText, testMode === 'online' && styles.modeButtonTextActive]}>
                    Online
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, testMode === 'offline' && styles.modeButtonActive]}
                  onPress={() => setTestMode('offline')}
                >
                  <Text style={[styles.modeButtonText, testMode === 'offline' && styles.modeButtonTextActive]}>
                    Offline
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                {testMode === 'online'
                  ? 'Students take the test in the app'
                  : 'Upload marks after conducting test physically'}
              </Text>
            </View>

            {/* Test Date */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Test Date *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowDatePicker(true)}
              >
                <CalendarIcon size={20} color={colors.text.secondary} />
                <Text style={styles.pickerText}>
                  {format(testDate, 'MMM dd, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Online-specific fields */}
            {testMode === 'online' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Time Limit (minutes) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="60"
                    value={timeLimitMinutes}
                    onChangeText={setTimeLimitMinutes}
                    keyboardType="numeric"
                    placeholderTextColor={colors.text.secondary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabel}>
                      <Text style={styles.label}>Allow Reattempts</Text>
                      <Text style={styles.helperText}>
                        Students can retake this test multiple times
                      </Text>
                    </View>
                    <Switch
                      value={allowReattempts}
                      onValueChange={setAllowReattempts}
                      trackColor={{ false: colors.neutral[300], true: colors.primary[300] }}
                      thumbColor={allowReattempts ? colors.primary[600] : colors.neutral[400]}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Offline-specific fields */}
            {testMode === 'offline' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Maximum Marks *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="100"
                  value={maxMarks}
                  onChangeText={setMaxMarks}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.secondary}
                />
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Saving...' : initialData ? 'Update Test' : 'Create Test'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Class Picker Modal */}
          {showClassPicker && (
            <Modal
              visible={showClassPicker}
              onDismiss={() => setShowClassPicker(false)}
              contentContainerStyle={styles.pickerModal}
            >
              <Text style={styles.pickerTitle}>Select Class</Text>
              <ScrollView>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[styles.pickerItem, classInstanceId === cls.id && styles.pickerItemSelected]}
                    onPress={() => {
                      setClassInstanceId(cls.id);
                      setShowClassPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, classInstanceId === cls.id && styles.pickerItemTextSelected]}>
                      Grade {cls.grade} - {cls.section}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Modal>
          )}

          {/* Subject Picker Modal */}
          {showSubjectPicker && (
            <Modal
              visible={showSubjectPicker}
              onDismiss={() => setShowSubjectPicker(false)}
              contentContainerStyle={styles.pickerModal}
            >
              <Text style={styles.pickerTitle}>Select Subject</Text>
              <ScrollView>
                {subjects.map((subject) => (
                  <TouchableOpacity
                    key={subject.id}
                    style={[styles.pickerItem, subjectId === subject.id && styles.pickerItemSelected]}
                    onPress={() => {
                      setSubjectId(subject.id);
                      setShowSubjectPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, subjectId === subject.id && styles.pickerItemTextSelected]}>
                      {subject.subject_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Modal>
          )}

          {/* Type Picker Modal */}
          {showTypePicker && (
            <Modal
              visible={showTypePicker}
              onDismiss={() => setShowTypePicker(false)}
              contentContainerStyle={styles.pickerModal}
            >
              <Text style={styles.pickerTitle}>Select Test Type</Text>
              <ScrollView>
                {TEST_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.pickerItem, testType === type && styles.pickerItemSelected]}
                    onPress={() => {
                      setTestType(type);
                      setShowTypePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, testType === type && styles.pickerItemTextSelected]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Modal>
          )}

          {/* Date Picker */}
          <DatePickerModal
            visible={showDatePicker}
            onDismiss={() => setShowDatePicker(false)}
            onConfirm={(date) => {
              setTestDate(date);
              setShowDatePicker(false);
            }}
            initialDate={testDate}
            title="Select Test Date"
          />
        </View>
      </Modal>
    </Portal>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  modal: {
    margin: spacing.md,
    maxHeight: '90%',
  },
  container: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  form: {
    padding: spacing.lg,
    maxHeight: 500,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  pickerText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  pickerPlaceholder: {
    color: colors.text.secondary,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  modeButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
  },
  modeButtonActive: {
    backgroundColor: colors.primary[600],
  },
  modeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  modeButtonTextActive: {
    color: colors.text.inverse,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.secondary,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  submitButton: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[600],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  pickerModal: {
    backgroundColor: colors.surface.primary,
    margin: spacing.xl,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  pickerItem: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary[100],
  },
  pickerItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  pickerItemTextSelected: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
});
