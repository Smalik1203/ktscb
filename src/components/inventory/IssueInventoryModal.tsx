/**
 * Issue Inventory Modal
 * 
 * Modal for issuing inventory items to students or staff.
 * Handles quantity, serial numbers, and fee charges.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal as RNModal } from 'react-native';
import { Text, Portal, Modal, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { X, User, Users, Package, AlertCircle, Info } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useStudents } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { spacing, typography, borderRadius, shadows } from '../../../lib/design-system';
import { Search } from 'lucide-react-native';

interface IssueInventoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inventoryItem: {
    id: string;
    name: string;
    category: string;
    can_be_issued: boolean;
    issue_to: 'student' | 'staff' | 'both' | null;
    track_quantity: boolean;
    current_quantity: number | null;
    track_serially: boolean;
    is_chargeable: boolean;
    charge_amount: number | null;
    charge_type: 'one_time' | 'deposit' | null;
    allow_price_override: boolean;
    must_be_returned: boolean;
    return_duration_days: number | null;
  };
  schoolCode: string;
  onIssue: (data: {
    inventory_item_id: string;
    issued_to_type: 'student' | 'staff';
    issued_to_id: string;
    quantity: number;
    serial_number?: string;
    charge_amount_override?: number;
  }) => Promise<{ id: string }>;
}

export function IssueInventoryModal({
  visible,
  onClose,
  onSuccess,
  inventoryItem,
  schoolCode,
  onIssue,
}: IssueInventoryModalProps) {
  const { colors, isDark } = useTheme();
  const { profile } = useAuth();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [issuedToType, setIssuedToType] = useState<'student' | 'staff'>(
    inventoryItem.issue_to === 'both' ? 'student' : (inventoryItem.issue_to || 'student')
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [serialNumber, setSerialNumber] = useState('');
  const [chargeAmountOverride, setChargeAmountOverride] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);

  // Fetch classes and students
  const { data: classes = [] } = useClasses(schoolCode);
  const { data: studentsData } = useStudents(
    selectedClassId || undefined,
    schoolCode,
    { page: 1, pageSize: 100 } // Get first 100 students
  );
  const students = studentsData?.data || [];

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s: any) =>
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.student_code || '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  // Fetch staff (users with admin/teacher role)
  const [staffSearch, setStaffSearch] = useState('');
  const [staff, setStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  useEffect(() => {
    if (issuedToType === 'staff' && visible) {
      loadStaff();
    }
  }, [issuedToType, visible]);

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('school_code', schoolCode)
        .in('role', ['admin', 'teacher', 'cb_admin'])
        .order('full_name');
      
      if (!error && data) {
        setStaff(data);
      }
    } catch (err) {
      console.error('Failed to load staff', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return staff;
    const q = staffSearch.trim().toLowerCase();
    return staff.filter((s: any) =>
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  }, [staff, staffSearch]);

  // Calculate total charge
  const totalCharge = useMemo(() => {
    if (!inventoryItem.is_chargeable || !inventoryItem.charge_amount) return null;
    const qty = parseInt(quantity) || 1;
    const amount = chargeAmountOverride 
      ? parseFloat(chargeAmountOverride) 
      : inventoryItem.charge_amount;
    return amount * qty;
  }, [quantity, chargeAmountOverride, inventoryItem.charge_amount, inventoryItem.is_chargeable]);

  // Calculate expected return date
  const expectedReturnDate = useMemo(() => {
    if (!inventoryItem.must_be_returned || !inventoryItem.return_duration_days) return null;
    const date = new Date();
    date.setDate(date.getDate() + inventoryItem.return_duration_days);
    return date.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }, [inventoryItem.must_be_returned, inventoryItem.return_duration_days]);

  const handleIssue = async () => {
    // Validation
    if (issuedToType === 'student' && !selectedStudentId) {
      Alert.alert('Required', 'Please select a student');
      return;
    }
    if (issuedToType === 'staff' && !selectedStaffId) {
      Alert.alert('Required', 'Please select a staff member');
      return;
    }
    
    const qty = parseInt(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid', 'Please enter a valid quantity');
      return;
    }

    if (inventoryItem.track_quantity && inventoryItem.current_quantity !== null) {
      if (qty > inventoryItem.current_quantity) {
        Alert.alert('Insufficient Quantity', `Only ${inventoryItem.current_quantity} items available`);
        return;
      }
    }

    if (inventoryItem.track_serially && qty > 1) {
      Alert.alert('Serial Tracking', 'Only 1 item can be issued at a time when serial tracking is enabled');
      return;
    }

    if (inventoryItem.track_serially && !serialNumber.trim()) {
      Alert.alert('Required', 'Please enter serial number');
      return;
    }

    if (inventoryItem.is_chargeable && chargeAmountOverride) {
      const amount = parseFloat(chargeAmountOverride);
      if (isNaN(amount) || amount < 0) {
        Alert.alert('Invalid', 'Please enter a valid charge amount');
        return;
      }
    }

    try {
      setSubmitting(true);
      await onIssue({
        inventory_item_id: inventoryItem.id,
        issued_to_type: issuedToType,
        issued_to_id: issuedToType === 'student' ? selectedStudentId : selectedStaffId,
        quantity: qty,
        serial_number: inventoryItem.track_serially ? serialNumber.trim() : undefined,
        charge_amount_override: chargeAmountOverride ? parseFloat(chargeAmountOverride) : undefined,
      });
      
      Alert.alert('Success', 'Item issued successfully', [
        { text: 'OK', onPress: () => {
          onSuccess();
          handleClose();
        }},
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to issue item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedClassId('');
    setSelectedStudentId('');
    setSelectedStaffId('');
    setQuantity('1');
    setSerialNumber('');
    setChargeAmountOverride('');
    setStudentSearch('');
    setStaffSearch('');
    onClose();
  };

  const getSelectedPersonName = () => {
    if (issuedToType === 'student') {
      const student = students.find((s: any) => s.id === selectedStudentId);
      return student ? student.full_name : 'Select Student';
    } else {
      const staffMember = staff.find((s: any) => s.id === selectedStaffId);
      return staffMember ? staffMember.full_name : 'Select Staff';
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Package size={24} color={colors.primary[600]} />
              <Text style={styles.headerTitle}>Issue Item</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Item Info */}
          <View style={styles.itemInfoCard}>
            <Text style={styles.itemName}>{inventoryItem.name}</Text>
            <Text style={styles.itemCategory}>{inventoryItem.category}</Text>
            {inventoryItem.track_quantity && inventoryItem.current_quantity !== null && (
              <Text style={styles.quantityInfo}>
                Available: {inventoryItem.current_quantity}
              </Text>
            )}
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Issue To Type */}
            {inventoryItem.issue_to === 'both' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Issue To *</Text>
                <SegmentedButtons
                  value={issuedToType}
                  onValueChange={(value) => {
                    setIssuedToType(value as 'student' | 'staff');
                    setSelectedStudentId('');
                    setSelectedStaffId('');
                    setSelectedClassId('');
                  }}
                  buttons={[
                    { value: 'student', label: 'Student', icon: User },
                    { value: 'staff', label: 'Staff', icon: Users },
                  ]}
                  style={styles.segmentedButtons}
                />
              </View>
            )}

            {/* Student Selection */}
            {issuedToType === 'student' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Class *</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setShowClassPicker(true)}
                  >
                    <Text style={styles.pickerButtonText}>
                      {selectedClassId
                        ? classes.find((c: any) => c.id === selectedClassId)
                          ? `Grade ${classes.find((c: any) => c.id === selectedClassId)?.grade} - ${classes.find((c: any) => c.id === selectedClassId)?.section}`
                          : 'Select Class'
                        : 'Select Class'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedClassId && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Student *</Text>
                    <View style={styles.searchContainer}>
                      <Search size={18} color={colors.text.secondary} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search students..."
                        value={studentSearch}
                        onChangeText={setStudentSearch}
                        placeholderTextColor={colors.text.secondary}
                      />
                    </View>
                    <ScrollView style={styles.pickerList} nestedScrollEnabled>
                      {filteredStudents.map((student: any) => (
                        <TouchableOpacity
                          key={student.id}
                          style={[
                            styles.pickerItem,
                            selectedStudentId === student.id && styles.pickerItemSelected,
                          ]}
                          onPress={() => setSelectedStudentId(student.id)}
                        >
                          <Text style={[
                            styles.pickerItemText,
                            selectedStudentId === student.id && styles.pickerItemTextSelected,
                          ]}>
                            {student.full_name} ({student.student_code})
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {filteredStudents.length === 0 && (
                        <Text style={styles.emptyText}>No students found</Text>
                      )}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            {/* Staff Selection */}
            {issuedToType === 'staff' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Staff Member *</Text>
                <View style={styles.searchContainer}>
                  <Search size={18} color={colors.text.secondary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search staff..."
                    value={staffSearch}
                    onChangeText={setStaffSearch}
                    placeholderTextColor={colors.text.secondary}
                  />
                </View>
                {loadingStaff ? (
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                ) : (
                  <ScrollView style={styles.pickerList} nestedScrollEnabled>
                    {filteredStaff.map((staffMember: any) => (
                      <TouchableOpacity
                        key={staffMember.id}
                        style={[
                          styles.pickerItem,
                          selectedStaffId === staffMember.id && styles.pickerItemSelected,
                        ]}
                        onPress={() => setSelectedStaffId(staffMember.id)}
                      >
                        <Text style={[
                          styles.pickerItemText,
                          selectedStaffId === staffMember.id && styles.pickerItemTextSelected,
                        ]}>
                          {staffMember.full_name} ({staffMember.role})
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {filteredStaff.length === 0 && (
                      <Text style={styles.emptyText}>No staff found</Text>
                    )}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Quantity */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholderTextColor={colors.text.secondary}
                editable={!inventoryItem.track_serially}
              />
              {inventoryItem.track_serially && (
                <Text style={styles.helperText}>
                  Serial tracking enabled - quantity is always 1
                </Text>
              )}
            </View>

            {/* Serial Number */}
            {inventoryItem.track_serially && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Serial Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter serial number"
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                  placeholderTextColor={colors.text.secondary}
                />
              </View>
            )}

            {/* Charge Amount */}
            {inventoryItem.is_chargeable && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Charge Amount {inventoryItem.allow_price_override ? '(Override)' : ''}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={inventoryItem.charge_amount?.toString() || '0.00'}
                  value={chargeAmountOverride}
                  onChangeText={setChargeAmountOverride}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.text.secondary}
                  editable={inventoryItem.allow_price_override}
                />
                <Text style={styles.helperText}>
                  Default: ₹{inventoryItem.charge_amount} per item
                  {inventoryItem.charge_type === 'deposit' && ' (refundable)'}
                </Text>
                {totalCharge && (
                  <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Total Charge:</Text>
                    <Text style={styles.totalAmount}>₹{totalCharge.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Return Date Info */}
            {inventoryItem.must_be_returned && expectedReturnDate && (
              <View style={styles.infoCard}>
                <Info size={20} color={colors.primary[600]} />
                <Text style={styles.infoText}>
                  Expected return date: {expectedReturnDate}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.issueButton, submitting && styles.issueButtonDisabled]}
              onPress={handleIssue}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.issueButtonText}>Issue Item</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Class Picker Modal */}
      <RNModal
        visible={showClassPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowClassPicker(false)}
      >
        <View style={styles.classPickerOverlay}>
          <View style={styles.classPickerContent}>
            <View style={styles.classPickerHeader}>
              <Text style={styles.classPickerTitle}>Select Class</Text>
              <TouchableOpacity onPress={() => setShowClassPicker(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.classPickerList}>
              {classes.map((cls: any) => {
                const isSelected = selectedClassId === cls.id;
                return (
                  <TouchableOpacity
                    key={cls.id}
                    style={[styles.classPickerItem, isSelected && styles.classPickerItemSelected]}
                    onPress={() => {
                      setSelectedClassId(cls.id);
                      setShowClassPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.classPickerItemText,
                      isSelected && styles.classPickerItemTextSelected,
                    ]}>
                      Grade {cls.grade} - Section {cls.section}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {classes.length === 0 && (
                <Text style={styles.emptyText}>No classes available</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </RNModal>
    </Portal>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  modal: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    margin: spacing.lg,
    maxHeight: '90%',
    ...shadows.lg,
  },
  container: {
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  itemInfoCard: {
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    margin: spacing.lg,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[600],
  },
  itemName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  itemCategory: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  quantityInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  scrollView: {
    maxHeight: 400,
  },
  formGroup: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  segmentedButtons: {
    marginTop: spacing.sm,
  },
  pickerButton: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  pickerButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  pickerList: {
    maxHeight: 200,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  pickerItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary[50],
  },
  pickerItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  pickerItemTextSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  emptyText: {
    padding: spacing.md,
    textAlign: 'center',
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  input: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 48,
  },
  helperText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  totalAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  issueButton: {
    flex: 2,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueButtonDisabled: {
    opacity: 0.6,
  },
  issueButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  classPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  classPickerContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    ...shadows.lg,
  },
  classPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  classPickerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  classPickerList: {
    padding: spacing.md,
  },
  classPickerItem: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
    marginBottom: spacing.sm,
  },
  classPickerItemSelected: {
    backgroundColor: colors.primary[600],
  },
  classPickerItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  classPickerItemTextSelected: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.semibold,
  },
});

