/**
 * Timeline Preview Modal
 * 
 * Shows visual timeline of how slots will change
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Text, Button } from 'react-native-paper';
import { Clock, ArrowRight, Check } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { TimetableSlot } from '../../services/api';
import { formatTimeForDisplay, timeToMinutes } from '../../utils/timeParser';

interface TimelinePreviewModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  currentSlots: TimetableSlot[];
  newSlot: {
    start_time: string;
    end_time: string;
    slot_type: 'period' | 'break';
    name?: string;
    subject_name?: string;
  };
  shifts: { slot: TimetableSlot; newStart: string; newEnd: string }[];
  shiftDelta: number;
}

export function TimelinePreviewModal({
  visible,
  onDismiss,
  onConfirm,
  currentSlots,
  newSlot,
  shifts,
  shiftDelta,
}: TimelinePreviewModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = createStyles(colors, typography, spacing, borderRadius, shadows);

  // Combine all slots for timeline view
  const allSlots = [...currentSlots];
  const newSlotStartMin = timeToMinutes(newSlot.start_time);
  
  // Insert new slot in correct position
  const insertIndex = allSlots.findIndex(
    (s) => timeToMinutes(s.start_time) >= newSlotStartMin
  );
  
  // Create timeline items
  const timelineItems: {
    type: 'existing' | 'new' | 'shifted';
    slot: TimetableSlot | typeof newSlot;
    oldStart?: string;
    oldEnd?: string;
    newStart?: string;
    newEnd?: string;
  }[] = [];

  // Add existing slots before new slot
  for (let i = 0; i < insertIndex; i++) {
    timelineItems.push({
      type: 'existing',
      slot: allSlots[i],
    });
  }

  // Add new slot
  timelineItems.push({
    type: 'new',
    slot: newSlot as any,
  });

  // Add shifted slots
  shifts.forEach(({ slot, newStart, newEnd }) => {
    timelineItems.push({
      type: 'shifted',
      slot,
      oldStart: slot.start_time,
      oldEnd: slot.end_time,
      newStart,
      newEnd,
    });
  });

  // Add remaining existing slots
  for (let i = insertIndex; i < allSlots.length; i++) {
    const slot = allSlots[i];
    const isShifted = shifts.some((s) => s.slot.id === slot.id);
    if (!isShifted) {
      timelineItems.push({
        type: 'existing',
        slot,
      });
    }
  }

  // Sort by time
  timelineItems.sort((a, b) => {
    const timeA = timeToMinutes(a.newStart || a.slot.start_time);
    const timeB = timeToMinutes(b.newStart || b.slot.start_time);
    return timeA - timeB;
  });

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.modalContainer}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Preview Timeline Changes</Text>
        <Text style={styles.subtitle}>
          {shifts.length} slot(s) will be shifted by {shiftDelta > 0 ? '+' : ''}{shiftDelta} minutes
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
        <View style={styles.timeline}>
          {timelineItems.map((item, index) => {
            const isNew = item.type === 'new';
            const isShifted = item.type === 'shifted';
            const slot = item.slot as TimetableSlot;

            return (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineLine}>
                  <View
                    style={[
                      styles.timelineDot,
                      isNew && styles.timelineDotNew,
                      isShifted && styles.timelineDotShifted,
                    ]}
                  />
                  {index < timelineItems.length - 1 && (
                    <View style={styles.timelineConnector} />
                  )}
                </View>

                <View style={styles.timelineContent}>
                  {isShifted ? (
                    <View style={styles.shiftRow}>
                      <View style={styles.timeBlock}>
                        <Text style={styles.oldTimeLabel}>Old</Text>
                        <View style={styles.timeRange}>
                          <Clock size={14} color={colors.text.secondary} />
                          <Text style={styles.oldTime}>
                            {formatTimeForDisplay(item.oldStart!)} - {formatTimeForDisplay(item.oldEnd!)}
                          </Text>
                        </View>
                      </View>
                      <ArrowRight size={20} color={colors.primary[600]} />
                      <View style={styles.timeBlock}>
                        <Text style={styles.newTimeLabel}>New</Text>
                        <View style={styles.timeRange}>
                          <Clock size={14} color={colors.primary[600]} />
                          <Text style={styles.newTime}>
                            {formatTimeForDisplay(item.newStart!)} - {formatTimeForDisplay(item.newEnd!)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.timeRange}>
                      <Clock
                        size={16}
                        color={isNew ? colors.primary[600] : colors.text.secondary}
                      />
                      <Text
                        style={[
                          styles.timeText,
                          isNew && styles.timeTextNew,
                        ]}
                      >
                        {formatTimeForDisplay(
                          item.newStart || item.slot.start_time
                        )}{' '}
                        -{' '}
                        {formatTimeForDisplay(
                          item.newEnd || item.slot.end_time
                        )}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.slotLabel}>
                    {isNew
                      ? `NEW: ${newSlot.slot_type === 'period' ? `Period - ${newSlot.subject_name || 'Unassigned'}` : `Break - ${newSlot.name || 'Unnamed'}`}`
                      : `Period ${slot.period_number}: ${slot.slot_type === 'period' ? slot.subject_name || 'Unassigned' : slot.name || 'Break'}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={onDismiss}
          style={styles.cancelButton}
          textColor={colors.text.primary}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={onConfirm}
          style={styles.confirmButton}
          buttonColor={colors.primary[600]}
          textColor={colors.text.inverse}
          icon={() => <Check size={18} color={colors.text.inverse} />}
        >
          Apply Changes
        </Button>
      </View>
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
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
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
    timeline: {
      gap: spacing.md,
    },
    timelineItem: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    timelineLine: {
      alignItems: 'center',
      width: 24,
    },
    timelineDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.neutral[400],
      borderWidth: 2,
      borderColor: colors.surface.primary,
    },
    timelineDotNew: {
      backgroundColor: colors.primary[600],
      borderColor: colors.primary[100],
    },
    timelineDotShifted: {
      backgroundColor: colors.info[600],
      borderColor: colors.info[100],
    },
    timelineConnector: {
      width: 2,
      flex: 1,
      backgroundColor: colors.border.light,
      marginTop: 2,
    },
    timelineContent: {
      flex: 1,
      paddingBottom: spacing.md,
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
    timeTextNew: {
      color: colors.primary[600],
      fontWeight: typography.fontWeight.semibold,
    },
    slotLabel: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginTop: spacing.xs,
      marginLeft: 24,
    },
    shiftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flexWrap: 'wrap',
    },
    timeBlock: {
      flex: 1,
      minWidth: 120,
    },
    oldTimeLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      marginBottom: spacing.xs,
    },
    newTimeLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.primary[600],
      marginBottom: spacing.xs,
      fontWeight: typography.fontWeight.medium,
    },
    oldTime: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      textDecorationLine: 'line-through',
    },
    newTime: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.primary[600],
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    cancelButton: {
      flex: 1,
    },
    confirmButton: {
      flex: 1,
    },
  });

