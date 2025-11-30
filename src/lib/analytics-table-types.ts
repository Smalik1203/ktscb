// Type definitions for table-first analytics architecture

// ==============================================================================
// QUERY FILTERS
// ==============================================================================

export interface AnalyticsQueryFilters {
  school_code: string;
  academic_year_id: string | undefined; // Can be undefined when academic year is not yet loaded
  start_date: string; // ISO date string (YYYY-MM-DD)
  end_date: string; // ISO date string (YYYY-MM-DD)
}

export interface OptionalAnalyticsFilters {
  class_instance_id?: string;
  student_id?: string;
  teacher_id?: string;
  subject_id?: string;
}

// ==============================================================================
// TREND CALCULATION
// ==============================================================================

export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendDelta {
  current: number;
  previous: number;
  delta: number; // Absolute change
  deltaPercent: number; // Percentage change
  direction: TrendDirection;
}

// ==============================================================================
// RANKED ROWS (GENERIC)
// ==============================================================================

export interface RankedRow<T> {
  rank: number;
  data: T;
  trend: TrendDelta;
}

export type SortOrder = 'asc' | 'desc';

// ==============================================================================
// MODULE-SPECIFIC ROW TYPES
// ==============================================================================

// 1. ATTENDANCE MODULE

export interface AttendanceRow {
  classId: string;
  className: string;
  presentCount: number;
  totalCount: number;
  rate: number; // Percentage (0-100)
  lastUpdated: string; // ISO date string
}

export interface AttendanceDetailRow extends AttendanceRow {
  schoolCode: string;
  academicYearId: string;
  dateRange: string; // e.g., "2024-01-01 to 2024-01-31"
}

// 2. FEES MODULE

export type FeeStatus = 'paid' | 'current' | 'overdue' | 'no_billing';
export type AgingBucket = 'current' | '30-60' | '60-90' | '90+';

export interface FeeRow {
  studentId: string;
  studentName: string;
  className: string;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  status: FeeStatus;
  agingDays: number;
  agingBucket: AgingBucket;
  lastPaymentDate: string | null; // ISO date string
}

export interface FeeDetailRow extends FeeRow {
  rollNumber: string;
  planName: string;
  dueDate: string | null;
}

// 3. ACADEMICS MODULE

export interface AcademicsRow {
  studentId: string;
  studentName: string;
  className: string;
  subjectId: string;
  subjectName: string;
  avgScore: number; // Percentage (0-100)
  testCount: number;
  lastTestDate: string | null; // ISO date string
}

export interface AcademicsDetailRow extends AcademicsRow {
  rollNumber: string;
  highestScore: number;
  lowestScore: number;
  personalBest: number;
}

// 4. TASKS MODULE

export type TaskStatus = 'pending' | 'completed' | 'overdue';

export interface TaskRow {
  taskId: string;
  taskName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  dueDate: string; // ISO date string
  totalStudents: number;
  submittedCount: number;
  onTimeCount: number;
  onTimeRate: number; // Percentage (0-100)
  status: TaskStatus;
}

export interface TaskDetailRow extends TaskRow {
  createdAt: string;
  description: string;
  maxMarks: number | null;
  avgMarks: number | null;
}

// 5. SYLLABUS MODULE

export interface SyllabusRow {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  completedTopics: number;
  totalTopics: number;
  progress: number; // Percentage (0-100)
  lastUpdated: string | null; // ISO date string
}

export interface SyllabusDetailRow extends SyllabusRow {
  teacherId: string;
  teacherName: string;
  chapters: {
    chapterId: string;
    chapterName: string;
    completedTopics: number;
    totalTopics: number;
  }[];
}

// 6. OPERATIONS MODULE

export interface OperationsRow {
  teacherId: string;
  teacherName: string;
  totalPeriods: number;
  conductedPeriods: number;
  coveragePercent: number; // Percentage (0-100)
  classCount: number; // Number of unique classes taught
  subjectCount: number; // Number of unique subjects taught
}

export interface OperationsDetailRow extends OperationsRow {
  email: string | null;
  phone: string | null;
  classes: {
    classId: string;
    className: string;
    subjectName: string;
    periods: number;
  }[];
}

// ==============================================================================
// DASHBOARD MODULE SUMMARY
// ==============================================================================

export interface ModuleSummary {
  moduleId: string;
  moduleName: string;
  icon: string; // Icon name for lucide-react-native
  primaryMetric: {
    label: string;
    value: string; // Formatted display value (e.g., "92%", "$1,234")
    rawValue: number;
  };
  trend: TrendDelta;
  topRows: RankedRow<any>[]; // Top 3 preview rows
}

export interface DashboardData {
  attendance: ModuleSummary;
  fees: ModuleSummary;
  academics: ModuleSummary;
  tasks: ModuleSummary;
  syllabus: ModuleSummary;
  operations: ModuleSummary;
}

// ==============================================================================
// PAGINATION & FILTERING
// ==============================================================================

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface ClientFilterParams {
  searchQuery?: string;
  sortField?: string;
  sortOrder?: SortOrder;
  statusFilter?: string[];
  customFilters?: Record<string, any>;
}

// ==============================================================================
// AGGREGATION RESULTS
// ==============================================================================

export interface AttendanceAggregation {
  totalClasses: number;
  totalPresent: number;
  totalAbsent: number;
  avgRate: number;
  classSummaries: AttendanceRow[];
}

export interface FeeAggregation {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  realizationRate: number;
  agingBreakdown: Record<AgingBucket, number>;
  studentSummaries: FeeRow[];
}

export interface AcademicsAggregation {
  totalTests: number;
  totalStudents: number;
  avgScore: number;
  participationRate: number;
  subjectSummaries: {
    subjectId: string;
    subjectName: string;
    avgScore: number;
    testCount: number;
  }[];
  studentSummaries: AcademicsRow[];
}

export interface TaskAggregation {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  avgOnTimeRate: number;
  taskSummaries: TaskRow[];
}

export interface SyllabusAggregation {
  overallProgress: number;
  totalSubjects: number;
  completedSubjects: number;
  subjectSummaries: SyllabusRow[];
}

export interface OperationsAggregation {
  totalTeachers: number;
  totalPeriods: number;
  conductedPeriods: number;
  avgCoverage: number;
  teacherSummaries: OperationsRow[];
}

// ==============================================================================
// HELPER TYPES
// ==============================================================================

export type ModuleType = 'attendance' | 'fees' | 'academics' | 'tasks' | 'syllabus' | 'operations';

export type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DateRangePreset {
  label: string;
  period: TimePeriod;
  startDate: string;
  endDate: string;
}
