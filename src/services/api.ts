import { supabase } from '../lib/supabase';
import { Database } from '../types/database.types';
import type { 
  DomainStudent, 
  DomainAdmin, 
  DomainClassInstance, 
  DomainUser,
  DomainAttendance,
  DomainTimetableSlot,
  DomainTask,
  DomainLearningResource,
  DomainSubject,
  DomainCalendarEvent
} from '../lib/normalize';
import { 
  getCurrentUserContext,
  getStudentDetails, 
  getClassDetails,
  listClasses,
  getTimetable,
  listTasks,
  listResources,
  listSubjects,
  getActiveAcademicYear
} from '../data/queries';

type Tables = Database['public']['Tables'];

export interface UserProfile {
  id: string;
  role: string;
  school_code: string | null;
  class_instance_id: string | null;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  student?: DomainStudent;
  admin?: DomainAdmin;
  class_instance?: DomainClassInstance;
}

export interface ClassInstance {
  id: string;
  grade: number | null;
  section: string | null;
  school_code: string;
  academic_year_id: string | null;
  class_teacher_id?: string | null;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_instance_id: string | null;
  date: string;
  status: 'present' | 'absent';
  marked_by: string;
  marked_by_role_code: string;
  school_code: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

export interface AttendanceInput {
  student_id: string;
  class_instance_id: string;
  date: string;
  status: 'present' | 'absent';
  marked_by: string;
  marked_by_role_code: string;
  school_code: string;
}

export interface FeePayment {
  id: string;
  student_id: string;
  amount_inr: number;
  payment_date: string;
  payment_method: string | null;
  component_type_id: string;
  plan_id: string | null;
  receipt_number: string | null;
  remarks: string | null;
  school_code: string;
  transaction_id: string | null;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
}

// Re-export domain types for backward compatibility
export type TimetableSlot = DomainTimetableSlot & {
  // Additional properties from database that aren't in domain schema yet
  slot_type?: string;
  name?: string | null;
  plan_text?: string | null;
  status?: string;
  created_by?: string;
  syllabus_chapter_id?: string | null;
  syllabus_topic_id?: string | null;
  // Enriched properties added by useUnifiedTimetable hook
  subject_name?: string | null;
  teacher_name?: string | null;
  chapter_name?: string | null;
  topic_name?: string | null;
  // Legacy nested objects (for backward compatibility)
  subject?: {
    id: string;
    subject_name: string;
  };
  teacher?: {
    id: string;
    full_name: string;
  };
  // Legacy properties for backward compatibility
  day_of_week?: number;
};

export type LearningResource = DomainLearningResource;
export type CalendarEvent = DomainCalendarEvent;
export type Task = DomainTask;

export const api = {
  users: {
    async getCurrentProfile(): Promise<UserProfile | null> {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, school_code, class_instance_id')
        .eq('id', user.id)
        .maybeSingle();

      if (userError || !userData) return null;

      let profile: UserProfile = {
        id: userData.id,
        role: userData.role,
        school_code: userData.school_code,
        class_instance_id: userData.class_instance_id,
        full_name: user.email?.split('@')[0] || null,
        email: user.email || null,
      };

      if (userData.role === 'student') {
        // Find student by auth_user_id
        const { data: studentRows } = await supabase
          .from('student')
          .select('id')
          .eq('auth_user_id', user.id)
          .limit(1);
        
        if (studentRows && studentRows.length > 0) {
          const studentResult = await getStudentDetails(studentRows[0].id);
          if (studentResult.data) {
            profile.student = studentResult.data;
            profile.full_name = studentResult.data.full_name;
            profile.class_instance_id = studentResult.data.class_instance_id;
          }
        }
      } else if (userData.role === 'admin' || userData.role === 'superadmin') {
        // Find admin by auth_user_id
        const { data: adminRows } = await supabase
          .from('admin')
          .select('id')
          .eq('auth_user_id', user.id)
          .limit(1);
        
        if (adminRows && adminRows.length > 0) {
          const { data: adminData } = await supabase
            .from('admin')
            .select('*')
            .eq('id', adminRows[0].id)
            .maybeSingle();

          if (adminData) {
            const { normalizeAdmin } = await import('../lib/normalize');
            const normalized = normalizeAdmin(adminData);
            if (normalized.data) {
              profile.admin = normalized.data;
              profile.full_name = normalized.data.full_name;
              profile.email = normalized.data.email;
              profile.phone = normalized.data.phone?.toString() || null;
            }
          }
        }
      }

      if (userData.class_instance_id) {
        const classResult = await getClassDetails(userData.class_instance_id);
        if (classResult.data) {
          profile.class_instance = classResult.data;
        }
      }

      return profile;
    },
  },

  classes: {
    async getBySchool(schoolCode: string): Promise<ClassInstance[]> {
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section, school_code, academic_year_id, class_teacher_id')
        .eq('school_code', schoolCode)
        .order('grade', { ascending: true })
        .order('section', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async getById(classId: string): Promise<ClassInstance | null> {
      const { data, error } = await supabase
        .from('class_instances')
        .select('id, grade, section, school_code, academic_year_id, class_teacher_id')
        .eq('id', classId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  },

  attendance: {
    async getByClass(classId: string, date?: string): Promise<DomainAttendance[]> {
      const { getAttendanceForDate, getAttendanceOverview } = await import('../data/queries');
      
      if (date) {
        // Get class instance to find school_code
        const classResult = await getClassDetails(classId);
        if (classResult.error || !classResult.data) {
          throw new Error(classResult.error?.userMessage || 'Class not found');
        }
        
        const result = await getAttendanceForDate(classId, date, classResult.data.school_code);
        if (result.error) throw new Error(result.error.userMessage || 'Operation failed');
        return result.data || [];
      } else {
        // Get overview - need school_code and date range
        const classResult = await getClassDetails(classId);
        if (classResult.error || !classResult.data) {
          throw new Error(classResult.error?.userMessage || 'Class not found');
        }
        
        // Default to last 30 days
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const result = await getAttendanceOverview(classId, [startDate, endDate], classResult.data.school_code);
        if (result.error) throw new Error(result.error.userMessage || 'Operation failed');
        return result.data || [];
      }
    },

    async getBySchool(schoolCode: string, date?: string): Promise<DomainAttendance[]> {
      const { listClasses, getAttendanceForDate, getAttendanceOverview } = await import('../data/queries');
      
      const classesResult = await listClasses(schoolCode);
      if (classesResult.error || !classesResult.data) {
        throw new Error(classesResult.error?.userMessage || 'Failed to fetch classes');
      }

      if (classesResult.data.length === 0) return [];

      // Aggregate attendance from all classes
      const allAttendance: DomainAttendance[] = [];
      
      for (const classInstance of classesResult.data) {
        if (date) {
          const result = await getAttendanceForDate(classInstance.id, date, schoolCode);
          if (result.data) {
            allAttendance.push(...result.data);
          }
        } else {
          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const result = await getAttendanceOverview(classInstance.id, [startDate, endDate], schoolCode);
          if (result.data) {
            allAttendance.push(...result.data);
          }
        }
      }
      
      return allAttendance;
    },

    async getByStudent(studentId: string): Promise<DomainAttendance[]> {
      // Get student to find class_instance_id and school_code
      const studentResult = await getStudentDetails(studentId);
      if (studentResult.error || !studentResult.data) {
        throw new Error(studentResult.error?.userMessage || 'Student not found');
      }
      
      const student = studentResult.data;
      if (!student.class_instance_id || !student.school_code) {
        throw new Error('Student missing class_instance_id or school_code');
      }
      
      // Get last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { getAttendanceOverview } = await import('../data/queries');
      const result = await getAttendanceOverview(
        student.class_instance_id,
        [startDate, endDate],
        student.school_code
      );
      
      if (result.error) throw new Error(result.error.userMessage || 'Operation failed');
      
      // Filter to this student only
      return (result.data || []).filter(a => a.student_id === studentId);
    },

    async markAttendance(records: AttendanceInput[]): Promise<void> {
      // Batch process for better performance
      const existingRecords: { [key: string]: string } = {};
      
      // First, get all existing records in one query
      if (records.length > 0) {
        const studentIds = records.map(r => r.student_id);
        const classId = records[0].class_instance_id;
        const date = records[0].date;
        
        const { data: existing } = await supabase
          .from('attendance')
          .select('id, student_id')
          .eq('class_instance_id', classId)
          .eq('date', date)
          .in('student_id', studentIds);

        if (existing) {
          existing.forEach(record => {
            if (record.student_id) {
              existingRecords[record.student_id] = record.id;
            }
          });
        }
      }

      // Separate records into updates and inserts
      const updates: any[] = [];
      const inserts: AttendanceInput[] = [];

      records.forEach(record => {
        if (existingRecords[record.student_id]) {
          updates.push({
            id: existingRecords[record.student_id],
            status: record.status,
            marked_by: record.marked_by,
            marked_by_role_code: record.marked_by_role_code,
            updated_at: new Date().toISOString()
          });
        } else {
          inserts.push(record);
        }
      });

      // Batch update existing records
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('attendance')
          .upsert(updates);
        
        if (updateError) throw updateError;
      }

      // Batch insert new records
      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from('attendance')
          .insert(inserts);
        
        if (insertError) throw insertError;
      }
    },

    async markBulkAttendance(
      classId: string, 
      date: string, 
      status: 'present' | 'absent',
      markedBy: string,
      markedByRoleCode: string,
      schoolCode: string
    ): Promise<void> {
      // Get all students in the class
      const { data: students, error: studentsError } = await supabase
        .from('student')
        .select('id')
        .eq('class_instance_id', classId);

      if (studentsError) throw studentsError;
      if (!students || students.length === 0) return;

      const records: AttendanceInput[] = students.map(student => ({
        student_id: student.id,
        class_instance_id: classId,
        date,
        status,
        marked_by: markedBy,
        marked_by_role_code: markedByRoleCode,
        school_code: schoolCode
      }));

      await this.markAttendance(records);
    },

    async getAttendanceStats(
      studentId: string, 
      startDate: string, 
      endDate: string
    ): Promise<{
      totalDays: number;
      presentDays: number;
      absentDays: number;
      percentage: number;
    }> {
      const { data, error } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      const attendanceData = data || [];
      const totalDays = attendanceData.length;
      const presentDays = attendanceData.filter(a => a.status === 'present').length;
      const absentDays = attendanceData.filter(a => a.status === 'absent').length;
      const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

      return {
        totalDays,
        presentDays,
        absentDays,
        percentage: Math.round(percentage * 100) / 100
      };
    },

    async getClassAttendanceSummary(
      classId: string,
      startDate: string,
      endDate: string
    ): Promise<{
      studentId: string;
      studentName: string;
      studentCode: string;
      totalDays: number;
      presentDays: number;
      absentDays: number;
      percentage: number;
    }[]> {
      // Get all students in the class
      const { data: students, error: studentsError } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .eq('class_instance_id', classId);

      if (studentsError) throw studentsError;
      if (!students || students.length === 0) return [];

      // Get attendance data for all students, filtered by class_instance_id
      const studentIds = students.map(s => s.id);
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .in('student_id', studentIds)
        .eq('class_instance_id', classId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (attendanceError) throw attendanceError;

      // Calculate stats for each student
      return students.map(student => {
        const studentAttendance = attendanceData?.filter(a => a.student_id === student.id) || [];
        const totalDays = studentAttendance.length;
        const presentDays = studentAttendance.filter(a => a.status === 'present').length;
        const absentDays = studentAttendance.filter(a => a.status === 'absent').length;
        const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

        return {
          studentId: student.id,
          studentName: student.full_name,
          studentCode: student.student_code,
          totalDays,
          presentDays,
          absentDays,
          percentage: Math.round(percentage * 100) / 100
        };
      });
    },
  },

  fees: {
    async getStudentPayments(studentId: string): Promise<FeePayment[]> {
      const { data, error } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async getClassPayments(classId: string): Promise<FeePayment[]> {
      const { data: students } = await supabase
        .from('student')
        .select('id')
        .eq('class_instance_id', classId);

      if (!students || students.length === 0) return [];

      const studentIds = students.map(s => s.id);

      const { data, error } = await supabase
        .from('fee_payments')
        .select('*')
        .in('student_id', studentIds)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async getSchoolPayments(schoolCode: string): Promise<FeePayment[]> {
      const { data: students } = await supabase
        .from('student')
        .select('id')
        .eq('school_code', schoolCode);

      if (!students || students.length === 0) return [];

      const studentIds = students.map(s => s.id);

      const { data, error } = await supabase
        .from('fee_payments')
        .select('*')
        .in('student_id', studentIds)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  },

  timetable: {
    async getByClass(classId: string, date?: string): Promise<DomainTimetableSlot[]> {
      const classResult = await getClassDetails(classId);
      if (classResult.error || !classResult.data) {
        throw new Error(classResult.error?.userMessage || 'Class not found');
      }
      
      const targetDate = date || new Date().toISOString().split('T')[0];
      const result = await getTimetable(classId, targetDate, classResult.data.school_code);
      if (result.error) throw new Error(result.error.userMessage || 'Operation failed');
      return result.data || [];
    },

    async getBySchool(schoolCode: string): Promise<DomainTimetableSlot[]> {
      const classesResult = await listClasses(schoolCode);
      if (classesResult.error || !classesResult.data || classesResult.data.length === 0) {
        return [];
      }

      const allSlots: DomainTimetableSlot[] = [];
      const today = new Date().toISOString().split('T')[0];
      
      for (const classInstance of classesResult.data) {
        const result = await getTimetable(classInstance.id, today, schoolCode);
        if (result.data) {
          allSlots.push(...result.data);
        }
      }
      
      return allSlots;
    },
  },

  students: {
    async getByClass(classId: string): Promise<Pick<DomainStudent, 'id' | 'full_name' | 'student_code' | 'class_instance_id' | 'school_code'>[]> {
      const { listStudents } = await import('../data/queries');
      const classResult = await getClassDetails(classId);
      if (classResult.error || !classResult.data) {
        throw new Error(classResult.error?.userMessage || 'Class not found');
      }
      
      const result = await listStudents(classId, classResult.data.school_code);
      if (result.error) throw new Error(result.error.userMessage || 'Operation failed');
      return (result.data || []).map(s => ({
        id: s.id,
        full_name: s.full_name,
        student_code: s.student_code,
        class_instance_id: s.class_instance_id,
        school_code: s.school_code,
      }));
    },

    async getBySchool(schoolCode: string): Promise<Pick<DomainStudent, 'id' | 'full_name' | 'student_code' | 'class_instance_id' | 'school_code'>[]> {
      // Get all classes for school, then get students from each
      const classesResult = await listClasses(schoolCode);
      if (classesResult.error || !classesResult.data) {
        throw new Error(classesResult.error?.userMessage || 'Failed to fetch classes');
      }
      
      const allStudents: Pick<DomainStudent, 'id' | 'full_name' | 'student_code' | 'class_instance_id' | 'school_code'>[] = [];
      const { listStudents } = await import('../data/queries');
      
      for (const classInstance of classesResult.data) {
        const result = await listStudents(classInstance.id, schoolCode);
        if (result.data) {
          allStudents.push(...result.data.map(s => ({
            id: s.id,
            full_name: s.full_name,
            student_code: s.student_code,
            class_instance_id: s.class_instance_id,
            school_code: s.school_code,
          })));
        }
      }
      
      return allStudents;
    },
  },

  resources: {
    async getByClass(classId?: string, schoolCode?: string): Promise<DomainLearningResource[]> {
      if (!classId || !schoolCode) {
        throw new Error('classId and schoolCode are required');
      }
      
      const result = await listResources(classId, schoolCode);
      if (result.error) throw new Error(result.error.userMessage || 'Operation failed');
      return result.data || [];
    },

    async getAll(schoolCode: string, limit?: number): Promise<DomainLearningResource[]> {
      // Get all classes, then get resources from each
      const classesResult = await listClasses(schoolCode);
      if (classesResult.error || !classesResult.data) {
        throw new Error(classesResult.error?.userMessage || 'Failed to fetch classes');
      }
      
      const allResources: DomainLearningResource[] = [];
      
      for (const classInstance of classesResult.data) {
        const result = await listResources(classInstance.id, schoolCode, undefined, { to: limit ? limit - allResources.length : 99 });
        if (result.data) {
          allResources.push(...result.data);
          if (limit && allResources.length >= limit) break;
        }
      }
      
      return allResources.slice(0, limit);
    },

    async getPaginated(schoolCode: string, offset: number, limit: number): Promise<LearningResource[]> {
      const { data, error } = await supabase
        .from('learning_resources')
        .select('*')
        .eq('school_code', schoolCode)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    },

    async create(resourceData: Omit<LearningResource, 'id' | 'created_at' | 'updated_at'>): Promise<LearningResource> {
      // Ensure content_url is provided (required by database)
      if (!resourceData.content_url) {
        throw new Error('content_url is required');
      }
      const { data, error } = await supabase
        .from('learning_resources')
        .insert([{
          ...resourceData,
          content_url: resourceData.content_url, // TypeScript now knows this is not null
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async update(id: string, updates: Partial<LearningResource>): Promise<LearningResource> {
      // Filter out null content_url if provided (database doesn't accept null)
      const updateData: Partial<DomainLearningResource> = { ...updates };
      if ('content_url' in updateData && updateData.content_url === null) {
        delete updateData.content_url;
      }
      const { data, error } = await supabase
        .from('learning_resources')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(id: string): Promise<void> {
      const { error } = await supabase
        .from('learning_resources')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
  },

  calendar: {
    async getByClass(classId: string): Promise<CalendarEvent[]> {
      const { data, error } = await supabase
        .from('school_calendar_events')
        .select('*')
        .eq('class_instance_id', classId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async getBySchool(schoolCode: string): Promise<CalendarEvent[]> {
      const { data, error } = await supabase
        .from('school_calendar_events')
        .select('*')
        .eq('school_code', schoolCode)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  },

  tasks: {
    async getByUser(userId: string): Promise<DomainTask[]> {
      // Get user's class_instance_id and academic_year_id
      const userResult = await getCurrentUserContext();
      if (userResult.error || !userResult.data) {
        throw new Error(userResult.error?.userMessage || 'User not found');
      }
      
      const user = userResult.data;
      if (!user.class_instance_id || !user.school_code) {
        throw new Error('User missing class_instance_id or school_code');
      }
      
      // Get active academic year
      const ayResult = await getActiveAcademicYear(user.school_code);
      if (ayResult.error || !ayResult.data) {
        throw new Error(ayResult.error?.userMessage || 'Active academic year not found');
      }
      
      const result = await listTasks(user.class_instance_id, ayResult.data.id, user.school_code);
      if (result.error) throw new Error(result.error.userMessage || 'Operation failed');
      
      // Filter to tasks created by this user
      return (result.data || []).filter(t => t.created_by === userId);
    },

    async getBySchool(schoolCode: string): Promise<DomainTask[]> {
      // Get active academic year
      const ayResult = await getActiveAcademicYear(schoolCode);
      if (ayResult.error || !ayResult.data) {
        throw new Error(ayResult.error?.userMessage || 'Active academic year not found');
      }
      
      // Get all classes, then get tasks from each
      const classesResult = await listClasses(schoolCode);
      if (classesResult.error || !classesResult.data) {
        throw new Error(classesResult.error?.userMessage || 'Failed to fetch classes');
      }
      
      const allTasks: DomainTask[] = [];
      
      for (const classInstance of classesResult.data) {
        const result = await listTasks(classInstance.id, ayResult.data.id, schoolCode);
        if (result.data) {
          allTasks.push(...result.data);
        }
      }
      
      return allTasks;
    },
  },

  subjects: {
    async getBySchool(schoolCode: string) {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, subject_name, school_code')
        .eq('school_code', schoolCode)
        .order('subject_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  },

  admin: {
    async getBySchool(schoolCode: string) {
      const { data, error } = await supabase
        .from('admin')
        .select('id, full_name, email, phone, role, school_code')
        .eq('school_code', schoolCode)
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  },

  // ==========================================
  // TEST MANAGEMENT
  // ==========================================

  tests: {
    async getBySchool(schoolCode: string, classInstanceId?: string) {
      let query = supabase
        .from('tests')
        .select(`
          *,
          class_instances!inner(
            id,
            grade,
            section,
            school_code
          ),
          subjects(
            id,
            subject_name
          )
        `)
        .eq('school_code', schoolCode)
        .order('created_at', { ascending: false });

      if (classInstanceId) {
        query = query.eq('class_instance_id', classInstanceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },

    async getById(testId: string) {
      const { data, error } = await supabase
        .from('tests')
        .select(`
          *,
          class_instances!inner(
            id,
            grade,
            section,
            school_code
          ),
          subjects(
            id,
            subject_name
          )
        `)
        .eq('id', testId)
        .single();

      if (error) throw error;
      return data;
    },

    async create(testData: any) {
      const { data, error } = await supabase
        .from('tests')
        .insert([testData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async update(testId: string, testData: any) {
      const { data, error } = await supabase
        .from('tests')
        .update(testData)
        .eq('id', testId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(testId: string) {
      const { error } = await supabase
        .from('tests')
        .delete()
        .eq('id', testId);

      if (error) throw error;
      return true;
    },

    async getWithStats(schoolCode: string, classInstanceId?: string) {
      const tests = await this.getBySchool(schoolCode, classInstanceId);

      // Get question counts and marks info for each test
      const testsWithStats = await Promise.all(
        tests.map(async (test: any) => {
          let questionCount = 0;
          let marksUploaded = 0;
          let totalStudents = 0;
          let attemptsCount = 0;

          if (test.test_mode === 'online') {
            // Get question count
            const { count: qCount } = await supabase
              .from('test_questions')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);
            questionCount = qCount || 0;

            // Get attempts count
            const { count: aCount } = await supabase
              .from('test_attempts')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);
            attemptsCount = aCount || 0;
          } else if (test.test_mode === 'offline') {
            // Get marks uploaded count
            const { count: mCount } = await supabase
              .from('test_marks')
              .select('*', { count: 'exact', head: true })
              .eq('test_id', test.id);
            marksUploaded = mCount || 0;
          }

          // Get total students in class
          const { count: sCount } = await supabase
            .from('student')
            .select('*', { count: 'exact', head: true })
            .eq('class_instance_id', test.class_instance_id);
          totalStudents = sCount || 0;

          return {
            ...test,
            class_name: `Grade ${test.class_instances?.grade} - ${test.class_instances?.section}`,
            subject_name: test.subjects?.subject_name || 'Unknown',
            question_count: questionCount,
            marks_uploaded: marksUploaded,
            total_students: totalStudents,
            attempts_count: attemptsCount,
          };
        })
      );

      return testsWithStats;
    },
  },

  testQuestions: {
    async getByTest(testId: string) {
      const { data, error } = await supabase
        .from('test_questions')
        .select('*')
        .eq('test_id', testId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    async create(questionData: any) {
      const { data, error } = await supabase
        .from('test_questions')
        .insert([questionData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async update(questionId: string, questionData: any) {
      const { data, error } = await supabase
        .from('test_questions')
        .update(questionData)
        .eq('id', questionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(questionId: string) {
      const { error } = await supabase
        .from('test_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
      return true;
    },

    async reorder(testId: string, questionIds: string[]) {
      // Update order_index for each question
      const updates = questionIds.map((id, index) =>
        supabase
          .from('test_questions')
          .update({ order_index: index })
          .eq('id', id)
      );

      await Promise.all(updates);
      return true;
    },
  },

  testMarks: {
    async getByTest(testId: string) {
      const { data, error } = await supabase
        .from('test_marks')
        .select(`
          *,
          student:student!inner(
            id,
            full_name,
            student_code
          )
        `)
        .eq('test_id', testId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async getByStudent(studentId: string) {
      const { data, error } = await supabase
        .from('test_marks')
        .select(`
          *,
          tests!inner(
            id,
            title,
            test_type,
            test_date,
            test_mode,
            max_marks
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async create(markData: any) {
      const { data, error } = await supabase
        .from('test_marks')
        .insert([markData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async createBulk(marksData: any[]) {
      const { data, error } = await supabase
        .from('test_marks')
        .upsert(marksData, {
          onConflict: 'test_id,student_id',
          ignoreDuplicates: false,
        })
        .select();

      if (error) throw error;
      return data || [];
    },

    async update(markId: string, markData: any) {
      const { data, error } = await supabase
        .from('test_marks')
        .update(markData)
        .eq('id', markId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(markId: string) {
      const { error } = await supabase
        .from('test_marks')
        .delete()
        .eq('id', markId);

      if (error) throw error;
      return true;
    },
  },

  testAttempts: {
    async getByTest(testId: string) {
      const { data, error } = await supabase
        .from('test_attempts')
        .select(`
          *,
          student:student!inner(
            id,
            full_name,
            student_code
          )
        `)
        .eq('test_id', testId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async getByStudent(studentId: string, testId?: string) {
      let query = supabase
        .from('test_attempts')
        .select(`
          *,
          tests!inner(
            id,
            title,
            test_type,
            test_date,
            time_limit_seconds
          )
        `)
        .eq('student_id', studentId)
        .order('started_at', { ascending: false });

      if (testId) {
        query = query.eq('test_id', testId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },

    async create(attemptData: any) {
      const { data, error } = await supabase
        .from('test_attempts')
        .insert([attemptData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async update(attemptId: string, attemptData: any) {
      const { data, error } = await supabase
        .from('test_attempts')
        .update(attemptData)
        .eq('id', attemptId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async submit(attemptId: string, finalAnswers: any, earnedPoints: number, totalPoints: number) {
      const { data, error } = await supabase
        .from('test_attempts')
        .update({
          answers: finalAnswers,
          status: 'completed',
          completed_at: new Date().toISOString(),
          earned_points: earnedPoints,
          total_points: totalPoints,
        })
        .eq('id', attemptId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  },
};
