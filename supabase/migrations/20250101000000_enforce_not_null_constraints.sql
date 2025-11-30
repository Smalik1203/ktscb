-- Migration: Enforce NOT NULL constraints based on business logic
-- This migration enforces data integrity at the database level
-- Run data cleanup queries first to identify and fix existing null values

-- ==================== STUDENT TABLE ====================
-- Students must belong to a class
-- Step 1: Audit existing nulls
-- SELECT COUNT(*) FROM student WHERE class_instance_id IS NULL;

-- Step 2: Fix data (choose one approach):
-- Option A: Assign to a default class (if applicable)
-- UPDATE student SET class_instance_id = (SELECT id FROM class_instances WHERE school_code = student.school_code LIMIT 1)
--   WHERE class_instance_id IS NULL;

-- Option B: Delete students without classes (if they're invalid)
-- DELETE FROM student WHERE class_instance_id IS NULL;

-- Step 3: Apply constraint (uncomment after data cleanup)
-- ALTER TABLE student 
--   ALTER COLUMN class_instance_id SET NOT NULL;
-- 
-- COMMENT ON COLUMN student.class_instance_id IS 
--   'Required: Students must belong to a class instance';

-- ==================== CLASS_INSTANCES TABLE ====================
-- Class instances must have academic year, grade, and section

-- Step 1: Audit
-- SELECT COUNT(*) FROM class_instances WHERE academic_year_id IS NULL;
-- SELECT COUNT(*) FROM class_instances WHERE grade IS NULL;
-- SELECT COUNT(*) FROM class_instances WHERE section IS NULL;

-- Step 2: Fix data
-- For academic_year_id: Assign to active academic year
-- UPDATE class_instances ci
-- SET academic_year_id = (
--   SELECT id FROM academic_years 
--   WHERE school_code = ci.school_code 
--     AND is_active = true 
--   LIMIT 1
-- )
-- WHERE academic_year_id IS NULL;

-- For grade and section: Extract from class_id if available, or set defaults
-- UPDATE class_instances ci
-- SET grade = (SELECT grade FROM classes WHERE id = ci.class_id),
--     section = (SELECT section FROM classes WHERE id = ci.class_id)
-- WHERE (grade IS NULL OR section IS NULL) AND class_id IS NOT NULL;

-- Step 3: Apply constraints (uncomment after data cleanup)
-- ALTER TABLE class_instances 
--   ALTER COLUMN academic_year_id SET NOT NULL,
--   ALTER COLUMN grade SET NOT NULL,
--   ALTER COLUMN section SET NOT NULL;
-- 
-- COMMENT ON COLUMN class_instances.academic_year_id IS 
--   'Required: Class instances must belong to an academic year';
-- COMMENT ON COLUMN class_instances.grade IS 
--   'Required: Class instances must have a grade level';
-- COMMENT ON COLUMN class_instances.section IS 
--   'Required: Class instances must have a section identifier';

-- ==================== ATTENDANCE TABLE ====================
-- Attendance records must have class_instance_id and school_code

-- Step 1: Audit
-- SELECT COUNT(*) FROM attendance WHERE class_instance_id IS NULL;
-- SELECT COUNT(*) FROM attendance WHERE school_code IS NULL;

-- Step 2: Fix data
-- For class_instance_id: Derive from student's class
-- UPDATE attendance a
-- SET class_instance_id = (SELECT class_instance_id FROM student WHERE id = a.student_id)
-- WHERE class_instance_id IS NULL AND student_id IS NOT NULL;

-- For school_code: Derive from student's school
-- UPDATE attendance a
-- SET school_code = (SELECT school_code FROM student WHERE id = a.student_id)
-- WHERE school_code IS NULL AND student_id IS NOT NULL;

-- Step 3: Apply constraints (uncomment after data cleanup)
-- ALTER TABLE attendance 
--   ALTER COLUMN class_instance_id SET NOT NULL,
--   ALTER COLUMN school_code SET NOT NULL;
-- 
-- COMMENT ON COLUMN attendance.class_instance_id IS 
--   'Required: Attendance records must belong to a class';
-- COMMENT ON COLUMN attendance.school_code IS 
--   'Required: Attendance records must have school context for security';

-- ==================== NOTES ====================
-- 1. Always test migrations on a development/staging environment first
-- 2. Backup your database before running these migrations
-- 3. Run the audit queries first to understand the scope of data cleanup needed
-- 4. Choose appropriate data cleanup strategies based on your business rules
-- 5. After applying constraints, update TypeScript types to remove null unions
-- 6. Monitor application logs for any validation errors after migration

-- ==================== VERIFICATION ====================
-- After applying constraints, verify with:
-- SELECT 
--   table_name,
--   column_name,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('student', 'class_instances', 'attendance')
--   AND column_name IN ('class_instance_id', 'academic_year_id', 'grade', 'section', 'school_code')
-- ORDER BY table_name, column_name;

