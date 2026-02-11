-- =====================================================
-- Fix return type mismatch in tests stats RPC
-- =====================================================

CREATE OR REPLACE FUNCTION get_tests_with_stats(
  p_class_instance_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_test_mode text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  class_instance_id uuid,
  subject_id uuid,
  school_code text,
  test_type text,
  time_limit_seconds integer,
  created_by uuid,
  created_at timestamptz,
  allow_reattempts boolean,
  chapter_id uuid,
  test_mode text,
  test_date date,
  status text,
  max_marks numeric,
  class_name text,
  subject_name text,
  question_count integer,
  marks_uploaded integer,
  total_students integer,
  attempts_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_school_code text;
BEGIN
  SELECT u.school_code
  INTO v_school_code
  FROM users u
  WHERE u.id = v_user_id;

  IF v_user_id IS NULL OR v_school_code IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH base_tests AS (
    SELECT
      t.id,
      t.title,
      t.description,
      t.class_instance_id,
      t.subject_id,
      t.school_code,
      t.test_type,
      t.time_limit_seconds,
      t.created_by,
      t.created_at,
      t.allow_reattempts,
      t.chapter_id,
      t.test_mode,
      t.test_date,
      t.status,
      t.max_marks,
      ci.grade,
      ci.section,
      s.subject_name
    FROM tests t
    JOIN class_instances ci ON ci.id = t.class_instance_id
    LEFT JOIN subjects s ON s.id = t.subject_id
    WHERE t.school_code = v_school_code
      AND (p_class_instance_id IS NULL OR t.class_instance_id = p_class_instance_id)
      AND (p_test_mode IS NULL OR t.test_mode = p_test_mode)
    ORDER BY t.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ),
  question_counts AS (
    SELECT tq.test_id, COUNT(*)::int AS question_count
    FROM test_questions tq
    WHERE tq.test_id IN (SELECT base_tests.id FROM base_tests)
    GROUP BY tq.test_id
  ),
  attempt_counts AS (
    SELECT ta.test_id, COUNT(*)::int AS attempts_count
    FROM test_attempts ta
    WHERE ta.test_id IN (SELECT base_tests.id FROM base_tests)
    GROUP BY ta.test_id
  ),
  marks_counts AS (
    SELECT tm.test_id, COUNT(*)::int AS marks_uploaded
    FROM test_marks tm
    WHERE tm.test_id IN (SELECT base_tests.id FROM base_tests)
    GROUP BY tm.test_id
  ),
  student_counts AS (
    SELECT s.class_instance_id, COUNT(*)::int AS total_students
    FROM student s
    WHERE s.class_instance_id IN (SELECT base_tests.class_instance_id FROM base_tests)
    GROUP BY s.class_instance_id
  )
  SELECT
    bt.id,
    bt.title,
    bt.description,
    bt.class_instance_id,
    bt.subject_id,
    bt.school_code,
    bt.test_type,
    bt.time_limit_seconds,
    bt.created_by,
    bt.created_at,
    bt.allow_reattempts,
    bt.chapter_id,
    bt.test_mode,
    bt.test_date,
    bt.status,
    bt.max_marks::numeric,
    CASE
      WHEN bt.grade IS NOT NULL THEN CONCAT('Grade ', bt.grade, COALESCE(CONCAT(' - ', bt.section), ''))
      ELSE 'Unknown Class'
    END AS class_name,
    COALESCE(bt.subject_name, 'Unknown') AS subject_name,
    COALESCE(q.question_count, 0) AS question_count,
    COALESCE(m.marks_uploaded, 0) AS marks_uploaded,
    COALESCE(sc.total_students, 0) AS total_students,
    COALESCE(a.attempts_count, 0) AS attempts_count
  FROM base_tests bt
  LEFT JOIN question_counts q ON q.test_id = bt.id
  LEFT JOIN attempt_counts a ON a.test_id = bt.id
  LEFT JOIN marks_counts m ON m.test_id = bt.id
  LEFT JOIN student_counts sc ON sc.class_instance_id = bt.class_instance_id;
END;
$$;
