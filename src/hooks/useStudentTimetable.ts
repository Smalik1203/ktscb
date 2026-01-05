import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useMemo } from 'react';
import { TimetableSlot } from '../services/api';

export interface StudentTimetableResult {
  slots: TimetableSlot[];
  displayPeriodNumber: number;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  taughtSlotIds: Set<string>;
}

export function useStudentTimetable(classInstanceId?: string, dateStr?: string): StudentTimetableResult {
  const { data, isLoading, error, refetch } = useQuery<{ slots: TimetableSlot[]; taughtSlotIds: Set<string> }>({
    queryKey: ['studentTimetable', classInstanceId, dateStr],
    queryFn: async ({ signal }) => {
      if (!classInstanceId || !dateStr) return { slots: [], taughtSlotIds: new Set<string>() };

      // OPTIMIZED: Single query with joins - eliminates N+1 pattern (3 queries → 1 query)
      const { data: slotsData, error: slotsError } = await supabase
        .from('timetable_slots')
        .select(`
          id,
          class_date,
          period_number,
          slot_type,
          name,
          start_time,
          end_time,
          subject_id,
          teacher_id,
          plan_text,
          syllabus_chapter_id,
          syllabus_topic_id,
          subject:subject_id(id, subject_name),
          teacher:teacher_id(id, full_name)
        `)
        .eq('class_instance_id', classInstanceId)
        .eq('class_date', dateStr)
        .order('start_time', { ascending: true })
        .abortSignal(signal);

      if (slotsError) throw slotsError;
      if (!slotsData || slotsData.length === 0) return { slots: [], taughtSlotIds: new Set<string>() };

      // Get taught slot IDs from syllabus_progress table
      const { data: progressData, error: progressError } = await supabase
        .from('syllabus_progress')
        .select('timetable_slot_id')
        .eq('class_instance_id', classInstanceId)
        .eq('date', dateStr)
        .abortSignal(signal);

      if (progressError) {
        // Don't throw, just log - taught status is optional
        console.warn('Error fetching taught slots:', progressError);
      }

      const taughtSlotIds = new Set((progressData || []).map(p => p.timetable_slot_id).filter(Boolean));

      // Combine slots with subject and teacher data from joins
      const enrichedSlots = slotsData.map((slot: any) => ({
        id: slot.id,
        class_date: slot.class_date,
        period_number: slot.period_number,
        slot_type: slot.slot_type,
        name: slot.name,
        start_time: slot.start_time,
        end_time: slot.end_time,
        subject_id: slot.subject_id,
        teacher_id: slot.teacher_id,
        plan_text: slot.plan_text,
        syllabus_chapter_id: slot.syllabus_chapter_id,
        syllabus_topic_id: slot.syllabus_topic_id,
        subject: slot.subject || null,
        teacher: slot.teacher || null,
      }));

      return { slots: enrichedSlots as unknown as TimetableSlot[], taughtSlotIds };
    },
    enabled: !!classInstanceId && !!dateStr,
    staleTime: 5 * 60 * 1000, // 5 minutes (was 30 seconds - too aggressive)
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false, // Don't refetch on every focus
    refetchOnMount: true,
    refetchInterval: false, // Remove aggressive polling
    refetchIntervalInBackground: false
  });

  // Compute displayPeriodNumber counting only period slots
  const displayPeriodNumber = useMemo(() => {
    if (!data?.slots) return 0;
    return data.slots.filter(slot => slot.slot_type === 'period').length;
  }, [data?.slots]);

  return {
    slots: data?.slots || [],
    displayPeriodNumber,
    loading: isLoading,
    error: error as Error | null,
    refetch,
    taughtSlotIds: data?.taughtSlotIds || new Set<string>(),
  };
}
