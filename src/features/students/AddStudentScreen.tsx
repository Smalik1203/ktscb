import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, ScrollView, Alert, TouchableOpacity, StyleSheet, Modal, TextInput as RNTextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { useCreateStudent, useStudents } from '../../hooks/useStudents';
import { useClassInstances } from '../../hooks/useClassInstances';
import { spacing, borderRadius, shadows, colors } from '../../../lib/design-system';
import { ChevronDown, X, Search, CheckCircle2 } from 'lucide-react-native';
import { ThreeStateView } from '../../components/common/ThreeStateView';
import { Pagination } from '../../components/common/Pagination';
import { sanitizeEmail, sanitizePhone, sanitizeCode, sanitizeName, validatePassword } from '../../utils/sanitize';

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

  const createMutation = useCreateStudent(schoolCode);
  const { data: classInstances = [], isLoading: loadingClasses } = useClassInstances(schoolCode);

  // Existing students
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data: studentsResponse, isLoading: loadingStudents, error: studentsError, refetch: refetchStudents } = useStudents(
    classInstanceId,
    schoolCode || undefined,
    { page, pageSize }
  );

  // Extract data from pagination response
  const students = studentsResponse?.data || [];
  const totalStudents = studentsResponse?.total || 0;
  const totalPages = Math.ceil(totalStudents / pageSize);

  // Reset to page 1 when class changes
  useEffect(() => {
    setPage(1);
  }, [classInstanceId]);

  const [studentSearch, setStudentSearch] = useState('');
  const normalized = (s: string) => s.trim().toLowerCase();
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = normalized(studentSearch);
    return students.filter((s: any) =>
      normalized(s.full_name || '').includes(q) ||
      normalized(s.student_code || '').includes(q) ||
      normalized(s.email || '').includes(q)
    );
  }, [students, studentSearch]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [studentSearch]);

  const selectedClass = classInstances.find((c: any) => c.id === classInstanceId);
  const selectedClassLabel = selectedClass
    ? `Grade ${selectedClass.grade}-${selectedClass.section}`
    : 'Select Class';

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim() || !phone.trim() || !studentCode.trim() || !classInstanceId) {
      Alert.alert('Validation Error', 'Please fill in all fields and select a class');
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      const missing: string[] = [];
      if (!passwordValidation.requirements.minLength) missing.push('at least 8 characters');
      if (!passwordValidation.requirements.hasLetter) missing.push('at least one letter');
      if (!passwordValidation.requirements.hasNumber) missing.push('at least one number');
      Alert.alert('Validation Error', `Password must contain: ${missing.join(', ')}`);
      return;
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
      await createMutation.mutateAsync({
        full_name: sanitizedData.full_name,
        email: sanitizedData.email,
        password,
        phone: sanitizedData.phone,
        student_code: sanitizedData.student_code,
        class_instance_id: classInstanceId,
      });

      Alert.alert('Success', 'Student created successfully!');
      setFullName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setStudentCode('S');
      setClassInstanceId('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create student');
    }
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
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentItem, mode === 'create' && styles.segmentItemActive]}
              onPress={() => setMode('create')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, mode === 'create' && styles.segmentTextActive]}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentItem, mode === 'list' && styles.segmentItemActive]}
              onPress={() => setMode('list')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, mode === 'list' && styles.segmentTextActive]}>Existing</Text>
            </TouchableOpacity>
          </View>
          
          {mode === 'create' && (
          <View style={styles.formGroup}>
            <View style={styles.inputContainer}>
              <RNTextInput
                value={fullName}
                onChangeText={setFullName}
                style={styles.cleanInput}
                placeholder="Full Name"
                placeholderTextColor={colors.text.tertiary}
              />
              {fullName.trim().length > 0 && (
                <CheckCircle2 size={18} color={colors.success[600]} style={styles.inputIcon} />
              )}
            </View>
            
            <RNTextInput
              value={email}
              onChangeText={setEmail}
              style={styles.cleanInput}
              placeholder="Email"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <RNTextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.cleanInput}
              placeholder="Phone"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="phone-pad"
            />
            
            <View style={styles.formRow}>
              <RNTextInput
                value={password}
                onChangeText={setPassword}
                style={[styles.cleanInput, styles.halfInput]}
                placeholder="Password (min 8 chars)"
                placeholderTextColor={colors.text.tertiary}
                secureTextEntry
              />
              <RNTextInput
                value={studentCode}
                onChangeText={setStudentCode}
                style={[styles.cleanInput, styles.halfInput]}
                placeholder="Student Code"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="characters"
              />
            </View>
            
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
          )}
        </View>

        {mode === 'list' && (
          <View style={styles.listContainer}>
            {!classInstanceId ? (
              <View style={styles.promptCard}>
                <Text style={styles.promptTitle}>Choose a class to see students</Text>
                <Text style={styles.promptText}>Pick a class to view existing students and manage them here.</Text>
                <TouchableOpacity style={styles.bigButton} onPress={() => setShowClassPicker(true)}>
                  <Text style={styles.bigButtonText}>Choose Class</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.classSelector}
                  onPress={() => setShowClassPicker(true)}
                >
                  <Text style={styles.classSelectorText}>{selectedClassLabel}</Text>
                  <ChevronDown size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
                <View style={styles.listHeaderRow}>
                  <Text style={styles.listTitle}>Students</Text>
                  <View style={styles.countPill}><Text style={styles.countPillText}>{totalStudents}</Text></View>
                </View>
              </>
            )}

            <View style={styles.searchBar}>
              <Search size={18} color={colors.text.tertiary} />
              <RNTextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor={colors.text.tertiary}
                value={studentSearch}
                onChangeText={setStudentSearch}
              />
              {studentSearch.length > 0 && (
                <TouchableOpacity onPress={() => setStudentSearch('')}>
                  <X size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>

            {classInstanceId && (
              loadingStudents ? (
                <ThreeStateView state="loading" loadingMessage="Loading students..." />
              ) : studentsError ? (
                <ThreeStateView state="error" errorMessage="Failed to load students" errorDetails={(studentsError as any)?.message} onRetry={() => refetchStudents()} />
              ) : filteredStudents.length === 0 ? (
                <View style={styles.emptyLively}>
                  <Text style={styles.emptyEmoji}>🧑‍🎓</Text>
                  <Text style={styles.emptyTitle}>{studentSearch ? 'No matches found' : 'No students in this class yet'}</Text>
                  <Text style={styles.emptyText}>{studentSearch ? 'Try a different search.' : 'Start by adding a student or switch class.'}</Text>
                  <View style={styles.emptyActions}>
                    <TouchableOpacity style={styles.bigButtonSecondary} onPress={() => setMode('create')}>
                      <Text style={styles.bigButtonSecondaryText}>Add Student</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.bigButtonTertiary} onPress={() => setShowClassPicker(true)}>
                      <Text style={styles.bigButtonTertiaryText}>Change Class</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.studentList}>
                    {filteredStudents.map((s: any) => (
                      <View key={s.id} style={styles.studentRow}>
                        <View style={styles.studentInfo}>
                          <Text style={styles.studentName}>{s.full_name || 'Unnamed'}</Text>
                          <Text style={styles.studentMeta}>{s.student_code}</Text>
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
            )}
          </View>
        )}
      </ScrollView>

      {mode === 'create' && (
      <View style={styles.footerBar}>
        <TouchableOpacity
          style={[styles.primaryButton, (!classInstanceId || createMutation.isPending) && styles.primaryButtonDisabled]}
          onPress={handleCreate}
          disabled={createMutation.isPending || !classInstanceId}
        >
          <Text style={styles.primaryButtonText}>
            {createMutation.isPending ? 'Creating...' : 'Add Student'}
          </Text>
        </TouchableOpacity>
      </View>
      )}

      <Modal
        visible={showClassPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowClassPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Class</Text>
              <TouchableOpacity onPress={() => setShowClassPicker(false)}>
                <X size={24} color={colors.text.primary} />
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
          </View>
        </View>
      </Modal>
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
    padding: spacing.lg,
  },
  headerSection: {
    marginBottom: spacing.xl,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface.secondary,
    padding: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  segmentItemActive: {
    backgroundColor: colors.surface.primary,
    ...shadows.sm,
  },
  segmentText: {
    color: colors.text.secondary,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.text.primary,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  formGroup: {
    gap: spacing.md,
  },
  inputContainer: {
    position: 'relative',
  },
  cleanInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingRight: spacing.xl + spacing.sm,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: colors.surface.primary,
    ...shadows.sm,
  },
  inputIcon: {
    position: 'absolute',
    right: spacing.md,
    top: 15,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  classSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    ...shadows.sm,
  },
  classSelectorText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  placeholderText: {
    color: colors.text.tertiary,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  countPill: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  countPillText: {
    color: colors.text.secondary,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  studentList: {
    gap: spacing.xs,
  },
  promptCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
    marginBottom: spacing.md,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  promptText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  bigButton: {
    height: 48,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigButtonText: {
    color: colors.surface.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  emptyLively: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bigButtonSecondary: {
    height: 44,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigButtonSecondaryText: {
    color: colors.surface.primary,
    fontWeight: '700',
  },
  bigButtonTertiary: {
    height: 44,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigButtonTertiaryText: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  studentMeta: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface.primary,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.lg,
  },
  primaryButton: {
    height: 48,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
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
});
