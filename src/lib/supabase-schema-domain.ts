/**
 * Domain Model Types
 *
 * These types represent the application's domain model:
 * - camelCase field names (not snake_case)
 * - Date objects for timestamps (not ISO strings)
 * - Normalized field names for clarity
 * - Used throughout the app for type safety
 *
 * Transform from Raw types using rawToDomain() functions
 */

// ==================== SCHOOLS ====================

export interface School {
  id: string;
  schoolName: string;
  schoolAddress: string;
  schoolEmail: string;
  schoolPhone: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  isActive: boolean | null;
  schoolCode: string;
}

// ==================== STUDENTS ====================

export interface Student {
  id: string;
  createdAt: Date;
  studentCode: string;
  fullName: string;
  email: string | null;
  phone: number;
  schoolName: string;
  role: string;
  createdBy: string;
  parentPhone: number | null;
  schoolCode: string;
  classInstanceId: string | null;
  authUserId: string | null;
}

// ==================== ATTENDANCE ====================

export interface Attendance {
  id: string;
  studentId: string | null;
  classInstanceId: string | null;
  status: 'present' | 'absent';
  date: string; // YYYY-MM-DD format (keep as string for date-only fields)
  markedBy: string;
  createdAt: Date | null;
  schoolCode: string | null;
  markedByRoleCode: string;
  updatedAt: Date | null;
}

// ==================== CLASS INSTANCES ====================

export interface ClassInstance {
  id: string;
  classId: string | null;
  classTeacherId: string | null;
  createdBy: string;
  schoolCode: string;
  createdAt: Date | null;
  academicYearId: string | null;
  grade: number | null;
  section: string | null;
}

// ==================== TESTS ====================

export interface Test {
  id: string;
  title: string;
  description: string | null;
  classInstanceId: string;
  subjectId: string;
  schoolCode: string;
  testType: string;
  timeLimitSeconds: number | null;
  createdBy: string;
  createdAt: Date | null;
  allowReattempts: boolean | null;
  chapterId: string | null;
  testMode: 'online' | 'offline' | null;
  testDate: string | null; // YYYY-MM-DD format
  status: 'active' | 'inactive' | null;
  maxMarks: number | null;
}

export interface TestQuestion {
  id: string;
  testId: string;
  questionText: string;
  questionType: 'mcq' | 'one_word' | 'long_answer';
  options: string[] | null;
  correctIndex: number | null;
  correctText: string | null;
  createdAt: Date | null;
  correctAnswer: string | null;
  points: number | null;
  orderIndex: number | null;
}

export interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  answers: Record<string, any>;
  score: number | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  evaluatedBy: string | null;
  completedAt: Date | null;
  startedAt: Date | null;
  createdAt: Date | null;
  earnedPoints: number | null;
  totalPoints: number | null;
}

export interface TestMark {
  id: string;
  testId: string;
  studentId: string;
  marksObtained: number;
  maxMarks: number;
  remarks: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ==================== CALENDAR EVENTS ====================

export interface SchoolCalendarEvent {
  id: string;
  schoolCode: string;
  academicYearId: string | null;
  title: string;
  description: string | null;
  eventType: string;
  startDate: string; // YYYY-MM-DD format
  endDate: string | null; // YYYY-MM-DD format
  isAllDay: boolean | null;
  startTime: string | null; // HH:MM:SS format
  endTime: string | null; // HH:MM:SS format
  isRecurring: boolean | null;
  recurrencePattern: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  recurrenceInterval: number | null;
  recurrenceEndDate: string | null; // YYYY-MM-DD format
  color: string | null;
  isActive: boolean | null;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  classInstanceId: string | null;
}

// ==================== SUBJECTS ====================

export interface Subject {
  id: string;
  subjectName: string;
  schoolCode: string;
  createdBy: string;
  createdAt: Date | null;
  subjectNameNorm: string | null;
}

// ==================== ACADEMIC YEARS ====================

export interface AcademicYear {
  id: string;
  schoolName: string | null;
  schoolCode: string | null;
  yearStart: number;
  yearEnd: number;
  isActive: boolean | null;
}

// ==================== USERS ====================

export interface User {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  schoolCode: string | null;
  schoolName: string | null;
  createdAt: Date | null;
  classInstanceId: string | null;
}

// ==================== ADMIN ====================

export interface Admin {
  id: string;
  createdAt: Date;
  adminCode: string;
  fullName: string;
  email: string | null;
  phone: number;
  schoolName: string;
  schoolCode: string;
  role: string;
  authUserId: string | null;
}

// ==================== TIMETABLE SLOTS ====================

export interface TimetableSlot {
  id: string;
  schoolCode: string;
  classInstanceId: string;
  classDate: string; // YYYY-MM-DD format
  periodNumber: number;
  slotType: 'period' | 'break';
  name: string | null;
  startTime: string; // HH:MM:SS format
  endTime: string; // HH:MM:SS format
  subjectId: string | null;
  teacherId: string | null;
  syllabusItemId: string | null;
  planText: string | null;
  status: 'planned' | 'done' | 'cancelled' | null;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  syllabusChapterId: string | null;
  syllabusTopicId: string | null;
}

// ==================== SYLLABUS ====================

export interface Syllabus {
  id: string;
  schoolCode: string;
  classInstanceId: string;
  subjectId: string;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SyllabusChapter {
  id: string;
  syllabusId: string;
  chapterNo: number;
  title: string;
  description: string | null;
  refCode: string | null;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SyllabusTopic {
  id: string;
  chapterId: string;
  topicNo: number;
  title: string;
  description: string | null;
  refCode: string | null;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SyllabusProgress {
  id: string;
  schoolCode: string;
  classInstanceId: string;
  date: string; // YYYY-MM-DD format
  timetableSlotId: string;
  subjectId: string;
  teacherId: string;
  syllabusChapterId: string | null;
  syllabusTopicId: string | null;
  createdBy: string;
  createdAt: Date | null;
}

// ==================== TASKS ====================

export interface Task {
  id: string;
  schoolCode: string;
  academicYearId: string | null;
  classInstanceId: string | null;
  subjectId: string | null;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  assignedDate: string; // YYYY-MM-DD format
  dueDate: string; // YYYY-MM-DD format
  maxMarks: number | null;
  instructions: string | null;
  attachments: Record<string, any> | null;
  isActive: boolean | null;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  studentId: string;
  submissionText: string | null;
  attachments: Record<string, any> | null;
  submittedAt: Date | null;
  marksObtained: number | null;
  maxMarks: number | null;
  feedback: string | null;
  status: 'submitted' | 'graded' | 'returned' | 'late' | null;
  gradedBy: string | null;
  gradedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ==================== FEES ====================

export interface FeeComponentType {
  id: string;
  schoolCode: string;
  code: string;
  name: string;
  isRecurring: boolean;
  period: 'annual' | 'term' | 'monthly';
  isOptional: boolean;
  meta: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  defaultAmountInr: number | null;
}

export interface FeeStudentPlan {
  id: string;
  schoolCode: string;
  studentId: string;
  classInstanceId: string;
  academicYearId: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: Date;
}

export interface FeeStudentPlanItem {
  id: string;
  planId: string;
  componentTypeId: string;
  quantity: number;
  meta: Record<string, any>;
  createdAt: Date;
  amountInr: number | null;
}

export interface FeePayment {
  id: string;
  studentId: string;
  planId: string | null;
  componentTypeId: string;
  paymentDate: string; // YYYY-MM-DD format
  paymentMethod: 'cash' | 'cheque' | 'online' | 'card' | 'other' | null;
  transactionId: string | null;
  receiptNumber: string | null;
  remarks: string | null;
  schoolCode: string;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  recordedByName: string | null;
  amountInr: number | null;
}

// ==================== LEARNING RESOURCES ====================

export interface LearningResource {
  id: string;
  title: string;
  description: string | null;
  resourceType: 'video' | 'pdf' | 'quiz';
  contentUrl: string;
  fileSize: number | null;
  schoolCode: string;
  classInstanceId: string | null;
  subjectId: string | null;
  uploadedBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
