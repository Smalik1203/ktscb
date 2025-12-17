/**
 * Conflict Resolution Modal
 * 
 * Shows conflicts and allows user to choose resolution action
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Text, Button, Card } from 'react-native-paper';
import { AlertTriangle, X, ArrowRight, Clock } from 'lucide-react-native';
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
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.modalContainer}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <AlertTriangle size={24} color={colors.warning[600]} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Time Conflict Detected</Text>
          <Text style={styles.subtitle}>
            {hasConflicts
              ? `${conflicts.length} slot(s) conflict with your new slot`
              : 'This change will affect other slots'}
          </Text>
        </View>
        <Button
          mode="text"
          onPress={onDismiss}
          icon={() => <X size={20} color={colors.text.secondary} />}
        >
          Close
        </Button>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
        {/* New Slot Preview */}
        <Card style={styles.previewCard}>
          <Text style={styles.sectionTitle}>New Slot</Text>
          <View style={styles.slotPreview}>
            <View style={styles.timeRange}>
              <Clock size={16} color={colors.primary[600]} />
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
        </Card>

        {/* Conflicting Slots */}
        {hasConflicts && (
          <Card style={styles.conflictCard}>
            <Text style={styles.sectionTitle}>Conflicting Slots</Text>
            {conflicts.map((slot) => (
              <View key={slot.id} style={styles.conflictItem}>
                <View style={styles.timeRange}>
                  <Clock size={14} color={colors.error[600]} />
                  <Text style={styles.conflictTime}>
                    {formatTimeForDisplay(slot.start_time)} - {formatTimeForDisplay(slot.end_time)}
                  </Text>
                </View>
                <Text style={styles.conflictInfo}>
                  Period {slot.period_number}: {slot.slot_type === 'period' ? slot.subject_name || 'Unassigned' : slot.name || 'Break'}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Affected Slots (Shifts) */}
        {hasShifts && (
          <Card style={styles.shiftCard}>
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
                    <Clock size={14} color={colors.info[600]} />
                    <Text style={styles.oldTime}>
                      {formatTimeForDisplay(slot.start_time)} - {formatTimeForDisplay(slot.end_time)}
                    </Text>
                  </View>
                  <ArrowRight size={16} color={colors.text.secondary} />
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
          </Card>
        )}

        {/* Resolution Options */}
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>Choose an action:</Text>

          <Button
            mode="outlined"
            onPress={() => onResolve('abort')}
            style={styles.optionButton}
            textColor={colors.text.primary}
            icon={() => <X size={18} color={colors.text.primary} />}
          >
            Cancel - Don't Add Slot
          </Button>

          {hasConflicts && (
            <Button
              mode="outlined"
              onPress={() => onResolve('replace')}
              style={styles.optionButton}
              textColor={colors.warning[600]}
              icon={() => <AlertTriangle size={18} color={colors.warning[600]} />}
            >
              Replace Conflicting Slots
            </Button>
          )}

          {hasShifts && (
            <Button
              mode="contained"
              onPress={() => onResolve('shift')}
              style={[styles.optionButton, styles.shiftButton]}
              buttonColor={colors.primary[600]}
              textColor={colors.text.inverse}
              icon={() => <ArrowRight size={18} color={colors.text.inverse} />}
            >
              Shift {affectedSlots.length} Slot(s) Forward
            </Button>
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
    modalContainer: {
      backgroundColor: colors.surface.primary,
      margin: spacing.lg,
      borderRadius: borderRadius.xl,
      maxHeight: '85%',
      overflow: 'hidden',
      ...shadows.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
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
    headerContent: {
      flex: 1,
    },
    title: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    content: {
      flex: 1,
      padding: spacing.lg,
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

