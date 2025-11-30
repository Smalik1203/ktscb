import React, { useMemo } from 'react';
import { useTheme } from '../../../../contexts/ThemeContext';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../../theme/types';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { SuperAdminAnalytics, TimePeriod } from '../../types';
import { TimePeriodFilter } from '../../shared/TimePeriodFilter';
import { MetricCard } from '../../shared/MetricCard';

interface AttendanceDetailViewProps {
  data: SuperAdminAnalytics;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  dateRange: { startDate: string; endDate: string };
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
}

export const AttendanceDetailView: React.FC<AttendanceDetailViewProps> = ({
  data,
  timePeriod,
  setTimePeriod,
  dateRange,
  onDateRangeChange,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const getAttendanceColor = (rate: number) => {
    if (rate >= 80) return colors.success[600];
    if (rate >= 50) return colors.info[600];
    return colors.warning[600];
  };

  const attendanceRate = data?.attendance?.avgRate || 0;

  const subtextByPeriod =
    timePeriod === 'today'
      ? 'Last 7 days average'
      : timePeriod === 'week'
      ? 'Last 30 days average'
      : 'Last 90 days average';

  const classComparisonData = data?.attendance?.classesByConsistency?.slice(0, 5).map((classItem) => ({
    label: classItem.className,
    value: classItem.avgRate,
    color: getAttendanceColor(classItem.avgRate),
    subtext: `${classItem.className} attendance`,
  })) || [];

  return (
    <>
      <TimePeriodFilter 
        timePeriod={timePeriod} 
        setTimePeriod={setTimePeriod}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
      />

      <MetricCard
        label="Overall Attendance Rate"
        value={`${Math.round(attendanceRate)}%`}
        subtext={subtextByPeriod}
        progress={attendanceRate}
        variant="ring"
      />

      {classComparisonData.length > 0 && (
        <Surface style={styles.chartCard} elevation={1}>
          <MetricCard
            label="Class-wise Attendance"
            value=""
            subtext="Top performing classes"
            variant="default"
          />
          <View style={styles.comparisonContainer}>
            {classComparisonData.map((item, index) => (
              <View key={index} style={styles.comparisonItem}>
                <View style={styles.comparisonHeader}>
                  <Text style={styles.comparisonLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.comparisonProgress}>
                    {Math.round(item.value)}%
                  </Text>
                </View>
                <View style={styles.comparisonProgressBar}>
                  <View
                    style={[
                      styles.comparisonProgressFill,
                      {
                        width: `${item.value}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
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
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  // Syllabus pattern styles
  comparisonContainer: {
    gap: spacing.md,
  },
  comparisonItem: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  comparisonLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  comparisonProgress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    marginLeft: spacing.sm,
  },
  comparisonProgressBar: {
    height: 6,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  comparisonProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
});

