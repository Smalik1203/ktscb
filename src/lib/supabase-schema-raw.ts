/**
 * Raw Supabase Database Types
 *
 * Generated from live Supabase schema via MCP introspection
 * These types match EXACTLY what Supabase returns:
 * - snake_case field names
 * - timestamp with time zone as string (ISO8601)
 * - nullable fields match DB nullability
 * - numeric types as number
 */

// ==================== SCHOOLS ====================

export interface SchoolRaw {
  id: string; // uuid
  school_name: string;
  school_address: string;
  school_email: string;
  school_phone: string;
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
  is_active: boolean | null;
  school_code: string;
}

// ==================== STUDENTS ====================

export interface StudentRaw {
  id: string; // uuid
  created_at: string; // timestamptz
  student_code: string;
  full_name: string;
  email: string | null;
  phone: number; // numeric
  school_name: string;
  role: string;
  created_by: string;
  parent_phone: number | null; // numeric
  school_code: string;
  class_instance_id: string | null; // uuid
  auth_user_id: string | null; // uuid
}

// ==================== ATTENDANCE ====================

export interface AttendanceRaw {
  id: string; // uuid
  student_id: string | null; // uuid
  class_instance_id: string | null; // uuid
  status: 'present' | 'absent';
  date: string; // date (YYYY-MM-DD)
  marked_by: string;
  created_at: string | null; // timestamptz
  school_code: string | null;
  marked_by_role_code: string;
  updated_at: string | null; // timestamptz
}

// ==================== CLASS INSTANCES ====================

export interface ClassInstanceRaw {
  id: string; // uuid
  class_id: string | null; // uuid
  class_teacher_id: string | null; // uuid
  created_by: string;
  school_code: string;
  created_at: string | null; // timestamptz
  academic_year_id: string | null; // uuid
  grade: number | null; // int4
  section: string | null;
}

// ==================== TESTS ====================

export interface TestRaw {
  id: string; // uuid
  title: string;
  description: string | null;
  class_instance_id: string; // uuid
  subject_id: string; // uuid
  school_code: string;
  test_type: string;
  time_limit_seconds: number | null; // int4
  created_by: string; // uuid
  created_at: string | null; // timestamptz
  allow_reattempts: boolean | null;
  chapter_id: string | null; // uuid
  test_mode: 'online' | 'offline' | null;
  test_date: string | null; // date
  status: 'active' | 'inactive' | null;
  max_marks: number | null; // int4
}

export interface TestQuestionRaw {
  id: string; // uuid
  test_id: string; // uuid
  question_text: string;
  question_type: 'mcq' | 'one_word' | 'long_answer';
  options: string[] | null; // text[]
  correct_index: number | null; // int4
  correct_text: string | null;
  created_at: string | null; // timestamptz
  correct_answer: string | null;
  points: number | null; // int4
  order_index: number | null; // int4
}

export interface TestAttemptRaw {
  id: string; // uuid
  test_id: string; // uuid
  student_id: string; // uuid
  answers: Record<string, any>; // jsonb
  score: number | null; // int4
  status: 'in_progress' | 'completed' | 'abandoned';
  evaluated_by: string | null; // uuid
  completed_at: string | null; // timestamptz
  started_at: string | null; // timestamptz
  created_at: string | null; // timestamptz
  earned_points: number | null; // int4
  total_points: number | null; // int4
}

export interface TestMarkRaw {
  id: string; // uuid
  test_id: string; // uuid
  student_id: string; // uuid
  marks_obtained: number; // int4
  max_marks: number; // int4
  remarks: string | null;
  created_by: string | null; // uuid
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
}

// ==================== CALENDAR EVENTS ====================

export interface SchoolCalendarEventRaw {
  id: string; // uuid
  school_code: string;
  academic_year_id: string | null; // uuid
  title: string;
  description: string | null;
  event_type: string;
  start_date: string; // date
  end_date: string | null; // date
  is_all_day: boolean | null;
  start_time: string | null; // time
  end_time: string | null; // time
  is_recurring: boolean | null;
  recurrence_pattern: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_interval: number | null; // int4
  recurrence_end_date: string | null; // date
  color: string | null;
  is_active: boolean | null;
  created_by: string; // uuid
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
  class_instance_id: string | null; // uuid
}

// ==================== SUBJECTS ====================

export interface SubjectRaw {
  id: string; // uuid
  subject_name: string;
  school_code: string;
  created_by: string;
  created_at: string | null; // timestamptz
  subject_name_norm: string | null; // generated
}

// ==================== ACADEMIC YEARS ====================

export interface AcademicYearRaw {
  id: string; // uuid
  school_name: string | null;
  school_code: string | null;
  year_start: number; // int4
  year_end: number; // int4
  is_active: boolean | null;
}

// ==================== USERS ====================

export interface UserRaw {
  id: string; // uuid
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  school_code: string | null;
  school_name: string | null;
  created_at: string | null; // timestamptz
  class_instance_id: string | null; // uuid
}

// ==================== ADMIN ====================

export interface AdminRaw {
  id: string; // uuid
  created_at: string; // timestamptz
  admin_code: string;
  full_name: string;
  email: string | null;
  phone: number; // numeric
  school_name: string;
  school_code: string;
  role: string;
  auth_user_id: string | null; // uuid
}

// ==================== TIMETABLE SLOTS ====================

export interface TimetableSlotRaw {
  id: string; // uuid
  school_code: string;
  class_instance_id: string; // uuid
  class_date: string; // date
  period_number: number; // int4
  slot_type: 'period' | 'break';
  name: string | null;
  start_time: string; // time (HH:MM:SS)
  end_time: string; // time (HH:MM:SS)
  subject_id: string | null; // uuid
  teacher_id: string | null; // uuid
  syllabus_item_id: string | null; // uuid
  plan_text: string | null;
  status: 'planned' | 'done' | 'cancelled' | null;
  created_by: string; // uuid
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
  syllabus_chapter_id: string | null; // uuid
  syllabus_topic_id: string | null; // uuid
}

// ==================== SYLLABUS ====================

export interface SyllabusRaw {
  id: string; // uuid
  school_code: string;
  class_instance_id: string; // uuid
  subject_id: string; // uuid
  created_by: string; // uuid
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
}

export interface SyllabusChapterRaw {
  id: string; // uuid
  syllabus_id: string; // uuid
  chapter_no: number; // int4
  title: string;
  description: string | null;
  ref_code: string | null;
  created_by: string; // uuid
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
}

export interface SyllabusTopicRaw {
  id: string; // uuid
  chapter_id: string; // uuid
  topic_no: number; // int4
  title: string;
  description: string | null;
  ref_code: string | null;
  created_by: string; // uuid
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
}

export interface SyllabusProgressRaw {
  id: string; // uuid
  school_code: string;
  class_instance_id: string; // uuid
  date: string; // date
  timetable_slot_id: string; // uuid
  subject_id: string; // uuid
  teacher_id: string; // uuid
  syllabus_chapter_id: string | null; // uuid
  syllabus_topic_id: string | null; // uuid
  created_by: string; // uuid
  created_at: string | null; // timestamptz
}

// ==================== TASKS ====================

export interface TaskRaw {
  id: string; // uuid
  school_code: string;
  academic_year_id: string | null; // uuid
  class_instance_id: string | null; // uuid
  subject_id: string | null; // uuid
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  assigned_date: string; // date
  due_date: string; // date
  max_marks: number | null; // int4
  instructions: string | null;
  attachments: Record<string, any> | null; // jsonb
  is_active: boolean | null;
  created_by: string; // uuid
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
}

export interface TaskSubmissionRaw {
  id: string; // uuid
  task_id: string; // uuid
  student_id: string; // uuid
  submission_text: string | null;
  attachments: Record<string, any> | null; // jsonb
  submitted_at: string | null; // timestamptz
  marks_obtained: number | null; // int4
  max_marks: number | null; // int4
  feedback: string | null;
  status: 'submitted' | 'graded' | 'returned' | 'late' | null;
  graded_by: string | null; // uuid
  graded_at: string | null; // timestamptz
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
}

// ==================== FEES ====================

export interface FeeComponentTypeRaw {
  id: string; // uuid
  school_code: string;
  code: string;
  name: string;
  is_recurring: boolean;
  period: 'annual' | 'term' | 'monthly';
  is_optional: boolean;
  meta: Record<string, any>; // jsonb
  created_by: string; // uuid
  created_at: string; // timestamptz
  default_amount_inr: number | null; // numeric
}

export interface FeeStudentPlanRaw {
  id: string; // uuid
  school_code: string;
  student_id: string; // uuid
  class_instance_id: string; // uuid
  academic_year_id: string; // uuid
  status: 'active' | 'inactive';
  created_by: string; // uuid
  created_at: string; // timestamptz
}

export interface FeeStudentPlanItemRaw {
  id: string; // uuid
  plan_id: string; // uuid
  component_type_id: string; // uuid
  quantity: number; // int4
  meta: Record<string, any>; // jsonb
  created_at: string; // timestamptz
  amount_inr: number | null; // numeric
}

export interface FeePaymentRaw {
  id: string; // uuid
  student_id: string; // uuid
  plan_id: string | null; // uuid
  component_type_id: string; // uuid
  payment_date: string; // date
  payment_method: 'cash' | 'cheque' | 'online' | 'card' | 'other' | null;
  transaction_id: string | null;
  receipt_number: string | null;
  remarks: string | null;
  school_code: string;
  created_by: string; // uuid
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
  recorded_by_name: string | null;
  amount_inr: number | null; // numeric
}

// ==================== LEARNING RESOURCES ====================

export interface LearningResourceRaw {
  id: string; // uuid
  title: string;
  description: string | null;
  resource_type: 'video' | 'pdf' | 'quiz';
  content_url: string;
  file_size: number | null; // bigint
  school_code: string;
  class_instance_id: string | null; // uuid
  subject_id: string | null; // uuid
  uploaded_by: string | null; // uuid
  created_at: string | null; // timestamptz
  updated_at: string | null; // timestamptz
}
