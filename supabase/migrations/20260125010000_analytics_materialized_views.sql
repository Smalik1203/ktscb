-- =====================================================
-- Analytics Materialized Views + RPC Functions
-- Purpose: Move analytics aggregation to DB (RPC + MV)
-- =====================================================

-- Helper: trend calculation (matches analytics-utils.ts)
CREATE OR REPLACE FUNCTION analytics_trend_delta(current_val numeric, previous_val numeric)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  delta_val numeric := current_val - previous_val;
  delta_percent numeric := CASE
    WHEN previous_val = 0 THEN CASE WHEN current_val > 0 THEN 100 ELSE 0 END
    ELSE (delta_val / previous_val) * 100
  END;
  direction text := 'stable';
BEGIN
  IF abs(delta_percent) > 0.5 THEN
    direction := CASE WHEN delta_val > 0 THEN 'up' ELSE 'down' END;
  END IF;

  RETURN jsonb_build_object(
    'current', current_val,
    'previous', previous_val,
    'delta', delta_val,
    'deltaPercent', delta_percent,
    'direction', direction
  );
END;
$$;

-- =====================================================
-- TASKS ANALYTICS MATERIALIZED VIEW
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS mv_tasks_analytics;

CREATE MATERIALIZED VIEW mv_tasks_analytics AS
SELECT
  t.id AS task_id,
  t.title AS task_name,
  t.class_instance_id,
  t.subject_id,
  t.due_date,
  t.created_at,
  t.school_code,
  t.academic_year_id,
  CASE
    WHEN ci.grade IS NOT NULL THEN CONCAT('Grade ', ci.grade, COALESCE(CONCAT(' - ', ci.section), ''))
    ELSE 'Unknown Class'
  END AS class_name,
  COALESCE(s.subject_name, 'Unknown') AS subject_name,
  COUNT(DISTINCT st.id) AS total_students,
  COUNT(ts.id) AS submitted_count,
  COUNT(ts.id) FILTER (WHERE ts.submitted_at <= t.due_date) AS on_time_count,
  CASE
    WHEN COUNT(ts.id) > 0
      THEN (COUNT(ts.id) FILTER (WHERE ts.submitted_at <= t.due_date)::numeric / COUNT(ts.id)::numeric) * 100
    ELSE 0
  END AS on_time_rate,
  CASE
    WHEN COUNT(DISTINCT st.id) > 0 AND COUNT(ts.id) >= COUNT(DISTINCT st.id) THEN 'completed'
    WHEN CURRENT_DATE > t.due_date THEN 'overdue'
    ELSE 'pending'
  END AS status
FROM tasks t
JOIN class_instances ci ON ci.id = t.class_instance_id
LEFT JOIN subjects s ON s.id = t.subject_id
LEFT JOIN student st ON st.class_instance_id = t.class_instance_id
LEFT JOIN task_submissions ts ON ts.task_id = t.id
WHERE t.is_active = true
GROUP BY
  t.id,
  t.title,
  t.class_instance_id,
  t.subject_id,
  t.due_date,
  t.created_at,
  t.school_code,
  t.academic_year_id,
  ci.grade,
  ci.section,
  s.subject_name;

CREATE UNIQUE INDEX mv_tasks_analytics_task_id_idx ON mv_tasks_analytics(task_id);
CREATE INDEX mv_tasks_analytics_school_date_idx ON mv_tasks_analytics(school_code, academic_year_id, due_date DESC);
CREATE INDEX mv_tasks_analytics_class_date_idx ON mv_tasks_analytics(class_instance_id, due_date DESC);

-- =====================================================
-- ATTENDANCE ANALYTICS MATERIALIZED VIEW (Daily, per class)
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS mv_attendance_daily_class;

CREATE MATERIALIZED VIEW mv_attendance_daily_class AS
SELECT
  a.class_instance_id,
  ci.school_code,
  ci.academic_year_id,
  a.date,
  CASE
    WHEN ci.grade IS NOT NULL THEN CONCAT('Grade ', ci.grade, COALESCE(CONCAT(' - ', ci.section), ''))
    ELSE 'Unknown Class'
  END AS class_name,
  COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
  COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count,
  COUNT(*) AS total_count
FROM attendance a
JOIN class_instances ci ON ci.id = a.class_instance_id
GROUP BY
  a.class_instance_id,
  ci.school_code,
  ci.academic_year_id,
  a.date,
  ci.grade,
  ci.section;

CREATE UNIQUE INDEX mv_attendance_daily_class_unique_idx
  ON mv_attendance_daily_class(class_instance_id, date);
CREATE INDEX mv_attendance_daily_class_school_date_idx
  ON mv_attendance_daily_class(school_code, academic_year_id, date DESC);

-- =====================================================
-- OPERATIONS ANALYTICS MATERIALIZED VIEW (Slots)
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS mv_operations_slots;

CREATE MATERIALIZED VIEW mv_operations_slots AS
SELECT
  ts.id AS slot_id,
  ts.teacher_id,
  ts.subject_id,
  ts.class_instance_id,
  ts.class_date,
  ts.is_conducted,
  ci.school_code,
  ci.academic_year_id,
  CASE
    WHEN ci.grade IS NOT NULL THEN CONCAT('Grade ', ci.grade, COALESCE(CONCAT(' - ', ci.section), ''))
    ELSE 'Unknown Class'
  END AS class_name,
  COALESCE(s.subject_name, 'Unknown') AS subject_name,
  COALESCE(a.full_name, 'Unknown Teacher') AS teacher_name
FROM timetable_slots ts
JOIN class_instances ci ON ci.id = ts.class_instance_id
LEFT JOIN subjects s ON s.id = ts.subject_id
LEFT JOIN admin a ON a.id = ts.teacher_id;

CREATE UNIQUE INDEX mv_operations_slots_unique_idx ON mv_operations_slots(slot_id);
CREATE INDEX mv_operations_slots_school_date_idx ON mv_operations_slots(school_code, academic_year_id, class_date DESC);
CREATE INDEX mv_operations_slots_teacher_date_idx ON mv_operations_slots(teacher_id, class_date DESC);

-- =====================================================
-- ACADEMICS ANALYTICS MATERIALIZED VIEW (Marks with computed score)
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS mv_academics_marks;

CREATE MATERIALIZED VIEW mv_academics_marks AS
WITH test_max_marks AS (
  SELECT
    tq.test_id,
    SUM(COALESCE(tq.points, 0)) AS max_marks
  FROM test_questions tq
  GROUP BY tq.test_id
)
SELECT
  tm.id AS mark_id,
  tm.test_id,
  tm.student_id,
  tm.marks_obtained,
  t.created_at AS test_created_at,
  COALESCE(t.test_date, t.created_at::date) AS test_date,
  t.subject_id,
  t.class_instance_id,
  ci.school_code,
  ci.academic_year_id,
  COALESCE(s.subject_name, 'Unknown') AS subject_name,
  COALESCE(st.full_name, 'Unknown') AS student_name,
  CASE
    WHEN ci.grade IS NOT NULL THEN CONCAT('Grade ', ci.grade, COALESCE(CONCAT(' - ', ci.section), ''))
    ELSE 'Unknown Class'
  END AS class_name,
  CASE
    WHEN COALESCE(tmm.max_marks, 0) > 0
      THEN (tm.marks_obtained::numeric / tmm.max_marks::numeric) * 100
    ELSE tm.marks_obtained::numeric
  END AS score_percent
FROM test_marks tm
JOIN tests t ON t.id = tm.test_id
JOIN class_instances ci ON ci.id = t.class_instance_id
LEFT JOIN subjects s ON s.id = t.subject_id
LEFT JOIN student st ON st.id = tm.student_id
LEFT JOIN test_max_marks tmm ON tmm.test_id = tm.test_id;

CREATE UNIQUE INDEX mv_academics_marks_unique_idx ON mv_academics_marks(mark_id);
CREATE INDEX mv_academics_marks_school_date_idx ON mv_academics_marks(school_code, academic_year_id, test_date DESC);
CREATE INDEX mv_academics_marks_class_date_idx ON mv_academics_marks(class_instance_id, test_date DESC);
CREATE INDEX mv_academics_marks_subject_date_idx ON mv_academics_marks(subject_id, test_date DESC);

-- =====================================================
-- SYLLABUS ANALYTICS MATERIALIZED VIEW
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS mv_syllabus_progress;

CREATE MATERIALIZED VIEW mv_syllabus_progress AS
WITH chapters_by_subject AS (
  SELECT
    s.id AS subject_id,
    sc.syllabus_id,
    COUNT(DISTINCT sc.id) AS total_chapters
  FROM syllabi sy
  JOIN subjects s ON s.id = sy.subject_id
  JOIN syllabus_chapters sc ON sc.syllabus_id = sy.id
  GROUP BY s.id, sc.syllabus_id
),
topics_by_subject AS (
  SELECT
    sy.subject_id,
    COUNT(DISTINCT st.id) AS total_topics
  FROM syllabi sy
  JOIN syllabus_chapters sc ON sc.syllabus_id = sy.id
  JOIN syllabus_topics st ON st.chapter_id = sc.id
  GROUP BY sy.subject_id
),
progress_counts AS (
  SELECT
    sp.class_instance_id,
    sp.subject_id,
    COUNT(DISTINCT sp.syllabus_chapter_id) AS covered_chapters,
    COUNT(DISTINCT sp.syllabus_topic_id) AS covered_topics,
    MAX(COALESCE(sp.created_at, sp.date)) AS last_updated
  FROM syllabus_progress sp
  GROUP BY sp.class_instance_id, sp.subject_id
)
SELECT
  pc.class_instance_id,
  ci.school_code,
  ci.academic_year_id,
  pc.subject_id,
  COALESCE(s.subject_name, 'Unknown') AS subject_name,
  CASE
    WHEN ci.grade IS NOT NULL THEN CONCAT('Grade ', ci.grade, COALESCE(CONCAT(' - ', ci.section), ''))
    ELSE 'Unknown Class'
  END AS class_name,
  COALESCE(cb.total_chapters, 0) AS total_chapters,
  COALESCE(tb.total_topics, 0) AS total_topics,
  CASE
    WHEN COALESCE(pc.covered_chapters, 0) > 0 THEN COALESCE(pc.covered_chapters, 0)
    ELSE COALESCE(pc.covered_topics, 0)
  END AS completed_topics,
  pc.last_updated
FROM progress_counts pc
JOIN class_instances ci ON ci.id = pc.class_instance_id
LEFT JOIN subjects s ON s.id = pc.subject_id
LEFT JOIN syllabi sy ON sy.subject_id = pc.subject_id AND sy.class_instance_id = pc.class_instance_id
LEFT JOIN chapters_by_subject cb ON cb.syllabus_id = sy.id AND cb.subject_id = pc.subject_id
LEFT JOIN topics_by_subject tb ON tb.subject_id = pc.subject_id;

CREATE UNIQUE INDEX mv_syllabus_progress_unique_idx ON mv_syllabus_progress(class_instance_id, subject_id);
CREATE INDEX mv_syllabus_progress_school_idx ON mv_syllabus_progress(school_code, academic_year_id);

-- =====================================================
-- AI USAGE ANALYTICS MATERIALIZED VIEW (Daily)
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS mv_ai_usage_daily;

CREATE MATERIALIZED VIEW mv_ai_usage_daily AS
SELECT
  school_code,
  user_id,
  date_trunc('day', created_at)::date AS usage_date,
  COUNT(*) AS total_generations,
  COUNT(*) FILTER (WHERE success = true) AS successful_generations,
  COUNT(*) FILTER (WHERE success = false) AS failed_generations,
  SUM(COALESCE(questions_generated, 0)) AS total_questions,
  SUM(COALESCE(duration_ms, 0)) AS total_duration_ms,
  SUM(COALESCE(estimated_cost_usd::numeric, 0)) AS total_cost_usd
FROM ai_generation_logs
GROUP BY school_code, user_id, date_trunc('day', created_at)::date;

CREATE UNIQUE INDEX mv_ai_usage_daily_unique_idx
  ON mv_ai_usage_daily(school_code, user_id, usage_date);
CREATE INDEX mv_ai_usage_daily_school_date_idx
  ON mv_ai_usage_daily(school_code, usage_date DESC);

-- =====================================================
-- RPC: TASKS ANALYTICS
-- =====================================================
CREATE OR REPLACE FUNCTION get_tasks_analytics(
  p_school_code text,
  p_academic_year_id uuid,
  p_start_date date,
  p_end_date date,
  p_class_instance_id uuid DEFAULT NULL,
  p_limit integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_prev_start date;
  v_prev_end date;
  v_limit integer := COALESCE(p_limit, 50);
  v_result jsonb;
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  v_prev_end := p_start_date - INTERVAL '1 day';
  v_prev_start := v_prev_end - (p_end_date - p_start_date);

  WITH current_rows AS (
    SELECT *
    FROM mv_tasks_analytics
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND due_date >= p_start_date
      AND due_date <= p_end_date
      AND (p_class_instance_id IS NULL OR class_instance_id = p_class_instance_id)
  ),
  previous_rows AS (
    SELECT task_id, on_time_rate
    FROM mv_tasks_analytics
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND due_date >= v_prev_start
      AND due_date <= v_prev_end
      AND (p_class_instance_id IS NULL OR class_instance_id = p_class_instance_id)
  ),
  ranked AS (
    SELECT
      dense_rank() OVER (ORDER BY c.on_time_rate DESC) AS rank,
      jsonb_build_object(
        'taskId', c.task_id,
        'taskName', c.task_name,
        'classId', c.class_instance_id,
        'className', c.class_name,
        'subjectId', c.subject_id,
        'subjectName', c.subject_name,
        'dueDate', c.due_date,
        'totalStudents', c.total_students,
        'submittedCount', c.submitted_count,
        'onTimeCount', c.on_time_count,
        'onTimeRate', c.on_time_rate,
        'status', c.status
      ) AS data,
      analytics_trend_delta(
        c.on_time_rate,
        COALESCE(p.on_time_rate, 0)
      ) AS trend
    FROM current_rows c
    LEFT JOIN previous_rows p ON p.task_id = c.task_id
    ORDER BY c.on_time_rate DESC
    LIMIT v_limit
  ),
  aggregation AS (
    SELECT jsonb_build_object(
      'totalTasks', COUNT(*),
      'completedTasks', COUNT(*) FILTER (WHERE status = 'completed'),
      'pendingTasks', COUNT(*) FILTER (WHERE status = 'pending'),
      'overdueTasks', COUNT(*) FILTER (WHERE status = 'overdue'),
      'avgOnTimeRate', COALESCE(AVG(on_time_rate), 0),
      'taskSummaries', COALESCE(jsonb_agg(jsonb_build_object(
        'taskId', task_id,
        'taskName', task_name,
        'classId', class_instance_id,
        'className', class_name,
        'subjectId', subject_id,
        'subjectName', subject_name,
        'dueDate', due_date,
        'totalStudents', total_students,
        'submittedCount', submitted_count,
        'onTimeCount', on_time_count,
        'onTimeRate', on_time_rate,
        'status', status
      ) ORDER BY on_time_rate DESC), '[]'::jsonb)
    ) AS data
    FROM current_rows
  )
  SELECT jsonb_build_object(
    'aggregation', (SELECT data FROM aggregation),
    'rankedRows', COALESCE(jsonb_agg(jsonb_build_object(
      'rank', rank,
      'data', data,
      'trend', trend
    )), '[]'::jsonb)
  )
  INTO v_result
  FROM ranked;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: ATTENDANCE ANALYTICS
-- =====================================================
CREATE OR REPLACE FUNCTION get_attendance_analytics(
  p_school_code text,
  p_academic_year_id uuid,
  p_start_date date,
  p_end_date date,
  p_class_instance_id uuid DEFAULT NULL,
  p_limit integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_prev_start date;
  v_prev_end date;
  v_limit integer := COALESCE(p_limit, 50);
  v_result jsonb;
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  v_prev_end := p_start_date - INTERVAL '1 day';
  v_prev_start := v_prev_end - (p_end_date - p_start_date);

  WITH current_rows AS (
    SELECT
      class_instance_id,
      MAX(class_name) AS class_name,
      SUM(present_count) AS present_count,
      SUM(absent_count) AS absent_count,
      SUM(total_count) AS total_count,
      MAX(date) AS last_updated
    FROM mv_attendance_daily_class
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND date >= p_start_date
      AND date <= p_end_date
      AND (p_class_instance_id IS NULL OR class_instance_id = p_class_instance_id)
    GROUP BY class_instance_id
  ),
  current_rates AS (
    SELECT
      class_instance_id,
      class_name,
      present_count,
      total_count,
      last_updated,
      CASE WHEN total_count > 0 THEN (present_count::numeric / total_count::numeric) * 100 ELSE 0 END AS rate
    FROM current_rows
  ),
  previous_rows AS (
    SELECT
      class_instance_id,
      SUM(present_count) AS present_count,
      SUM(total_count) AS total_count
    FROM mv_attendance_daily_class
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND date >= v_prev_start
      AND date <= v_prev_end
      AND (p_class_instance_id IS NULL OR class_instance_id = p_class_instance_id)
    GROUP BY class_instance_id
  ),
  previous_rates AS (
    SELECT
      class_instance_id,
      CASE WHEN total_count > 0 THEN (present_count::numeric / total_count::numeric) * 100 ELSE 0 END AS rate
    FROM previous_rows
  ),
  ranked AS (
    SELECT
      dense_rank() OVER (ORDER BY c.rate DESC) AS rank,
      jsonb_build_object(
        'classId', c.class_instance_id,
        'className', c.class_name,
        'presentCount', c.present_count,
        'totalCount', c.total_count,
        'rate', c.rate,
        'lastUpdated', c.last_updated
      ) AS data,
      analytics_trend_delta(c.rate, COALESCE(p.rate, 0)) AS trend
    FROM current_rates c
    LEFT JOIN previous_rates p ON p.class_instance_id = c.class_instance_id
    ORDER BY c.rate DESC
    LIMIT v_limit
  ),
  aggregation AS (
    SELECT jsonb_build_object(
      'totalClasses', COUNT(*),
      'totalPresent', COALESCE(SUM(present_count), 0),
      'totalAbsent', COALESCE(SUM(absent_count), 0),
      'avgRate', COALESCE(AVG(rate), 0),
      'classSummaries', COALESCE(jsonb_agg(jsonb_build_object(
        'classId', class_instance_id,
        'className', class_name,
        'presentCount', present_count,
        'totalCount', total_count,
        'rate', rate,
        'lastUpdated', last_updated
      ) ORDER BY rate DESC), '[]'::jsonb)
    ) AS data
    FROM current_rates
  )
  SELECT jsonb_build_object(
    'aggregation', (SELECT data FROM aggregation),
    'rankedRows', COALESCE(jsonb_agg(jsonb_build_object(
      'rank', rank,
      'data', data,
      'trend', trend
    )), '[]'::jsonb)
  )
  INTO v_result
  FROM ranked;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: OPERATIONS ANALYTICS
-- =====================================================
CREATE OR REPLACE FUNCTION get_operations_analytics(
  p_school_code text,
  p_academic_year_id uuid,
  p_start_date date,
  p_end_date date,
  p_teacher_id uuid DEFAULT NULL,
  p_limit integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_prev_start date;
  v_prev_end date;
  v_limit integer := COALESCE(p_limit, 50);
  v_result jsonb;
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  v_prev_end := p_start_date - INTERVAL '1 day';
  v_prev_start := v_prev_end - (p_end_date - p_start_date);

  WITH current_rows AS (
    SELECT
      teacher_id,
      MAX(teacher_name) AS teacher_name,
      COUNT(*) AS total_periods,
      COUNT(*) FILTER (WHERE is_conducted = true) AS conducted_periods,
      COUNT(DISTINCT class_instance_id) AS class_count,
      COUNT(DISTINCT subject_id) AS subject_count
    FROM mv_operations_slots
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND class_date >= p_start_date
      AND class_date <= p_end_date
      AND (p_teacher_id IS NULL OR teacher_id = p_teacher_id)
    GROUP BY teacher_id
  ),
  current_rates AS (
    SELECT
      teacher_id,
      teacher_name,
      total_periods,
      conducted_periods,
      class_count,
      subject_count,
      CASE WHEN total_periods > 0 THEN (conducted_periods::numeric / total_periods::numeric) * 100 ELSE 0 END AS coverage_percent
    FROM current_rows
  ),
  previous_rows AS (
    SELECT
      teacher_id,
      COUNT(*) AS total_periods,
      COUNT(*) FILTER (WHERE is_conducted = true) AS conducted_periods
    FROM mv_operations_slots
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND class_date >= v_prev_start
      AND class_date <= v_prev_end
      AND (p_teacher_id IS NULL OR teacher_id = p_teacher_id)
    GROUP BY teacher_id
  ),
  previous_rates AS (
    SELECT
      teacher_id,
      CASE WHEN total_periods > 0 THEN (conducted_periods::numeric / total_periods::numeric) * 100 ELSE 0 END AS coverage_percent
    FROM previous_rows
  ),
  ranked AS (
    SELECT
      dense_rank() OVER (ORDER BY c.coverage_percent DESC) AS rank,
      jsonb_build_object(
        'teacherId', c.teacher_id,
        'teacherName', c.teacher_name,
        'totalPeriods', c.total_periods,
        'conductedPeriods', c.conducted_periods,
        'coveragePercent', c.coverage_percent,
        'classCount', c.class_count,
        'subjectCount', c.subject_count
      ) AS data,
      analytics_trend_delta(c.coverage_percent, COALESCE(p.coverage_percent, 0)) AS trend
    FROM current_rates c
    LEFT JOIN previous_rates p ON p.teacher_id = c.teacher_id
    ORDER BY c.coverage_percent DESC
    LIMIT v_limit
  ),
  aggregation AS (
    SELECT jsonb_build_object(
      'totalTeachers', COUNT(*),
      'totalPeriods', COALESCE(SUM(total_periods), 0),
      'conductedPeriods', COALESCE(SUM(conducted_periods), 0),
      'avgCoverage', COALESCE(AVG(coverage_percent), 0),
      'teacherSummaries', COALESCE(jsonb_agg(jsonb_build_object(
        'teacherId', teacher_id,
        'teacherName', teacher_name,
        'totalPeriods', total_periods,
        'conductedPeriods', conducted_periods,
        'coveragePercent', coverage_percent,
        'classCount', class_count,
        'subjectCount', subject_count
      ) ORDER BY coverage_percent DESC), '[]'::jsonb)
    ) AS data
    FROM current_rates
  )
  SELECT jsonb_build_object(
    'aggregation', (SELECT data FROM aggregation),
    'rankedRows', COALESCE(jsonb_agg(jsonb_build_object(
      'rank', rank,
      'data', data,
      'trend', trend
    )), '[]'::jsonb)
  )
  INTO v_result
  FROM ranked;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: ACADEMICS ANALYTICS
-- =====================================================
CREATE OR REPLACE FUNCTION get_academics_analytics(
  p_school_code text,
  p_academic_year_id uuid,
  p_start_date date,
  p_end_date date,
  p_class_instance_id uuid DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_limit integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_prev_start date;
  v_prev_end date;
  v_limit integer := COALESCE(p_limit, 50);
  v_result jsonb;
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  v_prev_end := p_start_date - INTERVAL '1 day';
  v_prev_start := v_prev_end - (p_end_date - p_start_date);

  WITH current_marks AS (
    SELECT *
    FROM mv_academics_marks
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND test_date >= p_start_date
      AND test_date <= p_end_date
      AND (p_class_instance_id IS NULL OR class_instance_id = p_class_instance_id)
      AND (p_subject_id IS NULL OR subject_id = p_subject_id)
  ),
  current_rows AS (
    SELECT
      student_id,
      MAX(student_name) AS student_name,
      MAX(class_name) AS class_name,
      subject_id,
      MAX(subject_name) AS subject_name,
      AVG(score_percent) AS avg_score,
      COUNT(DISTINCT test_id) AS test_count,
      MAX(test_date) AS last_test_date
    FROM current_marks
    GROUP BY student_id, subject_id
  ),
  previous_marks AS (
    SELECT *
    FROM mv_academics_marks
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND test_date >= v_prev_start
      AND test_date <= v_prev_end
      AND (p_class_instance_id IS NULL OR class_instance_id = p_class_instance_id)
      AND (p_subject_id IS NULL OR subject_id = p_subject_id)
  ),
  previous_rows AS (
    SELECT
      student_id,
      subject_id,
      AVG(score_percent) AS avg_score
    FROM previous_marks
    GROUP BY student_id, subject_id
  ),
  ranked AS (
    SELECT
      dense_rank() OVER (ORDER BY c.avg_score DESC) AS rank,
      jsonb_build_object(
        'studentId', c.student_id,
        'studentName', c.student_name,
        'className', c.class_name,
        'subjectId', c.subject_id,
        'subjectName', c.subject_name,
        'avgScore', c.avg_score,
        'testCount', c.test_count,
        'lastTestDate', c.last_test_date
      ) AS data,
      analytics_trend_delta(c.avg_score, COALESCE(p.avg_score, 0)) AS trend
    FROM current_rows c
    LEFT JOIN previous_rows p
      ON p.student_id = c.student_id AND p.subject_id = c.subject_id
    ORDER BY c.avg_score DESC
    LIMIT v_limit
  ),
  subject_summaries AS (
    SELECT
      subject_id,
      MAX(subject_name) AS subject_name,
      AVG(avg_score) AS avg_score,
      SUM(test_count) AS test_count
    FROM current_rows
    GROUP BY subject_id
  ),
  aggregation AS (
    SELECT jsonb_build_object(
      'totalTests', (SELECT COUNT(DISTINCT test_id) FROM current_marks),
      'totalStudents', (SELECT COUNT(DISTINCT student_id) FROM current_rows),
      'avgScore', COALESCE((SELECT AVG(avg_score) FROM current_rows), 0),
      'participationRate', CASE
        WHEN (SELECT COUNT(DISTINCT test_id) FROM current_marks) = 0 OR (SELECT COUNT(DISTINCT student_id) FROM current_marks) = 0
          THEN 0
        ELSE
          (SELECT COUNT(*) FROM current_marks)::numeric
          / ((SELECT COUNT(DISTINCT test_id) FROM current_marks)::numeric * (SELECT COUNT(DISTINCT student_id) FROM current_marks)::numeric) * 100
      END,
      'subjectSummaries', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'subjectId', subject_id,
          'subjectName', subject_name,
          'avgScore', avg_score,
          'testCount', test_count
        ) ORDER BY avg_score DESC)
        FROM subject_summaries
      ), '[]'::jsonb),
      'studentSummaries', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'studentId', student_id,
          'studentName', student_name,
          'className', class_name,
          'subjectId', subject_id,
          'subjectName', subject_name,
          'avgScore', avg_score,
          'testCount', test_count,
          'lastTestDate', last_test_date
        ) ORDER BY avg_score DESC)
        FROM current_rows
      ), '[]'::jsonb)
    ) AS data
  )
  SELECT jsonb_build_object(
    'aggregation', (SELECT data FROM aggregation),
    'rankedRows', COALESCE(jsonb_agg(jsonb_build_object(
      'rank', rank,
      'data', data,
      'trend', trend
    )), '[]'::jsonb)
  )
  INTO v_result
  FROM ranked;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: SYLLABUS ANALYTICS
-- =====================================================
CREATE OR REPLACE FUNCTION get_syllabus_analytics(
  p_school_code text,
  p_academic_year_id uuid,
  p_start_date date,
  p_end_date date,
  p_class_instance_id uuid DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_limit integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_prev_end date;
  v_result jsonb;
  v_limit integer := COALESCE(p_limit, 50);
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  v_prev_end := p_start_date - INTERVAL '1 day';

  WITH current_rows AS (
    SELECT
      class_instance_id,
      class_name,
      subject_id,
      subject_name,
      CASE
        WHEN total_chapters > 0 THEN total_chapters
        ELSE total_topics
      END AS total_topics,
      completed_topics,
      CASE
        WHEN (CASE WHEN total_chapters > 0 THEN total_chapters ELSE total_topics END) > 0
          THEN (completed_topics::numeric / (CASE WHEN total_chapters > 0 THEN total_chapters ELSE total_topics END)::numeric) * 100
        ELSE 0
      END AS progress,
      last_updated
    FROM mv_syllabus_progress
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND (p_class_instance_id IS NULL OR class_instance_id = p_class_instance_id)
      AND (p_subject_id IS NULL OR subject_id = p_subject_id)
  ),
  previous_rows AS (
    SELECT
      sp.class_instance_id,
      sp.subject_id,
      CASE
        WHEN sp.total_chapters > 0 THEN sp.total_chapters
        ELSE sp.total_topics
      END AS total_topics,
      CASE
        WHEN sp.total_chapters > 0 THEN sp.completed_topics
        ELSE sp.completed_topics
      END AS completed_topics,
      CASE
        WHEN (CASE WHEN sp.total_chapters > 0 THEN sp.total_chapters ELSE sp.total_topics END) > 0
          THEN (sp.completed_topics::numeric / (CASE WHEN sp.total_chapters > 0 THEN sp.total_chapters ELSE sp.total_topics END)::numeric) * 100
        ELSE 0
      END AS progress
    FROM mv_syllabus_progress sp
    WHERE sp.school_code = p_school_code
      AND sp.academic_year_id = p_academic_year_id
      AND sp.last_updated <= v_prev_end
      AND (p_class_instance_id IS NULL OR sp.class_instance_id = p_class_instance_id)
      AND (p_subject_id IS NULL OR sp.subject_id = p_subject_id)
  ),
  ranked AS (
    SELECT
      dense_rank() OVER (ORDER BY c.progress DESC) AS rank,
      jsonb_build_object(
        'classId', c.class_instance_id,
        'className', c.class_name,
        'subjectId', c.subject_id,
        'subjectName', c.subject_name,
        'completedTopics', c.completed_topics,
        'totalTopics', c.total_topics,
        'progress', c.progress,
        'lastUpdated', c.last_updated
      ) AS data,
      analytics_trend_delta(c.progress, COALESCE(p.progress, 0)) AS trend
    FROM current_rows c
    LEFT JOIN previous_rows p
      ON p.class_instance_id = c.class_instance_id AND p.subject_id = c.subject_id
    ORDER BY c.progress DESC
    LIMIT v_limit
  ),
  aggregation AS (
    SELECT jsonb_build_object(
      'overallProgress', COALESCE(AVG(progress), 0),
      'totalSubjects', COUNT(DISTINCT subject_id),
      'completedSubjects', COUNT(*) FILTER (WHERE progress = 100),
      'subjectSummaries', COALESCE(jsonb_agg(jsonb_build_object(
        'classId', class_instance_id,
        'className', class_name,
        'subjectId', subject_id,
        'subjectName', subject_name,
        'completedTopics', completed_topics,
        'totalTopics', total_topics,
        'progress', progress,
        'lastUpdated', last_updated
      ) ORDER BY progress DESC), '[]'::jsonb)
    ) AS data
    FROM current_rows
  )
  SELECT jsonb_build_object(
    'aggregation', (SELECT data FROM aggregation),
    'rankedRows', COALESCE(jsonb_agg(jsonb_build_object(
      'rank', rank,
      'data', data,
      'trend', trend
    )), '[]'::jsonb)
  )
  INTO v_result
  FROM ranked;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: SYLLABUS SUMMARY (for aggregated analytics)
-- =====================================================
CREATE OR REPLACE FUNCTION get_syllabus_summary(
  p_school_code text,
  p_academic_year_id uuid,
  p_class_instance_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_result jsonb;
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  WITH current_rows AS (
    SELECT
      class_instance_id,
      class_name,
      subject_id,
      subject_name,
      CASE
        WHEN total_chapters > 0 THEN total_chapters
        ELSE total_topics
      END AS total_topics,
      completed_topics,
      CASE
        WHEN (CASE WHEN total_chapters > 0 THEN total_chapters ELSE total_topics END) > 0
          THEN (completed_topics::numeric / (CASE WHEN total_chapters > 0 THEN total_chapters ELSE total_topics END)::numeric) * 100
        ELSE 0
      END AS progress
    FROM mv_syllabus_progress
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND (p_class_instance_id IS NULL OR class_instance_id = p_class_instance_id)
  ),
  progress_by_class AS (
    SELECT
      class_instance_id AS class_id,
      MAX(class_name) AS class_name,
      AVG(progress) AS progress
    FROM current_rows
    GROUP BY class_instance_id
  ),
  progress_by_subject AS (
    SELECT
      subject_id,
      MAX(subject_name) AS subject_name,
      SUM(completed_topics) AS completed_topics,
      SUM(total_topics) AS total_topics,
      CASE WHEN SUM(total_topics) > 0 THEN (SUM(completed_topics)::numeric / SUM(total_topics)::numeric) * 100 ELSE 0 END AS progress
    FROM current_rows
    GROUP BY subject_id
  )
  SELECT jsonb_build_object(
    'overallProgress', COALESCE((SELECT AVG(progress) FROM progress_by_class), 0),
    'progressByClass', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'classId', class_id,
        'className', class_name,
        'progress', progress
      ) ORDER BY progress DESC)
      FROM progress_by_class
    ), '[]'::jsonb),
    'progressBySubject', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'subjectId', subject_id,
        'subjectName', subject_name,
        'completedTopics', completed_topics,
        'totalTopics', total_topics,
        'progress', progress
      ) ORDER BY progress DESC)
      FROM progress_by_subject
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: FEES SUMMARY (for aggregated analytics)
-- =====================================================
CREATE OR REPLACE FUNCTION get_fees_summary(
  p_school_code text,
  p_academic_year_id uuid,
  p_class_instance_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_result jsonb;
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  WITH fee_rows AS (
    SELECT
      total_billed_paise,
      total_collected_paise,
      total_outstanding_paise
    FROM analytics_fees_summary
    WHERE school_code = p_school_code
      AND academic_year_id = p_academic_year_id
      AND (p_class_instance_id IS NULL OR class_instance_id = p_class_instance_id)
  )
  SELECT jsonb_build_object(
    'realizationRate', CASE
      WHEN COALESCE(SUM(total_billed_paise), 0) = 0 THEN 0
      ELSE (COALESCE(SUM(total_collected_paise), 0)::numeric / COALESCE(SUM(total_billed_paise), 0)::numeric) * 100
    END,
    'totalBilled', COALESCE(SUM(total_billed_paise), 0)::numeric / 100,
    'totalCollected', COALESCE(SUM(total_collected_paise), 0)::numeric / 100,
    'totalOutstanding', COALESCE(SUM(total_outstanding_paise), 0)::numeric / 100,
    'agingBreakdown', jsonb_build_object(
      'current', COUNT(*) FILTER (WHERE total_outstanding_paise > 0),
      '30-60', 0,
      '60-90', 0,
      '90+', 0
    )
  )
  INTO v_result
  FROM fee_rows;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: STUDENT ATTENDANCE ANALYTICS
-- =====================================================
CREATE OR REPLACE FUNCTION get_student_attendance_analytics(
  p_school_code text,
  p_academic_year_id uuid,
  p_student_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_prev_start date;
  v_prev_end date;
  v_result jsonb;
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  v_prev_end := p_start_date - INTERVAL '1 day';
  v_prev_start := v_prev_end - (p_end_date - p_start_date);

  WITH current_records AS (
    SELECT
      id,
      date,
      status,
      created_at
    FROM attendance
    WHERE student_id = p_student_id
      AND date >= p_start_date
      AND date <= p_end_date
  ),
  prev_records AS (
    SELECT
      id,
      status
    FROM attendance
    WHERE student_id = p_student_id
      AND date >= v_prev_start
      AND date <= v_prev_end
  ),
  weekly_trend AS (
    SELECT
      date_trunc('week', date)::date AS week,
      COUNT(*) FILTER (WHERE status = 'present') AS present_count,
      COUNT(*) AS total_count
    FROM current_records
    GROUP BY date_trunc('week', date)::date
    ORDER BY week
  )
  SELECT jsonb_build_object(
    'presentCount', (SELECT COUNT(*) FROM current_records WHERE status = 'present'),
    'totalCount', (SELECT COUNT(*) FROM current_records),
    'rate', CASE
      WHEN (SELECT COUNT(*) FROM current_records) = 0 THEN 0
      ELSE (SELECT COUNT(*) FROM current_records WHERE status = 'present')::numeric
           / (SELECT COUNT(*) FROM current_records)::numeric * 100
    END,
    'trend', analytics_trend_delta(
      CASE
        WHEN (SELECT COUNT(*) FROM current_records) = 0 THEN 0
        ELSE (SELECT COUNT(*) FROM current_records WHERE status = 'present')::numeric
             / (SELECT COUNT(*) FROM current_records)::numeric * 100
      END,
      CASE
        WHEN (SELECT COUNT(*) FROM prev_records) = 0 THEN 0
        ELSE (SELECT COUNT(*) FROM prev_records WHERE status = 'present')::numeric
             / (SELECT COUNT(*) FROM prev_records)::numeric * 100
      END
    ),
    'weeklyTrend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'week', week,
        'presentCount', present_count,
        'totalCount', total_count,
        'rate', CASE WHEN total_count > 0 THEN (present_count::numeric / total_count::numeric) * 100 ELSE 0 END
      ) ORDER BY week)
      FROM weekly_trend
    ), '[]'::jsonb),
    'records', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'date', date,
        'status', status,
        'created_at', created_at
      ) ORDER BY date ASC)
      FROM current_records
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- =====================================================
-- RPC: AI USAGE ANALYTICS
-- =====================================================
CREATE OR REPLACE FUNCTION get_ai_usage_stats(
  p_school_code text,
  p_period text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_start_date date;
  v_result jsonb;
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  v_start_date := CASE p_period
    WHEN 'day' THEN CURRENT_DATE
    WHEN 'week' THEN CURRENT_DATE - INTERVAL '7 days'
    ELSE date_trunc('month', CURRENT_DATE)::date
  END;

  SELECT jsonb_build_object(
    'totalGenerations', COALESCE(SUM(total_generations), 0),
    'successfulGenerations', COALESCE(SUM(successful_generations), 0),
    'failedGenerations', COALESCE(SUM(failed_generations), 0),
    'successRate', CASE
      WHEN COALESCE(SUM(total_generations), 0) = 0 THEN 0
      ELSE ROUND((COALESCE(SUM(successful_generations), 0)::numeric / COALESCE(SUM(total_generations), 0)::numeric) * 100, 1)
    END,
    'totalQuestions', COALESCE(SUM(total_questions), 0),
    'averageDurationMs', CASE
      WHEN COALESCE(SUM(total_generations), 0) = 0 THEN 0
      ELSE ROUND(COALESCE(SUM(total_duration_ms), 0)::numeric / COALESCE(SUM(total_generations), 0)::numeric)
    END,
    'estimatedCostUsd', ROUND(COALESCE(SUM(total_cost_usd), 0)::numeric, 3),
    'uniqueUsers', COUNT(DISTINCT user_id)
  )
  INTO v_result
  FROM mv_ai_usage_daily
  WHERE school_code = p_school_code
    AND usage_date >= v_start_date;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION get_ai_top_users(
  p_school_code text,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_code text;
  v_result jsonb;
BEGIN
  SELECT school_code INTO v_school_code FROM users WHERE id = auth.uid();
  IF v_school_code IS NULL OR v_school_code <> p_school_code THEN
    RAISE EXCEPTION 'Unauthorized school scope';
  END IF;

  WITH user_stats AS (
    SELECT
      user_id,
      SUM(total_generations) AS generations,
      SUM(successful_generations) AS successful,
      SUM(total_questions) AS questions,
      MAX(usage_date) AS last_used
    FROM mv_ai_usage_daily
    WHERE school_code = p_school_code
      AND usage_date >= date_trunc('month', CURRENT_DATE)::date
    GROUP BY user_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId', user_id,
    'generations', generations,
    'questionsGenerated', questions,
    'successRate', CASE WHEN generations > 0 THEN ROUND((successful::numeric / generations::numeric) * 100) ELSE 0 END,
    'lastUsed', last_used
  ) ORDER BY generations DESC), '[]'::jsonb)
  INTO v_result
  FROM user_stats
  ORDER BY generations DESC
  LIMIT p_limit;

  RETURN v_result;
END;
$$;

-- =====================================================
-- Refresh functions (invoked by cron)
-- =====================================================
CREATE OR REPLACE FUNCTION refresh_analytics_materialized_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tasks_analytics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attendance_daily_class;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_operations_slots;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_academics_marks;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_syllabus_progress;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ai_usage_daily;
END;
$$;

