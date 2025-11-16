-- =====================================================
-- DATABASE MAINTENANCE - VACUUM & ANALYZE
-- Purpose: Clean up dead rows and update statistics
-- Run this weekly or when you see performance degradation
-- =====================================================

-- VACUUM ANALYZE removes dead rows and updates query planner statistics
-- This is safe to run on production - it won't lock tables for long

VACUUM ANALYZE attendance;
VACUUM ANALYZE student;
VACUUM ANALYZE timetable_slots;
VACUUM ANALYZE tasks;
VACUUM ANALYZE task_submissions;
VACUUM ANALYZE test_attempts;
VACUUM ANALYZE test_marks;
VACUUM ANALYZE tests;
VACUUM ANALYZE syllabus_topics;
VACUUM ANALYZE syllabus_chapters;
VACUUM ANALYZE fee_payments;
VACUUM ANALYZE fee_student_plans;
VACUUM ANALYZE class_instances;
VACUUM ANALYZE users;

-- Check for table bloat after cleanup
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percentage
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_dead_tup > 0
ORDER BY n_dead_tup DESC;

-- =====================================================
-- Query to identify slow queries causing CPU spikes
-- =====================================================
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- queries taking >100ms on average
ORDER BY mean_exec_time DESC
LIMIT 20;
