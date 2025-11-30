import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { spacing, borderRadius, typography, colors } from '../../../lib/design-system';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface MonthPickerModalProps {
  visible: boolean;
  initialDate: Date; // used to set initial month/year
  onDismiss: () => void;
  onConfirm: (date: Date) => void; // returns first day of selected month
}

export const MonthPickerModal: React.FC<MonthPickerModalProps> = ({
  visible,
  initialDate,
  onDismiss,
  onConfirm,
}) => {
  const [year, setYear] = useState<number>(initialDate.getFullYear());
  const [month, setMonth] = useState<number>(initialDate.getMonth());

  useEffect(() => {
    if (visible) {
      setYear(initialDate.getFullYear());
      setMonth(initialDate.getMonth());
    }
  }, [visible, initialDate]);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Unified simple modal with two-column list (Month | Year)
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text variant="titleMedium" style={styles.title}>Select Month</Text>

          <View style={styles.columnsCard}>
            <View style={styles.columns}>
            {/* Month column */}
            <ScrollView style={styles.column} contentContainerStyle={styles.columnContent}>
              {months.map((label, idx) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.rowItem, month === idx && styles.rowItemActive]}
                  onPress={() => setMonth(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rowText, month === idx && styles.rowTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Year column */}
            <ScrollView style={styles.column} contentContainerStyle={styles.columnContent}>
              {Array.from({ length: 16 }).map((_, i) => {
                const y = initialDate.getFullYear() - 5 + i; // 11-year window
                return (
                  <TouchableOpacity
                    key={y}
                    style={[styles.rowItem, year === y && styles.rowItemActive]}
                    onPress={() => setYear(y)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.rowText, year === y && styles.rowTextActive]}>{y}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            </View>
            <View style={styles.actionsRowCard}>
              <Button mode="outlined" onPress={onDismiss} style={{ flex: 1 }}>Cancel</Button>
              <Button mode="contained" onPress={() => { onConfirm(new Date(year, month, 1)); onDismiss(); }} style={{ flex: 1 }}>Done</Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.md,
    color: colors.text.primary,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  columnsCard: {
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    padding: spacing.sm,
  },
  actionsRowCard: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  column: {
    flex: 1,
    maxHeight: 260,
  },
  columnContent: {
    paddingVertical: spacing.sm,
  },
  rowItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginVertical: 4,
    borderRadius: borderRadius.full,
  },
  rowItemActive: {
    backgroundColor: colors.primary[50],
  },
  rowText: {
    textAlign: 'center',
    color: colors.text.primary,
  },
  rowTextActive: {
    color: colors.primary[700] || colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});


