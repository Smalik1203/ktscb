-- =====================================================
-- Fix Fee Overview in Dashboard Bundle
-- Changes fee_student_plans to fee_invoices (source of truth)
-- =====================================================

CREATE OR REPLACE FUNCTION get_dashboard_bundle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_school_code text;
  v_class_instance_id uuid;
  v_student_id uuid;
  v_today date := CURRENT_DATE;
  v_week_start date := (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int));
  v_next_week date := (CURRENT_DATE + INTERVAL '7 days')::date;

  v_next_month date := (CURRENT_DATE + INTERVAL '30 days')::date;
  v_month_start date := date_trunc('month', CURRENT_DATE)::date;
  v_month_end date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date;
  v_stats jsonb := '{}'::jsonb;
  v_recent_activity jsonb := '[]'::jsonb;
  v_upcoming_events jsonb := '[]'::jsonb;
  v_fee_overview jsonb := jsonb_build_object('totalFee', 0, 'paidAmount', 0, 'pendingAmount', 0);
  v_task_overview jsonb := jsonb_build_object('total', 0, 'completed', 0, 'pending', 0, 'overdue', 0, 'dueThisWeek', 0);
  v_syllabus_overview jsonb := jsonb_build_object('overallProgress', 0, 'totalSubjects', 0, 'subjectBreakdown', '[]'::jsonb);
  v_class_info jsonb := NULL;
BEGIN
  SELECT role, school_code, class_instance_id
  INTO v_role, v_school_code, v_class_instance_id
  FROM users
  WHERE id = v_user_id;

  IF v_user_id IS NULL OR v_school_code IS NULL THEN
    RETURN jsonb_build_object(
      'stats', v_stats,
      'recentActivity', v_recent_activity,
      'upcomingEvents', v_upcoming_events,
      'feeOverview', v_fee_overview,
      'taskOverview', v_task_overview,
      'syllabusOverview', v_syllabus_overview,
      'classInfo', v_class_info
    );
  END IF;

  -- Resolve student_id and class_instance_id for students
  IF v_role = 'student' THEN
    SELECT id, class_instance_id
    INTO v_student_id, v_class_instance_id
    FROM student
    WHERE auth_user_id = v_user_id
    LIMIT 1;
  END IF;

  -- Class info (for header)
  IF v_class_instance_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'classInstanceId', id,
      'grade', grade,
      'section', section
    )
    INTO v_class_info
    FROM class_instances
    WHERE id = v_class_instance_id;
  END IF;

  -- =====================================================
  -- STATS
  -- =====================================================
  IF v_role = 'superadmin' AND v_class_instance_id IS NULL THEN
    WITH school_classes AS (
      SELECT id FROM class_instances WHERE school_code = v_school_code
    ),
    todays_slots AS (
      SELECT class_instance_id
      FROM timetable_slots
      WHERE class_date = v_today
        AND class_instance_id IN (SELECT id FROM school_classes)
    ),
    todays_attendance AS (
      SELECT a.status, s.class_instance_id
      FROM attendance a
      JOIN student s ON s.id = a.student_id
      WHERE a.date = v_today
        AND s.school_code = v_school_code
    )
    SELECT jsonb_build_object(
      'todaysClasses', (SELECT COUNT(*) FROM todays_slots),
      'attendancePercentage', CASE
        WHEN (SELECT COUNT(*) FROM todays_attendance) = 0 THEN 0
        ELSE ROUND(((SELECT COUNT(*) FROM todays_attendance WHERE status = 'present')::numeric
          / (SELECT COUNT(*) FROM todays_attendance)::numeric) * 100)
      END,
      'weekAttendance', 0,
      'pendingAssignments', (
        SELECT COUNT(*) FROM tasks
        WHERE is_active = true AND class_instance_id IN (SELECT id FROM school_classes)
      ),
      'upcomingTests', (
        SELECT COUNT(*) FROM tests
        WHERE status = 'active'
          AND class_instance_id IN (SELECT id FROM school_classes)
          AND test_date >= v_today AND test_date <= v_next_week
      ),
      'achievements', 0,
      'totalStudents', (
        SELECT COUNT(*) FROM student WHERE school_code = v_school_code
      ),
      'markedClassesCount', (
        SELECT COUNT(DISTINCT class_instance_id) FROM todays_attendance
      ),
      'totalClassesCount', (
        SELECT COUNT(DISTINCT class_instance_id) FROM todays_slots
      ),
      'isPartialData', (
        SELECT CASE
          WHEN (SELECT COUNT(DISTINCT class_instance_id) FROM todays_slots) = 0 THEN false
          ELSE (SELECT COUNT(DISTINCT class_instance_id) FROM todays_attendance)
            < (SELECT COUNT(DISTINCT class_instance_id) FROM todays_slots)
        END
      )
    )
    INTO v_stats;
  ELSIF v_role = 'student' AND v_student_id IS NOT NULL AND v_class_instance_id IS NOT NULL THEN
    WITH student_tasks AS (
      SELECT id, due_date
      FROM tasks
      WHERE class_instance_id = v_class_instance_id
        AND is_active = true
    ),
    student_submissions AS (
      SELECT task_id
      FROM task_submissions
      WHERE student_id = v_student_id
        AND status IN ('submitted', 'graded')
    )
    SELECT jsonb_build_object(
      'todaysClasses', (
        SELECT COUNT(*) FROM timetable_slots
        WHERE class_instance_id = v_class_instance_id AND class_date = v_today
      ),
      'attendancePercentage', (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE status = 'present')::numeric / COUNT(*)::numeric) * 100)
        END
        FROM attendance
        WHERE student_id = v_student_id
          AND date >= v_month_start
          AND date < v_month_end
      ),
      'weekAttendance', (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE status = 'present')::numeric / COUNT(*)::numeric) * 100)
        END
        FROM attendance
        WHERE student_id = v_student_id
          AND date >= v_week_start
          AND date <= v_today
      ),
      'pendingAssignments', (
        SELECT COUNT(*) FROM student_tasks
        WHERE id NOT IN (SELECT task_id FROM student_submissions)
      ),
      'upcomingTests', (
        SELECT COUNT(*) FROM tests
        WHERE class_instance_id = v_class_instance_id
          AND status = 'active'
          AND test_date >= v_today AND test_date <= v_next_week
      ),
      'achievements', 0,
      'totalStudents', 0
    )
    INTO v_stats;
  ELSIF v_class_instance_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'todaysClasses', (
        SELECT COUNT(*) FROM timetable_slots
        WHERE class_instance_id = v_class_instance_id AND class_date = v_today
      ),
      'attendancePercentage', 0,
      'weekAttendance', 0,
      'pendingAssignments', (
        SELECT COUNT(*) FROM tasks
        WHERE class_instance_id = v_class_instance_id AND is_active = true
      ),
      'upcomingTests', (
        SELECT COUNT(*) FROM tests
        WHERE class_instance_id = v_class_instance_id
          AND status = 'active'
          AND test_date >= v_today AND test_date <= v_next_week
      ),
      'achievements', 0,
      'totalStudents', (
        SELECT COUNT(*) FROM student WHERE class_instance_id = v_class_instance_id
      )
    )
    INTO v_stats;
  END IF;

  -- =====================================================
  -- RECENT ACTIVITY
  -- =====================================================
  IF v_role = 'superadmin' THEN
    WITH task_activity AS (
      SELECT
        t.id::text AS id,
        'task'::text AS type,
        CONCAT('New Task: ', t.title) AS title,
        CONCAT('Class ', ci.grade, '-', ci.section, ' • Due ', to_char(t.due_date, 'YYYY-MM-DD')) AS subtitle,
        t.created_at AS timestamp,
        'FileText'::text AS icon,
        'info'::text AS color
      FROM tasks t
      JOIN class_instances ci ON ci.id = t.class_instance_id
      WHERE ci.school_code = v_school_code
        AND t.is_active = true
      ORDER BY t.created_at DESC
      LIMIT 5
    ),
    event_activity AS (
      SELECT
        e.id::text AS id,
        'event'::text AS type,
        CONCAT('New Event: ', e.title) AS title,
        CONCAT(e.event_type, ' • ', to_char(e.start_date, 'YYYY-MM-DD')) AS subtitle,
        COALESCE(e.created_at, NOW()) AS timestamp,
        'Calendar'::text AS icon,
        'secondary'::text AS color
      FROM school_calendar_events e
      WHERE e.school_code = v_school_code
      ORDER BY e.created_at DESC
      LIMIT 3
    ),
    combined AS (
      SELECT * FROM task_activity
      UNION ALL
      SELECT * FROM event_activity
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'type', type,
      'title', title,
      'subtitle', subtitle,
      'timestamp', timestamp,
      'icon', icon,
      'color', color
    ) ORDER BY timestamp DESC), '[]'::jsonb)
    INTO v_recent_activity
    FROM combined
    LIMIT 5;
  ELSIF v_student_id IS NOT NULL AND v_class_instance_id IS NOT NULL THEN
    WITH attendance_activity AS (
      SELECT
        a.id::text AS id,
        'attendance'::text AS type,
        'Attendance marked'::text AS title,
        CONCAT(to_char(a.date, 'YYYY-MM-DD'), ' - ', a.status) AS subtitle,
        COALESCE(a.created_at, NOW()) AS timestamp,
        'CheckSquare'::text AS icon,
        CASE WHEN a.status = 'present' THEN 'success' ELSE 'error' END AS color
      FROM attendance a
      WHERE a.student_id = v_student_id
      ORDER BY a.created_at DESC
      LIMIT 2
    ),
    task_activity AS (
      SELECT
        t.id::text AS id,
        'assignment'::text AS type,
        t.title AS title,
        CONCAT(COALESCE(s.subject_name, 'General'), ' - Due ', to_char(t.due_date, 'YYYY-MM-DD')) AS subtitle,
        t.created_at AS timestamp,
        'BookOpen'::text AS icon,
        'info'::text AS color
      FROM tasks t
      LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE t.class_instance_id = v_class_instance_id
        AND t.is_active = true
      ORDER BY t.created_at DESC
      LIMIT 2
    ),
    test_activity AS (
      SELECT
        tm.id::text AS id,
        'test'::text AS type,
        CONCAT('Test graded: ', COALESCE(ts.title, 'Test')) AS title,
        CONCAT('Score: ', tm.marks_obtained, '/', tm.max_marks) AS subtitle,
        tm.created_at AS timestamp,
        'Award'::text AS icon,
        'secondary'::text AS color
      FROM test_marks tm
      LEFT JOIN tests ts ON ts.id = tm.test_id
      WHERE tm.student_id = v_student_id
      ORDER BY tm.created_at DESC
      LIMIT 2
    ),
    combined AS (
      SELECT * FROM attendance_activity
      UNION ALL
      SELECT * FROM task_activity
      UNION ALL
      SELECT * FROM test_activity
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'type', type,
      'title', title,
      'subtitle', subtitle,
      'timestamp', timestamp,
      'icon', icon,
      'color', color
    ) ORDER BY timestamp DESC), '[]'::jsonb)
    INTO v_recent_activity
    FROM combined
    LIMIT 5;
  END IF;

  -- =====================================================
  -- UPCOMING EVENTS
  -- =====================================================
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'title', title,
    'date', start_date,
    'type', event_type,
    'description', description,
    'color', COALESCE(color, '#6366f1')
  ) ORDER BY start_date ASC), '[]'::jsonb)
  INTO v_upcoming_events
  FROM school_calendar_events
  WHERE school_code = v_school_code
    AND is_active = true
    AND start_date >= v_today
    AND start_date <= v_next_month
    AND (v_class_instance_id IS NULL OR class_instance_id IS NULL OR class_instance_id = v_class_instance_id)
  LIMIT 5;

  -- =====================================================
  -- FEE OVERVIEW (student only) - uses fee_invoices (source of truth)
  -- =====================================================
  IF v_student_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'totalFee', COALESCE(SUM(total_amount), 0),
      'paidAmount', COALESCE(SUM(paid_amount), 0),
      'pendingAmount', COALESCE(SUM(total_amount), 0) - COALESCE(SUM(paid_amount), 0)
    )
    INTO v_fee_overview
    FROM fee_invoices
    WHERE student_id = v_student_id
      AND school_code = v_school_code;
  END IF;

  -- =====================================================
  -- TASK OVERVIEW (student only)
  -- =====================================================
  IF v_student_id IS NOT NULL AND v_class_instance_id IS NOT NULL THEN
    WITH class_tasks AS (
      SELECT id, due_date
      FROM tasks
      WHERE class_instance_id = v_class_instance_id
        AND is_active = true
    ),
    submissions AS (
      SELECT task_id
      FROM task_submissions
      WHERE student_id = v_student_id
        AND status IN ('submitted', 'graded')
    )
    SELECT jsonb_build_object(
      'total', (SELECT COUNT(*) FROM class_tasks),
      'completed', (SELECT COUNT(DISTINCT task_id) FROM submissions),
      'pending', (SELECT COUNT(*) FROM class_tasks WHERE id NOT IN (SELECT task_id FROM submissions)),
      'overdue', (SELECT COUNT(*) FROM class_tasks WHERE id NOT IN (SELECT task_id FROM submissions) AND due_date < v_today),
      'dueThisWeek', (SELECT COUNT(*) FROM class_tasks WHERE id NOT IN (SELECT task_id FROM submissions) AND due_date <= v_next_week AND due_date >= v_today)
    )
    INTO v_task_overview;
  END IF;

  -- =====================================================
  -- SYLLABUS OVERVIEW (student only)
  -- =====================================================
  IF v_class_instance_id IS NOT NULL THEN
    WITH class_subjects AS (
      SELECT DISTINCT ts.subject_id, s.subject_name
      FROM timetable_slots ts
      JOIN subjects s ON s.id = ts.subject_id
      WHERE ts.class_instance_id = v_class_instance_id
    ),
    syllabi AS (
      SELECT id, subject_id
      FROM syllabi
      WHERE class_instance_id = v_class_instance_id
        AND subject_id IN (SELECT subject_id FROM class_subjects)
    ),
    chapters AS (
      SELECT id, syllabus_id
      FROM syllabus_chapters
      WHERE syllabus_id IN (SELECT id FROM syllabi)
    ),
    topics AS (
      SELECT id, chapter_id
      FROM syllabus_topics
      WHERE chapter_id IN (SELECT id FROM chapters)
    ),
    progress AS (
      SELECT syllabus_topic_id, subject_id
      FROM syllabus_progress
      WHERE class_instance_id = v_class_instance_id
        AND syllabus_topic_id IS NOT NULL
    ),
    topics_by_syllabus AS (
      SELECT
        sy.id AS syllabus_id,
        COUNT(t.id) AS total_topics
      FROM syllabi sy
      LEFT JOIN chapters c ON c.syllabus_id = sy.id
      LEFT JOIN topics t ON t.chapter_id = c.id
      GROUP BY sy.id
    ),
    progress_by_subject AS (
      SELECT
        cs.subject_id,
        cs.subject_name,
        COALESCE(tbs.total_topics, 0) AS total_topics,
        COALESCE(COUNT(DISTINCT p.syllabus_topic_id), 0) AS completed_topics
      FROM class_subjects cs
      LEFT JOIN syllabi sy ON sy.subject_id = cs.subject_id
      LEFT JOIN topics_by_syllabus tbs ON tbs.syllabus_id = sy.id
      LEFT JOIN progress p ON p.subject_id = cs.subject_id
      GROUP BY cs.subject_id, cs.subject_name, tbs.total_topics
    )
    SELECT jsonb_build_object(
      'overallProgress', CASE
        WHEN COALESCE(SUM(total_topics), 0) = 0 THEN 0
        ELSE ROUND((COALESCE(SUM(completed_topics), 0)::numeric / COALESCE(SUM(total_topics), 0)::numeric) * 100)
      END,
      'totalSubjects', (SELECT COUNT(*) FROM class_subjects),
      'subjectBreakdown', COALESCE(jsonb_agg(jsonb_build_object(
        'subjectId', subject_id,
        'subjectName', subject_name,
        'progress', CASE WHEN total_topics > 0 THEN ROUND((completed_topics::numeric / total_topics::numeric) * 100) ELSE 0 END,
        'totalTopics', total_topics,
        'completedTopics', completed_topics
      ) ORDER BY subject_name), '[]'::jsonb)
    )
    INTO v_syllabus_overview
    FROM progress_by_subject;
  END IF;

  RETURN jsonb_build_object(
    'stats', v_stats,
    'recentActivity', v_recent_activity,
    'upcomingEvents', v_upcoming_events,
    'feeOverview', v_fee_overview,
    'taskOverview', v_task_overview,
    'syllabusOverview', v_syllabus_overview,
    'classInfo', v_class_info
  );
END;
$$;
