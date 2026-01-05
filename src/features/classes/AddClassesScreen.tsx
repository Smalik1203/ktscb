import React, { useState, useEffect , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Portal, Modal } from 'react-native-paper';
import { Calendar, BookOpen, Edit, Trash2, X, Plus, Sparkles } from 'lucide-react-native';
import { spacing, borderRadius, typography, shadows, colors } from '../../../lib/design-system';
import { Card, Button, Input, EmptyState } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { AccessDenied } from '../../components/common/AccessDenied';
import { useAcademicYears, useCreateAcademicYear, useUpdateAcademicYear, useDeleteAcademicYear } from '../../hooks/useAcademicYears';
import { useClassInstances, useCreateClassInstance, useUpdateClassInstance, useDeleteClassInstance } from '../../hooks/useClassInstances';
import { useAdmins } from '../../hooks/useAdmins';
import { ThreeStateView } from '../../components/common/ThreeStateView';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';

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
  const [mode, setMode] = useState<'create' | 'list'>('create');

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
    Haptics.notificationAsync(
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
    if (!value) {
      setSectionError('Section is required');
      return false;
    }
    if (!/^[A-Za-z]$/.test(value)) {
      setSectionError('Enter a single letter (A-Z)');
      return false;
    }
    setSectionError('');
    return true;
  };

  if (!capabilitiesLoading && !canManageClasses) {
    return (
      <AccessDenied 
        message="You don't have permission to manage classes."
        capability="classes.manage"
      />
    );
  }

  const handleCreateYear = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!validateAcademicYearDates()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      'Are you sure? This will fail if any classes are using this year.',
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
      'Are you sure you want to delete this class?',
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
        {/* Compact Segment Selector */}
        <View style={styles.segmentContainer}>
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentItem, mode === 'create' && styles.segmentItemActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode('create');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, mode === 'create' && styles.segmentTextActive]}>
                Create
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentItem, mode === 'list' && styles.segmentItemActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode('list');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, mode === 'list' && styles.segmentTextActive]}>
                Existing
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Academic Year Section */}
        {mode === 'create' && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Calendar size={24} color={colors.success[600]} />
              <Text style={styles.cardTitle}>Academic Year</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.sectionLabel}>Start Date</Text>
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.pickerLabel}>Month</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={startMonth}
                      onValueChange={(value) => {
                        setStartMonth(value);
                        validateAcademicYearDates();
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="January" value={1} />
                      <Picker.Item label="February" value={2} />
                      <Picker.Item label="March" value={3} />
                      <Picker.Item label="April" value={4} />
                      <Picker.Item label="May" value={5} />
                      <Picker.Item label="June" value={6} />
                      <Picker.Item label="July" value={7} />
                      <Picker.Item label="August" value={8} />
                      <Picker.Item label="September" value={9} />
                      <Picker.Item label="October" value={10} />
                      <Picker.Item label="November" value={11} />
                      <Picker.Item label="December" value={12} />
                    </Picker>
                  </View>
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.pickerLabel}>Year</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={startYear}
                      onValueChange={(value) => {
                        setStartYear(value);
                        validateAcademicYearDates();
                      }}
                      style={styles.picker}
                    >
                      {Array.from({ length: 11 }, (_, i) => {
                        const year = new Date().getFullYear() - 5 + i;
                        return <Picker.Item key={year} label={year.toString()} value={year} />;
                      })}
                    </Picker>
                  </View>
                </View>
              </View>
              {yearStartError ? (
                <Text style={styles.errorText}>{yearStartError}</Text>
              ) : null}

              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>End Date</Text>
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={styles.pickerLabel}>Month</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={endMonth}
                      onValueChange={(value) => {
                        setEndMonth(value);
                        validateAcademicYearDates();
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="January" value={1} />
                      <Picker.Item label="February" value={2} />
                      <Picker.Item label="March" value={3} />
                      <Picker.Item label="April" value={4} />
                      <Picker.Item label="May" value={5} />
                      <Picker.Item label="June" value={6} />
                      <Picker.Item label="July" value={7} />
                      <Picker.Item label="August" value={8} />
                      <Picker.Item label="September" value={9} />
                      <Picker.Item label="October" value={10} />
                      <Picker.Item label="November" value={11} />
                      <Picker.Item label="December" value={12} />
                    </Picker>
                  </View>
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.pickerLabel}>Year</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={endYear}
                      onValueChange={(value) => {
                        setEndYear(value);
                        validateAcademicYearDates();
                      }}
                      style={styles.picker}
                    >
                      {Array.from({ length: 11 }, (_, i) => {
                        const year = new Date().getFullYear() - 5 + i;
                        return <Picker.Item key={year} label={year.toString()} value={year} />;
                      })}
                    </Picker>
                  </View>
                </View>
              </View>
              {yearEndError ? (
                <Text style={styles.errorText}>{yearEndError}</Text>
              ) : null}

              <Button
                title={createYearMutation.isPending ? 'Creating...' : 'Create Academic Year'}
                onPress={handleCreateYear}
                loading={createYearMutation.isPending}
                disabled={createYearMutation.isPending || !startYear || !endYear || !!yearStartError || !!yearEndError}
                icon={<Plus size={20} color={colors.surface.primary} />}
                style={styles.submitButton}
              />
            </View>
          </Card>
        )}

        {/* Academic Years List */}
        {academicYears.length > 0 && (
          <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Academic Years</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{academicYears.length}</Text>
                </View>
              </View>

              <View style={styles.list}>
                {academicYears.map((year) => (
                  <View
                    key={year.id}
                    style={styles.listItem}
                  >
                    <View style={styles.listItemContent}>
                      <View style={styles.listItemInfo}>
                        <Text style={styles.listItemTitle}>
                          {year.start_date && year.end_date
                            ? `${new Date(year.start_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} - ${new Date(year.end_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
                            : `${year.year_start} - ${year.year_end}`
                          }
                        </Text>
                        <View style={styles.listItemMeta}>
                          <View style={[styles.statusBadge, { backgroundColor: year.is_active ? colors.success[100] : colors.neutral[100] }]}>
                            <Text style={[styles.statusBadgeText, { color: year.is_active ? colors.success[700] : colors.neutral[700] }]}>
                              {year.is_active ? 'Active' : 'Inactive'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.listItemActions}>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleEditYear(year);
                          }}
                          style={styles.actionButton}
                          activeOpacity={0.7}
                        >
                          <Edit size={18} color={colors.info[600]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            handleDeleteYear(year.id);
                          }}
                          style={styles.actionButton}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={18} color={colors.error[600]} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
        )}

        {/* Tip Card */}
        {academicYears.length === 0 && mode === 'create' && (
          <Card style={[styles.card, styles.tipCard]}>
              <View style={styles.tipContent}>
                <Sparkles size={20} color={colors.info[600]} />
                <Text style={styles.tipText}>
                  Create an academic year first before adding classes
                </Text>
              </View>
            </Card>
        )}

        {/* Add Class Section */}
        {mode === 'create' && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <BookOpen size={24} color={colors.primary[600]} />
              <Text style={styles.cardTitle}>Create Class</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Academic Year</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedAcademicYear}
                    onValueChange={(value) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedAcademicYear(value);
                    }}
                    enabled={academicYears.length > 0}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select Academic Year" value="" />
                    {academicYears.map((year) => (
                      <Picker.Item
                        key={year.id}
                        label={`${year.year_start} - ${year.year_end}`}
                        value={year.id}
                      />
                    ))}
                  </Picker>
                </View>
                {academicYears.length === 0 && (
                  <Text style={styles.helperText}>Create an academic year first</Text>
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
                    placeholder="e.g., A"
                    autoCapitalize="characters"
                    maxLength={1}
                    error={sectionError}
                  />
                  {sectionError ? (
                    <Text style={styles.errorText}>{sectionError}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Class Admin</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedTeacher}
                    onValueChange={(value) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedTeacher(value);
                    }}
                    enabled={admins.length > 0}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select Class Admin" value="" />
                    {admins.map((admin) => (
                      <Picker.Item key={admin.id} label={admin.full_name} value={admin.id} />
                    ))}
                  </Picker>
                </View>
                {admins.length === 0 && (
                  <Text style={styles.helperText}>No admins available</Text>
                )}
              </View>

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
                icon={<Plus size={20} color={colors.surface.primary} />}
                style={styles.submitButton}
              />
            </View>
          </Card>
        )}

        {/* Classes List */}
        {mode === 'list' && (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Existing Classes</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{classInstances.length}</Text>
              </View>
            </View>

            <ThreeStateView
              state={classesLoading ? 'loading' : classesError ? 'error' : classInstances.length === 0 ? 'empty' : 'success'}
              loadingMessage="Loading classes..."
              errorMessage="Failed to load classes"
              errorDetails={classesError?.message}
              emptyMessage="No classes have been created yet"
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
                          {classInstance.year?.year_start} - {classInstance.year?.year_end}
                        </Text>
                        <Text style={styles.listItemSubtitle}>
                          {classInstance.teacher?.full_name || 'No teacher assigned'}
                        </Text>
                      </View>
                      <View style={styles.listItemActions}>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleEditClass(classInstance);
                          }}
                          style={styles.actionButton}
                          activeOpacity={0.7}
                        >
                          <Edit size={18} color={colors.info[600]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            handleDeleteClass(classInstance.id);
                          }}
                          style={styles.actionButton}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={18} color={colors.error[600]} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </ThreeStateView>
          </Card>
        )}
      </ScrollView>

      {/* Edit Year Modal */}
      <Portal>
        <Modal
          visible={editYearModalVisible}
          onDismiss={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setEditYearModalVisible(false);
          }}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Academic Year</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditYearModalVisible(false);
              }}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X size={24} color={colors.text.secondary} />
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
      </Portal>

      {/* Edit Class Modal */}
      <Portal>
        <Modal
          visible={editClassModalVisible}
          onDismiss={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setEditClassModalVisible(false);
          }}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Class</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditClassModalVisible(false);
              }}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Input
              label="Grade"
              value={editGrade}
              onChangeText={setEditGrade}
              keyboardType="number-pad"
            />

            <Input
              label="Section"
              value={editSection}
              onChangeText={setEditSection}
              autoCapitalize="characters"
            />

            <View>
              <Text style={styles.label}>Class Admin</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editTeacher}
                  onValueChange={setEditTeacher}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Class Admin" value="" />
                  {admins.map((admin) => (
                    <Picker.Item key={admin.id} label={admin.full_name} value={admin.id} />
                  ))}
                </Picker>
              </View>
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  // Segment Selector
  segmentContainer: {
    marginBottom: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface.secondary,
    padding: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
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
  // Cards
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  badge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.primary[700],
  },
  // Form
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  pickerContainer: {
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    overflow: 'hidden',
    ...shadows.xs,
  },
  picker: {
    height: 50,
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
    marginBottom: spacing.sm,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  formCol: {
    flex: 1,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
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
    gap: spacing.md,
  },
  listItem: {
    padding: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
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
    backgroundColor: colors.surface.primary,
    ...shadows.xs,
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
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '85%',
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
  },
  modalContent: {
    gap: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  modalButton: {
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
});

