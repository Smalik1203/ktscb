import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../theme/types';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput as RNTextInput } from 'react-native';
import { Text, Portal, Modal } from 'react-native-paper';
import { BookOpen, Edit, Trash2, X, Plus, Search } from 'lucide-react-native';
import { Card, Button, Input, EmptyState, Badge } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useSubjects } from '../../hooks/useSubjects';
import { ThreeStateView } from '../../components/common/ThreeStateView';
import { Pagination } from '../../components/common/Pagination';

export default function AddSubjectsScreen() {
  const { profile } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  
  const schoolCode = profile?.school_code;

  // Query
  const [subjectPage, setSubjectPage] = useState(1);
  const subjectPageSize = 50;
  const { data: subjectsResponse, isLoading, error, refetch, createSubject, updateSubject, deleteSubject } = useSubjects(schoolCode, { page: subjectPage, pageSize: subjectPageSize });

  // Extract data from pagination response
  const subjects = subjectsResponse?.data || [];
  const totalSubjects = subjectsResponse?.total || 0;
  const totalPages = Math.ceil(totalSubjects / subjectPageSize);

  // Reset to page 1 when search changes
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    setSubjectPage(1);
  }, [searchQuery]);

  // Form state
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [editSubjectName, setEditSubjectName] = useState('');

  // Role check
  const isSuperAdmin = profile?.role === 'superadmin';

  // Normalization function to match backend logic
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

  // Filtered subjects for search
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = normalize(searchQuery);
    return subjects.filter((s) => normalize(s.subject_name).includes(q));
  }, [subjects, searchQuery]);

  // Existing subjects normalized set
  const existingNormSet = useMemo(() => {
    const set = new Set<string>();
    subjects.forEach((s) => set.add(normalize(s.subject_name)));
    return set;
  }, [subjects]);

  if (!isSuperAdmin) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Access Denied"
          message="Only Super Admins can manage subjects"
        />
      </View>
    );
  }

  if (!schoolCode) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="No School Code"
          message="School code not found in your profile"
        />
      </View>
    );
  }

  const handleAddChip = () => {
    if (!currentInput.trim()) return;

    const trimmed = currentInput.trim();
    
    // Check if already added to chips
    if (subjectNames.some(name => normalize(name) === normalize(trimmed))) {
      Alert.alert('Duplicate', 'This subject is already in the list');
      return;
    }

    setSubjectNames([...subjectNames, trimmed]);
    setCurrentInput('');
  };

  const handleRemoveChip = (index: number) => {
    setSubjectNames(subjectNames.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (subjectNames.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one subject');
      return;
    }

    // De-duplicate within input
    const uniqueByNorm = Array.from(
      subjectNames.reduce((map, name) => map.set(normalize(name), name), new Map<string, string>()).values()
    );

    // Filter out subjects that already exist
    const toInsert = uniqueByNorm.filter((name) => !existingNormSet.has(normalize(name)));

    if (toInsert.length === 0) {
      Alert.alert('Already Exists', 'All entered subjects already exist for this school');
      return;
    }

    try {
      await Promise.all(
        toInsert.map((name) =>
          createSubject.mutateAsync({
            subject_name: name,
            school_code: schoolCode,
            created_by: profile?.auth_id || '',
          })
        )
      );

      Alert.alert('Success', `${toInsert.length} subject(s) created successfully!`);
      setSubjectNames([]);
      setCurrentInput('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create subjects');
    }
  };

  const handleEdit = (subject: any) => {
    setEditingSubject(subject);
    setEditSubjectName(subject.subject_name);
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!editingSubject || !editSubjectName.trim()) {
      Alert.alert('Validation Error', 'Subject name cannot be empty');
      return;
    }

    // Check if new name already exists (excluding current subject)
    const normalizedNewName = normalize(editSubjectName.trim());
    const existingSubject = subjects.find(
      (s) => s.id !== editingSubject.id && normalize(s.subject_name) === normalizedNewName
    );

    if (existingSubject) {
      Alert.alert('Duplicate', 'A subject with this name already exists');
      return;
    }

    try {
      await updateSubject.mutateAsync({
        id: editingSubject.id,
        subject_name: editSubjectName.trim(),
      });

      Alert.alert('Success', 'Subject updated successfully');
      setEditModalVisible(false);
      setEditingSubject(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update subject');
    }
  };

  const handleDelete = (subject: any) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${subject.subject_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSubject.mutateAsync(subject.id);
              Alert.alert('Success', 'Subject deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete subject');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Create Subjects Form */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <BookOpen size={24} color={colors.primary[600]} />
            <Text style={styles.cardTitle}>Add Subjects</Text>
            <Badge variant="info">School-wide</Badge>
          </View>

          <View style={styles.form}>
            <Text style={styles.hint}>
              Type subjects and press &quot;Add&quot; to include them. Subjects are unique per school (case/space
              insensitive).
            </Text>

            <View style={styles.inputRow}>
              <RNTextInput
                style={styles.textInput}
                value={currentInput}
                onChangeText={setCurrentInput}
                placeholder="Type subject name"
                placeholderTextColor={colors.text.tertiary}
                onSubmitEditing={handleAddChip}
                returnKeyType="done"
              />
              <Button title="Add" onPress={handleAddChip} style={styles.addButton} size="sm" />
            </View>

            {/* Chips Display */}
            {subjectNames.length > 0 && (
              <View style={styles.chipsContainer}>
                {subjectNames.map((name, index) => (
                  <View key={index} style={styles.chip}>
                    <Text style={styles.chipText}>{name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveChip(index)}>
                      <X size={16} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Button
              title={createSubject.isPending ? 'Creating...' : 'Create Subjects'}
              onPress={handleCreate}
              loading={createSubject.isPending}
              disabled={createSubject.isPending || subjectNames.length === 0}
              icon={<Plus size={20} color={colors.surface.primary} />}
            />
          </View>
        </Card>

        {/* Subjects List */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>All Subjects</Text>
            <Badge variant="success">{totalSubjects}</Badge>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Search size={20} color={colors.text.tertiary} />
            <RNTextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search subjects..."
              placeholderTextColor={colors.text.tertiary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          <ThreeStateView
            state={isLoading ? 'loading' : error ? 'error' : filteredSubjects.length === 0 ? 'empty' : 'success'}
            loadingMessage="Loading subjects..."
            errorMessage="Failed to load subjects"
            errorDetails={(error as any)?.message}
            emptyMessage={searchQuery ? 'No subjects match your search' : 'No subjects have been created yet'}
            onRetry={() => refetch()}
          >
            <View style={styles.subjectList}>
              {filteredSubjects.map((subject) => (
                <View key={subject.id} style={styles.subjectCard}>
                  <View style={styles.subjectInfo}>
                    <Text style={styles.subjectName}>{subject.subject_name}</Text>
                  </View>

                  <View style={styles.subjectActions}>
                    <TouchableOpacity onPress={() => handleEdit(subject)} style={styles.actionButton}>
                      <Edit size={18} color={colors.info[600]} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(subject)} style={styles.actionButton}>
                      <Trash2 size={18} color={colors.error[600]} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ThreeStateView>
          {!searchQuery && totalPages > 0 && (
            <Pagination
              currentPage={subjectPage}
              totalPages={totalPages}
              totalItems={totalSubjects}
              itemsPerPage={subjectPageSize}
              onPageChange={setSubjectPage}
            />
          )}
        </Card>
      </ScrollView>

      {/* Edit Modal */}
      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => setEditModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Subject</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <X size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Input
              label="Subject Name"
              value={editSubjectName}
              onChangeText={setEditSubjectName}
              placeholder="Enter subject name"
              autoCapitalize="words"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setEditModalVisible(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Update"
                onPress={handleUpdate}
                loading={updateSubject.isPending}
                disabled={updateSubject.isPending}
                style={styles.modalButton}
              />
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  card: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
    flex: 1,
  },
  form: {
    gap: spacing.md,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    backgroundColor: colors.surface.primary,
  },
  addButton: {
    minWidth: 80,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.primary[700],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  subjectList: {
    gap: spacing.md,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
  },
  subjectActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    ...shadows.sm,
  },
  modal: {
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
  },
  modalContent: {
    gap: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});

