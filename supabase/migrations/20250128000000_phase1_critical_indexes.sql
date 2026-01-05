-- =====================================================
-- PHASE 1: CRITICAL COMPOSITE INDEXES
-- Created: 2025-01-28
-- Purpose: Add missing composite indexes identified in performance audit
-- Expected Impact: 10-50× query speedup for critical queries
-- =====================================================

-- =====================================================
-- INDEX 1: fee_invoices - Composite Index for Billing Period Queries
-- =====================================================
-- Purpose: Optimize queries filtering by student_id + billing_period + school_code
-- Affected Queries:
--   - src/services/fees.ts:160 - getByStudent()
--   - src/services/fees.ts:138 - getByClass() (filters by student_id list)
CREATE INDEX IF NOT EXISTS idx_fee_invoices_student_billing_period 
ON fee_invoices(student_id, billing_period DESC, school_code)
WHERE student_id IS NOT NULL AND school_code IS NOT NULL;

-- =====================================================
-- INDEX 2: attendance - Composite Index for School + Date Range + Status
-- =====================================================
-- Purpose: Optimize analytics queries filtering by school_code + date range + status
-- Affected Queries:
--   - src/hooks/analytics/useAggregatedAnalytics.ts:49 - fetchAttendanceData()
--   - src/data/queries.ts:479 - getAttendanceOverview()
-- Note: This complements existing idx_attendance_school_date but adds status filter
CREATE INDEX IF NOT EXISTS idx_attendance_school_date_range 
ON attendance(school_code, date DESC, class_instance_id, status)
WHERE school_code IS NOT NULL;

-- =====================================================
-- INDEX 3: test_marks - Covering Index for Student + Test Performance
-- =====================================================
-- Purpose: Covering index for student progress queries that need marks_obtained and max_marks
-- Affected Queries:
--   - src/hooks/useStudentProgress.ts:150 - Test marks query
--   - src/hooks/analytics/useAcademicsAnalytics.ts:88 - Test marks aggregation
-- Note: This is a covering index that includes frequently accessed columns
CREATE INDEX IF NOT EXISTS idx_test_marks_student_test_covering 
ON test_marks(student_id, test_id, marks_obtained, max_marks, created_at)
WHERE student_id IS NOT NULL;

-- =====================================================
-- INDEX 4: task_submissions - Composite Index for Task + Status
-- =====================================================
-- Purpose: Optimize task analytics queries filtering by task_id + status
-- Affected Queries:
--   - src/hooks/analytics/useTasksAnalytics.ts:73 - Task submissions query
--   - src/hooks/useTasks.ts:142 - Task submissions query
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_status 
ON task_submissions(task_id, status, submitted_at DESC, student_id)
WHERE task_id IS NOT NULL;

-- =====================================================
-- INDEX 5: syllabus_progress - Composite Index for Class + Subject + Date
-- =====================================================
-- Purpose: Optimize syllabus analytics queries filtering by class_instance_id + subject_id
-- Affected Queries:
--   - src/hooks/analytics/useSyllabusAnalytics.ts - Multiple queries
--   - src/hooks/useDashboard.ts:595 - Syllabus progress query
CREATE INDEX IF NOT EXISTS idx_syllabus_progress_class_subject_date 
ON syllabus_progress(class_instance_id, subject_id, date DESC, syllabus_topic_id)
WHERE class_instance_id IS NOT NULL;

-- =====================================================
-- UPDATE STATISTICS
-- =====================================================
-- Update query planner statistics for optimal index usage
ANALYZE fee_invoices;
ANALYZE attendance;
ANALYZE test_marks;
ANALYZE task_submissions;
ANALYZE syllabus_progress;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Verify indexes were created successfully
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN (
    'idx_fee_invoices_student_billing_period',
    'idx_attendance_school_date_range',
    'idx_test_marks_student_test_covering',
    'idx_task_submissions_task_status',
    'idx_syllabus_progress_class_subject_date'
)
ORDER BY tablename, indexname;

