/**
 * InvoiceDetailModal - Shows invoice items, payments, and record payment action
 * Single modal, no nesting
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Text, Button, ActivityIndicator, Portal, Modal, TextInput } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Receipt, Plus, CreditCard, Wallet, Smartphone, Calendar, Trash2, FileText, Edit2, AlertTriangle, Bell } from 'lucide-react-native';

import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { invoiceService } from '../../services/fees';
import { useCapabilities } from '../../hooks/useCapabilities';
import {
  useAddInvoiceItems,
  useRemoveInvoiceItems,
  useUpdateInvoiceItem,
  useDeleteInvoice,
  useUpdateInvoice,
} from '../../hooks/useInvoiceOperations';
import { PaymentScreen } from './PaymentScreen';
import { InvoiceDocumentViewer } from './InvoiceDocumentViewer';
import { useInvoice } from '../../hooks/useInvoice';
import { InvoiceViewer } from './InvoiceViewer';

interface InvoiceDetailModalProps {
  invoiceId: string | null;
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

const isOverdue = (dueDate?: string) => {
  if (!dueDate) return false;
  try {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today;
  } catch {
    return false;
  }
};

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', icon: Wallet },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'online', label: 'UPI/Online', icon: Smartphone },
];

export function InvoiceDetailModal({ invoiceId, visible, onClose, onPaymentRecorded }: InvoiceDetailModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const queryClient = useQueryClient();
  const { can } = useCapabilities();
  const canAddItems = can('fees.write');
  const canDeleteInvoice = can('fees.write');

  // Mutation hooks (separated from UI)
  const addItemsMutation = useAddInvoiceItems();
  const removeItemsMutation = useRemoveInvoiceItems();
  const updateItemMutation = useUpdateInvoiceItem();
  const deleteInvoiceMutation = useDeleteInvoice();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemLabel, setEditingItemLabel] = useState('');
  const [editingItemAmount, setEditingItemAmount] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptNo, setReceiptNo] = useState('');
  const [saving, setSaving] = useState(false);

  // Add items form
  const [showAddItemsForm, setShowAddItemsForm] = useState(false);
  const [newItems, setNewItems] = useState<Array<{ id: string; label: string; amount: string }>>([
    { id: '1', label: '', amount: '' }
  ]);
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);
  const [showInvoiceDocument, setShowInvoiceDocument] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Edit Invoice Details State
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const updateInvoiceMutation = useUpdateInvoice();

  // Payment receipt generation
  const { generateInvoice, isGenerating, currentInvoice, clearInvoice } = useInvoice({
    onSuccess: () => {
      // Receipt generated, InvoiceViewer will show it
    },
    onError: (error) => {
      Alert.alert('Error', error.details || 'Failed to generate receipt');
    },
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: () => invoiceId ? invoiceService.getDetail(invoiceId) : null,
    enabled: !!invoiceId && visible,
    retry: 1, // Retry once on failure
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
  });

  const handleRecordPayment = async () => {
    if (!invoiceId || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      await invoiceService.recordPayment({
        invoice_id: invoiceId,
        amount,
        method: paymentMethod as 'cash' | 'card' | 'online' | 'cheque' | 'bank_transfer',
        receipt_number: receiptNo || undefined,
      });

      Alert.alert('Success', 'Payment recorded successfully');
      setShowPaymentForm(false);
      setPaymentAmount('');
      setReceiptNo('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onPaymentRecorded?.();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setShowPaymentForm(false);
    setPaymentAmount('');
    setReceiptNo('');
    setShowAddItemsForm(false);
    setNewItems([{ id: '1', label: '', amount: '' }]);
    onClose();
  };

  const addNewItemRow = () => {
    setNewItems([...newItems, { id: Date.now().toString(), label: '', amount: '' }]);
  };

  const removeNewItemRow = (id: string) => {
    if (newItems.length > 1) {
      setNewItems(newItems.filter(item => item.id !== id));
    }
  };

  const updateNewItem = (id: string, field: 'label' | 'amount', value: string) => {
    setNewItems(newItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleAddItems = async () => {
    if (!invoiceId) return;

    const validItems = newItems.filter(i => i.label.trim() && parseFloat(i.amount));

    if (validItems.length === 0) {
      Alert.alert('Error', 'Add at least one item with label and amount');
      return;
    }

    try {
      await addItemsMutation.mutateAsync({
        invoiceId,
        items: validItems.map(i => ({
          label: i.label.trim(),
          amount: parseFloat(i.amount),
        })),
      });

      Alert.alert('Success', 'Items added successfully');
      setShowAddItemsForm(false);
      setNewItems([{ id: '1', label: '', amount: '' }]);
      await refetch();
      onPaymentRecorded?.();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add items';
      Alert.alert('Error', errorMessage);
    }
  };

  const invoice = data && 'invoice' in data ? data.invoice : undefined;
  const items = data && 'items' in data ? data.items : [];
  const payments = data && 'payments' in data ? data.payments : [];
  const balance = invoice ? invoice.total_amount - invoice.paid_amount : 0;

  // NOTE: This hook must be called before any early returns to maintain hook order
  // Removed debug logging for production

  if (!visible) return null;

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleClose} contentContainerStyle={styles.modal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Invoice Details</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setShowInvoiceDocument(true)}
                style={styles.viewInvoiceBtn}
              >
                <FileText size={18} color={colors.primary[600]} />
                <Text style={styles.viewInvoiceText}>View Invoice</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary[600]} />
              <Text style={styles.loadingText}>Loading invoice...</Text>
            </View>
          ) : error ? (
            <View style={styles.loading}>
              <Text style={styles.errorText}>Error loading invoice</Text>
              <Text style={styles.errorSubtext}>
                {(error as Error).message || 'Please try again'}
              </Text>
              <Button
                mode="outlined"
                onPress={() => refetch()}
                style={{ marginTop: spacing.md }}
              >
                Retry
              </Button>
            </View>
          ) : !invoice ? (
            <View style={styles.loading}>
              <Text style={styles.errorText}>Invoice not found</Text>
              <Text style={styles.errorSubtext}>
                This invoice may have been deleted or you don't have access to it.
              </Text>
              <Button
                mode="outlined"
                onPress={handleClose}
                style={{ marginTop: spacing.md }}
              >
                Close
              </Button>
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* Summary */}
              <View style={styles.summary}>
                {invoice.student && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.studentName}>{invoice.student.full_name}</Text>
                    {canAddItems && !isEditingDetails && (
                      <TouchableOpacity onPress={() => {
                        setEditDueDate(invoice.due_date || '');
                        setEditNotes(invoice.notes || '');
                        setIsEditingDetails(true);
                      }}>
                        <Edit2 size={16} color={colors.primary[600]} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {isEditingDetails ? (
                  <View style={styles.editForm}>
                    <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
                    <TextInput
                      mode="outlined"
                      dense
                      style={styles.textInput}
                      value={editDueDate}
                      onChangeText={setEditDueDate}
                      placeholder="YYYY-MM-DD"
                      contentStyle={{ backgroundColor: colors.surface.primary }}
                    />
                    <Text style={styles.inputLabel}>Notes</Text>
                    <TextInput
                      mode="outlined"
                      dense
                      style={[styles.textInput, { height: undefined }]}
                      value={editNotes}
                      onChangeText={setEditNotes}
                      multiline
                      numberOfLines={3}
                      placeholder="Add notes..."
                      contentStyle={{ backgroundColor: colors.surface.primary, height: 80 }}
                    />
                    <View style={[styles.formActions, { marginTop: 10 }]}>
                      <Button mode="outlined" onPress={() => setIsEditingDetails(false)} style={{ marginRight: 8 }}>Cancel</Button>
                      <Button
                        mode="contained"
                        onPress={async () => {
                          try {
                            await updateInvoiceMutation.mutateAsync({
                              invoiceId: invoice.id,
                              updates: {
                                due_date: editDueDate || undefined,
                                notes: editNotes || null
                              }
                            });
                            setIsEditingDetails(false);
                            refetch();
                          } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to update');
                          }
                        }}
                        loading={updateInvoiceMutation.isPending}
                      >
                        Save
                      </Button>
                    </View>
                  </View>
                ) : (
                  <>
                    {invoice.due_date && (
                      <View style={styles.dueDateRow}>
                        <Calendar size={14} color={isOverdue(invoice.due_date) ? colors.error[600] : colors.text.secondary} />
                        <Text style={[styles.dueDateText, isOverdue(invoice.due_date) && styles.dueDateOverdue]}>
                          Due Date: {formatDate(invoice.due_date)}
                          {isOverdue(invoice.due_date) && ' (Overdue)'}
                        </Text>
                      </View>
                    )}
                    {invoice.notes && (
                      <Text style={styles.notesText}>{invoice.notes}</Text>
                    )}
                  </>
                )}

                {!isEditingDetails && (
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
                      <Text style={[styles.summaryValue, { color: balance > 0 ? colors.error[600] : colors.success[600] }]}>
                        {formatAmount(balance)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Items */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Fee Breakdown</Text>
                  {canAddItems && !showAddItemsForm && (
                    <TouchableOpacity
                      onPress={() => setShowAddItemsForm(true)}
                      style={styles.addItemButton}
                    >
                      <Plus size={18} color={colors.primary[600]} />
                      <Text style={styles.addItemButtonText}>Add Item</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {items.length === 0 ? (
                  <View style={styles.emptyItemsState}>
                    <Text style={styles.emptyItemsText}>No items added yet</Text>
                  </View>
                ) : (
                  items.map(item => {
                    const isEditing = editingItemId === item.id;

                    return (
                      <View key={item.id} style={styles.itemCard}>
                        {isEditing ? (
                          <View style={styles.editItemForm}>
                            <View style={styles.editItemFormRow}>
                              <TextInput
                                mode="outlined"
                                dense
                                style={styles.editItemLabelInput}
                                value={editingItemLabel}
                                onChangeText={setEditingItemLabel}
                                placeholder="Item name"
                                contentStyle={{ backgroundColor: colors.surface.secondary }}
                              />
                              <View style={styles.editItemAmountWrap}>
                                <TextInput
                                  mode="outlined"
                                  dense
                                  style={styles.editItemAmountInput}
                                  value={editingItemAmount}
                                  onChangeText={setEditingItemAmount}
                                  placeholder="0"
                                  keyboardType="decimal-pad"
                                  left={<TextInput.Affix text="₹" />}
                                  contentStyle={{ backgroundColor: colors.surface.secondary }}
                                />
                              </View>
                            </View>
                            <View style={styles.editItemActions}>
                              <TouchableOpacity
                                style={styles.cancelEditBtn}
                                onPress={() => {
                                  setEditingItemId(null);
                                  setEditingItemLabel('');
                                  setEditingItemAmount('');
                                }}
                              >
                                <Text style={styles.cancelEditBtnText}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.saveEditBtn}
                                onPress={async () => {
                                  if (!editingItemLabel.trim() || !editingItemAmount) {
                                    Alert.alert('Error', 'Please enter both label and amount');
                                    return;
                                  }

                                  try {
                                    await updateItemMutation.mutateAsync({
                                      itemId: item.id,
                                      updates: {
                                        label: editingItemLabel.trim(),
                                        amount: parseFloat(editingItemAmount),
                                      },
                                    });
                                    setEditingItemId(null);
                                    setEditingItemLabel('');
                                    setEditingItemAmount('');
                                    await refetch();
                                    onPaymentRecorded?.();
                                  } catch (err: unknown) {
                                    const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
                                    Alert.alert('Error', errorMessage);
                                  }
                                }}
                              >
                                <Text style={styles.saveEditBtnText}>Save</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.itemRow}>
                            <View style={styles.itemInfo}>
                              <Text style={styles.itemLabel}>{item.label}</Text>
                            </View>
                            <View style={styles.itemRightSection}>
                              <Text style={[styles.itemAmount, item.amount < 0 && styles.itemAmountNegative]}>
                                {item.amount < 0 ? '-' : ''}{formatAmount(Math.abs(item.amount))}
                              </Text>
                              {canAddItems && (
                                <View style={styles.itemActionButtons}>
                                  <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => {
                                      setEditingItemId(item.id);
                                      setEditingItemLabel(item.label);
                                      setEditingItemAmount(Math.abs(item.amount).toString());
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  >
                                    <Edit2 size={18} color={colors.primary[600]} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={async () => {
                                      Alert.alert(
                                        'Delete Item',
                                        `Are you sure you want to delete "${item.label}"?`,
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: async () => {
                                              try {
                                                await removeItemsMutation.mutateAsync({
                                                  invoiceId: invoiceId!,
                                                  itemIds: [item.id],
                                                });

                                                // Force refetch after deletion
                                                await refetch();
                                                onPaymentRecorded?.();
                                              } catch (err: unknown) {
                                                const errorMessage = err instanceof Error ? err.message : 'Failed to delete item';
                                                Alert.alert('Error', errorMessage);
                                              }
                                            },
                                          },
                                        ]
                                      );
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  >
                                    <Trash2 size={18} color={colors.error[600]} />
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}

                {/* Add Items Form */}
                {showAddItemsForm && canAddItems && (
                  <View style={styles.addItemsForm}>
                    <Text style={styles.addItemsTitle}>Add New Items</Text>
                    {newItems.map((item) => (
                      <View key={item.id} style={styles.newItemRow}>
                        <TextInput
                          mode="outlined"
                          dense
                          style={styles.newItemLabelInput}
                          value={item.label}
                          onChangeText={(v) => updateNewItem(item.id, 'label', v)}
                          placeholder="Item name"
                          contentStyle={{ backgroundColor: colors.surface.primary }}
                        />
                        <View style={styles.newItemAmountWrap}>
                          <TextInput
                            mode="outlined"
                            dense
                            style={styles.newItemAmountInput}
                            value={item.amount}
                            onChangeText={(v) => updateNewItem(item.id, 'amount', v)}
                            placeholder="0"
                            keyboardType="decimal-pad"
                            left={<TextInput.Affix text="₹" />}
                            contentStyle={{ backgroundColor: colors.surface.primary }}
                          />
                        </View>
                        <TouchableOpacity
                          onPress={() => removeNewItemRow(item.id)}
                          disabled={newItems.length <= 1}
                          style={styles.deleteNewItemBtn}
                        >
                          <Trash2 size={16} color={newItems.length <= 1 ? colors.neutral[300] : colors.error[500]} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      onPress={addNewItemRow}
                      style={styles.addNewItemRowBtn}
                    >
                      <Plus size={14} color={colors.primary[600]} />
                      <Text style={styles.addNewItemRowText}>Add Another Item</Text>
                    </TouchableOpacity>
                    <View style={styles.addItemsActions}>
                      <Button
                        mode="outlined"
                        onPress={() => {
                          setShowAddItemsForm(false);
                          setNewItems([{ id: '1', label: '', amount: '' }]);
                        }}
                        style={styles.cancelAddItemsBtn}
                      >
                        Cancel
                      </Button>
                      <Button
                        mode="contained"
                        onPress={handleAddItems}
                        loading={addItemsMutation.isPending}
                        disabled={addItemsMutation.isPending}
                        style={styles.saveAddItemsBtn}
                      >
                        Add Items
                      </Button>
                    </View>
                  </View>
                )}
              </View>

              {/* Payments */}
              {payments.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Payment History</Text>
                  {payments.map(payment => (
                    <View key={payment.id} style={styles.paymentRow}>
                      <View style={styles.paymentIcon}>
                        <Receipt size={16} color={colors.success[600]} />
                      </View>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentAmount}>{formatAmount(payment.amount_inr)}</Text>
                        <Text style={styles.paymentMeta}>
                          {payment.payment_method} • {payment.payment_date}
                          {payment.receipt_number && ` • Receipt: ${payment.receipt_number}`}
                        </Text>
                        {payment.recorded_by_name && (
                          <Text style={styles.recordedByText}>
                            Recorded by: {payment.recorded_by_name}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedPaymentId(payment.id);
                          generateInvoice(payment.id);
                        }}
                        style={styles.receiptBtn}
                        disabled={isGenerating}
                      >
                        <FileText size={16} color={colors.primary[600]} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Payment Form */}
              {showPaymentForm && balance > 0 && (
                <View style={styles.paymentForm}>
                  <Text style={styles.sectionTitle}>Record Payment</Text>

                  <Text style={styles.inputLabel}>Amount</Text>
                  <View style={styles.amountInputRow}>
                    <TextInput
                      mode="outlined"
                      dense
                      style={styles.paymentAmountInput}
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      placeholder={balance.toString()}
                      keyboardType="decimal-pad"
                      left={<TextInput.Affix text="₹" />}
                      contentStyle={{ backgroundColor: colors.background.secondary, fontSize: 18, fontWeight: 'bold' }}
                    />
                    <TouchableOpacity
                      style={styles.fullAmountBtn}
                      onPress={() => setPaymentAmount(balance.toString())}
                    >
                      <Text style={styles.fullAmountText}>Full</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.inputLabel}>Method</Text>
                  <View style={styles.methodRow}>
                    {PAYMENT_METHODS.map(m => {
                      const Icon = m.icon;
                      const active = paymentMethod === m.key;
                      return (
                        <TouchableOpacity
                          key={m.key}
                          style={[styles.methodBtn, active && styles.methodBtnActive]}
                          onPress={() => setPaymentMethod(m.key)}
                        >
                          <Icon size={18} color={active ? colors.primary[600] : colors.text.secondary} />
                          <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.inputLabel}>Receipt # (optional)</Text>
                  <TextInput
                    mode="outlined"
                    dense
                    style={styles.textInput}
                    value={receiptNo}
                    onChangeText={setReceiptNo}
                    placeholder="e.g. RCP-001"
                    contentStyle={{ backgroundColor: colors.background.secondary }}
                  />

                  <View style={styles.formActions}>
                    <Button mode="outlined" onPress={() => setShowPaymentForm(false)}>
                      Cancel
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleRecordPayment}
                      loading={saving}
                      disabled={saving || !paymentAmount}
                    >
                      Save Payment
                    </Button>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* Footer */}
          {invoice && !showPaymentForm && (
            <View style={styles.footer}>
              {balance > 0 && (
                <View style={styles.footerButtonRow}>
                  <Button
                    mode="contained"
                    icon={() => <Receipt size={18} color="#fff" />}
                    onPress={() => setShowPaymentScreen(true)}
                    style={[styles.payBtn, { flex: 1 }]}
                  >
                    Record Payment
                  </Button>
                  <Button
                    mode="outlined"
                    icon={() => <Bell size={18} color={colors.warning[600]} />}
                    onPress={async () => {
                      setSendingReminder(true);
                      try {
                        await invoiceService.sendPaymentReminder(invoiceId!);
                        Alert.alert('Success', 'Payment reminder sent to student');
                      } catch (err: any) {
                        Alert.alert('Error', err.message || 'Failed to send reminder');
                      } finally {
                        setSendingReminder(false);
                      }
                    }}
                    loading={sendingReminder}
                    disabled={sendingReminder}
                    buttonColor={colors.warning[50]}
                    textColor={colors.warning[700]}
                    style={styles.reminderBtn}
                  >
                    Remind
                  </Button>
                </View>
              )}
              {canDeleteInvoice && (
                <Button
                  mode="outlined"
                  onPress={() => {
                    Alert.alert(
                      'Delete Invoice',
                      'Are you sure you want to delete this invoice? This action cannot be undone. All items and associated data will be permanently deleted.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await deleteInvoiceMutation.mutateAsync(invoiceId!);
                              onPaymentRecorded?.();
                              onClose();
                              Alert.alert('Success', 'Invoice deleted successfully');
                            } catch (err: unknown) {
                              const errorMessage = err instanceof Error ? err.message : 'Failed to delete invoice';
                              Alert.alert('Error', errorMessage);
                            }
                          },
                        },
                      ]
                    );
                  }}
                  icon={() => <Trash2 size={18} color={colors.error[600]} />}
                  loading={deleteInvoiceMutation.isPending}
                  disabled={deleteInvoiceMutation.isPending}
                  buttonColor={colors.error[50]}
                  textColor={colors.error[600]}
                  style={styles.deleteInvoiceButtonBottom}
                >
                  Delete Invoice
                </Button>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Payment Screen */}
      {invoiceId && (
        <PaymentScreen
          invoiceId={invoiceId}
          visible={showPaymentScreen}
          onClose={() => setShowPaymentScreen(false)}
          onPaymentRecorded={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
            onPaymentRecorded?.();
          }}
        />
      )}

      {/* Invoice Document Viewer */}
      {invoiceId && (
        <InvoiceDocumentViewer
          invoiceId={invoiceId}
          visible={showInvoiceDocument}
          onClose={() => setShowInvoiceDocument(false)}
        />
      )}

      {/* Payment Receipt Viewer */}
      <InvoiceViewer
        visible={!!selectedPaymentId && !!currentInvoice}
        invoiceData={currentInvoice}
        onClose={() => {
          setSelectedPaymentId(null);
          clearInvoice();
        }}
        isLoading={isGenerating}
      />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },
  viewInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  viewInvoiceText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  closeBtn: {
    padding: spacing.xs,
  },
  loading: {
    padding: spacing.xl * 2,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  errorSubtext: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  body: {
    padding: spacing.md,
    maxHeight: 400,
  },
  summary: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  studentName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    lineHeight: typography.lineHeight.base,
  },
  itemRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    minWidth: 80,
    textAlign: 'right',
  },
  itemAmountNegative: {
    color: colors.success[600],
  },
  itemActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.secondary,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editItemForm: {
    gap: spacing.md,
  },
  editItemFormRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  editItemLabelInput: {
    flex: 2,
    backgroundColor: colors.surface.secondary,
    fontSize: typography.fontSize.sm,
    height: 40,
  },
  editItemAmountWrap: {
    flex: 1,
  },
  editItemAmountInput: {
    backgroundColor: colors.surface.secondary,
    fontSize: typography.fontSize.sm,
    height: 40,
  },
  editItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  saveEditBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveEditBtnText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  cancelEditBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelEditBtnText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  deleteInvoiceButtonBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.error[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error[300],
    marginTop: spacing.sm,
    minHeight: 44,
  },
  deleteInvoiceButtonTextBottom: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[600],
  },

  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dueDateText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  dueDateOverdue: {
    color: colors.error[600],
    fontWeight: typography.fontWeight.semibold,
  },

  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  paymentMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  recordedByText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  receiptBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  paymentForm: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paymentAmountInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
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
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  addItemButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  emptyItemsState: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  emptyItemsText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  addItemsForm: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
  },
  addItemsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  newItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  newItemLabelInput: {
    flex: 2,
    backgroundColor: colors.surface.primary,
    fontSize: typography.fontSize.sm,
    height: 40,
  },
  newItemAmountWrap: {
    flex: 1,
  },
  newItemAmountInput: {
    backgroundColor: colors.surface.primary,
    fontSize: typography.fontSize.sm,
    height: 40,
  },

  deleteNewItemBtn: {
    padding: spacing.xs,
  },
  addNewItemRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary[300],
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  addNewItemRowText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  addItemsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelAddItemsBtn: {
    flex: 1,
  },
  saveAddItemsBtn: {
    flex: 1,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.sm,
  },
  payBtn: {
    borderRadius: borderRadius.md,
  },
  footerButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reminderBtn: {
    borderRadius: borderRadius.md,
    borderColor: colors.warning[300],
  },
  editForm: {
    backgroundColor: colors.primary[50], // Same as summary background or slightly different?
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});

