/**
 * InvoiceList - Shows invoices for admin (by class) or student (own)
 * Simple, clean, invoice-first design
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { invoiceService, type Invoice } from '../../services/fees';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { useActiveAcademicYear } from '../../hooks/useAcademicYears';

interface InvoiceListProps {
  studentId?: string; // For student view
  classInstanceId?: string; // For admin view
  schoolCode: string;
}

const formatAmount = (amount: number) => 
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatPeriod = (period: string) => {
  // Check if it's academic year format (YYYY-YYYY) or old month format (YYYY-MM)
  const parts = period.split('-');
  if (parts.length === 2) {
    const [first, second] = parts;
    // If second part is 2 digits, it's old format (YYYY-MM)
    if (second.length === 2 && parseInt(second) <= 12) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[parseInt(second) - 1]} ${first}`;
    }
    // Otherwise it's academic year format (YYYY-YYYY)
    return `AY ${first.slice(-2)}-${second.slice(-2)}`;
  }
  return period;
};

export function InvoiceList({ studentId, classInstanceId, schoolCode }: InvoiceListProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { data: activeAcademicYear } = useActiveAcademicYear(schoolCode);

  const { data: invoices = [], isLoading, error, refetch } = useQuery({
    queryKey: ['invoices', studentId || classInstanceId, schoolCode, activeAcademicYear?.id],
    queryFn: async () => {
      if (studentId) {
        // OPTIMIZED: Filter by academic year in query, not JavaScript
        return await invoiceService.getByStudent(studentId, schoolCode, activeAcademicYear?.id);
      }
      if (classInstanceId) {
        return await invoiceService.getByClass(
          classInstanceId, 
          schoolCode,
          activeAcademicYear?.id
        );
      }
      return [];
    },
    enabled: !!(studentId || classInstanceId) && !!schoolCode,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return colors.success[600];
      case 'PARTIAL': return colors.warning[600];
      default: return colors.error[600];
    }
  };

  const getStatusIconName = (status: string) => {
    switch (status) {
      case 'PAID': return 'check-circle' as const;
      case 'PARTIAL': return 'schedule' as const;
      default: return 'error' as const;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600] as string} />
        <Text style={styles.loadingText}>Loading invoices...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error" size={64} color={colors.error[500]} />
        <Text style={styles.emptyTitle}>Error Loading</Text>
        <Text style={styles.emptyText}>
          {(error as Error).message || 'Failed to load invoices'}
        </Text>
        <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 16, padding: 12, backgroundColor: colors.primary[600], borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (invoices.length === 0) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="description" size={64} color={colors.neutral[300]} />
        <Text style={styles.emptyTitle}>No Invoices</Text>
        <Text style={styles.emptyText}>
          {studentId 
            ? "You don't have any fee invoices yet."
            : "No invoices generated for this class yet."
          }
        </Text>
      </View>
    );
  }

  // Group by billing period
  const grouped = invoices.reduce((acc, inv) => {
    const period = inv.billing_period;
    if (!acc[period]) acc[period] = [];
    acc[period].push(inv);
    return acc;
  }, {} as Record<string, Invoice[]>);

  return (
    <>
      {activeAcademicYear && (
        <View style={styles.academicYearBanner}>
          <Text style={styles.academicYearText}>
            Academic Year: {activeAcademicYear.year_start}-{activeAcademicYear.year_end}
          </Text>
        </View>
      )}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([period, periodInvoices]) => (
            <View key={period} style={styles.section}>
              <Text style={styles.sectionTitle}>{formatPeriod(period)}</Text>
              
              {periodInvoices
                .sort((a, b) => {
                  // Sort A to Z by student name
                  const nameA = a.student?.full_name || '';
                  const nameB = b.student?.full_name || '';
                  return nameA.localeCompare(nameB);
                })
                .map(invoice => {
                const statusIconName = getStatusIconName(invoice.status);
                const statusColor = getStatusColor(invoice.status);
                const balance = invoice.total_amount - invoice.paid_amount;
                
                return (
                  <TouchableOpacity
                    key={invoice.id}
                    style={styles.invoiceCard}
                    onPress={() => setSelectedInvoiceId(invoice.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.invoiceMain}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]}>
                        <MaterialIcons name={statusIconName} size={14} color="#fff" />
                      </View>
                      
                      <View style={styles.invoiceInfo}>
                        {invoice.student && (
                          <Text style={styles.studentName}>{invoice.student.full_name}</Text>
                        )}
                        <Text style={styles.invoiceTotal}>{formatAmount(invoice.total_amount)}</Text>
                        {balance > 0 && (
                          <Text style={styles.invoiceBalance}>Due: {formatAmount(balance)}</Text>
                        )}
                      </View>
                      
                      <View style={styles.invoiceRight}>
                        <Text style={[styles.statusBadge, { color: statusColor }]}>
                          {invoice.status}
                        </Text>
                        <MaterialIcons name="chevron-right" size={20} color={colors.neutral[400]} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
      </ScrollView>

      <InvoiceDetailModal
        invoiceId={selectedInvoiceId}
        visible={!!selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
        onPaymentRecorded={refetch}
      />
    </>
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
    backgroundColor: colors.background.secondary,
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  invoiceCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  invoiceMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  invoiceInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  invoiceTotal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  invoiceBalance: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    marginTop: 2,
  },
  invoiceRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  academicYearBanner: {
    backgroundColor: colors.primary[50],
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  academicYearText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    textAlign: 'center',
  },
});

