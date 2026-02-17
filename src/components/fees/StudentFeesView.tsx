/**
 * StudentFeesView - Full inline view for students/parents
 *
 * No modals. Everything is shown on one scrollable screen:
 *  1. Hero summary (total due / all paid)
 *  2. Unpaid / partial invoices with inline fee breakdown + payments
 *  3. Previously paid invoices (compact, expandable)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { invoiceService, type InvoiceWithItems } from '../../services/fees';
import { InvoiceDocumentViewer } from './InvoiceDocumentViewer';
import { supabase } from '../../lib/supabase';

// ---------- Helpers ----------

const fmt = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatPeriod = (period: string) => {
  if (!period) return 'Unknown';
  // Academic year format: "2025-2026"
  if (period.includes('-') && period.length >= 9) {
    const parts = period.split('-');
    if (parts.length === 2 && parts[0].length === 4 && parts[1].length === 4) return `${parts[0]}-${parts[1]}`;
  }
  const [year, month] = period.split('-');
  if (!month || !year) return period;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(month) - 1;
  if (idx >= 0 && idx < 12) return `${months[idx]} ${year}`;
  return period;
};

const fmtDate = (d: string | null): string => {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getDueLabel = (dueDate: string | null): { label: string; urgent: boolean } | null => {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { label: 'Due today', urgent: true };
  if (diff <= 7) return { label: `Due in ${diff}d`, urgent: true };
  return { label: `Due in ${diff}d`, urgent: false };
};

const fmtPayDate = (d: string) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return d; }
};

const methodLabel: Record<string, string> = {
  cash: 'Cash', card: 'Card', online: 'UPI/Online', cheque: 'Cheque', bank_transfer: 'Bank Transfer',
};

// ═════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════

export function StudentFeesView() {
  const { profile } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows],
  );

  const [studentId, setStudentId] = useState<string | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

  // Get student ID
  useEffect(() => {
    (async () => {
      if (!profile?.auth_id || !profile?.school_code) { setLoadingStudent(false); return; }
      try {
        const { data } = await supabase
          .from('student')
          .select('id')
          .eq('auth_user_id', profile.auth_id)
          .eq('school_code', profile.school_code)
          .maybeSingle();
        if (data) setStudentId(data.id);
      } catch { /* handled below */ } finally { setLoadingStudent(false); }
    })();
  }, [profile?.auth_id, profile?.school_code]);

  // Fetch invoices with items + payments (single query)
  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['student-invoices', studentId, profile?.school_code],
    queryFn: () =>
      studentId && profile?.school_code
        ? invoiceService.getByStudent(studentId, profile.school_code)
        : [],
    enabled: !!studentId && !!profile?.school_code,
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Summary
  const summary = useMemo(() => {
    const total = invoices.reduce((s, i) => s + i.total_amount, 0);
    const paid = invoices.reduce((s, i) => s + i.paid_amount, 0);
    return { total, paid, due: total - paid };
  }, [invoices]);

  // Split unpaid / paid
  const { unpaid, paid } = useMemo(() => {
    const u = invoices
      .filter((i) => i.status !== 'PAID')
      .sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        return 1;
      });
    const p = invoices.filter((i) => i.status === 'PAID');
    return { unpaid: u, paid: p };
  }, [invoices]);

  const allPaid = summary.due === 0;

  // Collect ALL payments across every invoice, sorted by date descending
  const allPayments = useMemo(() => {
    return invoices
      .flatMap((inv) =>
        (inv.payments ?? []).map((p) => ({ ...p, invoicePeriod: inv.billing_period })),
      )
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  }, [invoices]);

  // ── Loading / error / empty ────────────────────────────
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
        <MaterialIcons name="error" size={64} color={colors.error[400]} />
        <Text style={styles.errorTitle}>Profile Not Found</Text>
        <Text style={styles.errorText}>Unable to find your student profile. Please contact support.</Text>
      </View>
    );
  }
  if (invoices.length === 0) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="description" size={64} color={colors.neutral[300]} />
        <Text style={styles.emptyTitle}>No Fee Invoices</Text>
        <Text style={styles.emptyText}>You don&apos;t have any fee invoices yet.</Text>
      </View>
    );
  }

  // ═════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* ── Hero Summary ───────────────────────────────── */}
        <View style={[styles.heroCard, allPaid && styles.heroCardPaid]}>
          {allPaid ? (
            <>
              <MaterialIcons name="check-circle" size={36} color={colors.success[600]} />
              <Text style={styles.heroTitle}>All Fees Paid</Text>
              <Text style={styles.heroSub}>You&apos;re all caught up!</Text>
            </>
          ) : (
            <>
              <Text style={styles.heroDueLabel}>Amount Due</Text>
              <Text style={styles.heroDueAmount}>{fmt(summary.due)}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min((summary.paid / summary.total) * 100, 100)}%` }]} />
              </View>
              <View style={styles.heroRow}>
                <Text style={styles.heroStat}>Paid {fmt(summary.paid)}</Text>
                <Text style={styles.heroStat}>of {fmt(summary.total)}</Text>
              </View>
            </>
          )}
        </View>

        {/* ═══ SECTION 1: Fee Breakdown ═══════════════════ */}
        {unpaid.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Fee Breakdown</Text>
            {unpaid.map((inv) => {
              const balance = inv.total_amount - inv.paid_amount;
              const isPartial = inv.status === 'PARTIAL';
              const statusColor = isPartial ? colors.warning[600] : colors.error[600];
              const dueInfo = getDueLabel(inv.due_date);

              return (
                <View key={inv.id} style={styles.card}>
                  <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />
                  <View style={styles.cardBody}>
                    {/* Header */}
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardPeriod}>{formatPeriod(inv.billing_period)}</Text>
                      <View style={[styles.badge, { backgroundColor: `${statusColor}14` }]}>
                        <MaterialIcons name={isPartial ? 'schedule' : 'error-outline'} size={12} color={statusColor} />
                        <Text style={[styles.badgeText, { color: statusColor }]}>{isPartial ? 'Partial' : 'Unpaid'}</Text>
                      </View>
                    </View>

                    {/* Fee items */}
                    {(inv.items?.length ?? 0) > 0 && (
                      <View style={styles.breakdownBox}>
                        {(inv.items ?? []).map((item) => (
                          <View key={item.id} style={styles.bkRow}>
                            <Text style={styles.bkLabel} numberOfLines={1}>{item.label}</Text>
                            <Text style={styles.bkAmt}>{fmt(item.amount)}</Text>
                          </View>
                        ))}
                        <View style={styles.bkDivider} />
                        <View style={styles.bkRow}>
                          <Text style={styles.bkTotalLabel}>Total</Text>
                          <Text style={styles.bkTotalAmt}>{fmt(inv.total_amount)}</Text>
                        </View>
                        {isPartial && (
                          <View style={styles.bkRow}>
                            <Text style={[styles.bkLabel, { color: colors.success[600] }]}>Paid</Text>
                            <Text style={[styles.bkAmt, { color: colors.success[600] }]}>-{fmt(inv.paid_amount)}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Balance due */}
                    <View style={styles.balanceRow}>
                      <Text style={styles.balanceLabel}>Balance Due</Text>
                      <Text style={[styles.balanceAmt, { color: statusColor }]}>{fmt(balance)}</Text>
                    </View>

                    {/* Due date + urgency */}
                    {inv.due_date && (
                      <View style={styles.dueRow}>
                        <MaterialIcons name="event" size={13} color={colors.text.tertiary} />
                        <Text style={styles.dueText}>Due {fmtDate(inv.due_date)}</Text>
                        {dueInfo && (
                          <View style={[styles.urgBadge, dueInfo.urgent && styles.urgBadgeHot]}>
                            <Text style={[styles.urgText, dueInfo.urgent && styles.urgTextHot]}>{dueInfo.label}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* View Invoice */}
                    <TouchableOpacity
                      style={styles.viewDocBtn}
                      onPress={() => setViewingInvoiceId(inv.id)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="description" size={16} color={colors.primary[600]} />
                      <Text style={styles.viewDocText}>View Invoice</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ═══ SECTION 2: Payment History ═════════════════ */}
        {allPayments.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Payment History</Text>
            <View style={styles.payHistoryCard}>
              {allPayments.map((p) => (
                <View key={p.id} style={styles.payHistoryRow}>
                  <View style={styles.payHistoryIcon}>
                    <MaterialIcons name="check-circle" size={16} color={colors.success[600]} />
                  </View>
                  <View style={styles.payHistoryInfo}>
                    <View style={styles.payHistoryTopRow}>
                      <Text style={styles.payHistoryAmt}>{fmt(p.amount_inr)}</Text>
                      <Text style={styles.payHistoryDate}>{fmtPayDate(p.payment_date)}</Text>
                    </View>
                    <Text style={styles.payHistoryMeta}>
                      {methodLabel[p.payment_method] || p.payment_method}
                      {' · '}
                      {formatPeriod(p.invoicePeriod)}
                      {p.receipt_number ? ` · #${p.receipt_number}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ═══ SECTION 3: Paid Invoices (compact) ═════════ */}
        {paid.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
              Paid Invoices
            </Text>
            <View style={styles.paidCard}>
              {paid.map((inv) => (
                <TouchableOpacity
                  key={inv.id}
                  style={styles.paidHeader}
                  onPress={() => setViewingInvoiceId(inv.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.paidIconWrap}>
                    <MaterialIcons name="check-circle" size={18} color={colors.success[600]} />
                  </View>
                  <View style={styles.paidInfo}>
                    <Text style={styles.paidPeriod}>{formatPeriod(inv.billing_period)}</Text>
                    {(inv.items?.length ?? 0) > 0 && (
                      <Text style={styles.paidSummary} numberOfLines={1}>
                        {(inv.items ?? []).map((i) => i.label).join(', ')}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.paidAmt}>{fmt(inv.total_amount)}</Text>
                  <MaterialIcons name="description" size={16} color={colors.neutral[400]} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Invoice document viewer (full-screen, not a detail modal) */}
      {viewingInvoiceId && (
        <InvoiceDocumentViewer
          invoiceId={viewingInvoiceId}
          visible={!!viewingInvoiceId}
          onClose={() => setViewingInvoiceId(null)}
        />
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════

const createStyles = (
  colors: ThemeColors,
  typography: any,
  spacing: any,
  borderRadius: any,
  shadows: any,
) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.app },
    scroll: { flex: 1 },
    content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    loadingText: { marginTop: spacing.md, color: colors.text.secondary },
    errorTitle: {
      fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold,
      color: colors.text.primary, marginTop: spacing.lg,
    },
    errorText: {
      fontSize: typography.fontSize.base, color: colors.text.secondary,
      textAlign: 'center', marginTop: spacing.sm,
    },
    emptyTitle: {
      fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold,
      color: colors.text.primary, marginTop: spacing.lg,
    },
    emptyText: {
      fontSize: typography.fontSize.base, color: colors.text.secondary,
      textAlign: 'center', marginTop: spacing.sm,
    },

    // ── Hero ─────────────────────────────────────────────
    heroCard: {
      backgroundColor: colors.surface.primary, borderRadius: borderRadius.xl,
      padding: spacing.lg, alignItems: 'center', marginBottom: spacing.lg, ...shadows.md,
    },
    heroCardPaid: { backgroundColor: colors.success[50] },
    heroTitle: { fontSize: 20, fontWeight: '700' as any, color: colors.success[700], marginTop: spacing.sm },
    heroSub: { fontSize: typography.fontSize.sm, color: colors.success[600], marginTop: 2 },
    heroDueLabel: {
      fontSize: typography.fontSize.xs, fontWeight: '600' as any,
      color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 1,
    },
    heroDueAmount: {
      fontSize: 32, fontWeight: '800' as any, color: colors.error[600],
      marginTop: 2, marginBottom: spacing.md, letterSpacing: -0.5,
    },
    progressTrack: {
      width: '100%', height: 6, borderRadius: 3,
      backgroundColor: colors.neutral[100], overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.success[500] },
    heroRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: spacing.xs },
    heroStat: { fontSize: typography.fontSize.xs, color: colors.text.tertiary, fontWeight: '500' as any },

    // ── Section title ────────────────────────────────────
    sectionTitle: {
      fontSize: typography.fontSize.xs, fontWeight: '700' as any,
      color: colors.text.tertiary, textTransform: 'uppercase',
      letterSpacing: 1.2, marginBottom: spacing.sm,
    },

    // ── Unpaid card ──────────────────────────────────────
    card: {
      backgroundColor: colors.surface.primary, borderRadius: borderRadius.lg,
      flexDirection: 'row', alignItems: 'stretch', marginBottom: spacing.md,
      overflow: 'hidden', ...shadows.sm,
    },
    cardAccent: { width: 4 },
    cardBody: { flex: 1, padding: spacing.md },
    cardHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: spacing.sm,
    },
    cardPeriod: { fontSize: typography.fontSize.base, fontWeight: '600' as any, color: colors.text.primary },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full,
    },
    badgeText: { fontSize: 10, fontWeight: '700' as any, textTransform: 'uppercase', letterSpacing: 0.3 },

    // ── Breakdown box ────────────────────────────────────
    breakdownBox: {
      backgroundColor: colors.background.secondary, borderRadius: borderRadius.md,
      padding: spacing.sm, marginBottom: spacing.sm,
    },
    bkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
    bkLabel: { fontSize: typography.fontSize.sm, color: colors.text.secondary, flex: 1, marginRight: spacing.sm },
    bkAmt: { fontSize: typography.fontSize.sm, fontWeight: '500' as any, color: colors.text.primary },
    bkDivider: { height: 1, backgroundColor: colors.border.light, marginVertical: 4 },
    bkTotalLabel: { fontSize: typography.fontSize.sm, fontWeight: '700' as any, color: colors.text.primary },
    bkTotalAmt: { fontSize: typography.fontSize.sm, fontWeight: '700' as any, color: colors.text.primary },

    // ── Balance due ──────────────────────────────────────
    balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    balanceLabel: { fontSize: typography.fontSize.base, fontWeight: '700' as any, color: colors.text.primary },
    balanceAmt: { fontSize: typography.fontSize.xl, fontWeight: '800' as any, letterSpacing: -0.3 },

    // ── Due row ──────────────────────────────────────────
    dueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
    dueText: { fontSize: typography.fontSize.xs, color: colors.text.tertiary, fontWeight: '500' as any },
    urgBadge: {
      marginLeft: 4, paddingHorizontal: 6, paddingVertical: 1,
      borderRadius: borderRadius.full, backgroundColor: colors.neutral[100],
    },
    urgBadgeHot: { backgroundColor: colors.error[50] },
    urgText: { fontSize: 10, fontWeight: '600' as any, color: colors.text.tertiary },
    urgTextHot: { color: colors.error[600] },

    // ── Payment History section ────────────────────────────
    payHistoryCard: {
      backgroundColor: colors.surface.primary, borderRadius: borderRadius.lg,
      overflow: 'hidden', ...shadows.sm,
    },
    payHistoryRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.light,
    },
    payHistoryIcon: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.success[50], justifyContent: 'center', alignItems: 'center',
      marginRight: spacing.sm,
    },
    payHistoryInfo: { flex: 1 },
    payHistoryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    payHistoryAmt: {
      fontSize: typography.fontSize.base, fontWeight: '600' as any, color: colors.text.primary,
    },
    payHistoryDate: {
      fontSize: typography.fontSize.xs, color: colors.text.tertiary, fontWeight: '500' as any,
    },
    payHistoryMeta: {
      fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginTop: 2,
    },

    // ── View document button ─────────────────────────────
    viewDocBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: spacing.sm, marginTop: spacing.xs,
      backgroundColor: colors.primary[50], borderRadius: borderRadius.md,
      borderWidth: 1, borderColor: colors.primary[200],
    },
    viewDocText: {
      fontSize: typography.fontSize.sm, fontWeight: '600' as any, color: colors.primary[600],
    },

    // ── Paid card ────────────────────────────────────────
    paidCard: {
      backgroundColor: colors.surface.primary, borderRadius: borderRadius.lg,
      overflow: 'hidden', ...shadows.sm,
    },
    paidHeader: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.light,
    },
    paidIconWrap: { marginRight: spacing.sm },
    paidInfo: { flex: 1, marginRight: spacing.sm },
    paidPeriod: { fontSize: typography.fontSize.sm, fontWeight: '600' as any, color: colors.text.primary },
    paidSummary: { fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginTop: 1 },
    paidAmt: { fontSize: typography.fontSize.sm, fontWeight: '600' as any, color: colors.success[600], marginRight: spacing.xs },
  });
