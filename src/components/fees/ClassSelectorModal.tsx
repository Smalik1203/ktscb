/**
 * ClassSelectorModal - Simple class picker
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal } from '../../ui/Modal';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';

interface ClassItem {
  id: string;
  grade: number | string;
  section: string;
}

interface ClassSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  classes: ClassItem[];
  selectedClass: ClassItem | null;
  onSelect: (cls: ClassItem) => void;
}

export function ClassSelectorModal({
  visible,
  onClose,
  classes,
  selectedClass,
  onSelect,
}: ClassSelectorModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  return (
    <Modal visible={visible} onDismiss={onClose} title="Select Class" contentContainerStyle={styles.modal}>
      <ScrollView style={styles.list}>
        {classes.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="group" size={48} color={colors.neutral[300]} />
            <Text style={styles.emptyText}>No classes available</Text>
          </View>
        ) : (
          classes.map(cls => {
            const isSelected = selectedClass?.id === cls.id;
            return (
              <TouchableOpacity
                key={cls.id}
                style={[styles.classItem, isSelected && styles.classItemSelected]}
                onPress={() => onSelect(cls)}
              >
                <Text style={[styles.className, isSelected && styles.classNameSelected]}>
                  {cls.grade} {cls.section}
                </Text>
                {isSelected && <MaterialIcons name="check" size={20} color="#fff" />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </Modal>
  );
}

const createStyles = (
  colors: ThemeColors,
  typography: any,
  spacing: any,
  borderRadius: any,
  shadows: any
) => StyleSheet.create({
  modal: {
    backgroundColor: colors.surface.primary,
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  list: {
    padding: spacing.md,
    maxHeight: 400,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  classItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
    marginBottom: spacing.sm,
  },
  classItemSelected: {
    backgroundColor: colors.primary[600],
  },
  className: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  classNameSelected: {
    color: '#fff',
  },
});

