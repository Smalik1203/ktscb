import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { AlertCircle, Calendar as CalendarIcon } from 'lucide-react-native';
import { spacing, borderRadius, typography, colors } from '../../../lib/design-system';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { useHolidayCheck } from '../../hooks/useCalendarEvents';

interface HolidayCheckerProps {
  schoolCode: string;
  date: string;
  classInstanceId?: string;
  onHolidayClick?: () => void;
  showAsAlert?: boolean;
}

export default function HolidayChecker({
  schoolCode,
  date,
  classInstanceId,
  onHolidayClick,
  showAsAlert = true,
}: HolidayCheckerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { data: holidayInfo, isLoading } = useHolidayCheck(schoolCode, date, classInstanceId);

  if (isLoading || !holidayInfo) {
    return null;
  }

  if (showAsAlert) {
    return (
      <View style={styles.alertContainer}>
        <View style={styles.alertContent}>
          <View style={styles.alertHeader}>
            <AlertCircle size={20} color={colors.warning[600]} />
            <Text variant="titleMedium" style={styles.alertTitle}>
              {holidayInfo.title || 'Holiday'}
            </Text>
          </View>
          
          <Text variant="bodyMedium" style={styles.alertDescription}>
            {holidayInfo.description || 'This is a holiday. Timetable entries cannot be created or modified.'}
          </Text>

          {onHolidayClick && (
            <Button
              mode="text"
              onPress={onHolidayClick}
              style={styles.alertButton}
              labelStyle={styles.alertButtonLabel}
            >
              View Calendar
            </Button>
          )}
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.compactContainer}
      onPress={onHolidayClick}
      disabled={!onHolidayClick}
    >
      <CalendarIcon size={16} color={colors.warning[600]} />
      <Text variant="bodySmall" style={styles.compactText}>
        {holidayInfo.title || 'Holiday'}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  alertContainer: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[300],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertContent: {
    gap: spacing.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  alertTitle: {
    color: colors.warning[700],
    fontWeight: typography.fontWeight.bold,
  },
  alertDescription: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
  alertButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  alertButtonLabel: {
    color: colors.warning[700],
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.warning[300],
  },
  compactText: {
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },
});
