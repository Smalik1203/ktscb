-- =====================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Created: 2025-11-09
-- Purpose: Fix load test performance issues
-- Expected Impact: 10-50x query speedup
-- =====================================================

-- Drop existing indexes if they exist (for idempotency)
DROP INDEX IF EXISTS idx_attendance_class_date;
DROP INDEX IF EXISTS idx_attendance_student_date;
DROP INDEX IF EXISTS idx_attendance_school_date;
DROP INDEX IF EXISTS idx_student_school_class;
DROP INDEX IF EXISTS idx_student_school;
DROP INDEX IF EXISTS idx_test_attempts_student_test;
DROP INDEX IF EXISTS idx_test_attempts_test;
DROP INDEX IF EXISTS idx_test_marks_student;
DROP INDEX IF EXISTS idx_timetable_class_date;
DROP INDEX IF EXISTS idx_timetable_class_day;
DROP INDEX IF EXISTS idx_tasks_student_status;
DROP INDEX IF EXISTS idx_tasks_class_due;
DROP INDEX IF EXISTS idx_task_submissions_student;
DROP INDEX IF EXISTS idx_fee_payments_student;
DROP INDEX IF EXISTS idx_fee_student_plans_student;
DROP INDEX IF EXISTS idx_class_instances_school_year;
DROP INDEX IF EXISTS idx_users_auth_id;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_admin_user;
DROP INDEX IF EXISTS idx_captain_user;
DROP INDEX IF EXISTS idx_syllabus_class_subject;
DROP INDEX IF EXISTS idx_syllabus_chapters_syllabus;
DROP INDEX IF EXISTS idx_syllabus_topics_chapter;
DROP INDEX IF EXISTS idx_learning_resources_school_subject;

-- =====================================================
-- ATTENDANCE INDEXES (Most Critical - Hit ~30x per day)
-- =====================================================

-- Primary attendance lookup: by class and date
CREATE INDEX idx_attendance_class_date
ON attendance(class_instance_id, date DESC)
WHERE class_instance_id IS NOT NULL;

-- Student attendance history
CREATE INDEX idx_attendance_student_date
ON attendance(student_id, date DESC)
WHERE student_id IS NOT NULL;

-- School-wide attendance reports
CREATE INDEX idx_attendance_school_date
ON attendance(school_code, date DESC)
WHERE school_code IS NOT NULL;

-- Composite index for attendance queries with status filter
CREATE INDEX idx_attendance_class_date_status
ON attendance(class_instance_id, date, status)
WHERE class_instance_id IS NOT NULL;

-- =====================================================
-- STUDENT INDEXES (High frequency queries)
-- =====================================================

-- Most common student lookup: by school and class
CREATE INDEX idx_student_school_class
ON student(school_code, class_instance_id)
WHERE school_code IS NOT NULL AND class_instance_id IS NOT NULL;

-- Student by school (for admin queries)
CREATE INDEX idx_student_school
ON student(school_code)
WHERE school_code IS NOT NULL;

-- Student by auth_user_id (for login/profile)
CREATE INDEX idx_student_auth_user
ON student(auth_user_id)
WHERE auth_user_id IS NOT NULL;

-- Full text search on student names (for search functionality)
CREATE INDEX idx_student_name_search
ON student USING gin(to_tsvector('english', full_name));

-- =====================================================
-- TEST/ASSESSMENT INDEXES
-- =====================================================

-- Student test attempts
CREATE INDEX idx_test_attempts_student_test
ON test_attempts(student_id, test_id, created_at DESC)
WHERE student_id IS NOT NULL;

-- Test submissions for grading
CREATE INDEX idx_test_attempts_test
ON test_attempts(test_id, submitted_at DESC)
WHERE test_id IS NOT NULL;

-- Test marks lookup
CREATE INDEX idx_test_marks_student
ON test_marks(student_id, created_at DESC)
WHERE student_id IS NOT NULL;

-- Tests by class
CREATE INDEX idx_tests_class_created
ON tests(class_instance_id, created_at DESC)
WHERE class_instance_id IS NOT NULL;

-- =====================================================
-- TIMETABLE INDEXES
-- =====================================================

-- Timetable by class and date
CREATE INDEX idx_timetable_class_date
ON timetable_slots(class_instance_id, class_date DESC)
WHERE class_instance_id IS NOT NULL;

-- Timetable by class and day of week (for weekly view)
CREATE INDEX idx_timetable_class_day
ON timetable_slots(class_instance_id, day_of_week)
WHERE class_instance_id IS NOT NULL;

-- Timetable by school (for admin overview)
CREATE INDEX idx_timetable_school
ON timetable_slots(school_code, class_date DESC)
WHERE school_code IS NOT NULL;

-- =====================================================
-- TASKS/ASSIGNMENTS INDEXES
-- =====================================================

-- Student tasks by status and due date
CREATE INDEX idx_tasks_student_status
ON tasks(student_id, status, due_date DESC)
WHERE student_id IS NOT NULL;

-- Class tasks by due date
CREATE INDEX idx_tasks_class_due
ON tasks(class_instance_id, due_date DESC)
WHERE class_instance_id IS NOT NULL;

-- Task submissions
CREATE INDEX idx_task_submissions_student
ON task_submissions(student_id, task_id, submitted_at DESC)
WHERE student_id IS NOT NULL;

-- Task submissions by task (for teacher grading)
CREATE INDEX idx_task_submissions_task
ON task_submissions(task_id, submitted_at DESC)
WHERE task_id IS NOT NULL;

-- =====================================================
-- FEE MANAGEMENT INDEXES
-- =====================================================

-- Student fee payments
CREATE INDEX idx_fee_payments_student
ON fee_payments(student_id, payment_date DESC)
WHERE student_id IS NOT NULL;

-- Fee student plans
CREATE INDEX idx_fee_student_plans_student
ON fee_student_plans(student_id, academic_year_id)
WHERE student_id IS NOT NULL;

-- Fee plans by school and year
CREATE INDEX idx_fee_student_plans_school_year
ON fee_student_plans(school_code, academic_year_id)
WHERE school_code IS NOT NULL;

-- =====================================================
-- CLASS & SCHOOL INDEXES
-- =====================================================

-- Class instances by school and academic year
CREATE INDEX idx_class_instances_school_year
ON class_instances(school_code, academic_year_id)
WHERE school_code IS NOT NULL;

-- Class instances by academic year
CREATE INDEX idx_class_instances_year
ON class_instances(academic_year_id)
WHERE academic_year_id IS NOT NULL;

-- =====================================================
-- USER/AUTH INDEXES
-- =====================================================

-- User lookup by auth_user_id (critical for login)
CREATE INDEX idx_users_auth_id
ON users(auth_user_id)
WHERE auth_user_id IS NOT NULL;

-- User lookup by email
CREATE INDEX idx_users_email
ON users(email)
WHERE email IS NOT NULL;

-- Users by school and role
CREATE INDEX idx_users_school_role
ON users(school_code, role)
WHERE school_code IS NOT NULL;

-- Admin by user_id
CREATE INDEX idx_admin_user
ON admin(user_id)
WHERE user_id IS NOT NULL;

-- Captain by user_id (for transport system)
CREATE INDEX idx_captain_user
ON captain(user_id)
WHERE user_id IS NOT NULL;

-- =====================================================
-- SYLLABUS/CURRICULUM INDEXES
-- =====================================================

-- Syllabus by class and subject
CREATE INDEX idx_syllabus_class_subject
ON syllabi(class_instance_id, subject_id)
WHERE class_instance_id IS NOT NULL;

-- Syllabus chapters
CREATE INDEX idx_syllabus_chapters_syllabus
ON syllabus_chapters(syllabus_id, chapter_order)
WHERE syllabus_id IS NOT NULL;

-- Syllabus topics
CREATE INDEX idx_syllabus_topics_chapter
ON syllabus_topics(chapter_id, topic_order)
WHERE chapter_id IS NOT NULL;

-- =====================================================
-- LEARNING RESOURCES INDEXES
-- =====================================================

-- Resources by school and subject
CREATE INDEX idx_learning_resources_school_subject
ON learning_resources(school_code, subject_id)
WHERE school_code IS NOT NULL;

-- Resources by subject
CREATE INDEX idx_learning_resources_subject
ON learning_resources(subject_id)
WHERE subject_id IS NOT NULL;

-- =====================================================
-- CALENDAR/EVENTS INDEXES
-- =====================================================

-- Calendar events by school and date
CREATE INDEX idx_calendar_events_school_date
ON school_calendar_events(school_code, start_date DESC)
WHERE school_code IS NOT NULL;

-- =====================================================
-- ANALYTICS HELPER - Covering Indexes
-- =====================================================

-- Covering index for attendance percentage calculations
CREATE INDEX idx_attendance_stats_covering
ON attendance(class_instance_id, date, status, student_id)
WHERE class_instance_id IS NOT NULL;

-- Covering index for student performance queries
CREATE INDEX idx_test_marks_performance_covering
ON test_marks(student_id, marks_obtained, test_id, created_at)
WHERE student_id IS NOT NULL;

-- =====================================================
-- ANALYZE TABLES (Update Statistics)
-- =====================================================

ANALYZE attendance;
ANALYZE student;
ANALYZE test_attempts;
ANALYZE test_marks;
ANALYZE timetable_slots;
ANALYZE tasks;
ANALYZE task_submissions;
ANALYZE fee_payments;
ANALYZE fee_student_plans;
ANALYZE class_instances;
ANALYZE users;
ANALYZE syllabi;
ANALYZE syllabus_chapters;
ANALYZE syllabus_topics;
ANALYZE learning_resources;
ANALYZE school_calendar_events;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Check table sizes and index usage
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
