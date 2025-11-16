-- Populate attendance for all students for the last 30 days
-- This script generates realistic attendance data (mostly present, some absent/late)

-- First, let's see what students we have
-- SELECT id, full_name, class_instance_id, school_code FROM student LIMIT 10;

-- Generate attendance records for the last 30 days
-- Status distribution: ~85% present, ~15% absent
-- Note: Only 'present' and 'absent' are allowed (no 'late' status)
INSERT INTO attendance (
  student_id,
  class_instance_id,
  status,
  date,
  marked_by,
  marked_by_role_code,
  school_code
)
SELECT 
  s.id as student_id,
  s.class_instance_id,
  CASE 
    WHEN random() < 0.85 THEN 'present'
    ELSE 'absent'
  END as status,
  date_series.date as date,
  COALESCE(
    (SELECT admin_code FROM admin WHERE admin.school_code = s.school_code LIMIT 1),
    'system'
  ) as marked_by,
  COALESCE(
    (SELECT role FROM admin WHERE admin.school_code = s.school_code LIMIT 1),
    'admin'
  ) as marked_by_role_code,
  s.school_code
FROM student s
CROSS JOIN LATERAL (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE - INTERVAL '1 day',
    INTERVAL '1 day'
  )::date as date
) date_series
WHERE s.class_instance_id IS NOT NULL
  AND s.school_code = 'SCH019'
  -- Skip weekends (Saturday = 6, Sunday = 0)
  AND EXTRACT(DOW FROM date_series.date) NOT IN (0, 6)
  -- Only insert if record doesn't already exist
  AND NOT EXISTS (
    SELECT 1 FROM attendance a
    WHERE a.student_id = s.id
      AND a.date = date_series.date
  )
ON CONFLICT DO NOTHING;

-- Return summary of inserted records
SELECT 
  status,
  COUNT(*) as count,
  COUNT(DISTINCT student_id) as unique_students,
  COUNT(DISTINCT date) as unique_dates
FROM attendance
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY status
ORDER BY status;

