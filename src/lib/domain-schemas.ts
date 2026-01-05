/**
 * Domain Schemas with Zod Validation
 *
 * These schemas define the business rules for domain entities, separating
 * raw database types from domain-safe types. Fields are marked as nullable
 * only when the business logic genuinely allows null values.
 *
 * Key principles:
 * - Required fields that should never be null are NOT nullable
 * - Optional fields that can legitimately be null remain nullable
 * - All schemas validate data shape before it reaches UI components
 * - Timestamps handle Supabase microsecond precision (e.g., 2025-10-12T14:19:39.673506+00:00)
 */

import { z } from 'zod';

// ==================== COMMON SCHEMAS ====================

/**
 * Timestamp schema that handles Supabase timestamps with microsecond precision
 *
 * Supabase returns timestamps like: 2025-10-12T14:19:39.673506+00:00
 * Standard Zod .datetime() fails because RFC3339 doesn't allow fractional seconds beyond milliseconds
 *
 * This validator:
 * - Accepts any valid date string parseable by Date.parse()
 * - Rejects invalid date strings
 * - Works with ISO8601, RFC3339, Supabase microsecond timestamps, etc.
 */
const Timestamp = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid timestamp' }
);

/**
 * Optional timestamp - can be null or a valid timestamp
 */
const OptionalTimestamp = z.union([
  Timestamp,
  z.null()
]);

const uuidSchema = z.string().uuid();
const nonEmptyStringSchema = z.string().min(1);
const emailSchema = z.string().email().nullable();

// ==================== USER SCHEMAS ====================

/**
 * User domain schema
 * Business rules:
 * - id, role, created_at are always required
 * - email can be null (users may not have email)
 * - school_code can be null (super admins may not belong to a school)
 * - class_instance_id can be null (only students have this)
 */
export const UserSchema = z.object({
  id: uuidSchema,
  full_name: nonEmptyStringSchema,
  email: emailSchema,
  phone: z.string().nullable(),
  role: z.enum(['superadmin', 'admin', 'teacher', 'student', 'parent', 'cb_admin']),
  school_code: z.string().nullable(),
  school_name: z.string().nullable(),
  class_instance_id: uuidSchema.nullable(),
  created_at: Timestamp,
  updated_at: OptionalTimestamp,
});

export type DomainUser = z.infer<typeof UserSchema>;

// ==================== STUDENT SCHEMAS ====================

/**
 * Student domain schema
 * Business rules:
 * - id, student_code, full_name, phone, school_code, school_name, role are required
 * - class_instance_id SHOULD be required (students must belong to a class)
 *   but is nullable in DB for migration/edge cases - we'll validate this separately
 * - email can be null
 * - auth_user_id can be null (student may not have logged in yet)
 */
export const StudentSchema = z.object({
  id: uuidSchema,
  student_code: nonEmptyStringSchema,
  full_name: nonEmptyStringSchema,
  email: emailSchema,
  phone: z.number().int().positive(),
  parent_phone: z.number().int().positive().nullable(),
  school_code: nonEmptyStringSchema,
  school_name: nonEmptyStringSchema,
  class_instance_id: uuidSchema.nullable(), // TODO: Should be NOT NULL in DB
  auth_user_id: uuidSchema.nullable(),
  role: z.literal('student'),
  created_at: Timestamp,
  created_by: nonEmptyStringSchema,
});

export type DomainStudent = z.infer<typeof StudentSchema>;

/**
 * Validates that a student has a class assignment (business rule)
 */
export function validateStudentHasClass(student: DomainStudent): asserts student is DomainStudent & { class_instance_id: string } {
  if (!student.class_instance_id) {
    throw new Error(`Student ${student.student_code} must have a class_instance_id`);
  }
}

// ==================== ADMIN SCHEMAS ====================

/**
 * Admin/Teacher domain schema
 * Business rules:
 * - id, admin_code, full_name, phone, school_code, school_name, role are required
 * - email can be null
 * - auth_user_id can be null (admin may not have logged in yet)
 */
export const AdminSchema = z.object({
  id: uuidSchema,
  admin_code: nonEmptyStringSchema,
  full_name: nonEmptyStringSchema,
  email: emailSchema,
  phone: z.number().int().positive(),
  school_code: nonEmptyStringSchema,
  school_name: nonEmptyStringSchema,
  role: z.string(),
  auth_user_id: uuidSchema.nullable(),
  created_at: Timestamp,
});

export type DomainAdmin = z.infer<typeof AdminSchema>;

// ==================== CLASS SCHEMAS ====================

/**
 * Class Instance domain schema
 * Business rules:
 * - id, school_code, created_by are required
 * - academic_year_id SHOULD be required but is nullable in DB
 * - grade and section SHOULD be required but are nullable in DB
 * - class_teacher_id can be null (class may not have assigned teacher yet)
 */
export const ClassInstanceSchema = z.object({
  id: uuidSchema,
  school_code: nonEmptyStringSchema,
  academic_year_id: uuidSchema.nullable(), // TODO: Should be NOT NULL in DB
  class_id: uuidSchema.nullable(),
  class_teacher_id: uuidSchema.nullable(),
  grade: z.number().int().positive().nullable(), // TODO: Should be NOT NULL in DB
  section: z.string().nullable(), // TODO: Should be NOT NULL in DB
  created_by: nonEmptyStringSchema,
  created_at: OptionalTimestamp,
});

export type DomainClassInstance = z.infer<typeof ClassInstanceSchema>;

/**
 * Validates that a class instance has required academic info
 */
export function validateClassInstanceComplete(
  classInstance: DomainClassInstance
): asserts classInstance is DomainClassInstance & {
  academic_year_id: string;
  grade: number;
  section: string;
} {
  if (!classInstance.academic_year_id) {
    throw new Error(`Class instance ${classInstance.id} must have an academic_year_id`);
  }
  if (classInstance.grade === null || classInstance.grade === undefined) {
    throw new Error(`Class instance ${classInstance.id} must have a grade`);
  }
  if (!classInstance.section) {
    throw new Error(`Class instance ${classInstance.id} must have a section`);
  }
}

// ==================== SUBJECT SCHEMAS ====================

/**
 * Subject domain schema
 * Business rules:
 * - id, subject_name, school_code, created_by are required
 * - subject_name_norm is generated, can be null
 * Note: Database uses subject_name, but we expose as 'name' in domain for consistency
 */
export const SubjectSchema = z.object({
  id: uuidSchema,
  subject_name: nonEmptyStringSchema, // Database field name
  subject_name_norm: z.string().nullable(),
  school_code: nonEmptyStringSchema,
  created_by: nonEmptyStringSchema,
  created_at: OptionalTimestamp,
});

export type DomainSubject = z.infer<typeof SubjectSchema>;

// ==================== TIMETABLE SCHEMAS ====================

/**
 * Timetable Slot domain schema
 * Business rules:
 * - id, class_instance_id, subject_id, teacher_id, school_code, period_number,
 *   start_time, end_time, class_date are required
 * - room can be null
 */
export const TimetableSlotSchema = z.object({
  id: uuidSchema,
  class_instance_id: uuidSchema, // NOT NULL - timetable must belong to a class
  subject_id: uuidSchema, // NOT NULL - timetable must have a subject
  teacher_id: uuidSchema, // NOT NULL - timetable must have a teacher
  school_code: nonEmptyStringSchema,
  period_number: z.number().int().positive(),
  start_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/), // HH:MM:SS format
  end_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  class_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  room: z.string().nullable(),
  created_at: OptionalTimestamp,
  updated_at: OptionalTimestamp,
});

export type DomainTimetableSlot = z.infer<typeof TimetableSlotSchema>;

// ==================== ATTENDANCE SCHEMAS ====================

/**
 * Attendance domain schema
 * Business rules:
 * - id, student_id, class_instance_id, date, status, marked_by, marked_by_role_code are required
 * - school_code SHOULD be required but is nullable in DB
 */
export const AttendanceSchema = z.object({
  id: uuidSchema,
  student_id: uuidSchema, // NOT NULL - attendance must be for a student
  class_instance_id: uuidSchema.nullable(), // TODO: Should be NOT NULL in DB
  school_code: z.string().nullable(), // TODO: Should be NOT NULL in DB
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['present', 'absent']),
  marked_by: nonEmptyStringSchema,
  marked_by_role_code: nonEmptyStringSchema,
  created_at: OptionalTimestamp,
});

export type DomainAttendance = z.infer<typeof AttendanceSchema>;

// ==================== TASK SCHEMAS ====================

/**
 * Task domain schema
 * Business rules:
 * - id, title, class_instance_id, subject_id, school_code, due_date, created_by are required
 * - description can be null
 */
export const TaskSchema = z.object({
  id: uuidSchema,
  title: nonEmptyStringSchema,
  description: z.string().nullable(),
  class_instance_id: uuidSchema, // NOT NULL - task must belong to a class
  subject_id: uuidSchema, // NOT NULL - task must have a subject
  school_code: nonEmptyStringSchema,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  created_by: nonEmptyStringSchema,
  created_at: OptionalTimestamp,
  updated_at: OptionalTimestamp,
});

export type DomainTask = z.infer<typeof TaskSchema>;

// ==================== TEST SCHEMAS ====================

/**
 * Test domain schema
 * Business rules:
 * - id, title, class_instance_id, school_code, created_by are required
 * - description, instructions can be null
 */
export const TestSchema = z.object({
  id: uuidSchema,
  title: nonEmptyStringSchema,
  description: z.string().nullable(),
  class_instance_id: uuidSchema, // NOT NULL - test must belong to a class
  school_code: nonEmptyStringSchema,
  created_by: nonEmptyStringSchema,
  created_at: OptionalTimestamp,
  updated_at: OptionalTimestamp,
});

export type DomainTest = z.infer<typeof TestSchema>;

/**
 * Test Question domain schema
 * Business rules:
 * - id, test_id, question_text, question_type, points are required
 * - options, correct_answer can be null depending on question_type
 */
export const TestQuestionSchema = z.object({
  id: uuidSchema,
  test_id: uuidSchema, // NOT NULL - question must belong to a test
  question_text: nonEmptyStringSchema,
  question_type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'essay']),
  points: z.number().int().nonnegative(),
  options: z.array(z.string()).nullable(),
  correct_answer: z.string().nullable(),
  created_at: OptionalTimestamp,
});

export type DomainTestQuestion = z.infer<typeof TestQuestionSchema>;

// ==================== FEE SCHEMAS ====================

/**
 * Fee Component Type domain schema
 * Business rules:
 * - id, code, name, school_code, created_by are required
 */
export const FeeComponentTypeSchema = z.object({
  id: uuidSchema,
  code: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  school_code: nonEmptyStringSchema,
  period: z.string().nullable(),
  default_amount_inr: z.number().nonnegative().nullable(),
  is_recurring: z.boolean(),
  is_optional: z.boolean(),
  meta: z.record(z.unknown()).nullable(),
  created_at: Timestamp,
  created_by: nonEmptyStringSchema,
});

export type DomainFeeComponentType = z.infer<typeof FeeComponentTypeSchema>;

/**
 * Fee Student Plan domain schema
 * Business rules:
 * - id, student_id, class_instance_id, academic_year_id, school_code, created_by are required
 */
export const FeeStudentPlanSchema = z.object({
  id: uuidSchema,
  student_id: uuidSchema, // NOT NULL - plan must belong to a student
  class_instance_id: uuidSchema, // NOT NULL - plan must belong to a class
  academic_year_id: uuidSchema, // NOT NULL - plan must belong to an academic year
  school_code: nonEmptyStringSchema,
  status: z.string(),
  created_at: Timestamp,
  created_by: nonEmptyStringSchema,
});

export type DomainFeeStudentPlan = z.infer<typeof FeeStudentPlanSchema>;

/**
 * Fee Student Plan Item domain schema
 * Business rules:
 * - id, plan_id, component_type_id, amount_inr, quantity are required
 */
export const FeeStudentPlanItemSchema = z.object({
  id: uuidSchema,
  plan_id: uuidSchema, // NOT NULL - item must belong to a plan
  component_type_id: uuidSchema, // NOT NULL - item must have a component type
  amount_inr: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  meta: z.record(z.unknown()).nullable(),
  created_at: Timestamp,
});

export type DomainFeeStudentPlanItem = z.infer<typeof FeeStudentPlanItemSchema>;

/**
 * Fee Payment domain schema
 * Business rules:
 * - id, student_id, component_type_id, amount_inr, payment_date, school_code, created_by are required
 * - plan_id, payment_method, receipt_number, transaction_id, remarks can be null
 */
export const FeePaymentSchema = z.object({
  id: uuidSchema,
  student_id: uuidSchema, // NOT NULL - payment must belong to a student
  component_type_id: uuidSchema, // NOT NULL - payment must have a component type
  amount_inr: z.number().positive(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  school_code: nonEmptyStringSchema,
  plan_id: uuidSchema.nullable(),
  payment_method: z.string().nullable(),
  receipt_number: z.string().nullable(),
  transaction_id: z.string().nullable(),
  remarks: z.string().nullable(),
  created_by: nonEmptyStringSchema,
  created_at: OptionalTimestamp,
  updated_at: OptionalTimestamp,
});

export type DomainFeePayment = z.infer<typeof FeePaymentSchema>;

// ==================== ACADEMIC YEAR SCHEMAS ====================

/**
 * Academic Year domain schema
 * Business rules:
 * - id, year_start, year_end are required
 * - school_code, school_name, is_active can be null
 */
export const AcademicYearSchema = z.object({
  id: uuidSchema,
  year_start: z.number().int().positive(),
  year_end: z.number().int().positive(),
  school_code: z.string().nullable(),
  school_name: z.string().nullable(),
  is_active: z.boolean().nullable(),
});

export type DomainAcademicYear = z.infer<typeof AcademicYearSchema>;

// ==================== CALENDAR EVENT SCHEMAS ====================

/**
 * Calendar Event domain schema
 * Business rules:
 * - id, title, start_date, event_type, school_code, created_by are required
 * - class_instance_id, academic_year_id, description, end_date can be null
 */
export const CalendarEventSchema = z.object({
  id: uuidSchema,
  title: nonEmptyStringSchema,
  description: z.string().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  event_type: nonEmptyStringSchema,
  school_code: nonEmptyStringSchema,
  class_instance_id: uuidSchema.nullable(),
  academic_year_id: uuidSchema.nullable(),
  created_by: nonEmptyStringSchema,
  is_all_day: z.boolean().nullable(),
  is_recurring: z.boolean().nullable(),
  color: z.string().nullable(),
  created_at: OptionalTimestamp,
  updated_at: OptionalTimestamp,
});

export type DomainCalendarEvent = z.infer<typeof CalendarEventSchema>;

// ==================== LEARNING RESOURCE SCHEMAS ====================

/**
 * Learning Resource domain schema
 * Business rules:
 * - id, title, content_url, resource_type, school_code are required
 * - class_instance_id, subject_id, description can be null
 */
export const LearningResourceSchema = z.object({
  id: uuidSchema,
  title: nonEmptyStringSchema,
  description: z.string().nullable(),
  content_url: nonEmptyStringSchema,
  resource_type: nonEmptyStringSchema,
  school_code: nonEmptyStringSchema,
  class_instance_id: uuidSchema.nullable(),
  subject_id: uuidSchema.nullable(),
  file_size: z.number().int().nonnegative().nullable(),
  uploaded_by: nonEmptyStringSchema.nullable(),
  created_at: OptionalTimestamp,
  updated_at: OptionalTimestamp,
});

export type DomainLearningResource = z.infer<typeof LearningResourceSchema>;

// ==================== TIMESTAMP UTILITIES ====================

/**
 * Normalize a Supabase timestamp to ISO8601 UTC
 *
 * Supabase timestamps: 2025-10-12T14:19:39.673506+00:00
 * Output: 2025-10-12T14:19:39.673Z
 *
 * Use this when you need to convert timestamps for display or comparison
 */
export function normalizeTimestamp(timestamp: string | null): string | null {
  if (!timestamp) return null;

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Validate if a string is a valid timestamp
 */
export function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return !isNaN(Date.parse(value));
}

// ==================== VALIDATION HELPERS ====================

/**
 * Safe parse with error logging
 */
export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context?: string
): z.SafeParseReturnType<z.input<T>, z.output<T>> {
  const result = schema.safeParse(data);

  if (!result.success) {
    console.error(`[Domain Schema Validation Error]${context ? ` ${context}:` : ':'}`, {
      errors: result.error.errors,
      data: data,
    });
  }

  return result;
}

/**
 * Parse and throw on error (for critical paths)
 */
export function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context?: string
): z.output<T> {
  const result = safeParse(schema, data, context);

  if (!result.success) {
    throw new Error(
      `Domain validation failed${context ? ` in ${context}` : ''}: ${result.error.message}`
    );
  }

  return result.data;
}

// ==================== INVENTORY ITEM SCHEMAS ====================

/**
 * Inventory Item base object schema (before refinements)
 * Business rules:
 * - name, category, school_code, created_by are required
 * - Fee-related fields are conditional based on is_chargeable
 * - Issuance fields are conditional based on can_be_issued
 */
const InventoryItemBaseSchema = z.object({
  id: uuidSchema,
  school_code: nonEmptyStringSchema,
  
  // Step 1: Basic Information
  name: nonEmptyStringSchema,
  category: nonEmptyStringSchema, // User-defined category (free text)
  description: z.string().nullable(),
  
  // Step 2: Tracking Rules
  track_quantity: z.boolean(),
  current_quantity: z.number().int().nonnegative().nullable(),
  low_stock_threshold: z.number().int().nonnegative().nullable(),
  track_serially: z.boolean(),
  
  // Step 3: Issuance Rules
  can_be_issued: z.boolean(),
  issue_to: z.enum(['student', 'staff', 'both']).nullable(),
  must_be_returned: z.boolean(),
  return_duration_days: z.number().int().positive().nullable(),
  
  // Step 4: Fee Rules
  is_chargeable: z.boolean(),
  charge_type: z.enum(['one_time', 'deposit']).nullable(),
  charge_amount: z.number().nonnegative().nullable(),
  auto_add_to_fees: z.boolean(),
  fee_category: z.enum(['books', 'uniform', 'misc']).nullable(),
  
  // Step 5: Internal Controls
  unit_cost: z.number().nonnegative().nullable(),
  allow_price_override: z.boolean(),
  internal_notes: z.string().nullable(),
  
  // Metadata
  is_active: z.boolean(),
  created_at: Timestamp,
  updated_at: OptionalTimestamp,
  created_by: nonEmptyStringSchema,
});

/**
 * Inventory Item Input schema (for creation) - created before refinements
 * This schema is used for input validation and should have the same business rules
 */
export const InventoryItemInputSchema = InventoryItemBaseSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).refine(
  (data) => {
    // If can_be_issued is true, issue_to must be set
    if (data.can_be_issued && !data.issue_to) {
      return false;
    }
    return true;
  },
  { message: 'issue_to is required when can_be_issued is true', path: ['issue_to'] }
).refine(
  (data) => {
    // If must_be_returned is true, return_duration_days must be set
    if (data.must_be_returned && !data.return_duration_days) {
      return false;
    }
    return true;
  },
  { message: 'return_duration_days is required when must_be_returned is true', path: ['return_duration_days'] }
).refine(
  (data) => {
    // If is_chargeable is true, charge_type and charge_amount must be set
    if (data.is_chargeable && (!data.charge_type || data.charge_amount === null)) {
      return false;
    }
    return true;
  },
  { message: 'charge_type and charge_amount are required when is_chargeable is true', path: ['charge_type'] }
).refine(
  (data) => {
    // If auto_add_to_fees is true, fee_category must be set
    if (data.auto_add_to_fees && !data.fee_category) {
      return false;
    }
    return true;
  },
  { message: 'fee_category is required when auto_add_to_fees is true', path: ['fee_category'] }
).refine(
  (data) => {
    // If track_serially is true, track_quantity must also be true
    if (data.track_serially && !data.track_quantity) {
      return false;
    }
    return true;
  },
  { message: 'track_quantity must be true when track_serially is true', path: ['track_quantity'] }
);

export type InventoryItemInput = z.infer<typeof InventoryItemInputSchema>;

/**
 * Inventory Item domain schema with business rule validations
 */
export const InventoryItemSchema = InventoryItemBaseSchema.refine(
  (data) => {
    // If can_be_issued is true, issue_to must be set
    if (data.can_be_issued && !data.issue_to) {
      return false;
    }
    return true;
  },
  { message: 'issue_to is required when can_be_issued is true', path: ['issue_to'] }
).refine(
  (data) => {
    // If must_be_returned is true, return_duration_days must be set
    if (data.must_be_returned && !data.return_duration_days) {
      return false;
    }
    return true;
  },
  { message: 'return_duration_days is required when must_be_returned is true', path: ['return_duration_days'] }
).refine(
  (data) => {
    // If is_chargeable is true, charge_type and charge_amount must be set
    if (data.is_chargeable && (!data.charge_type || data.charge_amount === null)) {
      return false;
    }
    return true;
  },
  { message: 'charge_type and charge_amount are required when is_chargeable is true', path: ['charge_type'] }
).refine(
  (data) => {
    // If auto_add_to_fees is true, fee_category must be set
    if (data.auto_add_to_fees && !data.fee_category) {
      return false;
    }
    return true;
  },
  { message: 'fee_category is required when auto_add_to_fees is true', path: ['fee_category'] }
).refine(
  (data) => {
    // If track_serially is true, track_quantity must also be true
    if (data.track_serially && !data.track_quantity) {
      return false;
    }
    return true;
  },
  { message: 'track_quantity must be true when track_serially is true', path: ['track_quantity'] }
);

export type DomainInventoryItem = z.infer<typeof InventoryItemSchema>;

// ==================== INVOICE & FEES SCHEMAS ====================

/**
 * Invoice domain schemas
 * Re-exported from domain/fees/types for convenience
 */
export {
  InvoiceSchema,
  InvoiceItemSchema,
  InvoicePaymentSchema,
  InvoiceDetailSchema,
  CreateInvoiceInputSchema,
  RecordPaymentInputSchema,
  UpdateInvoiceItemInputSchema,
  CreateInvoiceItemInputSchema,
  calculateInvoiceStatus,
  validatePaymentAmount,
  calculateInvoiceTotal,
  type DomainInvoice,
  type DomainInvoiceItem,
  type DomainInvoicePayment,
  type DomainInvoiceDetail,
  type CreateInvoiceInput,
  type RecordPaymentInput,
  type UpdateInvoiceItemInput,
  type CreateInvoiceItemInput,
  type InvoiceStatus,
  type PaymentMethod,
} from '../domain/fees/types';
