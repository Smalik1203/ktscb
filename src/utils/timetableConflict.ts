/**
 * Timetable Conflict Detection and Resolution
 */

import { timeToMinutes, minutesToTime, timeRangesOverlap } from './timeParser';

export interface TimetableSlot {
  id: string;
  start_time: string;
  end_time: string;
  slot_type: 'period' | 'break';
  period_number: number;
  subject_name?: string | null;
  teacher_name?: string | null;
  name?: string | null;
  class_instance_id?: string;
  class_date?: string;
  school_code?: string;
}

export interface ConflictInfo {
  type: 'overlap' | 'adjacent';
  conflictingSlots: TimetableSlot[];
  affectedSlots: TimetableSlot[]; // Slots that would be shifted
  shiftDelta: number; // Minutes to shift
}

export interface ConflictResolution {
  action: 'abort' | 'replace' | 'shift';
  replaceSlotId?: string; // If action is 'replace'
  shiftDelta?: number; // If action is 'shift'
}

/**
 * Detect conflicts with existing slots
 */
export function detectConflicts(
  newStart: string,
  newEnd: string,
  existingSlots: TimetableSlot[],
  excludeSlotId?: string // For edit operations
): ConflictInfo | null {
  const conflicts: TimetableSlot[] = [];
  const affected: TimetableSlot[] = [];
  
  const newStartMin = timeToMinutes(newStart);
  const newEndMin = timeToMinutes(newEnd);

  for (const slot of existingSlots) {
    // Skip the slot being edited
    if (excludeSlotId && slot.id === excludeSlotId) {
      continue;
    }

    // Check for overlap
    if (timeRangesOverlap(newStart, newEnd, slot.start_time, slot.end_time)) {
      conflicts.push(slot);
    }

    // Check if this slot would be affected by shift (starts after new slot)
    const slotStartMin = timeToMinutes(slot.start_time);
    if (slotStartMin >= newStartMin && slot.id !== excludeSlotId) {
      affected.push(slot);
    }
  }

  if (conflicts.length === 0 && affected.length === 0) {
    return null;
  }

  // Calculate shift delta (difference between new end and latest conflicting end)
  let shiftDelta = 0;
  if (conflicts.length > 0) {
    const latestConflictEnd = Math.max(
      ...conflicts.map(s => timeToMinutes(s.end_time))
    );
    shiftDelta = newEndMin - latestConflictEnd;
  }

  return {
    type: conflicts.length > 0 ? 'overlap' : 'adjacent',
    conflictingSlots: conflicts,
    affectedSlots: affected,
    shiftDelta,
  };
}

/**
 * Calculate how slots would be shifted
 */
export function calculateShift(
  newStart: string,
  newEnd: string,
  existingSlots: TimetableSlot[],
  excludeSlotId?: string
): Array<{ slot: TimetableSlot; newStart: string; newEnd: string }> {
  const newStartMin = timeToMinutes(newStart);
  const newEndMin = timeToMinutes(newEnd);
  const shifts: Array<{ slot: TimetableSlot; newStart: string; newEnd: string }> = [];

  for (const slot of existingSlots) {
    if (excludeSlotId && slot.id === excludeSlotId) {
      continue;
    }

    const slotStartMin = timeToMinutes(slot.start_time);
    const slotEndMin = timeToMinutes(slot.end_time);

    // If slot starts after new slot, it needs to shift
    if (slotStartMin >= newStartMin) {
      const duration = slotEndMin - slotStartMin;
      const newSlotStartMin = newEndMin;
      const newSlotEndMin = newSlotStartMin + duration;

      shifts.push({
        slot,
        newStart: minutesToTime(newSlotStartMin),
        newEnd: minutesToTime(newSlotEndMin),
      });
    }
  }

  return shifts;
}

/**
 * Calculate period number for new slot based on time
 */
export function calculatePeriodNumber(
  startTime: string,
  existingSlots: TimetableSlot[],
  excludeSlotId?: string
): number {
  const startMin = timeToMinutes(startTime);
  let periodNumber = 1;

  for (const slot of existingSlots) {
    if (excludeSlotId && slot.id === excludeSlotId) {
      continue;
    }

    const slotStartMin = timeToMinutes(slot.start_time);
    if (slotStartMin < startMin) {
      periodNumber = Math.max(periodNumber, slot.period_number + 1);
    }
  }

  return periodNumber;
}

