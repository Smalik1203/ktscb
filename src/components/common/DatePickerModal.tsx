import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, TextInput, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Modal } from '../../ui';
import { typography, spacing, borderRadius, shadows, colors } from '../../../lib/design-system';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';

interface DatePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onDismiss,
  onConfirm,
  initialDate = new Date(),
  minimumDate = new Date(2020, 0, 1),
  maximumDate = new Date(2030, 11, 31),
  title = '',
}) => {
  const normalizeToNoon = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(12, 0, 0, 0);
    return normalized;
  };

  const toDateInputValue = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const fromDateInputValue = (value: string): Date | null => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };

  const [tempDate, setTempDate] = useState<Date>(normalizeToNoon(initialDate));

  // Update tempDate when modal opens
  useEffect(() => {
    if (visible) {
      setTempDate(normalizeToNoon(initialDate));
    }
  }, [visible, initialDate]);

  const handleConfirm = () => {
    onConfirm(normalizeToNoon(tempDate));
  };

  const handleCancel = () => {
    setTempDate(normalizeToNoon(initialDate));
    onDismiss();
  };

  // Format date for display
  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Quick select options
  const quickSelectDays = (days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() - days);
    const normalized = normalizeToNoon(newDate);
    if (normalized >= minimumDate && normalized <= maximumDate) {
      setTempDate(normalized);
    }
  };

  // Android date picker
  if (Platform.OS === 'android' && visible) {
    return (
      <DateTimePicker
        value={tempDate}
        mode="date"
        display="default"
        onChange={(event, selectedDate) => {
          onDismiss();
          if (selectedDate) {
            onConfirm(normalizeToNoon(selectedDate));
          }
        }}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
      />
    );
  }

  // iOS date picker modal
  if (Platform.OS === 'ios') {
    if (!visible) {
      return null;
    }
    return (
        <Modal
          visible={visible}
          onDismiss={handleCancel}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.container}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setTempDate(normalizeToNoon(selectedDate));
                }
              }}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
            />
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleCancel}
                style={[styles.button, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                style={[styles.button, styles.confirmButton]}
              >
                <Text style={styles.confirmButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
    );
  }

  // Web date picker modal
  if (!visible) {
    return null;
  }

  return (
      <Modal
        visible={visible}
        onDismiss={handleCancel}
        contentContainerStyle={styles.webModal}
      >
        <View style={styles.webContainer}>
          {title ? <Text style={styles.title}>{title}</Text> : null}

          {/* Quick Select Buttons */}
          <View style={styles.quickSelectRow}>
            <TouchableOpacity
              style={styles.quickSelectButton}
              onPress={() => setTempDate(normalizeToNoon(new Date()))}
            >
              <Text style={styles.quickSelectText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickSelectButton}
              onPress={() => quickSelectDays(7)}
            >
              <Text style={styles.quickSelectText}>-7 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickSelectButton}
              onPress={() => quickSelectDays(30)}
            >
              <Text style={styles.quickSelectText}>-30 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickSelectButton}
              onPress={() => quickSelectDays(90)}
            >
              <Text style={styles.quickSelectText}>-90 Days</Text>
            </TouchableOpacity>
          </View>

          {/* Native HTML Date Input for Web */}
          <View style={styles.webDateInputContainer}>
            <input
              type="date"
              value={toDateInputValue(tempDate)}
              min={toDateInputValue(minimumDate)}
              max={toDateInputValue(maximumDate)}
              onChange={(e) => {
                const newDate = fromDateInputValue(e.target.value);
                if (newDate && !isNaN(newDate.getTime())) {
                  setTempDate(newDate);
                }
              }}
              style={{
                width: '100%',
                padding: 16,
                fontSize: 18,
                border: `1px solid ${colors.border.light}`,
                borderRadius: 8,
                backgroundColor: colors.surface.secondary,
                color: colors.text.primary,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            />
          </View>

          {/* Selected Date Preview */}
          <View style={styles.selectedDatePreview}>
            <Text style={styles.selectedDateText}>
              {formatDisplayDate(tempDate)}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleCancel}
              style={[styles.button, styles.cancelButton]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              style={[styles.button, styles.confirmButton]}
            >
              <Text style={styles.confirmButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    backgroundColor: colors.surface.primary,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  webModal: {
    backgroundColor: colors.surface.primary,
    margin: spacing.xl,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    maxWidth: 400,
    alignSelf: 'center',
    ...shadows.lg,
  },
  container: {
    alignItems: 'center',
  },
  webContainer: {
    alignItems: 'stretch',
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  quickSelectRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickSelectButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    alignItems: 'center',
  },
  quickSelectText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  webDateInputContainer: {
    marginBottom: spacing.lg,
  },
  selectedDatePreview: {
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  selectedDateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.primary,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  confirmButton: {
    backgroundColor: colors.primary[600],
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
  },
});
