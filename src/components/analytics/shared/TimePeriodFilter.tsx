import React, { useCallback, useState, useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import type { ThemeColors } from '../../../theme/types';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { Calendar, ChevronDown } from 'lucide-react-native';
import { spacing, colors, typography, borderRadius } from '../../../../lib/design-system';
import { TimePeriod, DateRange, DATE_PRESETS, formatDate } from '../types';
import { DatePickerModal } from '../../common/DatePickerModal';
import * as Haptics from 'expo-haptics';

interface TimePeriodFilterProps {
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  disabled?: boolean;
}

export const TimePeriodFilter: React.FC<TimePeriodFilterProps> = ({
  timePeriod,
  setTimePeriod,
  dateRange,
  onDateRangeChange,
  disabled = false,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handlePeriodChange = useCallback((period: TimePeriod) => {
    if (disabled || period === timePeriod) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimePeriod(period);
  }, [disabled, timePeriod, setTimePeriod]);

  const handleStartDateConfirm = useCallback((date: Date) => {
    const newStartDate = date.toISOString().split('T')[0];
    // Ensure start date is not after end date
    const endDate = dateRange.endDate;
    if (newStartDate > endDate) {
      onDateRangeChange({ startDate: newStartDate, endDate: newStartDate });
    } else {
      onDateRangeChange({ startDate: newStartDate, endDate });
    }
    setShowStartPicker(false);
    // Switch to custom mode when dates are manually changed
    if (timePeriod !== 'custom') {
      setTimePeriod('custom');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [dateRange, onDateRangeChange, timePeriod, setTimePeriod]);

  const handleEndDateConfirm = useCallback((date: Date) => {
    const newEndDate = date.toISOString().split('T')[0];
    // Ensure end date is not before start date
    const startDate = dateRange.startDate;
    if (newEndDate < startDate) {
      onDateRangeChange({ startDate: newEndDate, endDate: newEndDate });
    } else {
      onDateRangeChange({ startDate, endDate: newEndDate });
    }
    setShowEndPicker(false);
    // Switch to custom mode when dates are manually changed
    if (timePeriod !== 'custom') {
      setTimePeriod('custom');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [dateRange, onDateRangeChange, timePeriod, setTimePeriod]);

  const openStartPicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowStartPicker(true);
  }, []);

  const openEndPicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowEndPicker(true);
  }, []);

  return (
    <View style={styles.container}>
      {/* Preset Buttons */}
      <View style={styles.presetRow}>
        {DATE_PRESETS.map(({ value, label }) => {
          const isSelected = timePeriod === value;
          return (
            <TouchableOpacity
              key={value}
              activeOpacity={disabled ? 1 : 0.7}
              onPress={() => handlePeriodChange(value)}
              disabled={disabled}
              style={[
                styles.presetButton,
                isSelected && styles.presetButtonSelected,
                disabled && styles.presetButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.presetButtonText,
                  isSelected && styles.presetButtonTextSelected,
                  disabled && styles.presetButtonTextDisabled,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Date Range Display */}
      <View style={styles.dateRangeRow}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={openStartPicker}
          activeOpacity={0.7}
        >
          <Calendar size={16} color={colors.primary[600]} />
          <Text style={styles.dateButtonText}>{formatDate(dateRange.startDate)}</Text>
          <ChevronDown size={14} color={colors.text.tertiary} />
        </TouchableOpacity>

        <Text style={styles.dateSeparator}>to</Text>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={openEndPicker}
          activeOpacity={0.7}
        >
          <Calendar size={16} color={colors.primary[600]} />
          <Text style={styles.dateButtonText}>{formatDate(dateRange.endDate)}</Text>
          <ChevronDown size={14} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Date Pickers */}
      <DatePickerModal
        visible={showStartPicker}
        onDismiss={() => setShowStartPicker(false)}
        onConfirm={handleStartDateConfirm}
        initialDate={new Date(dateRange.startDate)}
        maximumDate={new Date()}
        title="Select Start Date"
      />

      <DatePickerModal
        visible={showEndPicker}
        onDismiss={() => setShowEndPicker(false)}
        onConfirm={handleEndDateConfirm}
        initialDate={new Date(dateRange.endDate)}
        minimumDate={new Date(dateRange.startDate)}
        maximumDate={new Date()}
        title="Select End Date"
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  presetButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  presetButtonSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  presetButtonDisabled: {
    opacity: 0.5,
  },
  presetButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  presetButtonTextSelected: {
    color: colors.text.inverse,
  },
  presetButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.secondary,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dateButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  dateSeparator: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    paddingHorizontal: spacing.xs,
  },
});
