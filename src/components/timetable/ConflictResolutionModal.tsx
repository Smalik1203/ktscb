/**
 * Conflict Resolution Modal
 * 
 * Shows conflicts and allows user to choose resolution action
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Modal } from '../../ui';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { TimetableSlot } from '../../utils/timetableConflict';
import { formatTimeForDisplay } from '../../utils/timeParser';

interface ConflictResolutionModalProps {
  visible: boolean;
  onDismiss: () => void;
  conflicts: TimetableSlot[];
  affectedSlots: { slot: TimetableSlot; newStart: string; newEnd: string }[];
  shiftDelta: number;
  onResolve: (action: 'abort' | 'replace' | 'shift') => void;
  newSlotInfo: {
    start_time: string;
    end_time: string;
    slot_type: 'period' | 'break';
    name?: string;
    subject_name?: string;
  };
}

export function ConflictResolutionModal({
  visible,
  onDismiss,
  conflicts,
  affectedSlots,
  shiftDelta,
  onResolve,
  newSlotInfo,
}: ConflictResolutionModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = createStyles(colors, typography, spacing, borderRadius, shadows);

  const hasConflicts = conflicts.length > 0;
  const hasShifts = affectedSlots.length > 0 && shiftDelta !== 0;

  return (
    <Modal visible={visible} onDismiss={onDismiss} title="Time Conflict Detected">
      <View style={styles.warningBanner}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="warning" size={24} color={colors.warning[600]} />
        </View>
        <Text style={styles.subtitle}>
          {hasConflicts
            ? `${conflicts.length} slot(s) conflict with your new slot`
            : 'This change will affect other slots'}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={true}>
        {/* New Slot Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.sectionTitle}>New Slot</Text>
          <View style={styles.slotPreview}>
            <View style={styles.timeRange}>
              <MaterialIcons name="schedule" size={16} color={colors.primary[600]} />
              <Text style={styles.timeText}>
                {formatTimeForDisplay(newSlotInfo.start_time)} - {formatTimeForDisplay(newSlotInfo.end_time)}
              </Text>
            </View>
            <Text style={styles.slotInfo}>
              {newSlotInfo.slot_type === 'period'
                ? `Period: ${newSlotInfo.subject_name || 'Unassigned'}`
                : `Break: ${newSlotInfo.name || 'Unnamed'}`}
            </Text>
          </View>
        </View>

        {/* Conflicting Slots */}
        {hasConflicts && (
          <View style={styles.conflictCard}>
            <Text style={styles.sectionTitle}>Conflicting Slots</Text>
            {conflicts.map((slot) => (
              <View key={slot.id} style={styles.conflictItem}>
                <View style={styles.timeRange}>
                  <MaterialIcons name="schedule" size={14} color={colors.error[600]} />
                  <Text style={styles.conflictTime}>
                    {formatTimeForDisplay(slot.start_time)} - {formatTimeForDisplay(slot.end_time)}
                  </Text>
                </View>
                <Text style={styles.conflictInfo}>
                  Period {slot.period_number}: {slot.slot_type === 'period' ? slot.subject_name || 'Unassigned' : slot.name || 'Break'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Affected Slots (Shifts) */}
        {hasShifts && (
          <View style={styles.shiftCard}>
            <Text style={styles.sectionTitle}>
              Slots That Will Be Shifted ({affectedSlots.length})
            </Text>
            <Text style={styles.shiftDelta}>
              Shift by: {shiftDelta > 0 ? '+' : ''}{shiftDelta} minutes
            </Text>
            {affectedSlots.slice(0, 5).map(({ slot, newStart, newEnd }) => (
              <View key={slot.id} style={styles.shiftItem}>
                <View style={styles.shiftTimeRow}>
                  <View style={styles.timeRange}>
                    <MaterialIcons name="schedule" size={14} color={colors.info[600]} />
                    <Text style={styles.oldTime}>
                      {formatTimeForDisplay(slot.start_time)} - {formatTimeForDisplay(slot.end_time)}
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-forward" size={16} color={colors.text.secondary} />
                  <Text style={styles.newTime}>
                    {formatTimeForDisplay(newStart)} - {formatTimeForDisplay(newEnd)}
                  </Text>
                </View>
                <Text style={styles.shiftInfo}>
                  Period {slot.period_number}: {slot.slot_type === 'period' ? slot.subject_name || 'Unassigned' : slot.name || 'Break'}
                </Text>
              </View>
            ))}
            {affectedSlots.length > 5 && (
              <Text style={styles.moreText}>
                ... and {affectedSlots.length - 5} more slot(s)
              </Text>
            )}
          </View>
        )}

        {/* Resolution Options */}
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>Choose an action:</Text>

          <TouchableOpacity
            onPress={() => onResolve('abort')}
            style={[styles.optionButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border.light, paddingVertical: 12, borderRadius: 8 }]}
          >
            <MaterialIcons name="close" size={18} color={colors.text.primary} />
            <Text style={{ color: colors.text.primary, fontWeight: '600', fontSize: 14 }}>Cancel - Don't Add Slot</Text>
          </TouchableOpacity>

          {hasConflicts && (
            <TouchableOpacity
              onPress={() => onResolve('replace')}
              style={[styles.optionButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.warning[300], paddingVertical: 12, borderRadius: 8 }]}
            >
              <MaterialIcons name="warning" size={18} color={colors.warning[600]} />
              <Text style={{ color: colors.warning[600], fontWeight: '600', fontSize: 14 }}>Replace Conflicting Slots</Text>
            </TouchableOpacity>
          )}

          {hasShifts && (
            <TouchableOpacity
              onPress={() => onResolve('shift')}
              style={[styles.optionButton, styles.shiftButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary[600], paddingVertical: 12, borderRadius: 8 }]}
            >
              <MaterialIcons name="arrow-forward" size={18} color={colors.text.inverse} />
              <Text style={{ color: colors.text.inverse, fontWeight: '600', fontSize: 14 }}>Shift {affectedSlots.length} Slot(s) Forward</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Modal>
  );
}

const createStyles = (
  colors: any,
  typography: any,
  spacing: any,
  borderRadius: any,
  shadows: any
) =>
  StyleSheet.create({
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.warning[50],
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    subtitle: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      flex: 1,
    },
    previewCard: {
      backgroundColor: colors.primary[50],
      padding: spacing.md,
      marginBottom: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.primary[200],
    },
    conflictCard: {
      backgroundColor: colors.error[50],
      padding: spacing.md,
      marginBottom: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.error[200],
    },
    shiftCard: {
      backgroundColor: colors.info[50],
      padding: spacing.md,
      marginBottom: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.info[200],
    },
    sectionTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    slotPreview: {
      gap: spacing.xs,
    },
    timeRange: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    timeText: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
    },
    slotInfo: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginLeft: 24,
    },
    conflictItem: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.error[100],
    },
    conflictTime: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.error[700],
    },
    conflictInfo: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginLeft: 24,
      marginTop: spacing.xs,
    },
    shiftDelta: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      color: colors.info[700],
      marginBottom: spacing.sm,
    },
    shiftItem: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.info[100],
    },
    shiftTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    oldTime: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      textDecorationLine: 'line-through',
    },
    newTime: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.info[700],
    },
    shiftInfo: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginLeft: 24,
      marginTop: spacing.xs,
    },
    moreText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      fontStyle: 'italic',
      marginTop: spacing.xs,
    },
    optionsContainer: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    optionsTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    optionButton: {
      marginBottom: spacing.sm,
    },
    shiftButton: {
      marginTop: spacing.xs,
    },
  });

