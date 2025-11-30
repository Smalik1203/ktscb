import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Chip } from 'react-native-paper';
import {
  CreditCard,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Receipt,
  TrendingUp,
  Wallet,
  FileText,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { typography, spacing, borderRadius, shadows, colors } from '../../../lib/design-system';
import { ProgressRing } from '../analytics/ProgressRing';
import { ThreeStateView } from '../common/ThreeStateView';
import { supabase } from '../../data/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { getStudentFees } from '../../data/queries';
import { format, subDays, addDays } from 'date-fns';

interface FeePlanItem {
  id: string;
  component_type_id: string;
  amount_inr: number;
  quantity: number;
  component?: {
    id: string;
    name: string;
    code: string;
  };
}

interface FeePayment {
  id: string;
  amount_inr: number;
  payment_date: string;
  payment_method: string | null;
  receipt_number: string | null;
  transaction_id: string | null;
  remarks: string | null;
  component_type?: {
    id: string;
    name: string;
  };
}

interface FeePlan {
  id: string;
  student_id: string;
  status: string;
  items?: FeePlanItem[];
}

interface StudentFeesData {
  plan: FeePlan | null;
  payments: FeePayment[];
  totalDue: number;
  totalPaid: number;
  balance: number;
}

export const StudentFeesView: React.FC = () => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const { profile } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loadingStudentId, setLoadingStudentId] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'plan'>('overview');

  // Get student ID from profile (matching V1 pattern with fallback logic)
  useEffect(() => {
    const fetchStudent = async () => {
      if (!profile?.auth_id || profile?.role !== 'student') {
        setLoadingStudentId(false);
        return;
      }

      setLoadingStudentId(true);
      try {
        const schoolCode = profile.school_code;
        
        if (!schoolCode) {
          throw new Error('School information not found in your profile. Please contact support.');
        }

        // Try to find student by auth_user_id first (most reliable)
        let { data, error: queryError } = await supabase
          .from('student')
          .select('id')
          .eq('auth_user_id', profile.auth_id)
          .eq('school_code', schoolCode)
          .maybeSingle();

        // If not found by auth_user_id, try by email (fallback)
        if (!data && !queryError && profile.email) {
          const result = await supabase
            .from('student')
            .select('id')
            .eq('email', profile.email)
            .eq('school_code', schoolCode)
            .maybeSingle();
          data = result.data;
          queryError = result.error;
        }

        if (queryError) {
          console.error('Student lookup error:', queryError);
          throw new Error(`Failed to find student profile: ${queryError.message || 'Please contact support if this issue persists.'}`);
        }
        
        if (!data) {
          throw new Error('Student profile not found. Please contact your administrator to ensure your account is properly linked.');
        }
        
        setStudentId(data.id);
      } catch (err: any) {
        console.error('Error fetching student:', err);
        // Error will be caught and loading set to false
        // Don't set studentId, so viewState will be 'empty'
      } finally {
        setLoadingStudentId(false);
      }
    };

    fetchStudent();
  }, [profile?.auth_id, profile?.role, profile?.school_code, profile?.email]);

  // Get active academic year
  const { data: academicYear } = useQuery({
    queryKey: ['academic-year', profile?.school_code],
    queryFn: async () => {
      if (!profile?.school_code) return null;
      const { data } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_code', profile.school_code)
        .eq('is_active', true)
        .single();
      return data;
    },
    enabled: !!profile?.school_code,
  });

  // Fetch student fees data
  const { data: feesData, isLoading, error, refetch } = useQuery<StudentFeesData>({
    queryKey: ['student-fees', studentId, academicYear?.id],
    queryFn: async () => {
      if (!studentId || !academicYear?.id || !profile?.school_code) {
        return {
          plan: null,
          payments: [],
          totalDue: 0,
          totalPaid: 0,
          balance: 0,
        };
      }
      const result = await getStudentFees(studentId, academicYear.id, profile.school_code);
      if (result.error || !result.data) {
        throw result.error || new Error('Failed to load fees');
      }
      return result.data;
    },
    enabled: !!studentId && !!academicYear?.id && !!profile?.school_code,
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Calculate component-wise breakdown
  const componentBreakdown = useMemo(() => {
    if (!feesData?.plan?.items) return [];
    
    return feesData.plan.items.map(item => {
      const componentTotal = (item.amount_inr || 0) * (item.quantity || 1);
      const componentPayments = feesData.payments.filter(
        p => p.component_type?.id === item.component_type_id
      );
      const componentPaid = componentPayments.reduce((sum, p) => sum + p.amount_inr, 0);
      const componentBalance = componentTotal - componentPaid;

      return {
        component: item.component,
        total: componentTotal,
        paid: componentPaid,
        balance: componentBalance,
        items: item,
        payments: componentPayments,
      };
    });
  }, [feesData]);

  // Format amount
  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return format(dateString, 'MMM D, YYYY');
  };

  // Get payment method icon
  const getPaymentMethodIcon = (method: string | null) => {
    switch (method?.toLowerCase()) {
      case 'cash':
        return Wallet;
      case 'card':
      case 'credit_card':
      case 'debit_card':
        return CreditCard;
      case 'online':
      case 'upi':
      case 'netbanking':
        return TrendingUp;
      default:
        return Receipt;
    }
  };

  const viewState = loadingStudentId || isLoading ? 'loading' : error ? 'error' : !studentId ? 'empty' : 'success';

  if (!studentId && !loadingStudentId) {
    return (
      <ThreeStateView
        state="empty"
        emptyMessage="Student profile not found"
        errorDetails="Unable to load your student profile. Please contact support."
      />
    );
  }

  return (
    <ThreeStateView
      state={viewState}
      loadingMessage="Loading fee information..."
      errorMessage="Failed to load fee information"
      errorDetails={error?.message}
      onRetry={handleRefresh}
    >
      <View style={styles.container}>
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'plan' && styles.tabActive]}
            onPress={() => setActiveTab('plan')}
          >
            <Text style={[styles.tabText, activeTab === 'plan' && styles.tabTextActive]}>
              Fee Plan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
            onPress={() => setActiveTab('payments')}
          >
            <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
              Payments
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Summary Card */}
              <Card mode="elevated" style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View style={[styles.summaryIcon, { backgroundColor: colors.primary[50] }]}>
                    <DollarSign size={24} color={colors.primary[600]} />
                  </View>
                  <Text style={styles.summaryTitle}>Fee Summary</Text>
                </View>

                {feesData && feesData.totalDue > 0 ? (
                  <>
                    <View style={styles.progressContainer}>
                      <ProgressRing
                        progress={feesData.totalDue > 0 ? (feesData.totalPaid / feesData.totalDue) * 100 : 0}
                        size={120}
                        strokeWidth={10}
                        color={feesData.balance === 0 ? colors.success[600] : colors.primary[600]}
                        backgroundColor={colors.neutral[100]}
                        showPercentage={true}
                      />
                      <View style={styles.progressStats}>
                        <View style={styles.progressStatItem}>
                          <Text style={styles.progressStatLabel}>Total Fee</Text>
                          <Text style={styles.progressStatValue}>
                            {formatAmount(feesData.totalDue)}
                          </Text>
                        </View>
                        <View style={styles.progressStatItem}>
                          <Text style={styles.progressStatLabel}>Paid</Text>
                          <Text style={[styles.progressStatValue, { color: colors.success[600] }]}>
                            {formatAmount(feesData.totalPaid)}
                          </Text>
                        </View>
                        <View style={styles.progressStatItem}>
                          <Text style={styles.progressStatLabel}>Pending</Text>
                          <Text style={[styles.progressStatValue, { color: colors.error[600] }]}>
                            {formatAmount(feesData.balance)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {feesData.balance === 0 && (
                      <View style={styles.allPaidBadge}>
                        <CheckCircle size={16} color={colors.success[600]} />
                        <Text style={styles.allPaidText}>All fees paid!</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.noPlanContainer}>
                    <AlertCircle size={48} color={colors.text.tertiary} />
                    <Text style={styles.noPlanTitle}>No Fee Plan Assigned</Text>
                    <Text style={styles.noPlanText}>
                      Your fee structure hasn&apos;t been set up yet. Please contact your school administrator.
                    </Text>
                  </View>
                )}
              </Card>

              {/* Component Breakdown */}
              {componentBreakdown.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Component Breakdown</Text>
                  {componentBreakdown.map((breakdown, index) => (
                    <Card key={index} mode="elevated" style={styles.componentCard}>
                      <View style={styles.componentHeader}>
                        <View style={styles.componentInfo}>
                          <Text style={styles.componentName}>
                            {breakdown.component?.name || 'Fee Component'}
                          </Text>
                          {breakdown.component?.code && (
                            <Text style={styles.componentCode}>
                              {breakdown.component.code}
                            </Text>
                          )}
                        </View>
                        <View style={styles.componentAmount}>
                          <Text style={styles.componentAmountValue}>
                            {formatAmount(breakdown.total)}
                          </Text>
                          <Text style={styles.componentAmountLabel}>Total</Text>
                        </View>
                      </View>
                      <View style={styles.componentStats}>
                        <View style={styles.componentStatItem}>
                          <CheckCircle size={14} color={colors.success[600]} />
                          <Text style={styles.componentStatText}>
                            Paid: {formatAmount(breakdown.paid)}
                          </Text>
                        </View>
                        <View style={styles.componentStatItem}>
                          <Clock size={14} color={colors.warning[600]} />
                          <Text style={styles.componentStatText}>
                            Pending: {formatAmount(breakdown.balance)}
                          </Text>
                        </View>
                      </View>
                      {breakdown.balance > 0 && (
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${(breakdown.paid / breakdown.total) * 100}%`,
                                backgroundColor: colors.primary[600],
                              },
                            ]}
                          />
                        </View>
                      )}
                    </Card>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Fee Plan Tab */}
          {activeTab === 'plan' && (
            <View style={styles.section}>
              {feesData?.plan?.items && feesData.plan.items.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Fee Plan Details</Text>
                  {feesData.plan.items.map((item, index) => (
                    <Card key={index} mode="elevated" style={styles.planItemCard}>
                      <View style={styles.planItemHeader}>
                        <View style={[styles.planItemIcon, { backgroundColor: colors.info[50] }]}>
                          <FileText size={20} color={colors.info[600]} />
                        </View>
                        <View style={styles.planItemInfo}>
                          <Text style={styles.planItemName}>
                            {item.component?.name || 'Fee Component'}
                          </Text>
                          <Text style={styles.planItemDetails}>
                            {item.quantity || 1} × {formatAmount(item.amount_inr || 0)}
                          </Text>
                        </View>
                        <Text style={styles.planItemTotal}>
                          {formatAmount((item.amount_inr || 0) * (item.quantity || 1))}
                        </Text>
                      </View>
                    </Card>
                  ))}
                </>
              ) : (
                <Card mode="elevated" style={styles.emptyCard}>
                  <View style={styles.emptyContainer}>
                    <AlertCircle size={48} color={colors.text.tertiary} />
                    <Text style={styles.emptyTitle}>No Fee Plan</Text>
                    <Text style={styles.emptyText}>
                      Your fee plan hasn&apos;t been set up yet.
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <View style={styles.section}>
              {feesData?.payments && feesData.payments.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Payment History</Text>
                  {feesData.payments.map((payment) => {
                    const PaymentIcon = getPaymentMethodIcon(payment.payment_method);
                    return (
                      <Card key={payment.id} mode="elevated" style={styles.paymentCard}>
                        <View style={styles.paymentHeader}>
                          <View style={[styles.paymentIcon, { backgroundColor: colors.success[50] }]}>
                            <PaymentIcon size={20} color={colors.success[600]} />
                          </View>
                          <View style={styles.paymentInfo}>
                            <Text style={styles.paymentAmount}>
                              {formatAmount(payment.amount_inr)}
                            </Text>
                            <View style={styles.paymentMeta}>
                              <Calendar size={12} color={colors.text.secondary} />
                              <Text style={styles.paymentDate}>
                                {formatDate(payment.payment_date)}
                              </Text>
                              {payment.component_type && (
                                <>
                                  <Text style={styles.paymentDot}>•</Text>
                                  <Text style={styles.paymentComponent}>
                                    {payment.component_type.name}
                                  </Text>
                                </>
                              )}
                            </View>
                          </View>
                          <Chip
                            style={[styles.paymentStatusChip, { backgroundColor: colors.success[100] }]}
                            textStyle={[styles.paymentStatusText, { color: colors.success[700] }]}
                          >
                            Paid
                          </Chip>
                        </View>
                        {(payment.receipt_number || payment.transaction_id) && (
                          <View style={styles.paymentDetails}>
                            {payment.receipt_number && (
                              <View style={styles.paymentDetailRow}>
                                <Receipt size={14} color={colors.text.secondary} />
                                <Text style={styles.paymentDetailText}>
                                  Receipt: {payment.receipt_number}
                                </Text>
                              </View>
                            )}
                            {payment.transaction_id && (
                              <View style={styles.paymentDetailRow}>
                                <FileText size={14} color={colors.text.secondary} />
                                <Text style={styles.paymentDetailText}>
                                  Transaction: {payment.transaction_id}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </Card>
                    );
                  })}
                </>
              ) : (
                <Card mode="elevated" style={styles.emptyCard}>
                  <View style={styles.emptyContainer}>
                    <Receipt size={48} color={colors.text.tertiary} />
                    <Text style={styles.emptyTitle}>No Payments Yet</Text>
                    <Text style={styles.emptyText}>
                      Your payment history will appear here once you make a payment.
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </ThreeStateView>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary[50],
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  summaryCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  summaryTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: spacing.lg,
  },
  progressStats: {
    gap: spacing.md,
  },
  progressStatItem: {
    alignItems: 'flex-end',
  },
  progressStatLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  progressStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  allPaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  allPaidText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  noPlanContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noPlanTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  noPlanText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  componentCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  componentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  componentInfo: {
    flex: 1,
  },
  componentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  componentCode: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  componentAmount: {
    alignItems: 'flex-end',
  },
  componentAmountValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  componentAmountLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  componentStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  componentStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  componentStatText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  planItemCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  planItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planItemIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  planItemInfo: {
    flex: 1,
  },
  planItemName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  planItemDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  planItemTotal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  paymentCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  paymentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  paymentDot: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  paymentComponent: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  paymentStatusChip: {
    height: 24,
  },
  paymentStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  paymentDetails: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.xs,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentDetailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

