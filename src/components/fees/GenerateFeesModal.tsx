/**
 * GenerateFeesModal - Admin tool to generate invoices for a class
 * Simple: Select class, period, add items, preview, confirm.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, Portal, Modal, IconButton, TextInput } from 'react-native-paper';
import { X, Plus, Trash2, Users, Calendar, Receipt, Edit2 } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { invoiceService } from '../../services/fees';
import { useStudents } from '../../hooks/useStudents';
import { useActiveAcademicYear } from '../../hooks/useAcademicYears';
import { DatePickerModal } from '../../components/common/DatePickerModal';

interface GenerateFeesModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerated?: () => void;
  classInstanceId: string;
  className: string;
  schoolCode: string;
}

interface LineItem {
  id: string;
  label: string;
  amount: string;
}

const COMMON_PRESETS = [
  { label: 'Tuition Fee', amount: 5000 },
  { label: 'Transport Fee', amount: 2000 },
  { label: 'Books & Materials', amount: 1500 },
  { label: 'Activity Fee', amount: 500 },
];

export function GenerateFeesModal({
  visible,
  onClose,
  onGenerated,
  classInstanceId,
  className,
  schoolCode,
}: GenerateFeesModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const { data: studentsData } = useStudents(classInstanceId, schoolCode);
  const studentCount = studentsData?.data?.length || 0;
  const { data: activeAcademicYear } = useActiveAcademicYear(schoolCode);

  // Format academic year for display (e.g., 2025-2026 -> "AY 25-26")
  const formatAcademicYear = (yearStart: number, yearEnd: number) => {
    const startShort = yearStart.toString().slice(-2);
    const endShort = yearEnd.toString().slice(-2);
    return `AY ${startShort}-${endShort}`;
  };

  // Billing period is the academic year itself (e.g., "2025-2026")
  const billingPeriod = useMemo(() => {
    if (activeAcademicYear) {
      return `${activeAcademicYear.year_start}-${activeAcademicYear.year_end}`;
    }
    return '';
  }, [activeAcademicYear]);

  // Get academic year end date as default due date
  const getAcademicYearEndDate = useMemo(() => {
    if (activeAcademicYear) {
      // Use actual end_date if available, otherwise fallback to March 31st of year_end
      if (activeAcademicYear.end_date) {
        return activeAcademicYear.end_date; // Already in YYYY-MM-DD format
      }
      // Fallback for backward compatibility
      const yearEnd = activeAcademicYear.year_end;
      return `${yearEnd}-03-31`;
    }
    return null;
  }, [activeAcademicYear]);

  // Due date state - defaults to academic year end, but can be changed
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Initialize due date when academic year loads
  useEffect(() => {
    if (getAcademicYearEndDate) {
      setDueDate(new Date(getAcademicYearEndDate));
    }
  }, [getAcademicYearEndDate]);

  const [items, setItems] = useState<LineItem[]>([
    { id: '1', label: '', amount: '' },
  ]);
  const [generating, setGenerating] = useState(false);

  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      label: '',
      amount: ''
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const updateItem = (id: string, field: 'label' | 'amount', value: string) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const applyPreset = (preset: typeof COMMON_PRESETS[0]) => {
    // Find empty row or add new
    const emptyIdx = items.findIndex(i => !i.label && !i.amount);
    if (emptyIdx >= 0) {
      updateItem(items[emptyIdx].id, 'label', preset.label);
      updateItem(items[emptyIdx].id, 'amount', preset.amount.toString());
    } else {
      setItems([...items, {
        id: Date.now().toString(),
        label: preset.label,
        amount: preset.amount.toString()
      }]);
    }
  };

  const total = items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  const handleGenerate = async () => {
    const validItems = items.filter(i => i.label.trim() && parseFloat(i.amount));

    if (validItems.length === 0) {
      Alert.alert('Error', 'Add at least one fee item');
      return;
    }

    if (!activeAcademicYear) {
      Alert.alert('Error', 'Active academic year not found');
      return;
    }

    if (!dueDate) {
      Alert.alert('Error', 'Due date is required');
      return;
    }

    // Billing period is automatically set to academic year - no validation needed

    Alert.alert(
      'Confirm Generation',
      `Generate invoices for ${studentCount} students in ${className}?\n\nTotal per student: ₹${total.toLocaleString('en-IN')}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setGenerating(true);
            try {
              if (!activeAcademicYear || !dueDate) {
                Alert.alert('Error', 'Active academic year or due date not found');
                return;
              }

              // Format due date as YYYY-MM-DD
              const dueDateStr = dueDate.toISOString().split('T')[0];

              const result = await invoiceService.generateForClass(
                classInstanceId,
                schoolCode,
                billingPeriod,
                validItems.map(i => ({
                  label: i.label,
                  amount: parseFloat(i.amount)
                })),
                activeAcademicYear.id,
                dueDateStr // Single due date for all invoices
              );

              Alert.alert(
                'Success',
                `Created ${result.created} invoices.\n${result.skipped} students already had invoices for this period.`
              );
              onGenerated?.();
              handleClose();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to generate invoices');
            } finally {
              setGenerating(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    // Reset to defaults
    setItems([{ id: '1', label: '', amount: '' }]);
    // Reset due date to academic year end
    if (getAcademicYearEndDate) {
      setDueDate(new Date(getAcademicYearEndDate));
    }
    onClose();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleClose} contentContainerStyle={styles.modal}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Generate Fees</Text>
            <Text style={styles.headerSubtitle}>{className} • {studentCount} students</Text>
          </View>
          <IconButton icon={() => <X size={24} color={colors.text.primary} />} onPress={handleClose} />
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Academic Year Info */}
          {activeAcademicYear && (
            <View style={styles.academicYearInfo}>
              <View style={styles.infoRow}>
                <Calendar size={16} color={colors.primary[600]} />
                <Text style={styles.infoLabel}>Academic Year:</Text>
                <Text style={styles.infoValue}>
                  {formatAcademicYear(activeAcademicYear.year_start, activeAcademicYear.year_end)}
                </Text>
              </View>
              {dueDate && (
                <View style={styles.infoRow}>
                  <Calendar size={16} color={colors.text.secondary} />
                  <Text style={styles.infoLabel}>Due Date:</Text>
                  <Text style={styles.infoValue}>
                    {dueDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={styles.editDateBtn}
                  >
                    <Edit2 size={14} color={colors.primary[600]} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Presets */}
          <View style={styles.presetsSection}>
            <Text style={styles.presetsLabel}>Quick Add:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.presetsRow}>
                {COMMON_PRESETS.map((preset, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.presetChip}
                    onPress={() => applyPreset(preset)}
                  >
                    <Text style={styles.presetText}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Line Items */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Receipt size={16} color={colors.text.secondary} />
              <Text style={styles.fieldLabel}>Fee Items</Text>
            </View>

            {items.map((item, idx) => (
              <View key={item.id} style={styles.itemRow}>
                <TextInput
                  mode="outlined"
                  dense
                  style={styles.labelInput}
                  value={item.label}
                  onChangeText={(v) => updateItem(item.id, 'label', v)}
                  placeholder="Item name"
                  contentStyle={{ backgroundColor: colors.surface.primary }}
                />
                <View style={styles.amountContainer}>
                  <TextInput
                    mode="outlined"
                    dense
                    style={styles.amountInput}
                    value={item.amount}
                    onChangeText={(v) => updateItem(item.id, 'amount', v)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    left={<TextInput.Affix text="₹" />}
                    contentStyle={{ backgroundColor: colors.surface.primary }}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => removeItem(item.id)}
                  disabled={items.length <= 1}
                  style={styles.deleteBtn}
                >
                  <Trash2 size={18} color={items.length <= 1 ? colors.neutral[300] : colors.error[500]} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
              <Plus size={18} color={colors.primary[600]} />
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* Total */}
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total per Student</Text>
              <Text style={styles.totalAmount}>₹{total.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Date Picker Modal */}
        {dueDate && (
          <DatePickerModal
            visible={showDatePicker}
            onDismiss={() => setShowDatePicker(false)}
            onConfirm={(date) => {
              setDueDate(date);
              setShowDatePicker(false);
            }}
            initialDate={dueDate}
            title="Select Due Date"
            minimumDate={activeAcademicYear?.start_date ? new Date(activeAcademicYear.start_date) : undefined}
            maximumDate={activeAcademicYear?.end_date ? new Date(activeAcademicYear.end_date) : undefined}
          />
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Button mode="outlined" onPress={handleClose} style={styles.footerBtn}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleGenerate}
            loading={generating}
            disabled={generating || total <= 0}
            style={styles.footerBtn}
            icon={() => <Users size={18} color="#fff" />}
          >
            Generate for All
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const createStyles = (
  colors: ThemeColors,
  typography: any,
  spacing: any,
  borderRadius: any,
  shadows: any
) => StyleSheet.create({
  modal: {
    backgroundColor: colors.surface.primary,
    margin: spacing.md,
    borderRadius: borderRadius.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  body: {
    padding: spacing.md,
    maxHeight: 400,
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  periodInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  academicYearInfo: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  editDateBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  presetsSection: {
    marginBottom: spacing.lg,
  },
  presetsLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  presetChip: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  presetText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dueDateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  dueDateInfoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  labelInput: {
    flex: 2,
    backgroundColor: colors.surface.primary,
    fontSize: typography.fontSize.sm,
    height: 48,
  },
  amountContainer: {
    flex: 1,
  },
  amountInput: {
    backgroundColor: colors.surface.primary,
    fontSize: typography.fontSize.sm,
    height: 48,
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[300],
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  addItemText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  totalSection: {
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  totalLabel: {
    fontSize: typography.fontSize.base,
    color: colors.success[700],
    fontWeight: typography.fontWeight.semibold,
  },
  totalAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerBtn: {
    flex: 1,
  },
  academicYearHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

