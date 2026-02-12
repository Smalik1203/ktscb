import { supabase } from '../lib/supabase';
import { mapError } from './errorMapper';
import { DB } from '../types/db.constants';
import type {
  Student,
  Admin,
  ClassInstance,
  Attendance,
  AttendanceInsert,
  FeeStudentPlan,
  FeeStudentPlanItem,
  FeePayment,
  FeePaymentInsert,
  FeeComponentType,
  LearningResource,
  Test,
  TestQuestion,
  TimetableSlot,
  CalendarEvent,
  Task,
  User,
  AcademicYear,
  Subject,
} from '../types/database.types';
import {
  normalizeUser,
  normalizeStudent,
  normalizeStudents,
  normalizeAdmin,
  normalizeClassInstance,
  normalizeClassInstances,
  normalizeSubject,
  normalizeSubjects,
  normalizeTimetableSlot,
  normalizeTimetableSlots,
  normalizeAttendance,
  normalizeAttendances,
  normalizeTask,
  normalizeTasks,
  normalizeTest,
  normalizeTestQuestion,
  normalizeFeePayment,
  normalizeFeePayments,
  normalizeFeeStudentPlanWithItems,
  normalizeAcademicYear,
  normalizeCalendarEvent,
  normalizeLearningResource,
  normalizeLearningResources,
  type DomainUser,
  type DomainStudent,
  type DomainAdmin,
  type DomainClassInstance,
  type DomainSubject,
  type DomainTimetableSlot,
  type DomainAttendance,
  type DomainTask,
  type DomainTest,
  type DomainTestQuestion,
  type DomainFeePayment,
  type DomainFeeStudentPlan,
  type DomainFeeStudentPlanItem,
  type DomainAcademicYear,
  type DomainCalendarEvent,
  type DomainLearningResource,
  type DomainFeeComponentType,
} from '../lib/normalize';
import { FeeComponentTypeSchema, safeParse } from '../lib/domain-schemas';

export interface QueryResult<T> {
  data: T | null;
  error: ReturnType<typeof mapError> | null;
  warnings?: string[];
}

type StudentLite = Pick<DomainStudent,
  'id' | 'student_code' | 'full_name' | 'email' | 'phone' | 'class_instance_id' | 'school_code' | 'created_at'
>;

// ==================== AUTH & CONTEXT ====================

export async function getCurrentUserContext(options?: { signal?: AbortSignal }): Promise<QueryResult<{
  auth_id: string;
  role: string;
  school_code: string | null;
  class_instance_id: string | null;
}>> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        data: null,
        error: mapError(authError || new Error('No user found'), { queryName: 'getCurrentUserContext' }),
      };
    }
    
    // Query the custom users table to get profile data
    const { data, error } = await supabase
      .from(DB.tables.users)
      .select('id, role, school_code, class_instance_id')
      .eq('id', user.id)
      .maybeSingle();
    
    if (error) {
      // PGRST116 is "not found" - treat as error for user context
      return {
        data: null,
        error: mapError(error, { queryName: 'getCurrentUserContext', table: 'users' }),
      };
    }
    
    // If no data found, this is an error - user should exist
    if (!data) {
      return {
        data: null,
        error: mapError(new Error('User profile not found'), { queryName: 'getCurrentUserContext', table: 'users' }),
      };
    }
    
    return {
      data: {
        auth_id: user.id,
        role: data.role,
        school_code: data.school_code,
        class_instance_id: data.class_instance_id,
      },
      error: null,
    };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getCurrentUserContext' });
    return { data: null, error: mappedError };
  }
}

export async function getUserProfile(userId: string, options?: { signal?: AbortSignal }): Promise<QueryResult<DomainUser>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.users)
      .select('id, full_name, email, phone, role, school_code, school_name, created_at, class_instance_id')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'getUserProfile', table: 'users' }),
      };
    }
    
    const normalized = normalizeUser(data);
    if (normalized.error) {
      return {
        data: null,
        error: mapError(new Error(normalized.error), { queryName: 'getUserProfile' }),
        warnings: normalized.warnings,
      };
    }
    
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getUserProfile' });
    return { data: null, error: mappedError };
  }
}

// ==================== ACADEMIC YEARS ====================

export async function getActiveAcademicYear(schoolCode: string, options?: { signal?: AbortSignal }): Promise<QueryResult<DomainAcademicYear>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.academicYears)
      .select('id, school_code, school_name, year_start, year_end, is_active, start_date, end_date')
      .eq(DB.columns.schoolCode, schoolCode)
      .eq('is_active', true)
      .maybeSingle();
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'getActiveAcademicYear', table: 'academic_years' }),
      };
    }
    
    const normalized = normalizeAcademicYear(data);
    if (normalized.error) {
      return {
        data: null,
        error: mapError(new Error(normalized.error), { queryName: 'getActiveAcademicYear' }),
        warnings: normalized.warnings,
      };
    }
    
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getActiveAcademicYear' });
    return { data: null, error: mappedError };
  }
}

export async function listAcademicYears(schoolCode: string, options?: { signal?: AbortSignal; from?: number; to?: number }): Promise<QueryResult<DomainAcademicYear[]>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.academicYears)
      .select('id, school_code, school_name, year_start, year_end, is_active, start_date, end_date')
      .eq(DB.columns.schoolCode, schoolCode)
      .order('year_start', { ascending: false })
      .range(options?.from ?? 0, options?.to ?? 99);
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'listAcademicYears', table: 'academic_years' }),
      };
    }
    
    const normalized: DomainAcademicYear[] = [];
    const warnings: string[] = [];
    
    if (data) {
      for (const item of data) {
        const result = normalizeAcademicYear(item);
        if (result.data) {
          normalized.push(result.data);
          warnings.push(...result.warnings);
        } else if (result.error) {
          warnings.push(`Skipped invalid academic year: ${result.error}`);
        }
      }
    }
    
    return { data: normalized, error: null, warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'listAcademicYears' });
    return { data: null, error: mappedError };
  }
}

// ==================== CLASSES ====================

export async function listClasses(
  schoolCode: string,
  academicYearId?: string,
  options?: { signal?: AbortSignal; from?: number; to?: number }
): Promise<QueryResult<DomainClassInstance[]>> {
  try {
    let query = supabase
      .from(DB.tables.classInstances)
      .select('id, school_code, academic_year_id, class_id, class_teacher_id, grade, section, created_by, created_at')
      .eq(DB.columns.schoolCode, schoolCode)
      .order('grade', { ascending: true })
      .order('section', { ascending: true });
    
    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }
    
    const { data, error } = await query
      .range(options?.from ?? 0, options?.to ?? 199);
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'listClasses', table: 'class_instances' }),
      };
    }
    
    const normalized = normalizeClassInstances(data);
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'listClasses' });
    return { data: null, error: mappedError };
  }
}

export async function getClassDetails(classInstanceId: string, options?: { signal?: AbortSignal }): Promise<QueryResult<DomainClassInstance>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.classInstances)
      .select('id, school_code, academic_year_id, class_id, class_teacher_id, grade, section, created_by, created_at')
      .eq('id', classInstanceId)
      .maybeSingle();
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'getClassDetails', table: 'class_instances' }),
      };
    }
    
    const normalized = normalizeClassInstance(data);
    if (normalized.error) {
      return {
        data: null,
        error: mapError(new Error(normalized.error), { queryName: 'getClassDetails' }),
        warnings: normalized.warnings,
      };
    }
    
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getClassDetails' });
    return { data: null, error: mappedError };
  }
}

// ==================== STUDENTS ====================

export async function listAdmins(
  schoolCode: string
): Promise<QueryResult<DomainAdmin[]>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.admin)
      .select('id, admin_code, full_name, email, phone, role, school_code, school_name, auth_user_id, created_at')
      .eq(DB.columns.schoolCode, schoolCode)
      .order('full_name');

    if (error) {
      return { data: null, error: mapError(error, { queryName: 'listAdmins', table: 'admin' }) };
    }

    const normalized: DomainAdmin[] = [];
    const warnings: string[] = [];
    
    if (data) {
      for (const item of data) {
        const result = normalizeAdmin(item);
        if (result.data) {
          normalized.push(result.data);
          warnings.push(...result.warnings);
        } else if (result.error) {
          warnings.push(`Skipped invalid admin: ${result.error}`);
        }
      }
    }

    return { data: normalized, error: null, warnings };
  } catch (error) {
    return { data: null, error: mapError(error, { queryName: 'listAdmins', table: 'admin' }) };
  }
}

export async function listStudents(
  classInstanceId: string,
  schoolCode: string,
  options?: { signal?: AbortSignal; from?: number; to?: number; limit?: number; search?: string }
): Promise<QueryResult<StudentLite[]>> {
  try {
    const limit = options?.limit ?? 50; // Default to 50 (was 499)
    const from = options?.from ?? 0;
    const to = from + limit - 1;

    let query = supabase
      .from(DB.tables.student)
      .select('id, student_code, full_name, email, phone, class_instance_id, school_code, created_at')
      .eq(DB.columns.classInstanceId, classInstanceId)
      .eq(DB.columns.schoolCode, schoolCode)
      .order('full_name', { ascending: true })
      .range(from, to);

    const search = options?.search?.trim();
    if (search) {
      const filter = [
        `full_name.ilike.%${search}%`,
        `email.ilike.%${search}%`,
        `student_code.ilike.%${search}%`,
        `phone.ilike.%${search}%`,
      ].join(',');
      query = query.or(filter);
    }

    const { data, error } = await query;
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'listStudents', table: 'student' }),
      };
    }
    
    // Normalize students and extract lite fields
    // Note: We're only selecting a subset of fields, so we need to handle partial data
    const normalized: StudentLite[] = [];
    const warnings: string[] = [];
    
    if (data) {
      for (const item of data) {
        // Create a minimal student object with required fields for normalization
        const fullStudent = {
          ...item,
          auth_user_id: null,
          created_by: item.created_at ? 'system' : '',
          parent_phone: null,
          role: 'student' as const,
          school_name: item.school_code || '',
        };
        
        const result = normalizeStudent(fullStudent);
        if (result.data) {
          normalized.push({
            id: result.data.id,
            student_code: result.data.student_code,
            full_name: result.data.full_name,
            email: result.data.email,
            phone: result.data.phone,
            class_instance_id: result.data.class_instance_id,
            school_code: result.data.school_code,
            created_at: result.data.created_at,
          });
          warnings.push(...result.warnings);
        } else if (result.error) {
          warnings.push(`Skipped invalid student: ${result.error}`);
        }
      }
    }
    
    return { data: normalized, error: null, warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'listStudents' });
    return { data: null, error: mappedError };
  }
}

export async function getStudentDetails(studentId: string, options?: { signal?: AbortSignal }): Promise<QueryResult<DomainStudent>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.student)
      .select('id, student_code, full_name, email, phone, parent_phone, school_code, school_name, class_instance_id, auth_user_id, role, created_at, created_by')
      .eq('id', studentId)
      .maybeSingle();
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'getStudentDetails', table: 'student' }),
      };
    }
    
    const normalized = normalizeStudent(data);
    if (normalized.error) {
      return {
        data: null,
        error: mapError(new Error(normalized.error), { queryName: 'getStudentDetails' }),
        warnings: normalized.warnings,
      };
    }
    
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getStudentDetails' });
    return { data: null, error: mappedError };
  }
}

// ==================== ATTENDANCE ====================

export async function getAttendanceForDate(
  classInstanceId: string,
  date: string,
  schoolCode: string,
  options?: { signal?: AbortSignal; from?: number; to?: number }
): Promise<QueryResult<DomainAttendance[]>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.attendance)
      .select('id, student_id, class_instance_id, date, status, marked_by, marked_by_role_code, school_code, created_at, updated_at')
      .eq(DB.columns.classInstanceId, classInstanceId)
      .eq('date', date)
      .eq(DB.columns.schoolCode, schoolCode)
      .range(options?.from ?? 0, options?.to ?? 499);
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'getAttendanceForDate', table: 'attendance' }),
      };
    }
    
    // Type guard to ensure data is an array
    if (!Array.isArray(data)) {
      return {
        data: null,
        error: mapError(new Error('Invalid data format'), { queryName: 'getAttendanceForDate' }),
      };
    }
    
    const normalized = normalizeAttendances(data);
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getAttendanceForDate' });
    return { data: null, error: mappedError };
  }
}

export async function getAttendanceOverview(
  classInstanceId: string,
  dateRange: [string, string],
  schoolCode: string,
  options?: { signal?: AbortSignal; from?: number; to?: number; limit?: number }
): Promise<QueryResult<DomainAttendance[]>> {
  try {
    const [startDate, endDate] = dateRange;
    const limit = options?.limit ?? 50; // Default to 50 (was 999)
    const from = options?.from ?? 0;
    const to = from + limit - 1;
    
    const { data, error } = await supabase
      .from(DB.tables.attendance)
      .select('id, student_id, class_instance_id, status, date, marked_by, created_at, school_code, marked_by_role_code, updated_at')
      .eq(DB.columns.classInstanceId, classInstanceId)
      .eq(DB.columns.schoolCode, schoolCode)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .range(from, to);
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'getAttendanceOverview', table: 'attendance' }),
      };
    }
    
    const normalized = normalizeAttendances(data);
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getAttendanceOverview' });
    return { data: null, error: mappedError };
  }
}

export async function saveAttendance(
  records: AttendanceInsert[]
): Promise<QueryResult<Attendance[]>> {
  try {
    if (records.length === 0) {
      return { data: [], error: null };
    }
    
    // Delete existing attendance for this class and date
    const firstRecord = records[0];
    if (!firstRecord.class_instance_id || !firstRecord.school_code) {
      throw new Error('class_instance_id and school_code are required');
    }
    const class_instance_id = firstRecord.class_instance_id;
    const school_code = firstRecord.school_code;
    const date = firstRecord.date;
    if (!date) {
      throw new Error('date is required');
    }
    await supabase
      .from(DB.tables.attendance)
      .delete()
      .eq(DB.columns.classInstanceId, class_instance_id)
      .eq('date', date)
      .eq(DB.columns.schoolCode, school_code);
    
    // Insert new records
    const { data, error } = await supabase
      .from(DB.tables.attendance)
      .insert(records)
      .select('id, student_id, class_instance_id, status, date, marked_by, created_at, school_code, marked_by_role_code, updated_at');
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'saveAttendance', table: 'attendance', operation: 'insert' }),
      };
    }
    
    return { data: data || [], error: null };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'saveAttendance' });
    return { data: null, error: mappedError };
  }
}

export async function checkHoliday(
  schoolCode: string,
  date: string,
  classInstanceId?: string,
  options?: { signal?: AbortSignal }
): Promise<QueryResult<DomainCalendarEvent | null>> {
  try {
    let query = supabase
      .from(DB.tables.schoolCalendarEvents)
      .select('id, school_code, academic_year_id, title, description, event_type, start_date, end_date, is_all_day, start_time, end_time, is_recurring, recurrence_pattern, recurrence_interval, recurrence_end_date, color, is_active, created_by, created_at, updated_at, class_instance_id')
      .eq(DB.columns.schoolCode, schoolCode)
      .eq('start_date', date)
      .eq('is_active', true);
    
    if (classInstanceId) {
      query = query.or(`class_instance_id.is.null,class_instance_id.eq.${classInstanceId}`);
    } else {
      query = query.is('class_instance_id', null);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'checkHoliday', table: 'school_calendar_events' }),
      };
    }
    
    if (!data) {
      return { data: null, error: null };
    }
    
    const normalized = normalizeCalendarEvent(data);
    if (normalized.error) {
      return {
        data: null,
        error: mapError(new Error(normalized.error), { queryName: 'checkHoliday' }),
        warnings: normalized.warnings,
      };
    }
    
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'checkHoliday' });
    return { data: null, error: mappedError };
  }
}

// ==================== FEES ====================

export async function getStudentFees(
  studentId: string,
  academicYearId: string,
  schoolCode: string
): Promise<QueryResult<{
  plan: (DomainFeeStudentPlan & { items: DomainFeeStudentPlanItem[] }) | null;
  payments: DomainFeePayment[];
  totalDue: number;
  totalPaid: number;
  balance: number;
}>> {
  try {
    // Get student's fee plan with items
    const { data: planData, error: planError } = await supabase
      .from(DB.tables.feeStudentPlans)
      .select(`
        id,
        school_code,
        student_id,
        class_instance_id,
        academic_year_id,
        status,
        created_by,
        created_at,
        items:${DB.tables.feeStudentPlanItems}(
          id,
          plan_id,
          component_type_id,
          quantity,
          meta,
          created_at,
          amount_inr,
          component:${DB.tables.feeComponentTypes}(
            id,
            school_code,
            code,
            name,
            is_recurring,
            period,
            is_optional,
            meta,
            created_by,
            created_at,
            default_amount_inr
          )
        )
      `)
      .eq('student_id', studentId)
      .eq(DB.columns.academicYearId, academicYearId)
      .eq(DB.columns.schoolCode, schoolCode)
      .eq('status', 'active')
      .maybeSingle();
    
    // Get all payments for this student
    const { data: paymentsData, error: paymentsError } = await supabase
      .from(DB.tables.feePayments)
      .select(`
        *,
        component_type:${DB.tables.feeComponentTypes}(*)
      `)
      .eq('student_id', studentId)
      .eq(DB.columns.schoolCode, schoolCode)
      .order('payment_date', { ascending: false });
    
    if (paymentsError) {
      return {
        data: null,
        error: mapError(paymentsError, { queryName: 'getStudentFees', table: 'fee_payments' }),
      };
    }
    
    // Normalize plan with items
    const normalizedPlan = planData ? normalizeFeeStudentPlanWithItems(planData as FeeStudentPlan & { items?: FeeStudentPlanItem[] }) : null;
    
    // Normalize payments
    const normalizedPayments = normalizeFeePayments(paymentsData);
    
    if (normalizedPayments.error) {
      return {
        data: null,
        error: mapError(new Error(normalizedPayments.error), { queryName: 'getStudentFees' }),
        warnings: normalizedPayments.warnings,
      };
    }
    
    // Calculate totals
    let totalDue = 0;
    if (normalizedPlan?.data?.items) {
      totalDue = normalizedPlan.data.items.reduce((sum, item) => {
        return sum + (item.amount_inr * item.quantity);
      }, 0);
    }
    
    const totalPaid = (normalizedPayments.data || []).reduce((sum, payment) => {
      return sum + payment.amount_inr;
    }, 0);
    
    const balance = totalDue - totalPaid;
    
    const warnings = [
      ...(normalizedPlan?.warnings || []),
      ...normalizedPayments.warnings,
    ];
    
    return {
      data: {
        plan: normalizedPlan?.data || null,
        payments: normalizedPayments.data || [],
        totalDue,
        totalPaid,
        balance,
      },
      error: null,
      warnings,
    };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getStudentFees' });
    return { data: null, error: mappedError };
  }
}

export async function getClassStudentsFees(
  classInstanceId: string,
  academicYearId: string,
  schoolCode: string
): Promise<QueryResult<{
  id: string;
  student_code: string;
  full_name: string;
  class_instance_id: string;
  feeDetails: {
    plan: (DomainFeeStudentPlan & { items: DomainFeeStudentPlanItem[] }) | null;
    payments: DomainFeePayment[];
    totalDue: number;
    totalPaid: number;
    balance: number;
  };
}[]>> {
  try {
    // Get all students in this class
    const { data: students, error: studentsError } = await supabase
      .from(DB.tables.student)
      .select('id, student_code, full_name, class_instance_id')
      .eq(DB.columns.classInstanceId, classInstanceId)
      .eq(DB.columns.schoolCode, schoolCode)
      .order('full_name', { ascending: true });
    
    if (studentsError) {
      return {
        data: null,
        error: mapError(studentsError, { queryName: 'getClassStudentsFees', table: 'student' }),
      };
    }
    
    if (!students || students.length === 0) {
      return { data: [], error: null };
    }
    
    const studentIds = students.map((s) => s.id);
    
    // Get all fee plans for these students
    const { data: plans } = await supabase
      .from(DB.tables.feeStudentPlans)
      .select(`
        id,
        school_code,
        student_id,
        class_instance_id,
        academic_year_id,
        status,
        created_by,
        created_at,
        items:${DB.tables.feeStudentPlanItems}(
          id,
          plan_id,
          component_type_id,
          quantity,
          meta,
          created_at,
          amount_inr
        )
      `)
      .in('student_id', studentIds)
      .eq(DB.columns.academicYearId, academicYearId)
      .eq(DB.columns.schoolCode, schoolCode)
      .eq('status', 'active');
    
    // Get all payments for these students
    const { data: payments } = await supabase
      .from(DB.tables.feePayments)
      .select('id, student_id, plan_id, component_type_id, payment_date, payment_method, transaction_id, receipt_number, remarks, school_code, created_by, created_at, updated_at, recorded_by_name, amount_inr, invoice_id, invoice_item_id, recorded_by_user_id, recorded_at')
      .in('student_id', studentIds)
      .eq(DB.columns.schoolCode, schoolCode);
    
    // Normalize payments
    const normalizedPayments = normalizeFeePayments(payments);
    if (normalizedPayments.error) {
      return {
        data: null,
        error: mapError(new Error(normalizedPayments.error), { queryName: 'getClassStudentsFees' }),
        warnings: normalizedPayments.warnings,
      };
    }
    const allPayments = normalizedPayments.data || [];
    
    // Combine student data with fee information
    const studentsWithFees: {
      id: string;
      student_code: string;
      full_name: string;
      class_instance_id: string;
      feeDetails: {
        plan: (DomainFeeStudentPlan & { items: DomainFeeStudentPlanItem[] }) | null;
        payments: DomainFeePayment[];
        totalDue: number;
        totalPaid: number;
        balance: number;
      };
    }[] = [];
    const warnings: string[] = [...normalizedPayments.warnings];
    
    for (const student of students) {
      if (!student.id || !student.student_code || !student.full_name) {
        warnings.push(`Skipped invalid student record`);
        continue;
      }
      
      const studentPlan = plans?.find((p) => p.student_id === student.id);
      const studentPayments = allPayments.filter((p) => p.student_id === student.id);
      
      let normalizedPlan: (DomainFeeStudentPlan & { items: DomainFeeStudentPlanItem[] }) | null = null;
      if (studentPlan) {
        const planResult = normalizeFeeStudentPlanWithItems(studentPlan as FeeStudentPlan & { items?: FeeStudentPlanItem[] });
        if (planResult.data) {
          normalizedPlan = planResult.data;
          warnings.push(...planResult.warnings);
        }
      }
      
      let totalDue = 0;
      if (normalizedPlan?.items) {
        totalDue = normalizedPlan.items.reduce((sum, item) => {
          return sum + (item.amount_inr * item.quantity);
        }, 0);
      }
      
      const totalPaid = studentPayments.reduce((sum, payment) => {
        return sum + payment.amount_inr;
      }, 0);
      
      const balance = totalDue - totalPaid;
      
      studentsWithFees.push({
        id: student.id,
        student_code: student.student_code,
        full_name: student.full_name,
        class_instance_id: student.class_instance_id || '',
        feeDetails: {
          plan: normalizedPlan,
          payments: studentPayments,
          totalDue,
          totalPaid,
          balance,
        }
      });
    }
    
    return { data: studentsWithFees, error: null, warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getClassStudentsFees' });
    return { data: null, error: mappedError };
  }
}

export async function getFeeComponentTypes(schoolCode: string, options?: { signal?: AbortSignal; from?: number; to?: number }): Promise<QueryResult<DomainFeeComponentType[]>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.feeComponentTypes)
      .select('id, school_code, code, name, is_recurring, period, is_optional, meta, created_by, created_at, default_amount_inr')
      .eq(DB.columns.schoolCode, schoolCode)
      .order('name', { ascending: true })
      .range(options?.from ?? 0, options?.to ?? 99);
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'getFeeComponentTypes', table: 'fee_component_types' }),
      };
    }
    
    const normalized: DomainFeeComponentType[] = [];
    const warnings: string[] = [];
    
    if (data) {
      for (const item of data) {
        const result = safeParse(FeeComponentTypeSchema, item, 'normalizeFeeComponentType');
        if (result.success) {
          normalized.push(result.data);
        } else {
          warnings.push(`Skipped invalid fee component type: ${result.error.message}`);
        }
      }
    }
    
    return { data: normalized, error: null, warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getFeeComponentTypes' });
    return { data: null, error: mappedError };
  }
}

export async function recordPayment(payment: FeePaymentInsert): Promise<QueryResult<DomainFeePayment>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.feePayments)
      .insert(payment)
      .select('id, student_id, plan_id, component_type_id, payment_date, payment_method, transaction_id, receipt_number, remarks, school_code, created_by, created_at, updated_at, recorded_by_name, amount_inr, invoice_id, invoice_item_id, recorded_by_user_id, recorded_at')
      .maybeSingle();
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'recordPayment', table: 'fee_payments', operation: 'insert' }),
      };
    }
    
    const normalized = normalizeFeePayment(data);
    if (normalized.error) {
      return {
        data: null,
        error: mapError(new Error(normalized.error), { queryName: 'recordPayment' }),
        warnings: normalized.warnings,
      };
    }
    
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'recordPayment' });
    return { data: null, error: mappedError };
  }
}

// ==================== RESOURCES & LEARNING ====================

export async function listResources(
  classInstanceId: string,
  schoolCode: string,
  subjectId?: string,
  options?: { signal?: AbortSignal; from?: number; to?: number }
): Promise<QueryResult<DomainLearningResource[]>> {
  try {
    let query = supabase
      .from(DB.tables.learningResources)
      .select('id, title, description, resource_type, content_url, file_size, school_code, class_instance_id, subject_id, uploaded_by, created_at, updated_at')
      .eq(DB.columns.classInstanceId, classInstanceId)
      .eq(DB.columns.schoolCode, schoolCode)
      .order('created_at', { ascending: false })
      .range(options?.from ?? 0, options?.to ?? 99);
    
    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'listResources', table: 'learning_resources' }),
      };
    }
    
    const normalized = normalizeLearningResources(data);
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'listResources' });
    return { data: null, error: mappedError };
  }
}

export async function listResourcesBySchool(
  schoolCode: string,
  subjectId?: string,
  options?: { signal?: AbortSignal; from?: number; to?: number }
): Promise<QueryResult<DomainLearningResource[]>> {
  try {
    let query = supabase
      .from(DB.tables.learningResources)
      .select('id, title, description, resource_type, content_url, file_size, school_code, class_instance_id, subject_id, uploaded_by, created_at, updated_at')
      .eq(DB.columns.schoolCode, schoolCode)
      .order('created_at', { ascending: false })
      .range(options?.from ?? 0, options?.to ?? 49);

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'listResourcesBySchool', table: 'learning_resources' }),
      };
    }

    const normalized = normalizeLearningResources(data);
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'listResourcesBySchool' });
    return { data: null, error: mappedError };
  }
}

export async function listQuizzes(
  classInstanceId: string,
  schoolCode: string,
  subjectId?: string,
  options?: { signal?: AbortSignal; from?: number; to?: number }
): Promise<QueryResult<DomainTest[]>> {
  try {
    let query = supabase
      .from(DB.tables.tests)
      .select('id, title, description, class_instance_id, subject_id, school_code, test_type, time_limit_seconds, created_by, created_at, allow_reattempts, chapter_id, test_mode, test_date, status, max_marks')
      .eq(DB.columns.classInstanceId, classInstanceId)
      .eq(DB.columns.schoolCode, schoolCode)
      .order('created_at', { ascending: false })
      .range(options?.from ?? 0, options?.to ?? 49);
    
    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'listQuizzes', table: 'tests' }),
      };
    }
    
    const normalized: DomainTest[] = [];
    const warnings: string[] = [];
    
    if (data) {
      for (const item of data) {
        const result = normalizeTest(item);
        if (result.data) {
          normalized.push(result.data);
          warnings.push(...result.warnings);
        } else if (result.error) {
          warnings.push(`Skipped invalid test: ${result.error}`);
        }
      }
    }
    
    return { data: normalized, error: null, warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'listQuizzes' });
    return { data: null, error: mappedError };
  }
}

export async function getQuizDetails(testId: string, options?: { signal?: AbortSignal }): Promise<QueryResult<{
  test: DomainTest;
  questions: DomainTestQuestion[];
}>> {
  try {
    const { data: test, error: testError } = await supabase
      .from(DB.tables.tests)
      .select('id, title, description, class_instance_id, subject_id, school_code, test_type, time_limit_seconds, created_by, created_at, allow_reattempts, chapter_id, test_mode, test_date, status, max_marks')
      .eq('id', testId)
      .maybeSingle();
    
    if (testError) {
      return {
        data: null,
        error: mapError(testError, { queryName: 'getQuizDetails', table: 'tests' }),
      };
    }
    
    if (!test) {
      return {
        data: null,
        error: mapError(new Error('Test not found'), { queryName: 'getQuizDetails', table: 'tests' }),
      };
    }
    
    const { data: questions, error: questionsError } = await supabase
      .from(DB.tables.testQuestions)
      .select('id, test_id, question_text, question_type, options, correct_index, correct_text, created_at, correct_answer, points, order_index')
      .eq('test_id', testId)
      .order('order_index', { ascending: true });
    
    if (questionsError) {
      return {
        data: null,
        error: mapError(questionsError, { queryName: 'getQuizDetails', table: 'test_questions' }),
      };
    }
    
    const normalizedTest = normalizeTest(test);
    if (normalizedTest.error) {
      return {
        data: null,
        error: mapError(new Error(normalizedTest.error), { queryName: 'getQuizDetails' }),
        warnings: normalizedTest.warnings,
      };
    }
    
    const normalizedQuestions: DomainTestQuestion[] = [];
    const warnings: string[] = [...normalizedTest.warnings];
    
    if (questions) {
      for (const question of questions) {
        const result = normalizeTestQuestion(question);
        if (result.data) {
          normalizedQuestions.push(result.data);
          warnings.push(...result.warnings);
        } else if (result.error) {
          warnings.push(`Skipped invalid question: ${result.error}`);
        }
      }
    }
    
    return {
      data: {
        test: normalizedTest.data!,
        questions: normalizedQuestions,
      },
      error: null,
      warnings,
    };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getQuizDetails' });
    return { data: null, error: mappedError };
  }
}

// ==================== TIMETABLE ====================

export async function getTimetable(
  classInstanceId: string,
  date: string,
  schoolCode: string,
  options?: { signal?: AbortSignal; from?: number; to?: number }
): Promise<QueryResult<DomainTimetableSlot[]>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.timetableSlots)
      .select(`
        *,
        subject:${DB.tables.subjects}(id, subject_name),
        teacher:${DB.tables.admin}!teacher_id(id, full_name)
      `)
      .eq(DB.columns.classInstanceId, classInstanceId)
      .eq('class_date', date)
      .eq(DB.columns.schoolCode, schoolCode)
      .order('period_number', { ascending: true })
      .order('start_time', { ascending: true })
      .range(options?.from ?? 0, options?.to ?? 49);
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'getTimetable', table: 'timetable_slots' }),
      };
    }
    
    // Extract base timetable slot data (without joins) for normalization
    const slots: TimetableSlot[] = (data || []).map((slot: TimetableSlot & { subject?: { id: string; subject_name: string } | null; teacher?: { id: string; full_name: string } | null }) => {
      const { subject, teacher, ...baseSlot } = slot;
      return baseSlot as TimetableSlot;
    });
    
    const normalized = normalizeTimetableSlots(slots);
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getTimetable' });
    return { data: null, error: mappedError };
  }
}

export async function getTimetableWeek(
  classInstanceId: string,
  startDate: string,
  schoolCode: string,
  options?: { signal?: AbortSignal; from?: number; to?: number }
): Promise<QueryResult<DomainTimetableSlot[]>> {
  try {
    // Calculate end date (7 days from start)
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endDate = end.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from(DB.tables.timetableSlots)
      .select(`
        *,
        subject:${DB.tables.subjects}(id, subject_name),
        teacher:${DB.tables.admin}!teacher_id(id, full_name)
      `)
      .eq(DB.columns.classInstanceId, classInstanceId)
      .eq(DB.columns.schoolCode, schoolCode)
      .gte('class_date', startDate)
      .lte('class_date', endDate)
      .order('class_date', { ascending: true })
      .order('period_number', { ascending: true })
      .range(options?.from ?? 0, options?.to ?? 299);
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'getTimetableWeek', table: 'timetable_slots' }),
      };
    }
    
    // Extract base timetable slot data (without joins) for normalization
    const slots: TimetableSlot[] = (data || []).map((slot: TimetableSlot & { subject?: { id: string; subject_name: string } | null; teacher?: { id: string; full_name: string } | null }) => {
      const { subject, teacher, ...baseSlot } = slot;
      return baseSlot as TimetableSlot;
    });
    
    const normalized = normalizeTimetableSlots(slots);
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'getTimetableWeek' });
    return { data: null, error: mappedError };
  }
}

// ==================== CALENDAR ====================

export async function listCalendarEvents(
  schoolCode: string,
  month: string,
  classInstanceId?: string,
  options?: { signal?: AbortSignal; from?: number; to?: number }
): Promise<QueryResult<DomainCalendarEvent[]>> {
  try {
    const [year, monthNum] = month.split('-');
    const startDate = `${year}-${monthNum}-01`;
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
    const endDate = `${year}-${monthNum}-${lastDay.toString().padStart(2, '0')}`;
    
    let query = supabase
      .from(DB.tables.schoolCalendarEvents)
      .select('id, school_code, academic_year_id, title, description, event_type, start_date, end_date, is_all_day, start_time, end_time, is_recurring, recurrence_pattern, recurrence_interval, recurrence_end_date, color, is_active, created_by, created_at, updated_at, class_instance_id')
      .eq(DB.columns.schoolCode, schoolCode)
      .eq('is_active', true)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .range(options?.from ?? 0, options?.to ?? 199);
    
    if (classInstanceId) {
      query = query.or(`class_instance_id.is.null,class_instance_id.eq.${classInstanceId}`);
    } else {
      query = query.is('class_instance_id', null);
    }
    
    const { data, error } = await query.order('start_date', { ascending: true });
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'listCalendarEvents', table: 'school_calendar_events' }),
      };
    }
    
    const normalized: DomainCalendarEvent[] = [];
    const warnings: string[] = [];
    
    if (data) {
      for (const item of data) {
        const result = normalizeCalendarEvent(item);
        if (result.data) {
          normalized.push(result.data);
          warnings.push(...result.warnings);
        } else if (result.error) {
          warnings.push(`Skipped invalid calendar event: ${result.error}`);
        }
      }
    }
    
    return { data: normalized, error: null, warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'listCalendarEvents' });
    return { data: null, error: mappedError };
  }
}

// ==================== TASKS ====================

export async function listTasks(
  classInstanceId: string,
  academicYearId: string,
  schoolCode: string
): Promise<QueryResult<DomainTask[]>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.tasks)
      .select('id, school_code, academic_year_id, class_instance_id, subject_id, title, description, priority, assigned_date, due_date, max_marks, instructions, attachments, is_active, created_by, created_at, updated_at')
      .eq(DB.columns.classInstanceId, classInstanceId)
      .eq(DB.columns.academicYearId, academicYearId)
      .eq(DB.columns.schoolCode, schoolCode)
      .eq('is_active', true)
      .order('due_date', { ascending: true })
      .range(0, 199);
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'listTasks', table: 'tasks' }),
      };
    }
    
    const normalized = normalizeTasks(data);
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'listTasks' });
    return { data: null, error: mappedError };
  }
}

// ==================== SUBJECTS ====================

export async function listSubjects(schoolCode: string, options?: { signal?: AbortSignal; from?: number; to?: number }): Promise<QueryResult<DomainSubject[]>> {
  try {
    const { data, error } = await supabase
      .from(DB.tables.subjects)
      .select('id, subject_name, school_code, created_by, created_at, subject_name_norm')
      .eq(DB.columns.schoolCode, schoolCode)
      .order('subject_name', { ascending: true })
      .range(options?.from ?? 0, options?.to ?? 199);
    
    if (error) {
      return {
        data: null,
        error: mapError(error, { queryName: 'listSubjects', table: 'subjects' }),
      };
    }
    
    const normalized = normalizeSubjects(data);
    return { data: normalized.data, error: null, warnings: normalized.warnings };
  } catch (err) {
    const mappedError = mapError(err, { queryName: 'listSubjects' });
    return { data: null, error: mappedError };
  }
}

