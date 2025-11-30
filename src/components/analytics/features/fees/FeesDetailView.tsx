import React, { useMemo } from 'react';
import { useTheme } from '../../../../contexts/ThemeContext';
import type { ThemeColors } from '../../../../theme/types';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { typography, spacing, borderRadius, colors } from '../../../../../lib/design-system';
import { SuperAdminAnalytics, TimePeriod } from '../../types';
import { TimePeriodFilter } from '../../shared/TimePeriodFilter';
import { MetricCard } from '../../shared/MetricCard';
import { ComparisonChart } from '../../shared/ComparisonChart';

interface FeesDetailViewProps {
  data: SuperAdminAnalytics;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  dateRange: { startDate: string; endDate: string };
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
}

export const FeesDetailView: React.FC<FeesDetailViewProps> = ({
  data,
  timePeriod,
  setTimePeriod,
  dateRange,
  onDateRangeChange,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const realizationRate = Math.round(data?.fees?.realizationRate || 0);
  const totalCollected = data?.fees?.totalCollected || 0;
  const totalOutstanding = data?.fees?.totalOutstanding || 0;
  const totalBilled = data?.fees?.totalBilled || 1;

  // Calculate aging bucket items
  const agingItems = [
    { key: 'current', label: '0-30 days', color: colors.success[600] },
    { key: '30to60', label: '30-60 days', color: colors.warning[600] },
    { key: '60to90', label: '60-90 days', color: colors.error[500] },
    { key: 'over90', label: '90+ days', color: colors.error[700] },
  ]
    .map(({ key, label, color }) => {
      const value = data?.fees?.agingBuckets?.[key as keyof typeof data.fees.agingBuckets] || 0;
      if (value === 0) return null;
      return {
        label,
        value,
        color,
        percentage: totalOutstanding > 0 ? (value / totalOutstanding) * 100 : 0,
      };
    })
    .filter(Boolean) as { label: string; value: number; color: string; percentage: number }[];

  return (
    <>
      <TimePeriodFilter 
        timePeriod={timePeriod} 
        setTimePeriod={setTimePeriod}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
      />

      <MetricCard
        label="Fee Realization Rate"
        value={`${realizationRate}%`}
        subtext="of billed fees collected"
        valueColor={colors.primary[600]}
      />

      {/* Collected vs Outstanding Comparison */}
      <Surface style={styles.chartCard} elevation={1}>
        <Text variant="titleMedium" style={styles.chartTitle}>Collection Overview</Text>

        <View style={styles.feeComparisonContainer}>
          <View style={styles.feeComparisonItem}>
            <View
              style={[
                styles.feeComparisonBar,
                {
                  height: `${(totalCollected / totalBilled) * 100}%`,
                  backgroundColor: colors.success[600],
                },
              ]}
            />
            <Text variant="labelSmall" style={styles.feeComparisonLabel}>Collected</Text>
            <Text variant="titleMedium" style={[styles.feeComparisonValue, { color: colors.success[600] }]}>
              ₹{(totalCollected / 100).toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.feeComparisonItem}>
            <View
              style={[
                styles.feeComparisonBar,
                {
                  height: `${(totalOutstanding / totalBilled) * 100}%`,
                  backgroundColor: colors.error[600],
                },
              ]}
            />
            <Text variant="labelSmall" style={styles.feeComparisonLabel}>Outstanding</Text>
            <Text variant="titleMedium" style={[styles.feeComparisonValue, { color: colors.error[600] }]}>
              ₹{(totalOutstanding / 100).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </Surface>

      {/* Aging Buckets */}
      {agingItems.length > 0 && (
        <Surface style={styles.chartCard} elevation={1}>
          <ComparisonChart
            title="Outstanding by Age"
            subtitle="Follow-up priority"
            items={agingItems}
          />
        </Surface>
      )}
    </>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  chartCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chartTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  feeComparisonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 160,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  feeComparisonItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  feeComparisonBar: {
    width: '100%',
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
    minHeight: 20,
    marginBottom: spacing.md,
  },
  feeComparisonLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  feeComparisonValue: {
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
});

