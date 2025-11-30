/**
 * Enhanced Timetable Hook with Conflict Detection and Resolution
 * 
 * Extends useUnifiedTimetable with:
 * - Natural language time parsing
 * - Conflict detection
 * - RPC-based atomic operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useUnifiedTimetable } from './useUnifiedTimetable';
import { parseTimeInput, timeToMinutes, minutesToTime } from '../utils/timeParser';
import {
  detectConflicts,
  calculateShift,
  calculatePeriodNumber,
  type TimetableSlot as ConflictTimetableSlot,
} from '../utils/timetableConflict';
import type { TimetableSlot } from '../services/api';

export interface EnhancedCreateSlotPayload {
  class_instance_id: string;
  school_code: string;
  class_date: string;
  slot_type: 'period' | 'break';
  start_time_input: string; // Natural language input
  end_time_input: string; // Natural language input
  name?: string | null;
  subject_id?: string | null;
  teacher_id?: string | null;
  syllabus_chapter_id?: string | null;
  syllabus_topic_id?: string | null;
  plan_text?: string | null;
}

export interface EnhancedUpdateSlotPayload {
  slot_type?: 'period' | 'break';
  start_time_input?: string;
  end_time_input?: string;
  name?: string | null;
  subject_id?: string | null;
  teacher_id?: string | null;
  syllabus_chapter_id?: string | null;
  syllabus_topic_id?: string | null;
  plan_text?: string | null;
}

export interface ConflictResolution {
  action: 'abort' | 'replace' | 'shift';
  replaceSlotId?: string;
  shiftDelta?: number;
}

export interface EnhancedTimetableResult {
  // All from useUnifiedTimetable
  slots: TimetableSlot[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  deleteSlot: (slotId: string) => Promise<void>;
  quickGenerate: (payload: any) => Promise<void>;
  markSlotTaught: (slotId: string) => Promise<void>;
  unmarkSlotTaught: (slotId: string) => Promise<void>;
  updateSlotStatus: (slotId: string, status: 'planned' | 'done' | 'cancelled') => Promise<void>;
  displayPeriodNumber: number;
  taughtSlotIds: Set<string>;

  // Enhanced methods
  parseTimeInput: (input: string, referenceHour?: number) => { formatted: string; isValid: boolean; error?: string };
  detectSlotConflicts: (
    startTime: string,
    endTime: string,
    excludeSlotId?: string
  ) => {
    conflicts: TimetableSlot[];
    affectedSlots: Array<{ slot: TimetableSlot; newStart: string; newEnd: string }>;
    shiftDelta: number;
  } | null;
  createSlotWithResolution: (
    payload: EnhancedCreateSlotPayload,
    resolution: ConflictResolution
  ) => Promise<{ success: boolean; slot_id?: string; conflicts_resolved?: boolean; slots_shifted?: number }>;
  updateSlotWithResolution: (
    slotId: string,
    payload: EnhancedUpdateSlotPayload,
    resolution: ConflictResolution
  ) => Promise<{ success: boolean; conflicts_resolved?: boolean; slots_shifted?: number }>;
}

export function useEnhancedTimetable(
  classId?: string,
  dateStr?: string,
  schoolCode?: string
): EnhancedTimetableResult {
  const queryClient = useQueryClient();
  const baseResult = useUnifiedTimetable(classId, dateStr, schoolCode);

  // Parse time input helper
  const parseTime = (input: string, referenceHour?: number) => {
    return parseTimeInput(input, referenceHour);
  };

  // Detect conflicts helper
  const detectSlotConflicts = (
    startTime: string,
    endTime: string,
    excludeSlotId?: string
  ) => {
    // Convert TimetableSlot to ConflictTimetableSlot format
    const conflictSlots: ConflictTimetableSlot[] = baseResult.slots.map(slot => ({
      id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
      slot_type: (slot.slot_type || 'period') as 'period' | 'break',
      period_number: slot.period_number,
      subject_name: slot.subject_name || null,
      teacher_name: slot.teacher_name || null,
      name: slot.name || null,
      class_instance_id: slot.class_instance_id,
      class_date: slot.class_date,
      school_code: slot.school_code,
    }));

    const conflictInfo = detectConflicts(
      startTime,
      endTime,
      conflictSlots,
      excludeSlotId
    );

    if (!conflictInfo) {
      return null;
    }

    const shifts = calculateShift(
      startTime,
      endTime,
      conflictSlots,
      excludeSlotId
    );

    return {
      conflicts: conflictInfo.conflictingSlots,
      affectedSlots: shifts,
      shiftDelta: conflictInfo.shiftDelta,
    };
  };

  // Create slot with conflict resolution using RPC
  const createSlotWithResolutionMutation = useMutation({
    mutationFn: async ({
      payload,
      resolution,
    }: {
      payload: EnhancedCreateSlotPayload;
      resolution: ConflictResolution;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Parse time inputs
      const startParsed = parseTimeInput(payload.start_time_input);
      const endParsed = parseTimeInput(payload.end_time_input, startParsed.hour);

      if (!startParsed.isValid || !endParsed.isValid) {
        throw new Error(
          `Invalid time input: ${startParsed.error || endParsed.error}`
        );
      }

      // Calculate period number
      const conflictSlots: ConflictTimetableSlot[] = baseResult.slots.map(slot => ({
        id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        slot_type: (slot.slot_type || 'period') as 'period' | 'break',
        period_number: slot.period_number,
        subject_name: slot.subject_name || null,
        teacher_name: slot.teacher_name || null,
        name: slot.name || null,
        class_instance_id: slot.class_instance_id,
        class_date: slot.class_date,
        school_code: slot.school_code,
      }));
      
      const periodNumber = calculatePeriodNumber(
        startParsed.formatted,
        conflictSlots
      );

      // Calculate shift delta if needed
      let shiftDelta = 0;
      if (resolution.action === 'shift' && resolution.shiftDelta !== undefined) {
        shiftDelta = resolution.shiftDelta;
      } else if (resolution.action === 'shift') {
        // Calculate from conflicts
        const conflictSlots: ConflictTimetableSlot[] = baseResult.slots.map(slot => ({
          id: slot.id,
          start_time: slot.start_time,
          end_time: slot.end_time,
          slot_type: (slot.slot_type || 'period') as 'period' | 'break',
          period_number: slot.period_number,
          subject_name: slot.subject_name || null,
          teacher_name: slot.teacher_name || null,
          name: slot.name || null,
          class_instance_id: slot.class_instance_id,
          class_date: slot.class_date,
          school_code: slot.school_code,
        }));
        
        const conflictInfo = detectConflicts(
          startParsed.formatted,
          endParsed.formatted,
          conflictSlots
        );
        if (conflictInfo) {
          shiftDelta = conflictInfo.shiftDelta;
        }
      }

      // Call RPC function (p_slot_id is now optional and comes after required params)
      const rpcParams: any = {
        p_class_instance_id: String(payload.class_instance_id),
        p_school_code: payload.school_code,
        p_class_date: payload.class_date,
        p_slot_type: payload.slot_type,
        p_start_time: startParsed.formatted,
        p_end_time: endParsed.formatted,
        p_period_number: periodNumber,
        p_user_id: String(userId),
      };
      
      // Only include optional parameters if they have values
      if (payload.name) rpcParams.p_name = payload.name;
      if (payload.subject_id) rpcParams.p_subject_id = String(payload.subject_id);
      if (payload.teacher_id) rpcParams.p_teacher_id = String(payload.teacher_id);
      if (payload.syllabus_chapter_id) rpcParams.p_syllabus_chapter_id = String(payload.syllabus_chapter_id);
      if (payload.syllabus_topic_id) rpcParams.p_syllabus_topic_id = String(payload.syllabus_topic_id);
      if (payload.plan_text) rpcParams.p_plan_text = payload.plan_text;
      if (resolution.action !== 'abort') rpcParams.p_resolution_action = resolution.action;
      if (resolution.replaceSlotId) rpcParams.p_replace_slot_id = String(resolution.replaceSlotId);
      if (shiftDelta !== 0) rpcParams.p_shift_delta_minutes = shiftDelta;

      const { data, error } = await (supabase.rpc as any)('create_or_update_timetable_slot', rpcParams);

      if (error) {
        console.error('RPC Error:', error);
        // If it's a constraint violation, the RPC should have handled it, but if it still comes through, handle it
        if (error.code === '23505' && (error.message?.includes('uq_tt_time_per_day') || error.details?.includes('class_instance_id, class_date, start_time, end_time'))) {
          // Try to get the existing slot and update it
          const { data: existing } = await supabase
            .from('timetable_slots')
            .select('id')
            .eq('class_instance_id', payload.class_instance_id)
            .eq('class_date', payload.class_date)
            .eq('start_time', startParsed.formatted)
            .eq('end_time', endParsed.formatted)
            .limit(1)
            .maybeSingle();

          if (existing) {
            // Update existing slot
            const { error: updateError } = await supabase
              .from('timetable_slots')
              .update({
                slot_type: payload.slot_type,
                name: payload.name,
                subject_id: payload.subject_id || null,
                teacher_id: payload.teacher_id || null,
                syllabus_chapter_id: payload.syllabus_chapter_id || null,
                syllabus_topic_id: payload.syllabus_topic_id || null,
                plan_text: payload.plan_text || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            if (!updateError) {
              return { success: true, slot_id: existing.id, action: 'updated_duplicate' };
            }
          }
          return { success: false, reason: 'duplicate period' };
        }
        throw new Error(error.message || `Failed to create slot: ${error.code || 'Unknown error'}`);
      }

      const result = data as any;
      if (!result || !result.success) {
        if (result?.reason === 'duplicate period') {
          return { success: false, reason: 'duplicate period' };
        }
        throw new Error(result?.message || result?.error || 'Failed to create slot');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
      queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    },
  });

  // Update slot with conflict resolution using RPC
  const updateSlotWithResolutionMutation = useMutation({
    mutationFn: async ({
      slotId,
      payload,
      resolution,
    }: {
      slotId: string;
      payload: EnhancedUpdateSlotPayload;
      resolution: ConflictResolution;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get existing slot to preserve unchanged values
      const existingSlot = baseResult.slots.find((s) => s.id === slotId);
      if (!existingSlot) {
        throw new Error('Slot not found');
      }

      // Parse time inputs if provided, otherwise use existing times
      let startTime = existingSlot.start_time;
      let endTime = existingSlot.end_time;

      if (payload.start_time_input && payload.start_time_input.trim() !== '') {
        const parsed = parseTimeInput(payload.start_time_input);
        if (!parsed.isValid) {
          throw new Error(`Invalid start time: ${parsed.error}`);
        }
        startTime = parsed.formatted;
      }

      if (payload.end_time_input && payload.end_time_input.trim() !== '') {
        const parsed = parseTimeInput(
          payload.end_time_input,
          parseTimeInput(startTime).hour
        );
        if (!parsed.isValid) {
          throw new Error(`Invalid end time: ${parsed.error}`);
        }
        endTime = parsed.formatted;
      }

      // Calculate period number
      const conflictSlots: ConflictTimetableSlot[] = baseResult.slots.map(slot => ({
        id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        slot_type: (slot.slot_type || 'period') as 'period' | 'break',
        period_number: slot.period_number,
        subject_name: slot.subject_name || null,
        teacher_name: slot.teacher_name || null,
        name: slot.name || null,
        class_instance_id: slot.class_instance_id,
        class_date: slot.class_date,
        school_code: slot.school_code,
      }));
      
      const periodNumber = calculatePeriodNumber(
        startTime,
        conflictSlots,
        slotId
      );

      // Calculate shift delta if needed
      let shiftDelta = 0;
      if (resolution.action === 'shift' && resolution.shiftDelta !== undefined) {
        shiftDelta = resolution.shiftDelta;
      } else if (resolution.action === 'shift') {
        const conflictSlots: ConflictTimetableSlot[] = baseResult.slots.map(slot => ({
          id: slot.id,
          start_time: slot.start_time,
          end_time: slot.end_time,
          slot_type: (slot.slot_type || 'period') as 'period' | 'break',
          period_number: slot.period_number,
          subject_name: slot.subject_name || null,
          teacher_name: slot.teacher_name || null,
          name: slot.name || null,
          class_instance_id: slot.class_instance_id,
          class_date: slot.class_date,
          school_code: slot.school_code,
        }));
        
        const conflictInfo = detectConflicts(
          startTime,
          endTime,
          conflictSlots,
          slotId
        );
        if (conflictInfo) {
          shiftDelta = conflictInfo.shiftDelta;
        }
      }

      // Call RPC function (p_slot_id is now optional and comes after required params)
      const rpcParams: any = {
        p_class_instance_id: String(existingSlot.class_instance_id),
        p_school_code: existingSlot.school_code || '',
        p_class_date: existingSlot.class_date,
        p_slot_type: payload.slot_type || existingSlot.slot_type,
        p_start_time: startTime,
        p_end_time: endTime,
        p_period_number: periodNumber,
        p_user_id: String(userId),
        p_slot_id: String(slotId), // Slot ID for update
      };
      
      // Only include optional parameters if they have values
      if (payload.name !== undefined) rpcParams.p_name = payload.name;
      if (payload.subject_id !== undefined) rpcParams.p_subject_id = String(payload.subject_id);
      if (payload.teacher_id !== undefined) rpcParams.p_teacher_id = String(payload.teacher_id);
      if (payload.syllabus_chapter_id !== undefined) rpcParams.p_syllabus_chapter_id = String(payload.syllabus_chapter_id);
      if (payload.syllabus_topic_id !== undefined) rpcParams.p_syllabus_topic_id = String(payload.syllabus_topic_id);
      if (payload.plan_text !== undefined) rpcParams.p_plan_text = payload.plan_text;
      if (resolution.action !== 'abort') rpcParams.p_resolution_action = resolution.action;
      if (resolution.replaceSlotId) rpcParams.p_replace_slot_id = String(resolution.replaceSlotId);
      if (shiftDelta !== 0) rpcParams.p_shift_delta_minutes = shiftDelta;

      const { data, error } = await (supabase.rpc as any)('create_or_update_timetable_slot', rpcParams);

      if (error) {
        console.error('RPC Error:', error);
        if (error.code === '23505' && (error.message?.includes('uq_tt_time_per_day') || error.details?.includes('class_instance_id, class_date, start_time, end_time'))) {
          return { success: false, reason: 'duplicate period' };
        }
        throw new Error(error.message || `Failed to update slot: ${error.code || 'Unknown error'}`);
      }

      const result = data as any;
      if (!result || !result.success) {
        if (result?.reason === 'duplicate period') {
          return { success: false, reason: 'duplicate period' };
        }
        throw new Error(result?.message || result?.error || 'Failed to update slot');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
      queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    },
  });

  return {
    ...baseResult,
    parseTimeInput: parseTime,
    detectSlotConflicts: (startTime: string, endTime: string, excludeSlotId?: string) => {
      const result = detectSlotConflicts(startTime, endTime, excludeSlotId);
      if (!result) return null;
      // Convert ConflictTimetableSlot back to TimetableSlot format for return
      return {
        conflicts: result.conflicts.map(c => {
          const original = baseResult.slots.find(s => s.id === c.id);
          return original || c as any;
        }),
        affectedSlots: result.affectedSlots.map(a => ({
          slot: baseResult.slots.find(s => s.id === a.slot.id) || a.slot as any,
          newStart: a.newStart,
          newEnd: a.newEnd,
        })),
        shiftDelta: result.shiftDelta,
      };
    },
    createSlotWithResolution: async (payload, resolution) => {
      return createSlotWithResolutionMutation.mutateAsync({
        payload,
        resolution,
      });
    },
    updateSlotWithResolution: async (slotId, payload, resolution) => {
      return updateSlotWithResolutionMutation.mutateAsync({
        slotId,
        payload,
        resolution,
      });
    },
  };
}

