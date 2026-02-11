-- =====================================================
-- Tests RPCs: atomic create + stats aggregation
-- =====================================================

-- Ensure upsert safety for task submissions
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_submissions_task_student_unique
ON task_submissions(task_id, student_id);

-- Create test + questions atomically (no client-side transaction)
CREATE OR REPLACE FUNCTION create_test_with_questions(
  test_payload jsonb,
  questions_payload jsonb
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
  max_marks numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_school_code text;
  v_test_id uuid;
BEGIN
  SELECT school_code
  INTO v_school_code
  FROM users
  WHERE id = v_user_id;

  IF v_user_id IS NULL OR v_school_code IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM class_instances
    WHERE id = (test_payload->>'class_instance_id')::uuid
      AND school_code = v_school_code
  ) THEN
    RAISE EXCEPTION 'Invalid class for school';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM subjects
    WHERE id = (test_payload->>'subject_id')::uuid
      AND school_code = v_school_code
  ) THEN
    RAISE EXCEPTION 'Invalid subject for school';
  END IF;

  INSERT INTO tests (
    title,
    description,
    class_instance_id,
    subject_id,
    school_code,
    test_type,
    time_limit_seconds,
    created_by,
    allow_reattempts,
    chapter_id,
    test_mode,
    test_date,
    status,
    max_marks
  )
  VALUES (
    test_payload->>'title',
    test_payload->>'description',
    (test_payload->>'class_instance_id')::uuid,
    (test_payload->>'subject_id')::uuid,
    v_school_code,
    test_payload->>'test_type',
    (test_payload->>'time_limit_seconds')::integer,
    v_user_id,
    COALESCE((test_payload->>'allow_reattempts')::boolean, false),
    (test_payload->>'chapter_id')::uuid,
    test_payload->>'test_mode',
    (test_payload->>'test_date')::date,
    test_payload->>'status',
    (test_payload->>'max_marks')::numeric
  )
  RETURNING id INTO v_test_id;

  IF questions_payload IS NOT NULL THEN
    INSERT INTO test_questions (
      test_id,
      question_text,
      question_type,
      options,
      correct_index,
      correct_text,
      correct_answer,
      points,
      order_index
    )
    SELECT
      v_test_id,
      q.question_text,
      q.question_type,
      q.options,
      q.correct_index,
      q.correct_text,
      q.correct_answer,
      q.points,
      q.order_index
    FROM jsonb_to_recordset(questions_payload) AS q(
      question_text text,
      question_type text,
      options jsonb,
      correct_index integer,
      correct_text text,
      correct_answer text,
      points numeric,
      order_index integer
    );
  END IF;

  RETURN QUERY
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
    t.max_marks
  FROM tests t
  WHERE t.id = v_test_id;
END;
$$;

-- Get tests with aggregated stats in one query
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
  SELECT school_code
  INTO v_school_code
  FROM users
  WHERE id = v_user_id;

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
    SELECT test_id, COUNT(*) AS question_count
    FROM test_questions
    WHERE test_id IN (SELECT id FROM base_tests)
    GROUP BY test_id
  ),
  attempt_counts AS (
    SELECT test_id, COUNT(*) AS attempts_count
    FROM test_attempts
    WHERE test_id IN (SELECT id FROM base_tests)
    GROUP BY test_id
  ),
  marks_counts AS (
    SELECT test_id, COUNT(*) AS marks_uploaded
    FROM test_marks
    WHERE test_id IN (SELECT id FROM base_tests)
    GROUP BY test_id
  ),
  student_counts AS (
    SELECT class_instance_id, COUNT(*) AS total_students
    FROM student
    WHERE class_instance_id IN (SELECT class_instance_id FROM base_tests)
    GROUP BY class_instance_id
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
    bt.max_marks,
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
