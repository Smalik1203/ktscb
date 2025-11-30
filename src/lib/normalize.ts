/**
 * Normalization Layer
 * 
 * Transforms raw Supabase responses into domain-safe types.
 * This layer ensures UI components always receive predictable data shapes,
 * handling null coalescing, type narrowing, and business rule validation.
 * 
 * Key responsibilities:
 * - Convert nullable DB fields to required domain fields when business logic requires it
 * - Provide sensible defaults for optional fields
 * - Validate data shape before it reaches UI
 * - Log normalization issues for debugging
 */

import type {
  User,
  Student,
  Admin,
  ClassInstance,
  Subject,
  TimetableSlot,
  Attendance,
  Task,
  Test,
  TestQuestion,
  FeeComponentType,
  FeeStudentPlan,
  FeeStudentPlanItem,
  FeePayment,
  AcademicYear,
  CalendarEvent,
  LearningResource,
} from '../types/database.types';

import {
  UserSchema,
  StudentSchema,
  AdminSchema,
  ClassInstanceSchema,
  SubjectSchema,
  TimetableSlotSchema,
  AttendanceSchema,
  TaskSchema,
  TestSchema,
  TestQuestionSchema,
  FeeComponentTypeSchema,
  FeeStudentPlanSchema,
  FeeStudentPlanItemSchema,
  FeePaymentSchema,
  AcademicYearSchema,
  CalendarEventSchema,
  LearningResourceSchema,
  safeParse,
  parseOrThrow,
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
  type DomainFeeComponentType,
  type DomainFeeStudentPlan,
  type DomainFeeStudentPlanItem,
  type DomainFeePayment,
  type DomainAcademicYear,
  type DomainCalendarEvent,
  type DomainLearningResource,
} from './domain-schemas';

// Re-export domain types for convenience
export type {
  DomainUser,
  DomainStudent,
  DomainAdmin,
  DomainClassInstance,
  DomainSubject,
  DomainTimetableSlot,
  DomainAttendance,
  DomainTask,
  DomainTest,
  DomainTestQuestion,
  DomainFeeComponentType,
  DomainFeeStudentPlan,
  DomainFeeStudentPlanItem,
  DomainFeePayment,
  DomainAcademicYear,
  DomainCalendarEvent,
  DomainLearningResource,
} from './domain-schemas';

// ==================== NORMALIZATION RESULT TYPES ====================

export interface NormalizeResult<T> {
  data: T | null;
  error: string | null;
  warnings: string[];
}

// ==================== NORMALIZATION FUNCTIONS ====================

/**
 * Normalize a single user record
 */
export function normalizeUser(raw: User | null): NormalizeResult<DomainUser> {
  if (!raw) {
    return { data: null, error: 'User data is null', warnings: [] };
  }

  const result = safeParse(UserSchema, raw, 'normalizeUser');
  
  if (!result.success) {
    return {
      data: null,
      error: `User validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize a single student record
 */
export function normalizeStudent(raw: Student | null): NormalizeResult<DomainStudent> {
  if (!raw) {
    return { data: null, error: 'Student data is null', warnings: [] };
  }

  const result = safeParse(StudentSchema, raw, 'normalizeStudent');
  
  if (!result.success) {
    return {
      data: null,
      error: `Student validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  if (!result.data.class_instance_id) {
    warnings.push(`Student ${result.data.student_code} has no class_instance_id`);
  }

  return { data: result.data, error: null, warnings };
}

/**
 * Normalize an array of students
 */
export function normalizeStudents(raw: Student[] | null): NormalizeResult<DomainStudent[]> {
  if (!raw || raw.length === 0) {
    return { data: [], error: null, warnings: [] };
  }

  const normalized: DomainStudent[] = [];
  const warnings: string[] = [];

  for (const item of raw) {
    const result = normalizeStudent(item);
    if (result.data) {
      normalized.push(result.data);
      warnings.push(...result.warnings);
    } else if (result.error) {
      warnings.push(`Skipped invalid student: ${result.error}`);
    }
  }

  return { data: normalized, error: null, warnings };
}

/**
 * Normalize a single admin record
 */
export function normalizeAdmin(raw: Admin | null): NormalizeResult<DomainAdmin> {
  if (!raw) {
    return { data: null, error: 'Admin data is null', warnings: [] };
  }

  const result = safeParse(AdminSchema, raw, 'normalizeAdmin');
  
  if (!result.success) {
    return {
      data: null,
      error: `Admin validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize a single class instance record
 */
export function normalizeClassInstance(raw: ClassInstance | null): NormalizeResult<DomainClassInstance> {
  if (!raw) {
    return { data: null, error: 'Class instance data is null', warnings: [] };
  }

  const result = safeParse(ClassInstanceSchema, raw, 'normalizeClassInstance');
  
  if (!result.success) {
    return {
      data: null,
      error: `Class instance validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  if (!result.data.academic_year_id) {
    warnings.push(`Class instance ${result.data.id} has no academic_year_id`);
  }
  if (result.data.grade === null) {
    warnings.push(`Class instance ${result.data.id} has no grade`);
  }
  if (!result.data.section) {
    warnings.push(`Class instance ${result.data.id} has no section`);
  }

  return { data: result.data, error: null, warnings };
}

/**
 * Normalize an array of class instances
 */
export function normalizeClassInstances(raw: ClassInstance[] | null): NormalizeResult<DomainClassInstance[]> {
  if (!raw || raw.length === 0) {
    return { data: [], error: null, warnings: [] };
  }

  const normalized: DomainClassInstance[] = [];
  const warnings: string[] = [];

  for (const item of raw) {
    const result = normalizeClassInstance(item);
    if (result.data) {
      normalized.push(result.data);
      warnings.push(...result.warnings);
    } else if (result.error) {
      warnings.push(`Skipped invalid class instance: ${result.error}`);
    }
  }

  return { data: normalized, error: null, warnings };
}

/**
 * Normalize a single subject record
 *
 * Production-grade normalizer that:
 * - Validates all required fields exist
 * - Returns fully typed DomainSubject on success
 * - Returns structured error on failure
 * - Never fails silently
 */
export function normalizeSubject(raw: Subject | null): NormalizeResult<DomainSubject> {
  if (!raw) {
    return {
      data: null,
      error: 'Subject data is null or undefined',
      warnings: [],
    };
  }

  // Validate using Zod schema
  const result = safeParse(SubjectSchema, raw, 'normalizeSubject');

  if (!result.success) {
    const errorDetails = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return {
      data: null,
      error: `Subject validation failed: ${errorDetails}`,
      warnings: [],
    };
  }

  // Return fully validated subject
  return {
    data: result.data,
    error: null,
    warnings: [],
  };
}

/**
 * Normalize an array of subjects
 *
 * Production-grade batch normalizer that:
 * - Processes all subjects, skipping invalid ones
 * - Accumulates warnings for skipped records
 * - Returns valid subjects as array
 * - Never throws, always returns data structure
 */
export function normalizeSubjects(raw: Subject[] | null): NormalizeResult<DomainSubject[]> {
  if (!raw || raw.length === 0) {
    return {
      data: [],
      error: null,
      warnings: [],
    };
  }

  const normalized: DomainSubject[] = [];
  const warnings: string[] = [];
  let skippedCount = 0;

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const result = normalizeSubject(item);

    if (result.data) {
      normalized.push(result.data);
      if (result.warnings.length > 0) {
        warnings.push(...result.warnings);
      }
    } else {
      skippedCount++;
      const identifier = item?.id || item?.subject_name || `index ${i}`;
      warnings.push(`Skipped invalid subject (${identifier}): ${result.error}`);
    }
  }

  if (skippedCount > 0) {
    warnings.push(`Total subjects skipped: ${skippedCount} of ${raw.length}`);
  }

  return {
    data: normalized,
    error: null,
    warnings,
  };
}

/**
 * Normalize a single timetable slot record
 */
export function normalizeTimetableSlot(raw: TimetableSlot | null): NormalizeResult<DomainTimetableSlot> {
  if (!raw) {
    return { data: null, error: 'Timetable slot data is null', warnings: [] };
  }

  // Ensure required fields are present
  if (!raw.class_instance_id) {
    return {
      data: null,
      error: 'Timetable slot must have class_instance_id',
      warnings: [],
    };
  }

  if (!raw.subject_id) {
    return {
      data: null,
      error: 'Timetable slot must have subject_id',
      warnings: [],
    };
  }

  if (!raw.teacher_id) {
    return {
      data: null,
      error: 'Timetable slot must have teacher_id',
      warnings: [],
    };
  }

  const result = safeParse(TimetableSlotSchema, raw, 'normalizeTimetableSlot');
  
  if (!result.success) {
    return {
      data: null,
      error: `Timetable slot validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize an array of timetable slots
 */
export function normalizeTimetableSlots(raw: TimetableSlot[] | null): NormalizeResult<DomainTimetableSlot[]> {
  if (!raw || raw.length === 0) {
    return { data: [], error: null, warnings: [] };
  }

  const normalized: DomainTimetableSlot[] = [];
  const warnings: string[] = [];

  for (const item of raw) {
    const result = normalizeTimetableSlot(item);
    if (result.data) {
      normalized.push(result.data);
      warnings.push(...result.warnings);
    } else if (result.error) {
      warnings.push(`Skipped invalid timetable slot: ${result.error}`);
    }
  }

  return { data: normalized, error: null, warnings };
}

/**
 * Normalize a single attendance record
 */
export function normalizeAttendance(raw: Attendance | null): NormalizeResult<DomainAttendance> {
  if (!raw) {
    return { data: null, error: 'Attendance data is null', warnings: [] };
  }

  if (!raw.student_id) {
    return {
      data: null,
      error: 'Attendance must have student_id',
      warnings: [],
    };
  }

  const result = safeParse(AttendanceSchema, raw, 'normalizeAttendance');
  
  if (!result.success) {
    return {
      data: null,
      error: `Attendance validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  if (!result.data.class_instance_id) {
    warnings.push(`Attendance ${result.data.id} has no class_instance_id`);
  }
  if (!result.data.school_code) {
    warnings.push(`Attendance ${result.data.id} has no school_code`);
  }

  return { data: result.data, error: null, warnings };
}

/**
 * Normalize an array of attendance records
 */
export function normalizeAttendances(raw: Attendance[] | null): NormalizeResult<DomainAttendance[]> {
  if (!raw || raw.length === 0) {
    return { data: [], error: null, warnings: [] };
  }

  const normalized: DomainAttendance[] = [];
  const warnings: string[] = [];

  for (const item of raw) {
    const result = normalizeAttendance(item);
    if (result.data) {
      normalized.push(result.data);
      warnings.push(...result.warnings);
    } else if (result.error) {
      warnings.push(`Skipped invalid attendance: ${result.error}`);
    }
  }

  return { data: normalized, error: null, warnings };
}

/**
 * Normalize a single task record
 */
export function normalizeTask(raw: Task | null): NormalizeResult<DomainTask> {
  if (!raw) {
    return { data: null, error: 'Task data is null', warnings: [] };
  }

  if (!raw.class_instance_id) {
    return {
      data: null,
      error: 'Task must have class_instance_id',
      warnings: [],
    };
  }

  if (!raw.subject_id) {
    return {
      data: null,
      error: 'Task must have subject_id',
      warnings: [],
    };
  }

  const result = safeParse(TaskSchema, raw, 'normalizeTask');
  
  if (!result.success) {
    return {
      data: null,
      error: `Task validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize an array of tasks
 */
export function normalizeTasks(raw: Task[] | null): NormalizeResult<DomainTask[]> {
  if (!raw || raw.length === 0) {
    return { data: [], error: null, warnings: [] };
  }

  const normalized: DomainTask[] = [];
  const warnings: string[] = [];

  for (const item of raw) {
    const result = normalizeTask(item);
    if (result.data) {
      normalized.push(result.data);
      warnings.push(...result.warnings);
    } else if (result.error) {
      warnings.push(`Skipped invalid task: ${result.error}`);
    }
  }

  return { data: normalized, error: null, warnings };
}

/**
 * Normalize a single test record
 */
export function normalizeTest(raw: Test | null): NormalizeResult<DomainTest> {
  if (!raw) {
    return { data: null, error: 'Test data is null', warnings: [] };
  }

  if (!raw.class_instance_id) {
    return {
      data: null,
      error: 'Test must have class_instance_id',
      warnings: [],
    };
  }

  const result = safeParse(TestSchema, raw, 'normalizeTest');
  
  if (!result.success) {
    return {
      data: null,
      error: `Test validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize a single test question record
 */
export function normalizeTestQuestion(raw: TestQuestion | null): NormalizeResult<DomainTestQuestion> {
  if (!raw) {
    return { data: null, error: 'Test question data is null', warnings: [] };
  }

  if (!raw.test_id) {
    return {
      data: null,
      error: 'Test question must have test_id',
      warnings: [],
    };
  }

  const result = safeParse(TestQuestionSchema, raw, 'normalizeTestQuestion');
  
  if (!result.success) {
    return {
      data: null,
      error: `Test question validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize a single fee payment record
 */
export function normalizeFeePayment(raw: FeePayment | null): NormalizeResult<DomainFeePayment> {
  if (!raw) {
    return { data: null, error: 'Fee payment data is null', warnings: [] };
  }

  if (!raw.student_id) {
    return {
      data: null,
      error: 'Fee payment must have student_id',
      warnings: [],
    };
  }

  if (!raw.component_type_id) {
    return {
      data: null,
      error: 'Fee payment must have component_type_id',
      warnings: [],
    };
  }

  const result = safeParse(FeePaymentSchema, raw, 'normalizeFeePayment');
  
  if (!result.success) {
    return {
      data: null,
      error: `Fee payment validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize an array of fee payments
 */
export function normalizeFeePayments(raw: FeePayment[] | null): NormalizeResult<DomainFeePayment[]> {
  if (!raw || raw.length === 0) {
    return { data: [], error: null, warnings: [] };
  }

  const normalized: DomainFeePayment[] = [];
  const warnings: string[] = [];

  for (const item of raw) {
    const result = normalizeFeePayment(item);
    if (result.data) {
      normalized.push(result.data);
      warnings.push(...result.warnings);
    } else if (result.error) {
      warnings.push(`Skipped invalid fee payment: ${result.error}`);
    }
  }

  return { data: normalized, error: null, warnings };
}

/**
 * Normalize a single fee student plan record
 */
export function normalizeFeeStudentPlan(raw: FeeStudentPlan | null): NormalizeResult<DomainFeeStudentPlan> {
  if (!raw) {
    return { data: null, error: 'Fee student plan data is null', warnings: [] };
  }

  if (!raw.student_id) {
    return {
      data: null,
      error: 'Fee student plan must have student_id',
      warnings: [],
    };
  }

  if (!raw.class_instance_id) {
    return {
      data: null,
      error: 'Fee student plan must have class_instance_id',
      warnings: [],
    };
  }

  if (!raw.academic_year_id) {
    return {
      data: null,
      error: 'Fee student plan must have academic_year_id',
      warnings: [],
    };
  }

  const result = safeParse(FeeStudentPlanSchema, raw, 'normalizeFeeStudentPlan');
  
  if (!result.success) {
    return {
      data: null,
      error: `Fee student plan validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize fee student plan with items (nested structure)
 */
export function normalizeFeeStudentPlanWithItems(
  raw: (FeeStudentPlan & { items?: FeeStudentPlanItem[] }) | null
): NormalizeResult<DomainFeeStudentPlan & { items: DomainFeeStudentPlanItem[] }> {
  if (!raw) {
    return { data: null, error: 'Fee student plan data is null', warnings: [] };
  }

  const planResult = normalizeFeeStudentPlan(raw);
  if (!planResult.data) {
    return planResult as NormalizeResult<DomainFeeStudentPlan & { items: DomainFeeStudentPlanItem[] }>;
  }

  const items: DomainFeeStudentPlanItem[] = [];
  const warnings: string[] = [...planResult.warnings];

  if (raw.items && Array.isArray(raw.items)) {
    for (const item of raw.items) {
      const result = safeParse(FeeStudentPlanItemSchema, item, 'normalizeFeeStudentPlanItem');
      if (result.success) {
        items.push(result.data);
      } else {
        warnings.push(`Skipped invalid plan item: ${result.error.message}`);
      }
    }
  }

  return {
    data: { ...planResult.data, items },
    error: null,
    warnings,
  };
}

/**
 * Normalize a single academic year record
 */
export function normalizeAcademicYear(raw: AcademicYear | null): NormalizeResult<DomainAcademicYear> {
  if (!raw) {
    return { data: null, error: 'Academic year data is null', warnings: [] };
  }

  const result = safeParse(AcademicYearSchema, raw, 'normalizeAcademicYear');
  
  if (!result.success) {
    return {
      data: null,
      error: `Academic year validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize a single calendar event record
 */
export function normalizeCalendarEvent(raw: CalendarEvent | null): NormalizeResult<DomainCalendarEvent> {
  if (!raw) {
    return { data: null, error: 'Calendar event data is null', warnings: [] };
  }

  const result = safeParse(CalendarEventSchema, raw, 'normalizeCalendarEvent');
  
  if (!result.success) {
    return {
      data: null,
      error: `Calendar event validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize a single learning resource record
 */
export function normalizeLearningResource(raw: LearningResource | null): NormalizeResult<DomainLearningResource> {
  if (!raw) {
    return { data: null, error: 'Learning resource data is null', warnings: [] };
  }

  const result = safeParse(LearningResourceSchema, raw, 'normalizeLearningResource');
  
  if (!result.success) {
    return {
      data: null,
      error: `Learning resource validation failed: ${result.error.message}`,
      warnings: [],
    };
  }

  return { data: result.data, error: null, warnings: [] };
}

/**
 * Normalize an array of learning resources
 */
export function normalizeLearningResources(raw: LearningResource[] | null): NormalizeResult<DomainLearningResource[]> {
  if (!raw || raw.length === 0) {
    return { data: [], error: null, warnings: [] };
  }

  const normalized: DomainLearningResource[] = [];
  const warnings: string[] = [];

  for (const item of raw) {
    const result = normalizeLearningResource(item);
    if (result.data) {
      normalized.push(result.data);
      warnings.push(...result.warnings);
    } else if (result.error) {
      warnings.push(`Skipped invalid learning resource: ${result.error}`);
    }
  }

  return { data: normalized, error: null, warnings };
}

