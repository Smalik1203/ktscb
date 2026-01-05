/**
 * Finance Screen - Premium Design
 * Modern, minimal finance dashboard with excellent UX
 */

import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, RefreshControl, TouchableOpacity, Alert, Animated } from 'react-native';
import { Text, Button, Card, ActivityIndicator, Portal, Modal, TextInput, Chip, FAB, SegmentedButtons } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, FileText, AlertCircle, Calendar, TrendingUp, TrendingDown, Wallet, ArrowRight, Filter, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { financeService, financeReportsService } from '../../services/finance';
import type { FinanceTransaction } from '../../services/finance';
import { exportTransactionsToCSV, generateFinanceReportPDF } from '../../services/financeExport';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { DatePickerModal } from '../../components/common/DatePickerModal';
import { useActiveAcademicYear } from '../../hooks/useAcademicYears';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolCode: string;
}

function AddExpenseModal({ visible, onClose, onSuccess, schoolCode }: AddExpenseModalProps) {
  const { colors, spacing } = useTheme();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [txnDate, setTxnDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: categories = [] } = useQuery({
    queryKey: ['finance-categories', schoolCode, 'expense'],
    queryFn: () => financeService.listCategories(schoolCode, 'expense'),
    enabled: visible && !!schoolCode,
  });
  
  const { data: accounts = [] } = useQuery({
    queryKey: ['finance-accounts', schoolCode],
    queryFn: () => financeService.listAccounts(schoolCode),
    enabled: visible && !!schoolCode,
  });
  
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCategoryId || !selectedAccountId || !amount) throw new Error('Please fill all required fields');
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) throw new Error('Amount must be greater than 0');
      
      return financeService.createTransaction({
        school_code: schoolCode,
        txn_date: format(txnDate, 'yyyy-MM-dd'),
        amount: amountNum,
        type: 'expense',
        category_id: selectedCategoryId,
        account_id: selectedAccountId,
        description: description || undefined,
        source_type: 'manual',
        source_id: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-reports'] });
      onSuccess();
      onClose();
      setAmount('');
      setDescription('');
      setSelectedCategoryId('');
      setSelectedAccountId('');
      setTxnDate(new Date());
    },
  });
  
  return (
    <>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={onClose}
          contentContainerStyle={{
            backgroundColor: colors.surface.primary,
            margin: spacing.md,
            borderRadius: 16,
            maxHeight: '85%',
            overflow: 'hidden',
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.md }}>
            <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: spacing.xs }}>
              New Expense
            </Text>
            
            <TextInput
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              mode="outlined"
              dense
              style={{ marginBottom: spacing.sm }}
              placeholder="0.00"
            />
            
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{
                marginBottom: spacing.sm,
                borderWidth: 1,
                borderColor: colors.border?.default || colors.text.secondary + '30',
                borderRadius: 8,
                padding: spacing.sm,
                backgroundColor: colors.surface.secondary,
              }}
            >
              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 2, fontSize: 11 }}>
                Date
              </Text>
              <Text variant="bodyMedium" style={{ fontSize: 14 }}>{format(txnDate, 'MMM dd, yyyy')}</Text>
            </TouchableOpacity>
            
            <TextInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              dense
              multiline
              numberOfLines={2}
              style={{ marginBottom: spacing.sm }}
              placeholder="Optional"
            />
            
            <Text variant="bodySmall" style={{ marginBottom: spacing.xs, fontWeight: '600', fontSize: 12 }}>
              Category
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
              {categories.map((cat) => (
                <Chip
                  key={cat.id}
                  selected={selectedCategoryId === cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  compact
                  style={{ marginBottom: spacing.xs, height: 28 }}
                >
                  {cat.name}
                </Chip>
              ))}
            </View>
            
            <Text variant="bodySmall" style={{ marginBottom: spacing.xs, fontWeight: '600', fontSize: 12 }}>
              Account
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
              {accounts.map((acc) => (
                <Chip
                  key={acc.id}
                  selected={selectedAccountId === acc.id}
                  onPress={() => setSelectedAccountId(acc.id)}
                  compact
                  style={{ marginBottom: spacing.xs, height: 28 }}
                >
                  {acc.name}
                </Chip>
              ))}
            </View>
            
            {createMutation.isError && (
              <Card style={{ backgroundColor: colors.error[50], padding: spacing.md, marginBottom: spacing.lg }}>
                <Text style={{ color: colors.error[700] }}>
                  {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create expense'}
                </Text>
              </Card>
            )}
            
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
              <Button mode="outlined" onPress={onClose} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => createMutation.mutate()}
                loading={createMutation.isPending}
                disabled={createMutation.isPending || !selectedCategoryId || !selectedAccountId || !amount}
                style={{ flex: 1 }}
              >
                Add
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
      
      <DatePickerModal
        visible={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        onConfirm={(date) => {
          setTxnDate(date);
          setShowDatePicker(false);
        }}
        initialDate={txnDate}
        title="Select Date"
      />
    </>
  );
}

export default function FinanceScreen() {
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showInconsistencies, setShowInconsistencies] = useState(false);
  const [inconsistencies, setInconsistencies] = useState<any[]>([]);
  const [checkingInconsistencies, setCheckingInconsistencies] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  
  // Get school code - finance service uses super_admin table, so we need to fetch it
  const [actualSchoolCode, setActualSchoolCode] = useState<string | null>(null);
  
  useEffect(() => {
    if (profile?.role === 'superadmin') {
      // Fetch school code from super_admin table (what finance service uses)
      supabase
        .from('super_admin')
        .select('school_code')
        .eq('auth_user_id', profile.auth_id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data?.school_code) {
            setActualSchoolCode(data.school_code);
          } else {
            setActualSchoolCode(profile.school_code);
          }
        });
    } else {
      setActualSchoolCode(null);
    }
  }, [profile]);
  
  const schoolCode = actualSchoolCode;
  
  // Get active academic year for default date range
  const { data: activeAcademicYear } = useActiveAcademicYear(schoolCode);
  
  // Default to academic year date range, fallback to current month
  const getDefaultDateRange = () => {
    if (activeAcademicYear?.start_date && activeAcademicYear?.end_date) {
      return {
        startDate: activeAcademicYear.start_date,
        endDate: activeAcademicYear.end_date,
      };
    }
    // Fallback to current month if academic year not available
    return {
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    };
  };
  
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  
  // Update date range when academic year loads
  useEffect(() => {
    if (activeAcademicYear?.start_date && activeAcademicYear?.end_date) {
      setDateRange({
        startDate: activeAcademicYear.start_date,
        endDate: activeAcademicYear.end_date,
      });
    }
  }, [activeAcademicYear]);
  
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['finance-reports', 'income-vs-expense', schoolCode, dateRange.startDate, dateRange.endDate],
    queryFn: () => financeReportsService.getIncomeVsExpense(schoolCode!, dateRange.startDate, dateRange.endDate),
    enabled: !!schoolCode,
    staleTime: 0, // Always refetch on refresh
    refetchOnMount: true,
  });
  
  const { data: transactionsData, isLoading: transactionsLoading, error: transactionsError, refetch: refetchTransactions } = useQuery({
    queryKey: ['finance-transactions', schoolCode, dateRange],
    queryFn: () => financeService.listTransactions({
      school_code: schoolCode!,
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      limit: 100,
    }),
    enabled: !!schoolCode,
    staleTime: 0, // Always refetch on refresh
    refetchOnMount: true,
  });
  
  // Combined refetch function - invalidate and refetch to ensure fresh data
  const refetch = async () => {
    // Invalidate queries first to clear cache
    await queryClient.invalidateQueries({ queryKey: ['finance-reports'] });
    await queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
    // Then refetch both queries
    await Promise.all([
      refetchSummary({ cancelRefetch: false }),
      refetchTransactions({ cancelRefetch: false })
    ]);
  };
  
  const allTransactions = transactionsData?.data || [];
  
  const filteredTransactions = useMemo(() => {
    if (filterType === 'all') return allTransactions;
    return allTransactions.filter(t => t.type === filterType);
  }, [allTransactions, filterType]);
  
  const groupedTransactions = useMemo(() => {
    const grouped: Record<string, FinanceTransaction[]> = {};
    filteredTransactions.forEach((txn) => {
      const dateKey = format(parseISO(txn.txn_date), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(txn);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, txns]) => ({ date, transactions: txns }));
  }, [filteredTransactions]);
  
  if (!schoolCode) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background.app }}>
        <Text variant="titleLarge" style={{ marginBottom: spacing.sm, textAlign: 'center' }}>
          Access Restricted
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
          Finance module is only available for super admin users
        </Text>
      </View>
    );
  }
  
  if (transactionsError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.background.app }}>
        <AlertCircle size={48} color={colors.error[600]} style={{ marginBottom: spacing.md }} />
        <Text variant="titleLarge" style={{ marginBottom: spacing.sm, color: colors.error[600], textAlign: 'center' }}>
          Error
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.error[600], marginBottom: spacing.lg, textAlign: 'center' }}>
          {transactionsError.message}
        </Text>
        <Button mode="contained" onPress={() => refetch()}>
          Retry
        </Button>
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1, backgroundColor: colors.background.app }}>
      {/* Improved Header - Matching Other Screens */}
      <View style={{ 
        backgroundColor: colors.surface.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border?.default || colors.text.secondary + '10',
      }}>
        {/* Filter Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          {/* Start Date Filter */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
            onPress={() => setShowStartDatePicker(true)}
            activeOpacity={0.7}
          >
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: colors.primary[50],
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.sm,
              flexShrink: 0,
            }}>
              <Calendar size={14} color={colors.primary[600]} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '500',
                color: colors.text.secondary,
                marginBottom: 2,
              }}>
                Start
              </Text>
              <Text 
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: colors.text.primary,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {format(parseISO(dateRange.startDate), 'MMM dd')}
              </Text>
            </View>
            <ChevronDown size={14} color={colors.text.secondary} style={{ marginLeft: spacing.xs, flexShrink: 0 }} />
          </TouchableOpacity>

          {/* Divider */}
          <View style={{
            width: 1,
            height: 40,
            backgroundColor: colors.border?.default || colors.text.secondary + '20',
            marginHorizontal: spacing.sm,
            flexShrink: 0,
          }} />

          {/* End Date Filter */}
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
            onPress={() => setShowEndDatePicker(true)}
            activeOpacity={0.7}
          >
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: colors.primary[50],
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.sm,
              flexShrink: 0,
            }}>
              <Calendar size={14} color={colors.primary[600]} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '500',
                color: colors.text.secondary,
                marginBottom: 2,
              }}>
                End
              </Text>
              <Text 
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: colors.text.primary,
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {format(parseISO(dateRange.endDate), 'MMM dd, yyyy')}
              </Text>
            </View>
            <ChevronDown size={14} color={colors.text.secondary} style={{ marginLeft: spacing.xs, flexShrink: 0 }} />
          </TouchableOpacity>

          {/* Divider */}
          <View style={{
            width: 1,
            height: 40,
            backgroundColor: colors.border?.default || colors.text.secondary + '20',
            marginHorizontal: spacing.sm,
            flexShrink: 0,
          }} />

          {/* Export Actions */}
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexShrink: 0 }}>
            <TouchableOpacity
              onPress={async () => {
                if (!profile?.id || !profile?.role) return;
                try {
                  await exportTransactionsToCSV(schoolCode!, dateRange.startDate, dateRange.endDate, profile.id, profile.role);
                } catch (error) {
                  Alert.alert('Export Failed', 'Failed to export CSV.');
                }
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: colors.surface.secondary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border?.default || colors.text.secondary + '20',
              }}
              activeOpacity={0.7}
            >
              <Download size={16} color={colors.primary[600]} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                if (!profile?.id || !profile?.role) return;
                try {
                  await generateFinanceReportPDF(schoolCode!, dateRange.startDate, dateRange.endDate, profile.id, profile.role);
                } catch (error) {
                  Alert.alert('Export Failed', 'Failed to generate PDF.');
                }
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: colors.surface.secondary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border?.default || colors.text.secondary + '20',
              }}
              activeOpacity={0.7}
            >
              <FileText size={16} color={colors.primary[600]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <ScrollView
        refreshControl={<RefreshControl refreshing={summaryLoading || transactionsLoading} onRefresh={() => refetch()} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* Summary */}
        {summaryLoading ? (
          <View style={{ padding: spacing.lg, alignItems: 'center' }}>
            <ActivityIndicator size="small" />
          </View>
        ) : summary ? (
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            {/* Compact Summary Row */}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1, backgroundColor: colors.success[50], padding: spacing.sm, borderRadius: 8, minWidth: 0 }}>
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 2, fontSize: 11 }}>
                  Income
                </Text>
                <Text 
                  variant="titleLarge" 
                  style={{ color: colors.success[700], fontWeight: '700', fontSize: 18 }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {summary.total_income.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.error[50], padding: spacing.sm, borderRadius: 8, minWidth: 0 }}>
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 2, fontSize: 11 }}>
                  Expense
                </Text>
                <Text 
                  variant="titleLarge" 
                  style={{ color: colors.error[700], fontWeight: '700', fontSize: 18 }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {summary.total_expense.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: summary.net_income >= 0 ? colors.success[50] : colors.error[50], padding: spacing.sm, borderRadius: 8, minWidth: 0 }}>
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 2, fontSize: 11 }}>
                  Net
                </Text>
                <Text 
                  variant="titleLarge" 
                  style={{ 
                    color: summary.net_income >= 0 ? colors.success[700] : colors.error[700],
                    fontWeight: '700',
                    fontSize: 18,
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {summary.net_income.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
        
        {/* Filter */}
        {allTransactions.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {(['all', 'income', 'expense'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setFilterType(type)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.xs + 2,
                    paddingHorizontal: spacing.sm,
                    borderRadius: 8,
                    backgroundColor: filterType === type ? colors.primary[600] : colors.surface.secondary,
                    borderWidth: 1,
                    borderColor: filterType === type ? colors.primary[600] : colors.border?.default || colors.text.secondary + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 36,
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: filterType === type ? '#fff' : colors.text.primary,
                      fontWeight: filterType === type ? '600' : '500',
                      fontSize: 13,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {type === 'all' ? 'All' : type === 'income' ? 'Income' : 'Expense'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        
        {/* Transactions */}
        <View style={{ paddingHorizontal: spacing.md }}>
          {transactionsLoading ? (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator size="small" />
            </View>
          ) : groupedTransactions.length === 0 ? (
            <View style={{ padding: spacing.lg, alignItems: 'center', marginTop: spacing.md }}>
              <Wallet size={32} color={colors.text.secondary} style={{ opacity: 0.3, marginBottom: spacing.sm }} />
              <Text variant="bodyLarge" style={{ marginBottom: spacing.xs, textAlign: 'center' }}>
                No Transactions
              </Text>
              <Text variant="bodySmall" style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.md }}>
                Start by adding an expense
              </Text>
              <Button mode="contained" icon={() => <Plus size={16} />} onPress={() => setShowAddExpense(true)} compact>
                Add Expense
              </Button>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {groupedTransactions.map(({ date, transactions: dayTransactions }) => (
                <View key={date}>
                  <Text variant="bodySmall" style={{ 
                    color: colors.text.secondary, 
                    marginBottom: spacing.xs,
                    marginTop: spacing.sm,
                    fontWeight: '600',
                    fontSize: 11,
                  }}>
                    {format(parseISO(date), 'MMM dd, yyyy')}
                  </Text>
                  <View style={{ gap: spacing.xs }}>
                    {dayTransactions.map((txn) => (
                      <TouchableOpacity
                        key={txn.id}
                        style={{
                          backgroundColor: colors.surface.primary,
                          padding: spacing.sm,
                          borderRadius: 8,
                          borderLeftWidth: 3,
                          borderLeftColor: txn.type === 'income' ? colors.success[600] : colors.error[600],
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1, paddingRight: spacing.sm, minWidth: 0 }}>
                            <Text 
                              variant="bodyLarge" 
                              style={{ fontWeight: '600', marginBottom: 2 }}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {txn.category?.name || 'Unknown'}
                            </Text>
                            {txn.description && (
                              <Text 
                                variant="bodySmall" 
                                style={{ color: colors.text.secondary, marginBottom: 2, fontSize: 12 }}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                              >
                                {txn.description}
                              </Text>
                            )}
                            <Text 
                              variant="bodySmall" 
                              style={{ color: colors.text.secondary, fontSize: 11 }}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {txn.account?.name} • {format(parseISO(txn.txn_date), 'h:mm a')}
                            </Text>
                          </View>
                          <View style={{ flexShrink: 0, marginLeft: spacing.xs }}>
                            <Text 
                              variant="titleMedium" 
                              style={{ 
                                fontWeight: '700',
                                color: txn.type === 'income' ? colors.success[700] : colors.error[700],
                                fontSize: 16,
                              }}
                              numberOfLines={1}
                            >
                              {txn.type === 'income' ? '+' : '-'}{Number(txn.amount).toLocaleString('en-IN')}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* FAB */}
      <FAB
        icon={() => <Plus size={24} />}
        style={{
          position: 'absolute',
          right: spacing.lg,
          bottom: spacing.lg,
        }}
        onPress={() => setShowAddExpense(true)}
      />
      
      {/* Modals */}
      <AddExpenseModal
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onSuccess={() => refetch()}
        schoolCode={schoolCode}
      />
      
      <DatePickerModal
        visible={showStartDatePicker}
        onDismiss={() => setShowStartDatePicker(false)}
        onConfirm={(date) => {
          setDateRange(prev => ({ ...prev, startDate: format(date, 'yyyy-MM-dd') }));
          setShowStartDatePicker(false);
        }}
        initialDate={parseISO(dateRange.startDate)}
        title="Start Date"
      />
      
      <DatePickerModal
        visible={showEndDatePicker}
        onDismiss={() => setShowEndDatePicker(false)}
        onConfirm={(date) => {
          setDateRange(prev => ({ ...prev, endDate: format(date, 'yyyy-MM-dd') }));
          setShowEndDatePicker(false);
        }}
        initialDate={parseISO(dateRange.endDate)}
        title="End Date"
      />
    </View>
  );
}
