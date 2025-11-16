import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useRef, useEffect } from 'react';
import { TimetableSlot } from '../services/api';
import { useSyllabusLoader } from './useSyllabusLoader';

export interface UnifiedTimetableResult {
  slots: TimetableSlot[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  createSlot: (payload: CreateSlotPayload) => Promise<void>;
  updateSlot: (id: string, updates: UpdateSlotPayload) => Promise<void>;
  deleteSlot: (slotId: string) => Promise<void>;
  quickGenerate: (payload: QuickGeneratePayload) => Promise<void>;
  markSlotTaught: (slotId: string) => Promise<void>;
  unmarkSlotTaught: (slotId: string) => Promise<void>;
  updateSlotStatus: (slotId: string, status: 'planned' | 'done' | 'cancelled') => Promise<void>;
  displayPeriodNumber: number;
  taughtSlotIds: Set<string>;
}

export interface CreateSlotPayload {
  school_code: string;
  class_instance_id: string;
  class_date: string;
  period_number: number;
  slot_type: 'period' | 'break';
  name: string | null;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  teacher_id: string | null;
  syllabus_chapter_id?: string | null;
  syllabus_topic_id?: string | null;
  plan_text?: string | null;
}

export interface UpdateSlotPayload {
  slot_type?: 'period' | 'break';
  name?: string | null;
  start_time?: string;
  end_time?: string;
  subject_id?: string | null;
  teacher_id?: string | null;
  syllabus_chapter_id?: string | null;
  syllabus_topic_id?: string | null;
  plan_text?: string | null;
}

export interface QuickGeneratePayload {
  class_instance_id: string;
  school_code: string;
  class_date: string;
  startTime: string;
  numPeriods: number;
  periodDurationMin: number;
  breaks: {
    afterPeriod: number;
    durationMin: number;
    name: string;
  }[];
}

export function useUnifiedTimetable(classId?: string, dateStr?: string, schoolCode?: string): UnifiedTimetableResult {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Load syllabus data for chapter and topic names
  const { syllabusContentMap } = useSyllabusLoader(classId, schoolCode);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const { data: slots, isLoading, error, refetch } = useQuery<{ slots: TimetableSlot[]; taughtSlotIds: Set<string> }>({
    queryKey: ['unifiedTimetable', classId, dateStr],
    queryFn: async () => {
      if (!classId || !dateStr) return { slots: [], taughtSlotIds: new Set<string>() };
      
      abortControllerRef.current = new AbortController();
      
      // Fetch timetable slots for the selected date - scoped by school_code
      const { data: slotsData, error: slotsError } = await supabase
        .from('timetable_slots')
        .select(`
          id,
          class_instance_id,
          class_date,
          period_number,
          slot_type,
          name,
          start_time,
          end_time,
          subject_id,
          teacher_id,
          syllabus_chapter_id,
          syllabus_topic_id,
          plan_text,
          status,
          created_by,
          created_at,
          updated_at
        `)
        .eq('class_instance_id', classId)
        .eq('class_date', dateStr)
        .order('start_time', { ascending: true })
        .abortSignal(abortControllerRef.current.signal);

      if (slotsError) {
        throw slotsError;
      }

      if (!slotsData || slotsData.length === 0) {
        return { slots: [], taughtSlotIds: new Set<string>() };
      }

      // Get unique subject and teacher IDs
      const subjectIds = [...new Set(slotsData.map(slot => slot.subject_id).filter(Boolean))];
      const teacherIds = [...new Set(slotsData.map(slot => slot.teacher_id).filter(Boolean))];

      // Batch fetch subjects and teachers
      const [subjectsResult, teachersResult] = await Promise.all([
        subjectIds.length > 0 ? supabase
          .from('subjects')
          .select('id, subject_name')
          .in('id', subjectIds)
          .abortSignal(abortControllerRef.current.signal) : Promise.resolve({ data: [], error: null }),
        teacherIds.length > 0 ? supabase
          .from('admin')
          .select('id, full_name')
          .in('id', teacherIds)
          .abortSignal(abortControllerRef.current.signal) : Promise.resolve({ data: [], error: null })
      ]);

      if (subjectsResult.error) {
        throw subjectsResult.error;
      }

      if (teachersResult.error) {
        throw teachersResult.error;
      }

      const subjectsMap = new Map((subjectsResult.data || []).map(s => [s.id, s]));
      const teachersMap = new Map((teachersResult.data || []).map(t => [t.id, t]));

      // Get taught slot IDs from syllabus_progress table
      const { data: progressData, error: progressError } = await supabase
        .from('syllabus_progress')
        .select('timetable_slot_id')
        .eq('class_instance_id', classId)
        .eq('date', dateStr)
        .abortSignal(abortControllerRef.current.signal);

      if (progressError) {
        throw progressError;
      }

      const taughtSlotIds = new Set((progressData || []).map(p => p.timetable_slot_id));

      // Combine slots with subject and teacher data
      const enrichedSlots = slotsData.map(slot => {
        // Get chapter and topic names from syllabus content map
        const chapterContent = slot.syllabus_chapter_id ? syllabusContentMap?.get(`chapter_${slot.syllabus_chapter_id}`) : null;
        const topicContent = slot.syllabus_topic_id ? syllabusContentMap?.get(`topic_${slot.syllabus_topic_id}`) : null;
        
        return {
          ...slot,
          subject_name: slot.subject_id ? subjectsMap.get(slot.subject_id)?.subject_name : null,
          teacher_name: slot.teacher_id ? teachersMap.get(slot.teacher_id)?.full_name : null,
          chapter_name: chapterContent?.title || null,
          topic_name: topicContent?.title || null,
          day_of_week: new Date(slot.class_date).getDay(), // Add day_of_week for compatibility
        };
      });

      return { slots: enrichedSlots as TimetableSlot[], taughtSlotIds };
    },
    enabled: !!classId && !!dateStr,
    staleTime: 2 * 60 * 1000, // 2 minutes - data stays fresh for navigation
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    retry: 2, // Reduce retries for faster failure feedback
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: true, // ✅ Ensures fresh data when user returns to app
    refetchOnMount: true, // ✅ Ensures fresh data on screen load
    // ❌ Removed refetchInterval - no more aggressive polling
    // User gets fresh data when it matters (on focus/mount) without wasting resources
  });

  // Helper function to renumber slots sequentially
  const renumberSlotsSequentially = async (classId: string, dateStr: string, schoolCode: string) => {
    const { data: allSlots, error: fetchError } = await supabase
      .from('timetable_slots')
      .select('id, period_number')
      .eq('class_instance_id', classId)
      .eq('class_date', dateStr)
      .eq('school_code', schoolCode)
      .order('start_time', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    if (!allSlots || allSlots.length === 0) return;

    // Update each slot with sequential period numbers
    for (let i = 0; i < allSlots.length; i++) {
      const slot = allSlots[i];
      const newPeriodNumber = i + 1; // Start from 1, no 0s
      
      if (slot.period_number !== newPeriodNumber) {
        const { error } = await supabase
          .from('timetable_slots')
          .update({ period_number: newPeriodNumber })
          .eq('id', slot.id);
        
        if (error) {
          throw error;
        }
      }
    }
  };

  // Helper function to handle time adjustments for neighboring slots
  const handleTimeAdjustment = async (slotId: string, updates: UpdateSlotPayload) => {
    if (!updates.start_time && !updates.end_time) return;

    // Get slot info in ONE query instead of 2 separate queries
    const { data: slotInfo } = await supabase
      .from('timetable_slots')
      .select('class_instance_id, class_date, school_code')
      .eq('id', slotId)
      .single();

    if (!slotInfo) return;

    const { data: daySlots, error } = await supabase
      .from('timetable_slots')
      .select('id, start_time, end_time')
      .eq('class_instance_id', slotInfo.class_instance_id)
      .eq('class_date', slotInfo.class_date)
      .order('start_time', { ascending: true });

    if (error) {
      throw error;
    }

    const currentSlotIndex = daySlots?.findIndex(slot => slot.id === slotId);
    if (currentSlotIndex === undefined || currentSlotIndex === -1) return;

    // If end_time changed, adjust next slot's start_time
    if (updates.end_time) {
      const nextSlot = daySlots?.[currentSlotIndex + 1];
      if (nextSlot) {
        const { error: nextError } = await supabase
          .from('timetable_slots')
          .update({ start_time: updates.end_time })
          .eq('id', nextSlot.id);
        
        if (nextError) {
          // Log warning but don't fail the operation
        }
      }
    }

    // If start_time changed, adjust previous slot's end_time
    if (updates.start_time) {
      const prevSlot = daySlots?.[currentSlotIndex - 1];
      if (prevSlot) {
        const { error: prevError } = await supabase
          .from('timetable_slots')
          .update({ end_time: updates.start_time })
          .eq('id', prevSlot.id);
        
        if (prevError) {
          // Log warning but don't fail the operation
        }
      }
    }
  };

  // Create slot mutation
  const createSlotMutation = useMutation({
    mutationFn: async (payload: CreateSlotPayload) => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('timetable_slots')
        .insert({
          ...payload,
          period_number: 999, // Temporary high number to avoid constraint conflicts
          created_by: userId,
        });

      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('uq_day_slot')) {
            throw new Error('A slot with this period number already exists for this class and date. Please try again.');
          } else if (error.message.includes('uq_tt_time_per_day')) {
            throw new Error('A slot with overlapping time already exists for this class and date. Please choose different times.');
          }
        }
        throw error;
      }

      await renumberSlotsSequentially(payload.class_instance_id, payload.class_date, payload.school_code);
    },
    onSuccess: () => {
      // Invalidate all timetable queries for better cross-device sync
      queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
      // Also invalidate syllabus progress queries
      queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    },
  });

  // Update slot mutation
  const updateSlotMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateSlotPayload }) => {
      const { error } = await supabase
        .from('timetable_slots')
        .update(updates)
        .eq('id', id);

      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('uq_day_slot')) {
            throw new Error('A slot with this period number already exists for this class and date. Please try again.');
          } else if (error.message.includes('uq_tt_time_per_day')) {
            throw new Error('A slot with overlapping time already exists for this class and date. Please choose different times.');
          }
        }
        throw error;
      }

      // Handle time adjustments for neighboring slots
      if (updates.start_time || updates.end_time) {
        await handleTimeAdjustment(id, updates);
      }

      // Get slot info in ONE query instead of 3 separate queries
      const { data: slotData } = await supabase
        .from('timetable_slots')
        .select('class_instance_id, class_date, school_code')
        .eq('id', id)
        .single();

      if (slotData) {
        await renumberSlotsSequentially(
          slotData.class_instance_id,
          slotData.class_date,
          slotData.school_code
        );
      }
    },
    onSuccess: () => {
      // Invalidate all timetable queries for better cross-device sync
      queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
      // Also invalidate syllabus progress queries
      queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    },
  });

  // Delete slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('id', slotId);

      if (error) {
        throw error;
      }

      const slotData = await supabase.from('timetable_slots').select('class_instance_id, class_date, school_code').eq('id', slotId).maybeSingle();
      if (slotData.data) {
        await renumberSlotsSequentially(slotData.data.class_instance_id, slotData.data.class_date, slotData.data.school_code);
      }
    },
    onSuccess: () => {
      // Invalidate all timetable queries for better cross-device sync
      queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
      // Also invalidate syllabus progress queries
      queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    },
  });

  // Quick generate mutation
  const quickGenerateMutation = useMutation({
    mutationFn: async (payload: QuickGeneratePayload) => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Delete existing slots for this class and date
      const { error: deleteError } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('class_instance_id', payload.class_instance_id)
        .eq('class_date', payload.class_date)
        .eq('school_code', payload.school_code);

      if (deleteError) {
        throw deleteError;
      }

      // Generate new slots
      const newSlots = generateSlots(payload, userId);

      // Insert all new slots
      const { error: insertError } = await supabase
        .from('timetable_slots')
        .insert(newSlots);

      if (insertError) {
        throw insertError;
      }

      await renumberSlotsSequentially(payload.class_instance_id, payload.class_date, payload.school_code);
    },
    onSuccess: () => {
      // Invalidate all timetable queries for better cross-device sync
      queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
      // Also invalidate syllabus progress queries
      queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    },
  });

  // Mark slot as taught mutation
  const markSlotTaughtMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data: slot, error: slotError } = await supabase
        .from('timetable_slots')
        .select('school_code, subject_id, teacher_id, syllabus_chapter_id, syllabus_topic_id, class_instance_id, class_date')
        .eq('id', slotId)
        .maybeSingle();

      if (slotError) {
        throw slotError;
      }

      const { error } = await supabase
        .from('syllabus_progress')
        .insert({
          class_instance_id: slot.class_instance_id,
          created_by: userId,
          date: slot.class_date,
          school_code: slot.school_code,
          subject_id: slot.subject_id,
          syllabus_chapter_id: slot.syllabus_chapter_id,
          syllabus_topic_id: slot.syllabus_topic_id,
          teacher_id: slot.teacher_id,
          timetable_slot_id: slotId,
        });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all timetable queries for better cross-device sync
      queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
      // Invalidate student timetable queries so students see the update
      queryClient.invalidateQueries({ queryKey: ['studentTimetable'] });
      // Also invalidate syllabus progress queries
      queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    },
  });

  // Unmark slot as taught mutation
  const unmarkSlotTaughtMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { data: slot, error: slotError } = await supabase
        .from('timetable_slots')
        .select('school_code, subject_id, teacher_id, syllabus_chapter_id, syllabus_topic_id')
        .eq('id', slotId)
        .maybeSingle();

      if (slotError) {
        throw slotError;
      }

      const { error } = await supabase
        .from('syllabus_progress')
        .delete()
        .eq('school_code', slot.school_code)
        .eq('subject_id', slot.subject_id)
        .eq('teacher_id', slot.teacher_id)
        .eq('syllabus_chapter_id', slot.syllabus_chapter_id)
        .eq('syllabus_topic_id', slot.syllabus_topic_id);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all timetable queries for better cross-device sync
      queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
      // Invalidate student timetable queries so students see the update
      queryClient.invalidateQueries({ queryKey: ['studentTimetable'] });
      // Also invalidate syllabus progress queries
      queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    },
  });

  // Update slot status mutation
  const updateSlotStatusMutation = useMutation({
    mutationFn: async ({ slotId, status }: { slotId: string; status: 'planned' | 'done' | 'cancelled' }) => {
      const { error } = await supabase
        .from('timetable_slots')
        .update({ status })
        .eq('id', slotId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all timetable queries for better cross-device sync
      queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
      // Also invalidate syllabus progress queries
      queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    },
  });

  // Manual refresh function for better sync
  const refreshData = async () => {
    await queryClient.invalidateQueries({ queryKey: ['unifiedTimetable'] });
    await queryClient.invalidateQueries({ queryKey: ['syllabus_progress'] });
    await refetch();
  };

  return {
    slots: slots?.slots || [],
    loading: isLoading,
    error: error as Error | null,
    refetch: refreshData, // Use enhanced refresh function
    createSlot: (payload: CreateSlotPayload) => createSlotMutation.mutateAsync(payload),
    updateSlot: (id: string, updates: UpdateSlotPayload) => updateSlotMutation.mutateAsync({ id, updates }),
    deleteSlot: (slotId: string) => deleteSlotMutation.mutateAsync(slotId),
    quickGenerate: (payload: QuickGeneratePayload) => quickGenerateMutation.mutateAsync(payload),
    markSlotTaught: (slotId: string) => markSlotTaughtMutation.mutateAsync(slotId),
    unmarkSlotTaught: (slotId: string) => unmarkSlotTaughtMutation.mutateAsync(slotId),
    updateSlotStatus: (slotId: string, status: 'planned' | 'done' | 'cancelled') => updateSlotStatusMutation.mutateAsync({ slotId, status }),
    displayPeriodNumber: (slots?.slots || []).filter(slot => slot.slot_type === 'period').length,
    taughtSlotIds: slots?.taughtSlotIds || new Set<string>(),
  };
}

// Helper function to generate slots for quick generate
function generateSlots(payload: QuickGeneratePayload, userId: string) {
  const slots = [];
  let currentTime = payload.startTime;
  let order = 1;

  for (let i = 1; i <= payload.numPeriods; i++) {
    // Add period
    const periodStart = currentTime;
    const periodEnd = addMinutes(periodStart, payload.periodDurationMin);
    
    slots.push({
      school_code: payload.school_code,
      class_instance_id: payload.class_instance_id,
      class_date: payload.class_date,
      period_number: order++,
      slot_type: 'period' as const,
      name: null,
      start_time: periodStart,
      end_time: periodEnd,
      subject_id: null,
      teacher_id: null,
      syllabus_chapter_id: null,
      syllabus_topic_id: null,
      plan_text: null,
      status: 'planned' as const,
      created_by: userId,
    });

    currentTime = periodEnd;

    // Check if we need to add a break after this period
    const breakConfig = payload.breaks.find(b => b.afterPeriod === i);
    if (breakConfig) {
      const breakStart = currentTime;
      const breakEnd = addMinutes(breakStart, breakConfig.durationMin);
      
      slots.push({
        school_code: payload.school_code,
        class_instance_id: payload.class_instance_id,
        class_date: payload.class_date,
        period_number: order++,
        slot_type: 'break' as const,
        name: breakConfig.name,
        start_time: breakStart,
        end_time: breakEnd,
        subject_id: null,
        teacher_id: null,
        syllabus_chapter_id: null,
        syllabus_topic_id: null,
        plan_text: null,
        status: 'planned' as const,
        created_by: userId,
      });

      currentTime = breakEnd;
    }
  }

  return slots;
}

// Helper function to add minutes to time string
function addMinutes(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}:00`;
}
