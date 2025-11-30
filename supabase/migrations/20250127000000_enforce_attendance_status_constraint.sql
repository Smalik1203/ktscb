-- Migration: Enforce attendance status constraint
-- Description: Restrict attendance.status to only 'present' or 'absent'
-- Date: 2025-01-27

-- Step 1: Clean up any invalid status values (if any exist)
-- Convert 'late' or 'excused' to 'absent' as a reasonable default
UPDATE attendance
SET status = 'absent'
WHERE status NOT IN ('present', 'absent');

-- Step 2: Add CHECK constraint to enforce valid status values
-- This will prevent any future inserts/updates with invalid status values
ALTER TABLE attendance
DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE attendance
ADD CONSTRAINT attendance_status_check
CHECK (status IN ('present', 'absent'));

-- Step 3: Add a comment to document the constraint
COMMENT ON CONSTRAINT attendance_status_check ON attendance IS 
  'Enforces that attendance status can only be ''present'' or ''absent''';

-- Step 4: Verify the constraint
-- This query should return 0 rows if constraint is working
SELECT 
  COUNT(*) as invalid_status_count,
  array_agg(DISTINCT status) as invalid_statuses
FROM attendance
WHERE status NOT IN ('present', 'absent');

-- Expected result: 0 rows (all statuses should be valid)

