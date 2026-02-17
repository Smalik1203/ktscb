import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DB } from '../types/db.constants';
import { getCalendarEventsForDateRange, getDayData, getHolidayInfo } from '../services/calendarIntegration';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  is_all_day: boolean;
  color?: string;
  is_active: boolean;
  class_instance_id?: string;
  school_code: string;
  academic_year_id?: string;
  created_by?: string;
}

// Hook to fetch calendar events for a date range
export function useCalendarEvents(
  schoolCode: string,
  startDate: string,
  endDate: string,
  classInstanceId?: string
) {
  return useQuery({
    queryKey: ['calendar-events', schoolCode, startDate, endDate, classInstanceId],
    queryFn: () => getCalendarEventsForDateRange(startDate, endDate, schoolCode, classInstanceId),
    enabled: !!schoolCode && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to fetch day data (timetable + tests + events)
export function useDayData(date: string, schoolCode: string, classInstanceId?: string) {
  return useQuery({
    queryKey: ['day-data', date, schoolCode, classInstanceId],
    queryFn: () => getDayData(date, schoolCode, classInstanceId),
    enabled: !!date && !!schoolCode,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to check if a date is a holiday
export function useHolidayCheck(schoolCode: string, date: string, classInstanceId?: string) {
  return useQuery({
    queryKey: ['holiday-check', schoolCode, date, classInstanceId],
    queryFn: () => getHolidayInfo(schoolCode, date, classInstanceId),
    enabled: !!schoolCode && !!date,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to fetch holidays for a date range (for attendance integration)
export function useSchoolHolidays(schoolCode: string | null, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['school-holidays', schoolCode, startDate, endDate],
    queryFn: async () => {
      // Fetch holidays that overlap with [startDate, endDate]
      // start_date <= endDate AND (end_date >= startDate OR end_date is null and start_date >= startDate)
      const { data, error } = await supabase
        .from(DB.tables.schoolCalendarEvents)
        .select('start_date, end_date, title')
        .eq('school_code', schoolCode!)
        .eq('event_type', 'holiday')
        .eq('is_active', true)
        .lte('start_date', endDate)
        .or(`end_date.gte.${startDate},end_date.is.null`);

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolCode && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Hook to create calendar event
export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventData: Omit<CalendarEvent, 'id'> & { created_by: string }) => {
      const { data, error } = await supabase
        .from(DB.tables.schoolCalendarEvents)
        .insert([eventData])
        .select('id, school_code, academic_year_id, title, description, event_type, start_date, end_date, is_all_day, start_time, end_time, is_recurring, recurrence_pattern, recurrence_interval, recurrence_end_date, color, is_active, created_by, created_at, updated_at, class_instance_id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['day-data'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-check'] });
    },
  });
}

// Hook to update calendar event
export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...eventData }: Partial<CalendarEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from(DB.tables.schoolCalendarEvents)
        .update(eventData)
        .eq('id', id)
        .select('id, school_code, academic_year_id, title, description, event_type, start_date, end_date, is_all_day, start_time, end_time, is_recurring, recurrence_pattern, recurrence_interval, recurrence_end_date, color, is_active, created_by, created_at, updated_at, class_instance_id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['day-data'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-check'] });
    },
  });
}

// Hook to delete calendar event
export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from(DB.tables.schoolCalendarEvents)
        .delete()
        .eq('id', eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['day-data'] });
      queryClient.invalidateQueries({ queryKey: ['holiday-check'] });
    },
  });
}

