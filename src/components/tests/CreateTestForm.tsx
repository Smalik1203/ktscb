import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { format } from 'date-fns';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { TestInput, TestMode, TestWithDetails } from '../../types/test.types';
import { DatePickerModal } from '../common/DatePickerModal';
import { Modal, Input, Button, SegmentedControl, Menu } from '../../ui';

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

  // Form state
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
  const [submitting, setSubmitting] = useState(false);

  // Picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [classMenuVisible, setClassMenuVisible] = useState(false);
  const [subjectMenuVisible, setSubjectMenuVisible] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);

  // Inline validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setClassInstanceId(initialData.class_instance_id);
      setSubjectId(initialData.subject_id);
      setTestType(initialData.test_type);
      setTestMode(initialData.test_mode);
      if (initialData.test_date) setTestDate(new Date(initialData.test_date));
      if (initialData.time_limit_seconds) setTimeLimitMinutes(String(Math.floor(initialData.time_limit_seconds / 60)));
      if (initialData.max_marks) setMaxMarks(String(initialData.max_marks));
      setAllowReattempts(initialData.allow_reattempts || false);
    }
  }, [initialData]);

  const resetForm = useCallback(() => {
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
    setErrors({});
  }, []);

  // Clear error when field changes
  const clearError = useCallback((field: string) => {
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Test title is required';
    if (!classInstanceId) newErrors.class = 'Please select a class';
    if (!subjectId) newErrors.subject = 'Please select a subject';

    if (testMode === 'online') {
      const timeLimit = parseInt(timeLimitMinutes);
      if (isNaN(timeLimit) || timeLimit <= 0) newErrors.timeLimit = 'Enter a valid time limit';
    } else {
      const marks = parseInt(maxMarks);
      if (isNaN(marks) || marks <= 0) newErrors.maxMarks = 'Enter valid max marks';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedClassName = () => {
    const cls = classes.find((c) => c.id === classInstanceId);
    return cls ? `Grade ${cls.grade} - ${cls.section}` : '';
  };

  const getSelectedSubjectName = () => {
    const s = subjects.find((s) => s.id === subjectId);
    return s ? s.subject_name : '';
  };

  const modeOptions = [
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
  ];

  return (
    <Modal
      visible={visible}
      onDismiss={() => { resetForm(); onClose(); }}
      contentContainerStyle={styles.modal}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {initialData ? 'Edit Test' : 'Create New Test'}
          </Text>
          <Button variant="ghost" size="sm" onPress={() => { resetForm(); onClose(); }}>
            Cancel
          </Button>
        </View>

        {/* Form */}
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <Input
            label="Test Title"
            required
            placeholder="e.g., Mathematics Unit Test 1"
            value={title}
            onChangeText={(v) => { setTitle(v); clearError('title'); }}
            error={errors.title}
          />

          {/* Description */}
          <Input
            label="Description"
            placeholder="Enter test description..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            containerStyle={styles.fieldGap}
          />

          {/* Test Mode */}
          <View style={[styles.fieldGap, styles.fieldGroup]}>
            <Text style={styles.label}>Test Mode</Text>
            <SegmentedControl
              options={modeOptions}
              value={testMode}
              onChange={(val) => setTestMode(val as TestMode)}
            />
            <Text style={styles.helperText}>
              {testMode === 'online'
                ? 'Students take the test in the app'
                : 'Upload marks after conducting test physically'}
            </Text>
          </View>

          {/* Class picker via Menu */}
          <View style={[styles.fieldGap, styles.fieldGroup]}>
            <Text style={styles.label}>
              Class <Text style={styles.required}>*</Text>
            </Text>
            <Menu
              visible={classMenuVisible}
              onDismiss={() => setClassMenuVisible(false)}
              anchor={
                <Button
                  variant="outline"
                  size="md"
                  onPress={() => setClassMenuVisible(true)}
                  fullWidth
                  style={errors.class ? styles.errorBorder : undefined}
                >
                  {getSelectedClassName() || 'Select Class'}
                </Button>
              }
            >
              {classes.map((cls) => (
                <Menu.Item
                  key={cls.id}
                  title={`Grade ${cls.grade} - ${cls.section}`}
                  icon={classInstanceId === cls.id ? 'check' : undefined}
                  onPress={() => { setClassInstanceId(cls.id); setClassMenuVisible(false); clearError('class'); }}
                />
              ))}
            </Menu>
            {errors.class && <Text style={styles.errorText}>{errors.class}</Text>}
          </View>

          {/* Subject picker via Menu */}
          <View style={[styles.fieldGap, styles.fieldGroup]}>
            <Text style={styles.label}>
              Subject <Text style={styles.required}>*</Text>
            </Text>
            <Menu
              visible={subjectMenuVisible}
              onDismiss={() => setSubjectMenuVisible(false)}
              anchor={
                <Button
                  variant="outline"
                  size="md"
                  onPress={() => setSubjectMenuVisible(true)}
                  fullWidth
                  style={errors.subject ? styles.errorBorder : undefined}
                >
                  {getSelectedSubjectName() || 'Select Subject'}
                </Button>
              }
            >
              {subjects.map((s) => (
                <Menu.Item
                  key={s.id}
                  title={s.subject_name}
                  icon={subjectId === s.id ? 'check' : undefined}
                  onPress={() => { setSubjectId(s.id); setSubjectMenuVisible(false); clearError('subject'); }}
                />
              ))}
            </Menu>
            {errors.subject && <Text style={styles.errorText}>{errors.subject}</Text>}
          </View>

          {/* Test Type picker via Menu */}
          <View style={[styles.fieldGap, styles.fieldGroup]}>
            <Text style={styles.label}>Test Type</Text>
            <Menu
              visible={typeMenuVisible}
              onDismiss={() => setTypeMenuVisible(false)}
              anchor={
                <Button variant="outline" size="md" onPress={() => setTypeMenuVisible(true)} fullWidth>
                  {testType}
                </Button>
              }
            >
              {TEST_TYPES.map((type) => (
                <Menu.Item
                  key={type}
                  title={type}
                  icon={testType === type ? 'check' : undefined}
                  onPress={() => { setTestType(type); setTypeMenuVisible(false); }}
                />
              ))}
            </Menu>
          </View>

          {/* Test Date */}
          <View style={[styles.fieldGap, styles.fieldGroup]}>
            <Text style={styles.label}>Test Date</Text>
            <Button
              variant="outline"
              size="md"
              onPress={() => setShowDatePicker(true)}
              fullWidth
            >
              {format(testDate, 'MMM dd, yyyy')}
            </Button>
          </View>

          {/* Online: time limit + reattempts */}
          {testMode === 'online' && (
            <>
              <Input
                label="Time Limit (minutes)"
                required
                placeholder="60"
                value={timeLimitMinutes}
                onChangeText={(v) => { setTimeLimitMinutes(v); clearError('timeLimit'); }}
                keyboardType="numeric"
                error={errors.timeLimit}
                containerStyle={styles.fieldGap}
              />

              <View style={[styles.fieldGap, styles.switchRow]}>
                <View style={styles.switchLabel}>
                  <Text style={styles.label}>Allow Reattempts</Text>
                  <Text style={styles.helperText}>Students can retake this test</Text>
                </View>
                <Switch
                  value={allowReattempts}
                  onValueChange={setAllowReattempts}
                  trackColor={{ false: colors.neutral[300], true: colors.primary[300] }}
                  thumbColor={allowReattempts ? colors.primary[600] : colors.neutral[400]}
                />
              </View>
            </>
          )}

          {/* Offline: max marks */}
          {testMode === 'offline' && (
            <Input
              label="Maximum Marks"
              required
              placeholder="100"
              value={maxMarks}
              onChangeText={(v) => { setMaxMarks(v); clearError('maxMarks'); }}
              keyboardType="numeric"
              error={errors.maxMarks}
              containerStyle={styles.fieldGap}
            />
          )}

          {/* Bottom spacer for scroll */}
          <View style={{ height: spacing.lg }} />
        </ScrollView>

        {/* Footer buttons */}
        <View style={styles.footer}>
          <Button
            variant="outline"
            onPress={() => { resetForm(); onClose(); }}
            disabled={submitting}
            style={styles.flex1}
          >
            Cancel
          </Button>
          <Button
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.flex1}
          >
            {initialData ? 'Update Test' : 'Create Test'}
          </Button>
        </View>

        {/* Date Picker */}
        <DatePickerModal
          visible={showDatePicker}
          onDismiss={() => setShowDatePicker(false)}
          onConfirm={(date) => { setTestDate(date); setShowDatePicker(false); }}
          initialDate={testDate}
          title="Select Test Date"
        />
      </View>
    </Modal>
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
    headerTitle: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    form: {
      padding: spacing.lg,
      maxHeight: 500,
    },
    fieldGap: {
      marginTop: spacing.md,
    },
    fieldGroup: {
      gap: spacing.xs,
    },
    label: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    required: {
      color: colors.error[500],
    },
    helperText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: spacing.xs / 2,
    },
    errorBorder: {
      borderColor: colors.error[500],
    },
    errorText: {
      fontSize: typography.fontSize.xs,
      color: colors.error[500],
      marginTop: spacing.xs / 2,
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
    flex1: {
      flex: 1,
    },
  });
