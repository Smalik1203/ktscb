import React, { useState, useEffect , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal, Button, Input, EmptyState, Badge } from '../../ui';
import { spacing, borderRadius, typography, shadows, colors } from '../../../lib/design-system';
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { AccessDenied } from '../../components/common/AccessDenied';
import { useAcademicYears, useCreateAcademicYear, useUpdateAcademicYear, useDeleteAcademicYear } from '../../hooks/useAcademicYears';
import { useClassInstances, useCreateClassInstance, useUpdateClassInstance, useDeleteClassInstance } from '../../hooks/useClassInstances';
import { useAdmins } from '../../hooks/useAdmins';
import { ThreeStateView } from '../../components/common/ThreeStateView';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import { safeImpact, safeNotification } from '../../utils/haptics';

export default function AddClassesScreen() {
  const { profile } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );
  
  const schoolCode = profile?.school_code;
  const schoolName = profile?.school_name;

  // Queries
  const { data: academicYears = [] } = useAcademicYears(schoolCode);
  const { data: classInstances = [], isLoading: classesLoading, error: classesError, refetch: refetchClasses } = useClassInstances(schoolCode);
  const { data: adminsData } = useAdmins(schoolCode);
  const admins = adminsData?.data || [];
  const [showYearsModal, setShowYearsModal] = useState(false);

  // Mutations
  const createYearMutation = useCreateAcademicYear(schoolCode);
  const updateYearMutation = useUpdateAcademicYear(schoolCode);
  const deleteYearMutation = useDeleteAcademicYear(schoolCode);
  const createClassMutation = useCreateClassInstance(schoolCode);
  const updateClassMutation = useUpdateClassInstance(schoolCode);
  const deleteClassMutation = useDeleteClassInstance(schoolCode);

  // Academic Year Form - Date pickers
  const [startMonth, setStartMonth] = useState(4); // April (0-indexed: 3, but we'll use 1-12)
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(3); // March
  const [endYear, setEndYear] = useState(new Date().getFullYear() + 1);

  // Class Form
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [showAcademicYearPicker, setShowAcademicYearPicker] = useState(false);
  const [showTeacherPicker, setShowTeacherPicker] = useState(false);
  const [teacherPickerTarget, setTeacherPickerTarget] = useState<'create' | 'edit'>('create');

  // Edit Modals
  const [editYearModalVisible, setEditYearModalVisible] = useState(false);
  const [editingYear, setEditingYear] = useState<any>(null);
  const [editYearStart, setEditYearStart] = useState('');
  const [editYearEnd, setEditYearEnd] = useState('');
  const [editYearActive, setEditYearActive] = useState(true);

  const [editClassModalVisible, setEditClassModalVisible] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [editGrade, setEditGrade] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editTeacher, setEditTeacher] = useState('');

  // Toast notification state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Validation states
  const [yearStartError, setYearStartError] = useState('');
  const [yearEndError, setYearEndError] = useState('');
  const [gradeError, setGradeError] = useState('');
  const [sectionError, setSectionError] = useState('');

  // Capability-based access control
  const { can, isLoading: capabilitiesLoading } = useCapabilities();
  const canManageClasses = can('classes.manage');

  // Toast helper
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    safeNotification(
      type === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );
  };

  // Auto-set end year when start year changes
  useEffect(() => {
    if (startYear) {
      // If start month is Apr-Dec, end year is same year + 1
      // If start month is Jan-Mar, end year is same year
      if (startMonth >= 4) {
        setEndYear(startYear + 1);
      } else {
        setEndYear(startYear);
      }
    }
  }, [startYear, startMonth]);

  // Validation
  const validateAcademicYearDates = () => {
    const startDate = new Date(startYear, startMonth - 1, 1);
    const endDate = new Date(endYear, endMonth, 0); // Last day of end month
    
    if (endDate <= startDate) {
      setYearStartError('End date must be after start date');
      setYearEndError('End date must be after start date');
      return false;
    }
    
    setYearStartError('');
    setYearEndError('');
    return true;
  };

  const validateGrade = (value: string) => {
    if (!value) {
      setGradeError('Grade is required');
      return false;
    }
    const gradeNum = parseInt(value);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) {
      setGradeError('Enter a grade between 1 and 12');
      return false;
    }
    setGradeError('');
    return true;
  };

  const validateSection = (value: string) => {
    if (!value.trim()) {
      setSectionError('Section is required');
      return false;
    }
    setSectionError('');
    return true;
  };

  useEffect(() => {
    if (!selectedAcademicYear && academicYears.length > 0) {
      const activeYear = academicYears.find((year) => year.is_active);
      setSelectedAcademicYear(activeYear?.id || academicYears[0].id);
    }
  }, [academicYears, selectedAcademicYear]);

  const selectedYear = academicYears.find((year) => year.id === selectedAcademicYear);
  const selectedYearLabel = selectedYear
    ? `${selectedYear.year_start} - ${selectedYear.year_end}`
    : 'No academic year set';
  const selectedAdmin = admins.find((admin) => admin.id === selectedTeacher);
  const selectedAdminLabel = selectedAdmin ? selectedAdmin.full_name : 'Select Class Teacher';
  const editAdmin = admins.find((admin) => admin.id === editTeacher);
  const editAdminLabel = editAdmin ? editAdmin.full_name : 'Select Class Teacher';
  const normalizeSection = (value: string) => value.trim();

  if (!capabilitiesLoading && !canManageClasses) {
    return (
      <AccessDenied 
        message="You don't have permission to manage classes."
        capability="classes.manage"
      />
    );
  }

  const handleCreateYear = async () => {
    safeImpact(Haptics.ImpactFeedbackStyle.Medium);

    if (!validateAcademicYearDates()) {
      safeNotification(Haptics.NotificationFeedbackType.Error);
      showToast('Please fix the errors in the form', 'error');
      return;
    }

    // Create dates: start is 1st of start month, end is last day of end month
    const startDate = new Date(startYear, startMonth - 1, 1);
    const endDate = new Date(endYear, endMonth, 0); // Last day of end month

    // Extract year_start and year_end for backward compatibility
    const yearStart = startDate.getFullYear();
    const yearEnd = endDate.getFullYear();

    try {
      await createYearMutation.mutateAsync({
        year_start: yearStart,
        year_end: yearEnd,
        start_date: startDate.toISOString().split('T')[0], // YYYY-MM-DD
        end_date: endDate.toISOString().split('T')[0],
        school_code: schoolCode!,
        school_name: schoolName || schoolCode!,
      });

      showToast(`Academic Year created successfully!`, 'success');
      // Reset form
      setStartMonth(4);
      setStartYear(new Date().getFullYear());
      setEndMonth(3);
      setEndYear(new Date().getFullYear() + 1);
    } catch (error: any) {
      showToast(error.message || 'Failed to create academic year', 'error');
    }
  };

  const handleCreateClass = async () => {
    if (!grade || !section || !selectedAcademicYear || !selectedTeacher) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    if (academicYears.length === 0) {
      Alert.alert('Error', 'Please create an academic year first');
      return;
    }

    try {
      await createClassMutation.mutateAsync({
        grade,
        section: section.toUpperCase(),
        academic_year_id: selectedAcademicYear,
        class_teacher_id: selectedTeacher,
        school_code: schoolCode!,
        school_name: schoolName || schoolCode!,
        created_by: profile?.auth_id || '',
      });

      Alert.alert('Success', 'Class created successfully!');
      setGrade('');
      setSection('');
      setSelectedAcademicYear('');
      setSelectedTeacher('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create class');
    }
  };

  const handleEditYear = (year: any) => {
    setEditingYear(year);
    setEditYearStart(year.year_start.toString());
    setEditYearEnd(year.year_end.toString());
    setEditYearActive(year.is_active);
    setEditYearModalVisible(true);
  };

  const handleUpdateYear = async () => {
    if (!editingYear) return;

    try {
      await updateYearMutation.mutateAsync({
        id: editingYear.id,
        year_start: parseInt(editYearStart),
        year_end: parseInt(editYearEnd),
        is_active: editYearActive,
      });

      Alert.alert('Success', 'Academic year updated successfully');
      setEditYearModalVisible(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update academic year');
    }
  };

  const handleDeleteYear = (yearId: string) => {
    Alert.alert(
      'Delete Academic Year',
      'This removes the academic year and can block class creation. Deletion will fail if any classes are using this year.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteYearMutation.mutateAsync(yearId);
              Alert.alert('Success', 'Academic year deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete academic year');
            }
          },
        },
      ]
    );
  };

  const handleEditClass = (classInstance: any) => {
    setEditingClass(classInstance);
    setEditGrade(classInstance.grade);
    setEditSection(classInstance.section);
    setEditTeacher(classInstance.class_teacher_id || '');
    setEditClassModalVisible(true);
  };

  const handleUpdateClass = async () => {
    if (!editingClass) return;

    try {
      await updateClassMutation.mutateAsync({
        id: editingClass.id,
        grade: editGrade,
        section: editSection.toUpperCase(),
        class_teacher_id: editTeacher,
      });

      Alert.alert('Success', 'Class updated successfully');
      setEditClassModalVisible(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update class');
    }
  };

  const handleDeleteClass = (classId: string) => {
    Alert.alert(
      'Delete Class',
      'This removes the class for the active academic year. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClassMutation.mutateAsync(classId);
              Alert.alert('Success', 'Class deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete class');
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
        <View style={styles.section}>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <View style={styles.yearHeaderRow}>
                <Text style={styles.yearHeaderLabel}>Academic Year</Text>
                <TouchableOpacity 
                  onPress={() => setShowYearsModal(true)}
                  style={styles.manageLink}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="edit" size={14} color={colors.primary[600]} />
                  <Text style={styles.manageLinkText}>Manage</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setShowAcademicYearPicker(true)}
                disabled={academicYears.length === 0}
              >
                <Text style={[styles.selectText, !selectedAcademicYear && styles.placeholderText]}>
                  {selectedYearLabel}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
              {academicYears.length === 0 && (
                <Text style={styles.helperText}>Create an academic year before adding classes.</Text>
              )}
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Input
                  label="Grade"
                  value={grade}
                  onChangeText={(text) => {
                    setGrade(text);
                    if (text) validateGrade(text);
                  }}
                  placeholder="e.g., 10"
                  keyboardType="number-pad"
                  error={gradeError}
                  size="sm"
                  inputStyle={{ fontSize: typography.fontSize.base }}
                />
                {gradeError ? (
                  <Text style={styles.errorText}>{gradeError}</Text>
                ) : null}
              </View>
              <View style={styles.formCol}>
                <Input
                  label="Section"
                  value={section}
                  onChangeText={(text) => {
                    setSection(text);
                    if (text) validateSection(text);
                  }}
                  placeholder="e.g., A or Blue"
                  autoCapitalize="words"
                  error={sectionError}
                  size="sm"
                  inputStyle={{ fontSize: typography.fontSize.base }}
                />
                {sectionError ? (
                  <Text style={styles.errorText}>{sectionError}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Class Teacher</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => {
                  setTeacherPickerTarget('create');
                  setShowTeacherPicker(true);
                }}
                disabled={admins.length === 0}
              >
                <Text style={[styles.selectText, !selectedTeacher && styles.placeholderText]}>
                  {selectedAdminLabel}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
              {admins.length === 0 && (
                <Text style={styles.helperText}>No teachers available</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listTitle}>Existing Classes</Text>
            <Badge variant="primary">{classInstances.length}</Badge>
          </View>

          <ThreeStateView
            state={classesLoading ? 'loading' : classesError ? 'error' : classInstances.length === 0 ? 'empty' : 'success'}
            loadingMessage="Loading classes..."
            errorMessage="Failed to load classes"
            errorDetails={classesError?.message}
            emptyMessage="No classes yet. Add a grade and section to create the first class."
            onRetry={refetchClasses}
          >
            <View style={styles.list}>
              {classInstances.map((classInstance) => (
                <View
                  key={classInstance.id}
                  style={styles.listItem}
                >
                  <View style={styles.listItemContent}>
                    <View style={styles.classInfo}>
                      <Text style={styles.listItemTitle}>
                        Grade {classInstance.grade} - Section {classInstance.section}
                      </Text>
                      <Text style={styles.listItemSubtitle}>
                        Class Teacher: {classInstance.teacher?.full_name || 'Not assigned'}
                      </Text>
                    </View>
                    <View style={styles.listItemActions}>
                      <TouchableOpacity
                        onPress={() => {
                          safeImpact(Haptics.ImpactFeedbackStyle.Light);
                          handleEditClass(classInstance);
                        }}
                        style={styles.actionButton}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="edit" size={18} color={colors.info[600]} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          safeImpact(Haptics.ImpactFeedbackStyle.Medium);
                          handleDeleteClass(classInstance.id);
                        }}
                        style={styles.actionButton}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="delete" size={18} color={colors.error[600]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ThreeStateView>
        </View>
      </ScrollView>

      <View style={styles.footerBar}>
        <Button
          title={createClassMutation.isPending ? 'Creating...' : 'Create Class'}
          onPress={handleCreateClass}
          loading={createClassMutation.isPending}
          disabled={
            createClassMutation.isPending ||
            academicYears.length === 0 ||
            !grade ||
            !section ||
            !selectedAcademicYear ||
            !selectedTeacher
          }
          fullWidth
        />
      </View>

      {/* Academic Years Modal */}
        <Modal
          visible={showYearsModal}
          onDismiss={() => setShowYearsModal(false)}
          contentContainerStyle={styles.yearsModal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Academic Years</Text>
            <TouchableOpacity
              onPress={() => setShowYearsModal(false)}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {/* Existing Years List First */}
            {academicYears.length > 0 ? (
              <View style={styles.yearsList}>
                {academicYears.map((year) => (
                  <View key={year.id} style={styles.yearItem}>
                    <View style={styles.yearItemLeft}>
                      <Text style={styles.yearItemText}>
                        {year.year_start} - {year.year_end}
                      </Text>
                      {year.is_active && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.yearItemActions}>
                      <TouchableOpacity
                        onPress={() => {
                          safeImpact(Haptics.ImpactFeedbackStyle.Light);
                          handleEditYear(year);
                        }}
                        style={styles.iconBtn}
                      >
                        <MaterialIcons name="edit" size={18} color={colors.primary[600]} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          safeImpact(Haptics.ImpactFeedbackStyle.Medium);
                          handleDeleteYear(year.id);
                        }}
                        style={styles.iconBtn}
                      >
                        <MaterialIcons name="delete" size={18} color={colors.error[600]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyYears}>
                <Text style={styles.emptyYearsText}>No academic years yet</Text>
              </View>
            )}

            {/* Create New Section */}
            <View style={styles.createSection}>
              <Text style={styles.createSectionTitle}>Add New</Text>
              <View style={styles.yearInputRow}>
                <Input
                  label="Start Year"
                  value={startYear.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || new Date().getFullYear();
                    setStartYear(num);
                    validateAcademicYearDates();
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="2025"
                  containerStyle={styles.yearInput}
                />
                <Input
                  label="End Year"
                  value={endYear.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || new Date().getFullYear() + 1;
                    setEndYear(num);
                    validateAcademicYearDates();
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="2026"
                  containerStyle={styles.yearInput}
                />
              </View>
              {(yearStartError || yearEndError) && (
                <Text style={styles.errorText}>{yearStartError || yearEndError}</Text>
              )}
              <Button
                title={createYearMutation.isPending ? 'Adding...' : 'Add Year'}
                onPress={handleCreateYear}
                loading={createYearMutation.isPending}
                disabled={createYearMutation.isPending || !startYear || !endYear || !!yearStartError || !!yearEndError}
                fullWidth
              />
            </View>
          </ScrollView>
        </Modal>

      {/* Edit Year Modal */}
        <Modal
          visible={editYearModalVisible}
          onDismiss={() => {
            safeImpact(Haptics.ImpactFeedbackStyle.Light);
            setEditYearModalVisible(false);
          }}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Academic Year</Text>
            <TouchableOpacity
              onPress={() => {
                safeImpact(Haptics.ImpactFeedbackStyle.Light);
                setEditYearModalVisible(false);
              }}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Input
              label="Start Year"
              value={editYearStart}
              onChangeText={setEditYearStart}
              keyboardType="number-pad"
              maxLength={4}
            />

            <Input
              label="End Year"
              value={editYearEnd}
              onChangeText={setEditYearEnd}
              keyboardType="number-pad"
              maxLength={4}
            />

            <TouchableOpacity
              onPress={() => setEditYearActive(!editYearActive)}
              style={styles.switchRow}
            >
              <Text style={styles.switchLabel}>Active</Text>
              <View style={[styles.switch, editYearActive && styles.switchActive]}>
                <View style={[styles.switchThumb, editYearActive && styles.switchThumbActive]} />
              </View>
            </TouchableOpacity>
              <Text style={styles.switchHint}>
                Only one academic year should be active for class creation.
              </Text>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setEditYearModalVisible(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Update"
                onPress={handleUpdateYear}
                loading={updateYearMutation.isPending}
                style={styles.modalButton}
              />
            </View>
          </View>
        </Modal>

      {/* Edit Class Modal */}
        <Modal
          visible={editClassModalVisible}
          onDismiss={() => {
            safeImpact(Haptics.ImpactFeedbackStyle.Light);
            setEditClassModalVisible(false);
          }}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Class</Text>
            <TouchableOpacity
              onPress={() => {
                safeImpact(Haptics.ImpactFeedbackStyle.Light);
                setEditClassModalVisible(false);
              }}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Input
              label="Grade"
              value={editGrade}
              onChangeText={(text) => setEditGrade(text)}
              keyboardType="number-pad"
              size="sm"
              inputStyle={{ fontSize: typography.fontSize.base }}
            />

            <Input
              label="Section"
              value={editSection}
              onChangeText={setEditSection}
              placeholder="e.g., A or Blue"
              autoCapitalize="words"
              size="sm"
              inputStyle={{ fontSize: typography.fontSize.base }}
            />

            <View>
              <Text style={styles.label}>Class Teacher</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => {
                  setTeacherPickerTarget('edit');
                  setShowTeacherPicker(true);
                }}
                disabled={admins.length === 0}
              >
                <Text style={[styles.selectText, !editTeacher && styles.placeholderText]}>
                  {editAdminLabel}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
              {admins.length === 0 && (
                <Text style={styles.helperText}>No teachers available</Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setEditClassModalVisible(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Update"
                onPress={handleUpdateClass}
                loading={updateClassMutation.isPending}
                style={styles.modalButton}
              />
            </View>
          </View>
        </Modal>

      {/* Academic Year Picker */}
        <Modal
          visible={showAcademicYearPicker}
          onDismiss={() => setShowAcademicYearPicker(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Academic Year</Text>
            <TouchableOpacity
              onPress={() => setShowAcademicYearPicker(false)}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalList}>
            {academicYears.map((year) => {
              const label = `${year.year_start} - ${year.year_end}`;
              const isSelected = selectedAcademicYear === year.id;
              return (
                <TouchableOpacity
                  key={year.id}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    setSelectedAcademicYear(year.id);
                    setShowAcademicYearPicker(false);
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

      {/* Class Admin Picker */}
        <Modal
          visible={showTeacherPicker}
          onDismiss={() => setShowTeacherPicker(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Class Admin</Text>
            <TouchableOpacity
              onPress={() => setShowTeacherPicker(false)}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {admins.length === 0 ? (
            <EmptyState
              title="No admins available"
              message="Create an admin to assign as class admin."
              variant="card"
            />
          ) : (
            <ScrollView style={styles.modalList}>
              {admins.map((admin) => {
                const isSelected =
                  teacherPickerTarget === 'create'
                    ? selectedTeacher === admin.id
                    : editTeacher === admin.id;
                return (
                  <TouchableOpacity
                    key={admin.id}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      if (teacherPickerTarget === 'create') {
                        setSelectedTeacher(admin.id);
                      } else {
                        setEditTeacher(admin.id);
                      }
                      setShowTeacherPicker(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {admin.full_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
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
  scrollContent: {
    padding: spacing.sm,
    paddingBottom: spacing.xl * 2 + 56,
  },
  // Cards
  section: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  yearHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  yearHeaderLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
  },
  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium as any,
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
    flex: 1,
  },
  // Form
  form: {
    gap: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    overflow: 'hidden',
    ...shadows.none,
  },
  picker: {
    height: 44,
    color: colors.text.primary,
  },
  pickerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formCol: {
    flex: 1,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    ...shadows.none,
  },
  selectText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  placeholderText: {
    color: colors.text.tertiary,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  // Tip Card
  tipCard: {
    backgroundColor: colors.info[50],
    borderColor: colors.info[200],
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.info[700],
    lineHeight: typography.lineHeight.relaxed,
  },
  // List Items
  list: {
    gap: 0,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  listTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
  },
  listItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemInfo: {
    flex: 1,
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  classInfo: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  listItemSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as any,
  },
  listItemActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
  },
  // Switch
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
  },
  switchLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.text.primary,
  },
  switchHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  switch: {
    width: 52,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[300],
    padding: 3,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: colors.success[500],
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.primary,
    ...shadows.sm,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  // Modal
  modal: {
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    maxHeight: '85%',
    ...shadows.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
  },
  modalContent: {
    gap: spacing.md,
  },
  modalHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
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
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  modalItemTextSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold as any,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  modalButton: {
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface.primary,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.md,
  },
  // Academic Years Modal
  yearsModal: {
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    maxHeight: '70%',
    ...shadows.md,
  },
  yearsList: {
    marginBottom: spacing.md,
  },
  yearItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  yearItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  yearItemText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.text.primary,
  },
  activeBadge: {
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  activeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.success[700],
  },
  yearItemActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBtn: {
    padding: spacing.xs,
  },
  emptyYears: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyYearsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  createSection: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  createSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  yearInputRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  yearInput: {
    flex: 1,
  },
});

