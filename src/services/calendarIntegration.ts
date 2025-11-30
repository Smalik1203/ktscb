import { supabase } from '../lib/supabase';
import { DB } from '../types/db.constants';

/**
 * Calendar Integration Service
 * Handles integration between calendar, timetable, and tests
 */

export interface TimetableSlot {
  id: string;
  class_date: string;
  period_number: number;
  slot_type: 'period' | 'break';
  name?: string;
  start_time: string;
  end_time: string;
  subject_id?: string;
  teacher_id?: string;
  plan_text?: string;
  subject_name?: string;
  teacher_name?: string;
}

export interface TestData {
  id: string;
  title: string;
  description?: string;
  test_type: string;
  test_mode: 'online' | 'offline';
  test_date: string;
  time_limit_seconds?: number;
  status: string;
  subject_id: string;
  class_instance_id: string;
  subject_name?: string;
  grade?: number;
  section?: string;
}

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

export interface DayData {
  date: string;
  timetable: TimetableSlot[];
  tests: TestData[];
  events: CalendarEvent[];
  hasData: boolean;
}

// Get timetable data for a specific date and class
export const getTimetableForDate = async (
  classInstanceId: string,
  date: string,
  schoolCode: string
): Promise<TimetableSlot[]> => {
  try {
    const { data, error } = await supabase
      .from(DB.tables.timetableSlots)
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
        plan_text
      `)
      .eq('class_instance_id', classInstanceId)
      .eq('class_date', date)
      .eq('school_code', schoolCode)
      .order('start_time', { ascending: true })
      .order('period_number', { ascending: true });

    if (error) throw error;
    return (data || []) as TimetableSlot[];
  } catch (error) {
    console.error('Error fetching timetable:', error);
    throw error;
  }
};

// Get tests for a specific date
export const getTestsForDate = async (
  date: string,
  schoolCode: string,
  classInstanceId?: string
): Promise<TestData[]> => {
  try {
    let query = supabase
      .from(DB.tables.tests)
      .select('*')
      .eq('test_date', date)
      .eq('school_code', schoolCode)
      .eq('status', 'active');

    if (classInstanceId) {
      query = query.eq('class_instance_id', classInstanceId);
    }

    const { data, error } = await query.order('test_date', { ascending: true });

    if (error) throw error;
    return (data || []) as TestData[];
  } catch (error) {
    console.error('Error fetching tests:', error);
    throw error;
  }
};

// Get all calendar events for a date range
export const getCalendarEventsForDateRange = async (
  startDate: string,
  endDate: string,
  schoolCode: string,
  classInstanceId?: string
): Promise<CalendarEvent[]> => {
  try {
    let query = supabase
      .from(DB.tables.schoolCalendarEvents)
      .select('*')
      .eq('school_code', schoolCode)
      .eq('is_active', true)
      .gte('start_date', startDate)
      .lte('start_date', endDate);

    if (classInstanceId) {
      // For specific class: show class-specific + school-wide events
      query = query.or(`class_instance_id.eq.${classInstanceId},class_instance_id.is.null`);
    }
    // For "All Classes": don't filter by class_instance_id, show all events

    const { data, error } = await query.order('start_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(event => ({
      id: event.id,
      title: event.title,
      description: event.description || undefined,
      event_type: event.event_type,
      start_date: event.start_date,
      end_date: event.end_date || undefined,
      start_time: event.start_time || undefined,
      end_time: event.end_time || undefined,
      is_all_day: event.is_all_day,
      color: event.color || undefined,
      is_active: event.is_active,
      class_instance_id: event.class_instance_id || undefined,
      school_code: event.school_code,
      academic_year_id: event.academic_year_id || undefined,
      created_by: event.created_by || undefined,
    })) as CalendarEvent[];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
};

// Get comprehensive day data (timetable + tests + events)
export const getDayData = async (
  date: string,
  schoolCode: string,
  classInstanceId?: string
): Promise<DayData> => {
  try {
    const [timetable, tests, events] = await Promise.all([
      classInstanceId ? getTimetableForDate(classInstanceId, date, schoolCode) : Promise.resolve([]),
      getTestsForDate(date, schoolCode, classInstanceId),
      getCalendarEventsForDateRange(date, date, schoolCode, classInstanceId),
    ]);

    return {
      date,
      timetable,
      tests,
      events,
      hasData: timetable.length > 0 || tests.length > 0 || events.length > 0,
    };
  } catch (error) {
    console.error('Error fetching day data:', error);
    throw error;
  }
};

// Get classes for a school
export const getClassesForSchool = async (schoolCode: string) => {
  try {
    const { data, error } = await supabase
      .from(DB.tables.classInstances)
      .select('id, grade, section')
      .eq('school_code', schoolCode)
      .order('grade', { ascending: true })
      .order('section', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching classes:', error);
    throw error;
  }
};

// Check if a date is a holiday
export const getHolidayInfo = async (
  schoolCode: string,
  date: string,
  classInstanceId?: string
): Promise<CalendarEvent | null> => {
  try {
    // Check for Sunday
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 0) {
      return {
        id: 'sunday',
        title: 'Sunday',
        description: 'Sunday is a weekend day. No timetable can be scheduled.',
        event_type: 'holiday',
        start_date: date,
        is_all_day: true,
        is_active: true,
        color: '#faad14',
        school_code: schoolCode,
      };
    }

    // Check for explicit holidays in the database
    let query = supabase
      .from(DB.tables.schoolCalendarEvents)
      .select('*')
      .eq('school_code', schoolCode)
      .eq('event_type', 'holiday')
      .lte('start_date', date)
      .gte('end_date', date)
      .eq('is_active', true);

    if (classInstanceId) {
      query = query.or(`class_instance_id.eq.${classInstanceId},class_instance_id.is.null`);
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? {
      ...data,
      description: data.description || undefined,
    } as CalendarEvent : null;
  } catch (error) {
    console.error('Error checking holiday:', error);
    return null;
  }
};

// Get student-specific calendar data
export const getStudentCalendarData = async (
  studentId: string,
  schoolCode: string,
  startDate: string,
  endDate: string
) => {
  try {
    // Get student's class
    const { data: student, error: studentError } = await supabase
      .from(DB.tables.student)
      .select('class_instance_id')
      .eq('id', studentId)
      .eq('school_code', schoolCode)
      .single();

    if (studentError) throw studentError;
    if (!student?.class_instance_id) {
      return { timetable: [], tests: [], events: [] };
    }

    const [events] = await Promise.all([
      getCalendarEventsForDateRange(startDate, endDate, schoolCode, student.class_instance_id),
    ]);

    return {
      events,
      classInstanceId: student.class_instance_id,
    };
  } catch (error) {
    console.error('Error fetching student calendar data:', error);
    throw error;
  }
};

