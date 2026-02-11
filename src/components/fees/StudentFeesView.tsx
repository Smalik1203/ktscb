/**
 * StudentFeesView - Invoice-first view for students
 * Shows their invoices with payment status and history
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { FileText, CheckCircle, Clock, AlertCircle, Receipt, ChevronRight } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { invoiceService, type Invoice } from '../../services/fees';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { supabase } from '../../lib/supabase';
import { ProgressRing } from '../ui/ProgressRing';

const formatAmount = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatPeriod = (period: string) => {
  if (!period) return 'Unknown';
  
  // Check if it's an academic year format (YYYY-YYYY)
  if (period.includes('-') && period.length >= 9) {
    const parts = period.split('-');
    if (parts.length === 2 && parts[0].length === 4 && parts[1].length === 4) {
      return `${parts[0]}-${parts[1]}`; // Return as-is: "2025-2026"
    }
  }
  
  // Otherwise assume it's YYYY-MM format
  const [year, month] = period.split('-');
  if (!month || !year) return period;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(month) - 1;
  
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${months[monthIndex]} ${year}`;
  }
  
  return period; // Fallback to original value
};

export function StudentFeesView() {
  const { profile } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const [studentId, setStudentId] = useState<string | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Get student ID from profile
  useEffect(() => {
    const fetchStudentId = async () => {
      if (!profile?.auth_id || !profile?.school_code) {
        setLoadingStudent(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('student')
          .select('id')
          .eq('auth_user_id', profile.auth_id)
          .eq('school_code', profile.school_code)
          .maybeSingle();

        if (data) {
          setStudentId(data.id);
        }
      } catch (err) {
        // Student fetch failed - error state set below
      } finally {
        setLoadingStudent(false);
      }
    };

    fetchStudentId();
  }, [profile?.auth_id, profile?.school_code]);

  // Fetch invoices
  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['student-invoices', studentId, profile?.school_code],
    queryFn: () => studentId && profile?.school_code 
      ? invoiceService.getByStudent(studentId, profile.school_code) 
      : [],
    enabled: !!studentId && !!profile?.school_code,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Calculate summary
  const summary = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const paid = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);
    return { total, paid, due: total - paid };
  }, [invoices]);

  if (loadingStudent || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading fees...</Text>
      </View>
    );
  }

  if (!studentId) {
    return (
      <View style={styles.centered}>
        <AlertCircle size={64} color={colors.error[400]} />
        <Text style={styles.errorTitle}>Profile Not Found</Text>
        <Text style={styles.errorText}>
          Unable to find your student profile. Please contact support.
        </Text>
      </View>
    );
  }

  if (invoices.length === 0) {
    return (
      <View style={styles.centered}>
        <FileText size={64} color={colors.neutral[300]} />
        <Text style={styles.emptyTitle}>No Fee Invoices</Text>
        <Text style={styles.emptyText}>
          You don't have any fee invoices yet.
        </Text>
      </View>
    );
  }

  const progressPercent = summary.total > 0 ? (summary.paid / summary.total) * 100 : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <ProgressRing
              progress={progressPercent}
              size={80}
              strokeWidth={8}
              color={summary.due === 0 ? colors.success[600] : colors.primary[600]}
              backgroundColor={colors.neutral[100]}
              showPercentage
            />
          </View>
          <View style={styles.summaryRight}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Fees</Text>
              <Text style={styles.summaryValue}>{formatAmount(summary.total)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid</Text>
              <Text style={[styles.summaryValue, { color: colors.success[600] }]}>
                {formatAmount(summary.paid)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Due</Text>
              <Text style={[styles.summaryValue, { color: summary.due > 0 ? colors.error[600] : colors.success[600] }]}>
                {formatAmount(summary.due)}
              </Text>
            </View>
          </View>
        </View>

        {/* All Paid Badge */}
        {summary.due === 0 && (
          <View style={styles.allPaidBadge}>
            <CheckCircle size={18} color={colors.success[600]} />
            <Text style={styles.allPaidText}>All fees paid!</Text>
          </View>
        )}

        {/* Invoices List */}
        <Text style={styles.sectionTitle}>Your Invoices</Text>
        {invoices.map(invoice => {
          const balance = invoice.total_amount - invoice.paid_amount;
          const StatusIcon = invoice.status === 'PAID' ? CheckCircle : invoice.status === 'PARTIAL' ? Clock : AlertCircle;
          const statusColor = invoice.status === 'PAID' ? colors.success[600] : invoice.status === 'PARTIAL' ? colors.warning[600] : colors.error[600];

          return (
            <TouchableOpacity
              key={invoice.id}
              style={styles.invoiceCard}
              onPress={() => setSelectedInvoiceId(invoice.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.statusIndicator, { backgroundColor: statusColor }]}>
                <StatusIcon size={16} color="#fff" />
              </View>
              <View style={styles.invoiceInfo}>
                <Text style={styles.invoicePeriod}>{formatPeriod(invoice.billing_period)}</Text>
                <Text style={styles.invoiceAmount}>{formatAmount(invoice.total_amount)}</Text>
                {balance > 0 && (
                  <Text style={styles.invoiceBalance}>Due: {formatAmount(balance)}</Text>
                )}
              </View>
              <ChevronRight size={20} color={colors.neutral[400]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <InvoiceDetailModal
        invoiceId={selectedInvoiceId}
        visible={!!selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onPaymentRecorded={refetch}
      />
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  typography: any,
  spacing: any,
  borderRadius: any,
  shadows: any
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.md,
    marginBottom: spacing.md,
  },
  summaryLeft: {
    marginRight: spacing.lg,
  },
  summaryRight: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  allPaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[50],
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  allPaidText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  invoiceCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoicePeriod: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  invoiceAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: 2,
  },
  invoiceBalance: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    marginTop: 2,
  },
});
