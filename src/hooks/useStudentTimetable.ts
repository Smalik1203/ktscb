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

      // Fetch timetable slots for the selected date
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
          syllabus_topic_id
        `)
        .eq('class_instance_id', classInstanceId)
        .eq('class_date', dateStr)
        .order('start_time', { ascending: true })
        .abortSignal(signal);

      if (slotsError) throw slotsError;
      if (!slotsData || slotsData.length === 0) return { slots: [], taughtSlotIds: new Set<string>() };

      // Get unique subject and teacher IDs
      const subjectIds = [...new Set(slotsData.map(slot => slot.subject_id).filter((id): id is string => Boolean(id)))];
      const teacherIds = [...new Set(slotsData.map(slot => slot.teacher_id).filter((id): id is string => Boolean(id)))];

      // Batch fetch subjects and teachers
      const [subjectsResult, teachersResult] = await Promise.all([
        subjectIds.length > 0 ? supabase
          .from('subjects')
          .select('id, subject_name')
          .in('id', subjectIds)
          .abortSignal(signal) : Promise.resolve({ data: [] }),
        teacherIds.length > 0 ? supabase
          .from('admin')
          .select('id, full_name')
          .in('id', teacherIds)
          .abortSignal(signal) : Promise.resolve({ data: [] })
      ]);

      const subjectsMap = new Map((subjectsResult.data || []).map(s => [s.id, s]));
      const teachersMap = new Map((teachersResult.data || []).map(t => [t.id, t]));

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

      // Combine slots with subject and teacher data
      const enrichedSlots = slotsData.map(slot => ({
        ...slot,
        subject: slot.subject_id ? subjectsMap.get(slot.subject_id) : null,
        teacher: slot.teacher_id ? teachersMap.get(slot.teacher_id) : null,
      }));

      return { slots: enrichedSlots as unknown as TimetableSlot[], taughtSlotIds };
    },
    enabled: !!classInstanceId && !!dateStr,
    staleTime: 30 * 1000, // ✅ 30 seconds (was 5 minutes - too long!)
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: true, // ✅ Refetch when app comes to focus (was false!)
    refetchOnMount: true,
    refetchInterval: 30 * 1000, // ✅ Auto-refetch every 30 seconds (NEW!)
    refetchIntervalInBackground: false, // Don't refetch in background to save battery
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
