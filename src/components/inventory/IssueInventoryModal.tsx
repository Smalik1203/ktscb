/**
 * Issue Inventory Modal
 * 
 * Modal for issuing inventory items to students or staff.
 * Handles quantity, serial numbers, and fee charges.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, FlatList, TouchableOpacity, Alert, Modal as RNModal, Text, TextInput as RNTextInput, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal } from '../../ui';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useStudents } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { spacing, typography, borderRadius, shadows } from '../../../lib/design-system';

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
      // Staff load failed
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

      onSuccess();
      handleClose();
      setTimeout(() => {
        Alert.alert('Success', 'Item issued successfully');
      }, 300);
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
    <>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        title="Issue Item"
      >
        <View style={styles.container}>
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
                <View style={[styles.segmentedButtons, { flexDirection: 'row', gap: spacing.sm }]}>
                  <TouchableOpacity
                    style={[styles.segmentBtn, issuedToType === 'student' && styles.segmentBtnActive]}
                    onPress={() => { setIssuedToType('student'); setSelectedStudentId(''); setSelectedStaffId(''); setSelectedClassId(''); }}
                  >
                    <MaterialIcons name="person" size={18} color={issuedToType === 'student' ? colors.text.inverse : colors.text.secondary} />
                    <Text style={[styles.segmentBtnText, issuedToType === 'student' && styles.segmentBtnTextActive]}>Student</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentBtn, issuedToType === 'staff' && styles.segmentBtnActive]}
                    onPress={() => { setIssuedToType('staff'); setSelectedStudentId(''); setSelectedStaffId(''); setSelectedClassId(''); }}
                  >
                    <MaterialIcons name="group" size={18} color={issuedToType === 'staff' ? colors.text.inverse : colors.text.secondary} />
                    <Text style={[styles.segmentBtnText, issuedToType === 'staff' && styles.segmentBtnTextActive]}>Staff</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Student Selection */}
            {issuedToType === 'student' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Class *</Text>
                  <TouchableOpacity onPress={() => setShowClassPicker(true)} style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                    <Text style={{ color: selectedClassId ? colors.text.primary : colors.text.secondary, fontSize: typography.fontSize.base }}>
                      {selectedClassId
                        ? classes.find((c: any) => c.id === selectedClassId)
                          ? `Grade ${classes.find((c: any) => c.id === selectedClassId)?.grade} - ${classes.find((c: any) => c.id === selectedClassId)?.section}`
                          : 'Select Class'
                        : 'Select Class'}
                    </Text>
                    <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>

                {selectedClassId && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Student *</Text>
                    <View style={styles.searchContainer}>
                      <View style={[styles.searchInput, { flexDirection: 'row', alignItems: 'center' }]}>
                        <MaterialIcons name="search" size={18} color={colors.text.secondary} style={{ marginRight: spacing.xs }} />
                        <RNTextInput
                          style={{ flex: 1, fontSize: typography.fontSize.base, color: colors.text.primary }}
                          placeholder="Search students..."
                          placeholderTextColor={colors.text.secondary}
                          value={studentSearch}
                          onChangeText={setStudentSearch}
                        />
                      </View>
                    </View>
                    <FlatList
                      style={styles.pickerList}
                      nestedScrollEnabled
                      data={filteredStudents}
                      keyExtractor={(item: any) => item.id}
                      renderItem={({ item: student }: { item: any }) => (
                        <TouchableOpacity
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
                      )}
                      ListEmptyComponent={
                        <Text style={styles.emptyText}>No students found</Text>
                      }
                    />
                  </View>
                )}
              </>
            )}

            {/* Staff Selection */}
            {issuedToType === 'staff' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Staff Member *</Text>
                <View style={styles.searchContainer}>
                  <View style={[styles.searchInput, { flexDirection: 'row', alignItems: 'center' }]}>
                    <MaterialIcons name="search" size={18} color={colors.text.secondary} style={{ marginRight: spacing.xs }} />
                    <RNTextInput
                      style={{ flex: 1, fontSize: typography.fontSize.base, color: colors.text.primary }}
                      placeholder="Search staff..."
                      placeholderTextColor={colors.text.secondary}
                      value={staffSearch}
                      onChangeText={setStaffSearch}
                    />
                  </View>
                </View>
                {loadingStaff ? (
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                ) : (
                  <FlatList
                    style={styles.pickerList}
                    nestedScrollEnabled
                    data={filteredStaff}
                    keyExtractor={(item: any) => item.id}
                    renderItem={({ item: staffMember }: { item: any }) => (
                      <TouchableOpacity
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
                    )}
                    ListEmptyComponent={
                      <Text style={styles.emptyText}>No staff found</Text>
                    }
                  />
                )}
              </View>
            )}

            {/* Quantity */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Quantity *</Text>
              <RNTextInput
                style={[styles.input, { fontSize: typography.fontSize.base, color: colors.text.primary }]}
                placeholder="1"
                placeholderTextColor={colors.text.secondary}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
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
                <RNTextInput
                  style={[styles.input, { fontSize: typography.fontSize.base, color: colors.text.primary }]}
                  placeholder="Enter serial number"
                  placeholderTextColor={colors.text.secondary}
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                />
              </View>
            )}

            {/* Charge Amount */}
            {inventoryItem.is_chargeable && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Charge Amount {inventoryItem.allow_price_override ? '(Override)' : ''}
                </Text>
                <View style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
                  <Text style={{ color: colors.text.secondary, marginRight: spacing.xs }}>₹</Text>
                  <RNTextInput
                    style={{ flex: 1, fontSize: typography.fontSize.base, color: colors.text.primary }}
                    placeholder={inventoryItem.charge_amount?.toString() || '0.00'}
                    placeholderTextColor={colors.text.secondary}
                    value={chargeAmountOverride}
                    onChangeText={setChargeAmountOverride}
                    keyboardType="decimal-pad"
                    editable={inventoryItem.allow_price_override}
                  />
                </View>
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
                <MaterialIcons name="info" size={20} color={colors.primary[600]} />
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
                <MaterialIcons name="close" size={24} color={colors.text.primary} />
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
    </>
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
  segmentBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  segmentBtnText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  segmentBtnTextActive: {
    color: colors.text.inverse,
    fontWeight: '600' as const,
  },

  searchContainer: {
    marginBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surface.secondary,
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
    fontSize: typography.fontSize.base,
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

