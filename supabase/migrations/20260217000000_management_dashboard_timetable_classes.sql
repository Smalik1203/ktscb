-- =====================================================
-- Management Dashboard: classes from timetable (scheduled + completed)
-- "Classes completed" = timetable_slots with status = 'done' for today
-- =====================================================

CREATE OR REPLACE FUNCTION get_management_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_school_code text;
  v_today date := CURRENT_DATE;
  v_yesterday date := v_today - INTERVAL '1 day';
  v_kpis jsonb;
  v_today_att_pct numeric := 0;
  v_yesterday_att_pct numeric := 0;
  v_total_students bigint := 0;
  v_classes_scheduled bigint := 0;
  v_classes_completed bigint := 0;
BEGIN
  SELECT school_code INTO v_school_code
  FROM users
  WHERE id = v_user_id;

  IF v_user_id IS NULL OR v_school_code IS NULL THEN
    RETURN jsonb_build_object(
      'kpis', jsonb_build_object(
        'todayAttPct', 0, 'yesterdayAttPct', 0, 'feesCollectedToday', 0,
        'pendingFeesTotal', 0, 'activeClassesMarked', 0, 'totalClassesScheduled', 0,
        'totalStudents', 0
      ),
      'attendanceTrend', '[]'::jsonb,
      'feeCollectionTrend', '[]'::jsonb,
      'actionItems', '[]'::jsonb,
      'academicSnapshot', jsonb_build_object('avgPerformancePct', 0, 'topClass', null, 'lowestClass', null, 'totalTests', 0),
      'feeOverview', jsonb_build_object('totalExpected', 0, 'totalCollected', 0, 'outstanding', 0, 'collectionRate', 0),
      'upcomingEvents', '[]'::jsonb
    );
  END IF;

  -- Today's attendance %
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND((COUNT(*) FILTER (WHERE a.status = 'present')::numeric / COUNT(*)::numeric) * 100)
  END
  INTO v_today_att_pct
  FROM attendance a
  JOIN student s ON s.id = a.student_id
  WHERE a.date = v_today AND s.school_code = v_school_code;

  -- Yesterday's attendance %
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND((COUNT(*) FILTER (WHERE a.status = 'present')::numeric / COUNT(*)::numeric) * 100)
  END
  INTO v_yesterday_att_pct
  FROM attendance a
  JOIN student s ON s.id = a.student_id
  WHERE a.date = v_yesterday AND s.school_code = v_school_code;

  -- Total students
  SELECT COUNT(*) INTO v_total_students FROM student WHERE school_code = v_school_code;

  -- Classes: from timetable_slots (scheduled = any slot today; completed = slot status = 'done' today)
  WITH school_classes AS (
    SELECT id FROM class_instances WHERE school_code = v_school_code
  ),
  todays_slots AS (
    SELECT class_instance_id, status
    FROM timetable_slots
    WHERE class_date = v_today
      AND class_instance_id IN (SELECT id FROM school_classes)
  )
  SELECT
    (SELECT COUNT(DISTINCT class_instance_id) FROM todays_slots),
    (SELECT COUNT(DISTINCT class_instance_id) FROM todays_slots WHERE status = 'done')
  INTO v_classes_scheduled, v_classes_completed;

  v_kpis := jsonb_build_object(
    'todayAttPct', COALESCE(v_today_att_pct, 0),
    'yesterdayAttPct', COALESCE(v_yesterday_att_pct, 0),
    'feesCollectedToday', 0,
    'pendingFeesTotal', 0,
    'activeClassesMarked', COALESCE(v_classes_completed, 0),
    'totalClassesScheduled', COALESCE(v_classes_scheduled, 0),
    'totalStudents', COALESCE(v_total_students, 0)
  );

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'attendanceTrend', '[]'::jsonb,
    'feeCollectionTrend', '[]'::jsonb,
    'actionItems', (
      SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object('type', 'overdue_tasks', 'label', cnt || ' overdue tasks', 'count', cnt, 'category', 'tasks', 'route', '/(tabs)/tasks') AS item
        FROM (SELECT COUNT(*)::int AS cnt FROM tasks t JOIN class_instances ci ON ci.id = t.class_instance_id WHERE t.is_active AND t.due_date < v_today AND ci.school_code = v_school_code) x
        WHERE cnt > 0
      ) y
    ),
    'academicSnapshot', jsonb_build_object('avgPerformancePct', 0, 'topClass', null, 'lowestClass', null, 'totalTests', 0),
    'feeOverview', jsonb_build_object('totalExpected', 0, 'totalCollected', 0, 'outstanding', 0, 'collectionRate', 0),
    'upcomingEvents', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'date', start_date, 'type', event_type, 'description', description, 'color', COALESCE(color, '#6366f1'))), '[]'::jsonb)
      FROM (
        SELECT id, title, start_date, event_type, description, color
        FROM school_calendar_events
        WHERE school_code = v_school_code AND is_active = true
          AND start_date >= v_today AND start_date <= (v_today + INTERVAL '30 days')::date
        ORDER BY start_date ASC
        LIMIT 5
      ) ev
    )
  );
END;
$$;

COMMENT ON FUNCTION get_management_dashboard() IS 'Management dashboard KPIs: classes scheduled/completed from timetable_slots (completed = status = done), attendance %, action items, upcoming events';

GRANT EXECUTE ON FUNCTION get_management_dashboard() TO authenticated;
