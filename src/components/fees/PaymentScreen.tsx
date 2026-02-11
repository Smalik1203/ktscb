/**
 * PaymentScreen - Dedicated screen for recording item-level payments
 * Shows invoice items with payment status and allows recording payments per item
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, ActivityIndicator, Portal, Modal } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Receipt, CreditCard, Wallet, Smartphone, Calendar, CheckCircle, AlertCircle } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { invoiceService } from '../../services/fees';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface PaymentScreenProps {
  invoiceId: string;
  visible: boolean;
  onClose: () => void;
  onPaymentRecorded?: () => void;
}

const formatAmount = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateString;
  }
};

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', icon: Wallet },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'online', label: 'UPI/Online', icon: Smartphone },
];

export function PaymentScreen({ invoiceId, visible, onClose, onPaymentRecorded }: PaymentScreenProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { profile } = useAuth();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );
  
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptNo, setReceiptNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Note: recorded_by_user_id is handled server-side - no need to fetch or display here

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: () => invoiceId ? invoiceService.getDetail(invoiceId) : null,
    enabled: !!invoiceId && visible,
  });

  const invoice = data?.invoice;
  const items = data?.items || [];
  const payments = data?.payments || [];

  // Calculate payment status per item
  const itemPaymentStatus = useMemo(() => {
    const status: Record<string, { paid: number; remaining: number; payments: any[] }> = {};
    
    items.forEach(item => {
      const itemPayments = payments.filter(p => p.invoice_item_id === item.id);
      const paid = itemPayments.reduce((sum, p) => sum + parseFloat(p.amount_inr.toString()), 0);
      const remaining = item.amount - paid;
      
      status[item.id] = {
        paid,
        remaining: Math.max(0, remaining),
        payments: itemPayments,
      };
    });
    
    return status;
  }, [items, payments]);

  // Get total invoice payments (for items without specific item_id)
  const generalPayments = payments.filter(p => !p.invoice_item_id);
  const generalPaid = generalPayments.reduce((sum, p) => sum + parseFloat(p.amount_inr.toString()), 0);

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    const status = itemPaymentStatus[itemId];
    if (status) {
      // Pre-fill with remaining amount
      setPaymentAmount(status.remaining > 0 ? status.remaining.toString() : '');
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedItemId || !paymentAmount) {
      Alert.alert('Error', 'Please select an item and enter payment amount');
      return;
    }
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    const status = itemPaymentStatus[selectedItemId];
    if (!status) {
      Alert.alert('Error', 'Item not found');
      return;
    }

    // Validate: Don't exceed remaining amount
    if (amount > status.remaining) {
      Alert.alert(
        'Amount Exceeds Due',
        `Maximum payment allowed: ${formatAmount(status.remaining)}\nRemaining: ${formatAmount(status.remaining)}`
      );
      return;
    }

    setSaving(true);
    try {
      // Note: recorded_by_name is ignored by service - it fetches from users table directly
      // But we pass it for validation purposes
      await invoiceService.recordItemPayment({
        invoice_id: invoiceId,
        invoice_item_id: selectedItemId,
        amount,
        method: paymentMethod as 'cash' | 'card' | 'online' | 'cheque' | 'bank_transfer',
        receipt_number: receiptNo || undefined,
        remarks: remarks || undefined,
        // recorded_by_name is not needed - service fetches from users table
      });
      
      Alert.alert('Success', 'Payment recorded successfully');
      setSelectedItemId(null);
      setPaymentAmount('');
      setReceiptNo('');
      setRemarks('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      onPaymentRecorded?.();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedItemId(null);
    setPaymentAmount('');
    setReceiptNo('');
    setRemarks('');
    onClose();
  };

  if (!visible) return null;

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleClose} contentContainerStyle={styles.modal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Record Payment</Text>
              {invoice?.student && (
                <Text style={styles.headerSubtitle}>{invoice.student.full_name}</Text>
              )}
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary[600]} />
            </View>
          ) : !invoice ? (
            <View style={styles.loading}>
              <Text style={styles.errorText}>Invoice not found</Text>
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* Invoice Summary */}
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total</Text>
                    <Text style={styles.summaryValue}>{formatAmount(invoice.total_amount)}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Paid</Text>
                    <Text style={[styles.summaryValue, { color: colors.success[600] }]}>
                      {formatAmount(invoice.paid_amount)}
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Due</Text>
                    <Text style={[styles.summaryValue, { color: (invoice.total_amount - invoice.paid_amount) > 0 ? colors.error[600] : colors.success[600] }]}>
                      {formatAmount(invoice.total_amount - invoice.paid_amount)}
                    </Text>
                  </View>
                </View>
                {invoice.due_date && (
                  <View style={styles.dueDateRow}>
                    <Calendar size={14} color={colors.text.secondary} />
                    <Text style={styles.dueDateText}>
                      Due Date: {formatDate(invoice.due_date)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Items List */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Fee Items</Text>
                <Text style={styles.sectionSubtitle}>Select an item to record payment</Text>
                
                {items.map(item => {
                  const status = itemPaymentStatus[item.id];
                  const isSelected = selectedItemId === item.id;
                  const isFullyPaid = status && status.remaining <= 0;
                  
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.itemCard,
                        isSelected && styles.itemCardSelected,
                        isFullyPaid && styles.itemCardPaid
                      ]}
                      onPress={() => !isFullyPaid && handleSelectItem(item.id)}
                      disabled={isFullyPaid}
                    >
                      <View style={styles.itemHeader}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemLabel}>{item.label}</Text>
                          <Text style={styles.itemAmount}>Amount: {formatAmount(item.amount)}</Text>
                        </View>
                        {isFullyPaid ? (
                          <View style={styles.paidBadge}>
                            <CheckCircle size={16} color={colors.success[600]} />
                            <Text style={styles.paidBadgeText}>Paid</Text>
                          </View>
                        ) : (
                          <View style={styles.statusBadge}>
                            <AlertCircle size={16} color={colors.warning[600]} />
                            <Text style={styles.statusBadgeText}>
                              Due: {formatAmount(status?.remaining || item.amount)}
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      {status && status.paid > 0 && (
                        <View style={styles.paymentProgress}>
                          <Text style={styles.progressText}>
                            Paid: {formatAmount(status.paid)} / {formatAmount(item.amount)}
                          </Text>
                          <View style={styles.progressBar}>
                            <View 
                              style={[
                                styles.progressFill, 
                                { width: `${(status.paid / item.amount) * 100}%` }
                              ]} 
                            />
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Payment Form */}
              {selectedItemId && (
                <View style={styles.paymentForm}>
                  <Text style={styles.formTitle}>Record Payment</Text>
                  
                  {(() => {
                    const status = itemPaymentStatus[selectedItemId];
                    const selectedItem = items.find(i => i.id === selectedItemId);
                    return (
                      <View style={styles.formInfo}>
                        <Text style={styles.formInfoText}>
                          Item: {selectedItem?.label}
                        </Text>
                        <Text style={styles.formInfoText}>
                          Remaining: {formatAmount(status?.remaining || 0)}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Amount */}
                  <View style={styles.formField}>
                    <Text style={styles.inputLabel}>Amount *</Text>
                    <View style={styles.amountInputRow}>
                      <Text style={styles.currencySymbol}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.text.tertiary}
                      />
                      {(() => {
                        const status = itemPaymentStatus[selectedItemId];
                        return status && status.remaining > 0 ? (
                          <TouchableOpacity
                            style={styles.fullAmountBtn}
                            onPress={() => setPaymentAmount(status.remaining.toString())}
                          >
                            <Text style={styles.fullAmountText}>Full Amount</Text>
                          </TouchableOpacity>
                        ) : null;
                      })()}
                    </View>
                  </View>

                  {/* Payment Method */}
                  <View style={styles.formField}>
                    <Text style={styles.inputLabel}>Payment Method *</Text>
                    <View style={styles.methodRow}>
                      {PAYMENT_METHODS.map(method => {
                        const Icon = method.icon;
                        const isActive = paymentMethod === method.key;
                        return (
                          <TouchableOpacity
                            key={method.key}
                            style={[styles.methodBtn, isActive && styles.methodBtnActive]}
                            onPress={() => setPaymentMethod(method.key)}
                          >
                            <Icon size={18} color={isActive ? colors.primary[700] : colors.text.secondary} />
                            <Text style={[styles.methodLabel, isActive && styles.methodLabelActive]}>
                              {method.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Receipt Number */}
                  <View style={styles.formField}>
                    <Text style={styles.inputLabel}>Receipt Number (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={receiptNo}
                      onChangeText={setReceiptNo}
                      placeholder="Enter receipt number"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>

                  {/* Remarks */}
                  <View style={styles.formField}>
                    <Text style={styles.inputLabel}>Remarks (Optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={remarks}
                      onChangeText={setRemarks}
                      placeholder="Add any remarks"
                      placeholderTextColor={colors.text.tertiary}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Actions */}
                  <View style={styles.formActions}>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        setSelectedItemId(null);
                        setPaymentAmount('');
                        setReceiptNo('');
                        setRemarks('');
                      }}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleRecordPayment}
                      loading={saving}
                      disabled={saving}
                      style={styles.submitBtn}
                    >
                      Record Payment
                    </Button>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
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
    maxHeight: '90%',
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
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  loading: {
    padding: spacing.xl * 2,
    alignItems: 'center',
  },
  errorText: {
    color: colors.error[600],
  },
  body: {
    padding: spacing.md,
    maxHeight: 600,
  },
  summary: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  dueDateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  itemCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  itemCardSelected: {
    borderColor: colors.primary[600],
    borderWidth: 2,
    backgroundColor: colors.primary[50],
  },
  itemCardPaid: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[200],
    opacity: 0.7,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
  },
  itemLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  itemAmount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  paidBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  paymentProgress: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success[600],
    borderRadius: borderRadius.sm,
  },
  paymentForm: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  formTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  formInfo: {
    backgroundColor: colors.primary[50],
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  formInfoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  formField: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    paddingHorizontal: spacing.sm,
  },
  currencySymbol: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  amountInput: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  fullAmountBtn: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  fullAmountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  methodBtnActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  methodLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  methodLabelActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  textInput: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    padding: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
  readOnlyInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 1,
  },
});

