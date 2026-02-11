import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, ScrollView, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Portal, Modal } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateStudent, useStudents, useUpdateStudent, useDeleteStudent } from '../../hooks/useStudents';
import { useClassInstances } from '../../hooks/useClassInstances';
import { spacing, borderRadius, shadows } from '../../../lib/design-system';
import { ChevronDown, X, CheckCircle2, Edit2, Trash2 } from 'lucide-react-native';
import { ThreeStateView } from '../../components/common/ThreeStateView';
import { Pagination } from '../../components/common/Pagination';
import { sanitizeEmail, sanitizePhone, sanitizeCode, sanitizeName, validatePassword } from '../../utils/sanitize';
import { Button, Input, Badge, SearchBar, SegmentedControl, EmptyState, Avatar } from '../../components/ui';

export default function AddStudentScreen() {
  const { profile } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const schoolCode = profile?.school_code;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [studentCode, setStudentCode] = useState('S');
  const [classInstanceId, setClassInstanceId] = useState('');
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [mode, setMode] = useState<'create' | 'list'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const createMutation = useCreateStudent(schoolCode);
  const updateMutation = useUpdateStudent(schoolCode);
  const deleteMutation = useDeleteStudent(schoolCode);
  const { data: classInstances = [], isLoading: loadingClasses } = useClassInstances(schoolCode);

  // Existing students
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data: studentsResponse, isLoading: loadingStudents, error: studentsError, refetch: refetchStudents } = useStudents(
    classInstanceId,
    schoolCode || undefined,
    { page, pageSize, search: studentSearch }
  );

  // Extract data from pagination response
  const students = studentsResponse?.data || [];
  const totalStudents = studentsResponse?.total || 0;
  const totalPages = Math.ceil(totalStudents / pageSize);

  // Reset to page 1 when class changes
  useEffect(() => {
    setPage(1);
  }, [classInstanceId]);

  // Search handled in SQL (no client-side filtering)

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [studentSearch]);

  const selectedClass = classInstances.find((c: any) => c.id === classInstanceId);
  const selectedClassLabel = selectedClass
    ? `Grade ${selectedClass.grade}-${selectedClass.section}`
    : 'Select Class';

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim() || !studentCode.trim() || !classInstanceId) {
      Alert.alert('Validation Error', 'Please fill in all fields and select a class');
      return;
    }

    if (!editingId && !password.trim()) {
      Alert.alert('Validation Error', 'Password is required for new students');
      return;
    }

    if (!editingId) {
      // Validate password strength only for creation
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        const missing: string[] = [];
        if (!passwordValidation.requirements.minLength) missing.push('at least 8 characters');
        if (!passwordValidation.requirements.hasLetter) missing.push('at least one letter');
        if (!passwordValidation.requirements.hasNumber) missing.push('at least one number');
        Alert.alert('Validation Error', `Password must contain: ${missing.join(', ')}`);
        return;
      }
    }

    // Sanitize inputs
    const sanitizedData = {
      full_name: sanitizeName(fullName),
      email: sanitizeEmail(email),
      phone: sanitizePhone(phone),
      student_code: sanitizeCode(studentCode),
    };

    // Validate sanitized data
    if (!sanitizedData.full_name || !sanitizedData.email || !sanitizedData.phone || !sanitizedData.student_code) {
      Alert.alert('Validation Error', 'Please check all fields for invalid characters');
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          full_name: sanitizedData.full_name,
          phone: sanitizedData.phone,
          student_code: sanitizedData.student_code,
        });
        Alert.alert('Success', 'Student updated successfully!');
      } else {
        await createMutation.mutateAsync({
          full_name: sanitizedData.full_name,
          email: sanitizedData.email,
          password,
          phone: sanitizedData.phone,
          student_code: sanitizedData.student_code,
          class_instance_id: classInstanceId,
        });
        Alert.alert('Success', 'Student created successfully!');
      }

      resetForm();
      if (editingId) {
        setMode('list'); // Go back to list after edit
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save student');
    }
  };

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setStudentCode('S');
    setClassInstanceId('');
    setEditingId(null);
  };

  const handleEdit = (student: any) => {
    setFullName(student.full_name);
    setEmail(student.email);
    setPhone(student.phone);
    setStudentCode(student.student_code);
    setClassInstanceId(student.class_instance_id); // Ensure this matches ID format
    setEditingId(student.id);
    setMode('create'); // Switch to form view
  };

  const handleDelete = (student: any) => {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${student.full_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(student.id);
              // Alert.alert('Success', 'Student deleted'); // Optional, query invalidation handles update
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <SegmentedControl
            value={mode}
            onChange={(value) => {
              if (value === 'create' && editingId) resetForm();
              setMode(value as 'create' | 'list');
            }}
            options={[
              { label: editingId ? 'Edit Student' : 'Create', value: 'create' },
              { label: 'Existing', value: 'list' },
            ]}
            containerStyle={styles.segment}
          />

          {mode === 'create' && (
            <View style={styles.section}>
              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.classSelector}
                  onPress={() => setShowClassPicker(true)}
                  disabled={loadingClasses || classInstances.length === 0}
                >
                  <Text style={[styles.classSelectorText, !classInstanceId && styles.placeholderText]}>
                    {selectedClassLabel}
                  </Text>
                  <ChevronDown size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.formGroup}>
                <Input
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter full name"
                  autoCapitalize="words"
                  rightIcon={fullName.trim().length > 0 ? <CheckCircle2 size={18} color={colors.success[600]} /> : undefined}
                />

                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!editingId}
                  inputStyle={editingId ? styles.disabledInputText : undefined}
                  helperText={editingId ? 'Email cannot be edited' : undefined}
                />

                <Input
                  label="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />

                <View style={styles.formRow}>
                  {!editingId && (
                    <View style={styles.formCol}>
                      <Input
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Min 8 characters"
                        secureTextEntry
                      />
                    </View>
                  )}
                  <View style={styles.formCol}>
                    <Input
                      label="Student Code"
                      value={studentCode}
                      onChangeText={setStudentCode}
                      placeholder="Enter code"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {mode === 'list' && (
          <View style={styles.listContainer}>

            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={styles.classSelector}
                onPress={() => setShowClassPicker(true)}
              >
                <Text style={[styles.classSelectorText, !classInstanceId && styles.placeholderText]}>
                  {selectedClassLabel}
                </Text>
                <ChevronDown size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {classInstanceId && (
              <View style={styles.filterBar}>
                <SearchBar
                  value={studentSearch}
                  onChangeText={setStudentSearch}
                  placeholder="Search students..."
                  containerStyle={styles.searchBar}
                />
              </View>
            )}

            {!classInstanceId ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Select a class</Text>
                <Text style={styles.emptyMessage}>Choose a class above to view its students</Text>
              </View>
            ) : loadingStudents ? (
              <ThreeStateView state="loading" loadingMessage="Loading students..." />
            ) : studentsError ? (
              <ThreeStateView state="error" errorMessage="Failed to load students" errorDetails={(studentsError as any)?.message} onRetry={() => refetchStudents()} />
            ) : students.length === 0 ? (
              <EmptyState
                title={studentSearch ? 'No matches found' : 'No students yet'}
                message={studentSearch ? 'Try a different search.' : 'Add the first student to this class.'}
                actionLabel="Add Student"
                onAction={() => setMode('create')}
                variant="card"
              />
            ) : (
                <>
                  <View style={styles.studentList}>
                    {students.map((s: any) => (
                      <View key={s.id} style={styles.studentRow}>
                        <Avatar
                          name={s.full_name || s.student_code || 'Student'}
                          size="sm"
                          variant="primary"
                          style={styles.studentAvatar}
                        />
                        <View style={styles.studentInfo}>
                          <Text style={styles.studentName}>{s.full_name || 'Unnamed'}</Text>
                        </View>
                        <View style={styles.studentActions}>
                          <TouchableOpacity onPress={() => handleEdit(s)} style={styles.actionButton}>
                            <Edit2 size={18} color={colors.primary[600]} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDelete(s)} style={styles.actionButton}>
                            <Trash2 size={18} color={colors.error[600]} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>

                  {!studentSearch && totalPages > 0 && (
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      totalItems={totalStudents}
                      itemsPerPage={pageSize}
                      onPageChange={setPage}
                    />
                  )}
                </>
              )
            }
          </View>
        )}
      </ScrollView>

      {mode === 'create' && (
        <View style={styles.footerBar}>
          <Button
            title={createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingId ? 'Update Student' : 'Add Student')}
            onPress={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={createMutation.isPending || updateMutation.isPending || !classInstanceId}
            fullWidth
          />
        </View>
      )}

      <Portal>
        <Modal
          visible={showClassPicker}
          onDismiss={() => setShowClassPicker(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Class</Text>
            <TouchableOpacity onPress={() => setShowClassPicker(false)} style={styles.closeButton}>
              <X size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalList}>
            {classInstances.map((classInstance: any) => {
              const label = `Grade ${classInstance.grade} - Section ${classInstance.section}`;
              const isSelected = classInstanceId === classInstance.id;

              return (
                <TouchableOpacity
                  key={classInstance.id}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    setClassInstanceId(classInstance.id);
                    setShowClassPicker(false);
                  }}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.app,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingBottom: 80,
    },
    formContainer: {
      padding: spacing.sm,
    },
    segment: {
      marginBottom: spacing.sm,
    },
    section: {
      paddingVertical: 0,
    },
    cardHeader: {
      marginBottom: spacing.md,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    formGroup: {
      gap: spacing.sm,
    },
    inputGroup: {
      marginBottom: spacing.sm,
    },
    formRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    formCol: {
      flex: 1,
    },
    classSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 44,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface.primary,
      ...shadows.none,
    },
    classSelectorText: {
      fontSize: 15,
      color: colors.text.primary,
    },
    placeholderText: {
      color: colors.text.tertiary,
    },
    listContainer: {
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    listHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    listTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    searchBar: {
      marginBottom: spacing.sm,
    },
    filterBar: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    studentList: {
      gap: 0,
    },
    studentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      gap: spacing.sm,
    },
    studentActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingLeft: spacing.sm,
    },
    actionButton: {
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: 'transparent',
    },
    disabledInputText: {
      color: colors.text.tertiary,
    },
    studentInfo: {
      flex: 1,
    },
    studentName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    studentMeta: {
      fontSize: 13,
      color: colors.text.secondary,
      marginTop: 2,
    },
    studentAvatar: {
      flexShrink: 0,
    },
    footerBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surface.primary,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      ...shadows.md,
    },
    modal: {
      backgroundColor: colors.surface.primary,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    modalTitle: {
    fontSize: 18,
    fontWeight: '600',
      color: colors.text.primary,
    },
    modalList: {
      maxHeight: 400,
    },
    modalItem: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    modalItemSelected: {
      backgroundColor: colors.primary[50],
    },
    modalItemText: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    modalItemTextSelected: {
      color: colors.primary[600],
      fontWeight: '600',
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.neutral[100],
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      minHeight: 300,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    emptyMessage: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
    },
  });
