/**
 * Return Inventory Modal
 * 
 * Modal for returning issued inventory items.
 * Handles quantity reversal and fee refunds.
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Text, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import { X, RotateCcw, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows } from '../../../lib/design-system';

interface ReturnInventoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  issue: {
    id: string;
    quantity: number;
    charge_amount: number | null;
    charge_type: 'one_time' | 'deposit' | null;
    inventory_item: {
      name: string;
      category: string;
    } | null;
    issued_to_type: 'student' | 'staff';
    issue_date: string;
    expected_return_date: string | null;
  };
  onReturn: (data: {
    issueId: string;
    return_notes?: string;
    mark_as_lost?: boolean;
  }) => Promise<void>;
}

export function ReturnInventoryModal({
  visible,
  onClose,
  onSuccess,
  issue,
  onReturn,
}: ReturnInventoryModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [returnNotes, setReturnNotes] = useState('');
  const [markAsLost, setMarkAsLost] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleReturn = async () => {
    try {
      setSubmitting(true);
      await onReturn({
        issueId: issue.id,
        return_notes: returnNotes.trim() || undefined,
        mark_as_lost: markAsLost,
      });
      
      Alert.alert(
        'Success',
        markAsLost 
          ? 'Item marked as lost. Quantity and fees have been reversed.'
          : 'Item returned successfully. Quantity and fees have been reversed.',
        [
          { text: 'OK', onPress: () => {
            onSuccess();
            handleClose();
          }},
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to return item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReturnNotes('');
    setMarkAsLost(false);
    onClose();
  };

  const itemName = issue.inventory_item?.name || 'Unknown Item';
  const isOverdue = issue.expected_return_date 
    ? new Date(issue.expected_return_date) < new Date()
    : false;

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
              <RotateCcw size={24} color={colors.primary[600]} />
              <Text style={styles.headerTitle}>
                {markAsLost ? 'Mark as Lost' : 'Return Item'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Item Info */}
          <View style={styles.itemInfoCard}>
            <Text style={styles.itemName}>{itemName}</Text>
            <Text style={styles.itemCategory}>{issue.inventory_item?.category}</Text>
            <View style={styles.detailsRow}>
              <Text style={styles.detailLabel}>Quantity:</Text>
              <Text style={styles.detailValue}>{issue.quantity}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailLabel}>Issued Date:</Text>
              <Text style={styles.detailValue}>
                {new Date(issue.issue_date).toLocaleDateString('en-IN')}
              </Text>
            </View>
            {issue.expected_return_date && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailLabel}>Expected Return:</Text>
                <Text style={[
                  styles.detailValue,
                  isOverdue && styles.overdueText,
                ]}>
                  {new Date(issue.expected_return_date).toLocaleDateString('en-IN')}
                  {isOverdue && ' (Overdue)'}
                </Text>
              </View>
            )}
            {issue.charge_amount && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailLabel}>Charge Amount:</Text>
                <Text style={styles.detailValue}>
                  ₹{issue.charge_amount} {issue.charge_type === 'deposit' ? '(Refundable)' : ''}
                </Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Warning for lost items */}
            {markAsLost && (
              <View style={styles.warningCard}>
                <AlertTriangle size={20} color={colors.warning[600]} />
                <Text style={styles.warningText}>
                  Marking as lost will reverse the inventory quantity and fees, but the item will be permanently marked as lost.
                </Text>
              </View>
            )}

            {/* Return Notes */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Return Notes {markAsLost ? '(Required)' : '(Optional)'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={markAsLost ? "Explain why item is lost..." : "Add any notes about the return..."}
                value={returnNotes}
                onChangeText={setReturnNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor={colors.text.secondary}
              />
            </View>

            {/* Mark as Lost Toggle */}
            <View style={styles.formGroup}>
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setMarkAsLost(!markAsLost)}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Mark as Lost</Text>
                  <Text style={styles.toggleDescription}>
                    Use this if the item cannot be returned (damaged, stolen, etc.)
                  </Text>
                </View>
                <View style={[
                  styles.toggleSwitch,
                  markAsLost && styles.toggleSwitchActive,
                ]}>
                  <View style={[
                    styles.toggleThumb,
                    markAsLost && styles.toggleThumbActive,
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Info about reversals */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What will be reversed:</Text>
              <View style={styles.infoList}>
                <Text style={styles.infoItem}>• Inventory quantity will be added back</Text>
                {issue.charge_amount && (
                  <>
                    {issue.charge_type === 'deposit' ? (
                      <Text style={styles.infoItem}>• Deposit will be refunded (negative invoice item)</Text>
                    ) : (
                      <Text style={styles.infoItem}>• One-time charge will be removed from invoice</Text>
                    )}
                  </>
                )}
              </View>
            </View>
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
              style={[
                styles.returnButton,
                markAsLost && styles.returnButtonLost,
                submitting && styles.returnButtonDisabled,
              ]}
              onPress={handleReturn}
              disabled={submitting || (markAsLost && !returnNotes.trim())}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.returnButtonText}>
                  {markAsLost ? 'Mark as Lost' : 'Return Item'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: spacing.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  overdueText: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.semibold,
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
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  toggleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  toggleDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutral[300],
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: colors.warning[600],
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface.primary,
    ...shadows.sm,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[600],
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
  infoCard: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.sm,
  },
  infoList: {
    gap: spacing.xs,
  },
  infoItem: {
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
  returnButton: {
    flex: 2,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnButtonLost: {
    backgroundColor: colors.warning[600],
  },
  returnButtonDisabled: {
    opacity: 0.6,
  },
  returnButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
});

