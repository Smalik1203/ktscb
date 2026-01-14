-- ============================================================================
-- AI Report Card Comments - Database Migration
-- ============================================================================
-- This migration creates the tables and functions needed for AI-generated 
-- report card comments with quality controls and analytics.
-- ============================================================================

-- ============================================================================
-- TABLE: report_comments
-- Stores AI-generated report card comments with full audit trail
-- ============================================================================
CREATE TABLE public.report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  student_id UUID NOT NULL REFERENCES public.student(id) ON DELETE CASCADE,
  term_id UUID NOT NULL,  -- Reference to terms/academic periods
  class_instance_id UUID NOT NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  school_code TEXT NOT NULL,
  
  -- Generation Input (for explainability)
  input_data JSONB NOT NULL DEFAULT '{}',  -- grades, attendance, trends used
  data_freshness_days INTEGER DEFAULT 0,  -- how old the underlying data was
  
  -- Generation Settings
  tone TEXT DEFAULT 'friendly' CHECK (tone IN ('professional', 'friendly', 'encouraging')),
  focus TEXT DEFAULT 'holistic' CHECK (focus IN ('academic', 'behavioral', 'holistic')),
  language TEXT DEFAULT 'english' CHECK (language IN ('english', 'hindi', 'bilingual')),
  
  -- Generated Content
  generated_comment TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  
  -- Quality Metrics
  similarity_score DECIMAL(4,3) DEFAULT 0,  -- vs other comments in same batch
  positivity_score DECIMAL(4,3) DEFAULT 0.5,  -- sentiment analysis score
  generation_version INTEGER DEFAULT 1,
  model_used TEXT DEFAULT 'gpt-4o-mini',
  
  -- Teacher Edits
  edited_comment TEXT,
  edit_diff_length INTEGER DEFAULT 0,  -- track edit magnitude for prompt improvement
  was_regenerated BOOLEAN DEFAULT FALSE,
  regeneration_count INTEGER DEFAULT 0,
  
  -- Approval Flow
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one comment per student per term
  UNIQUE(student_id, term_id)
);

-- Add comment for documentation
COMMENT ON TABLE public.report_comments IS 'AI-generated report card comments with quality controls and approval workflow';

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX idx_report_comments_class_term ON report_comments(class_instance_id, term_id);
CREATE INDEX idx_report_comments_teacher ON report_comments(teacher_id);
CREATE INDEX idx_report_comments_status ON report_comments(status);
CREATE INDEX idx_report_comments_school ON report_comments(school_code);
CREATE INDEX idx_report_comments_student ON report_comments(student_id);

-- ============================================================================
-- TABLE: report_comment_analytics
-- Aggregated analytics per school/term for monitoring quality
-- ============================================================================
CREATE TABLE public.report_comment_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code TEXT NOT NULL,
  term_id UUID NOT NULL,
  
  -- Aggregate Metrics
  total_generated INTEGER DEFAULT 0,
  total_approved INTEGER DEFAULT 0,
  total_edited INTEGER DEFAULT 0,
  total_regenerated INTEGER DEFAULT 0,
  avg_edit_length INTEGER DEFAULT 0,
  avg_similarity_score DECIMAL(4,3) DEFAULT 0,
  avg_positivity_score DECIMAL(4,3) DEFAULT 0,
  
  -- Performance Distribution
  comments_high_performers INTEGER DEFAULT 0,  -- A+ to A students
  comments_mid_performers INTEGER DEFAULT 0,   -- B to C students
  comments_low_performers INTEGER DEFAULT 0,   -- D and below
  
  -- Quality Flags
  regeneration_rate DECIMAL(4,3) DEFAULT 0,
  rejection_rate DECIMAL(4,3) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(school_code, term_id)
);

COMMENT ON TABLE public.report_comment_analytics IS 'Aggregated analytics for AI report comments quality monitoring';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_comment_analytics ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own comments
CREATE POLICY "Teachers manage own report comments"
  ON report_comments FOR ALL
  USING (teacher_id = auth.uid());

-- Admins can view all school comments
CREATE POLICY "Admins view school report comments"
  ON report_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_code = report_comments.school_code
      AND u.role IN ('admin', 'superadmin')
    )
  );

-- Admins can view school analytics
CREATE POLICY "Admins view report comment analytics"
  ON report_comment_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.school_code = report_comment_analytics.school_code
      AND u.role IN ('admin', 'superadmin')
    )
  );

-- ============================================================================
-- FUNCTION: get_student_report_data
-- Aggregates all data needed for report comment generation
-- ============================================================================
CREATE OR REPLACE FUNCTION get_student_report_data(
  p_student_id UUID,
  p_class_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_student RECORD;
  v_grades JSONB;
  v_attendance RECORD;
  v_trend TEXT;
BEGIN
  -- Get student info
  SELECT 
    s.id,
    s.full_name,
    s.student_code
  INTO v_student
  FROM student s
  WHERE s.id = p_student_id;

  IF v_student IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get subject grades from assessments
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'subject_name', sub.subject_name,
      'average_percentage', ROUND(AVG(sr.marks_obtained::numeric / NULLIF(a.max_marks, 0) * 100), 1)
    )
  ), '[]'::jsonb)
  INTO v_grades
  FROM student_results sr
  JOIN assessments a ON sr.assessment_id = a.id
  JOIN subjects sub ON a.subject_id = sub.id
  WHERE sr.student_id = p_student_id
    AND a.class_instance_id = p_class_instance_id
  GROUP BY sub.subject_name;

  -- Get attendance
  SELECT 
    COUNT(*) FILTER (WHERE status = 'present') as present,
    COUNT(*) FILTER (WHERE status = 'absent') as absent,
    COUNT(*) as total,
    ROUND(COUNT(*) FILTER (WHERE status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as percentage
  INTO v_attendance
  FROM attendance
  WHERE student_id = p_student_id;

  -- Calculate trend (simplified - compare to average)
  v_trend := 'stable';

  -- Build result
  v_result := jsonb_build_object(
    'student_id', v_student.id,
    'student_name', v_student.full_name,
    'student_code', v_student.student_code,
    'subjects', v_grades,
    'attendance', jsonb_build_object(
      'present', COALESCE(v_attendance.present, 0),
      'absent', COALESCE(v_attendance.absent, 0),
      'total', COALESCE(v_attendance.total, 0),
      'percentage', COALESCE(v_attendance.percentage, 0)
    ),
    'trend', v_trend,
    'data_timestamp', NOW()
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- FUNCTION: save_report_comment
-- Saves or updates a report comment
-- ============================================================================
CREATE OR REPLACE FUNCTION save_report_comment(
  p_student_id UUID,
  p_term_id UUID,
  p_class_instance_id UUID,
  p_school_code TEXT,
  p_generated_comment TEXT,
  p_input_data JSONB,
  p_tone TEXT DEFAULT 'friendly',
  p_focus TEXT DEFAULT 'holistic',
  p_language TEXT DEFAULT 'english',
  p_word_count INTEGER DEFAULT 0,
  p_positivity_score DECIMAL DEFAULT 0.5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO report_comments (
    student_id,
    term_id,
    class_instance_id,
    teacher_id,
    school_code,
    generated_comment,
    input_data,
    tone,
    focus,
    language,
    word_count,
    positivity_score,
    status
  ) VALUES (
    p_student_id,
    p_term_id,
    p_class_instance_id,
    auth.uid(),
    p_school_code,
    p_generated_comment,
    p_input_data,
    p_tone,
    p_focus,
    p_language,
    p_word_count,
    p_positivity_score,
    'draft'
  )
  ON CONFLICT (student_id, term_id)
  DO UPDATE SET
    generated_comment = EXCLUDED.generated_comment,
    input_data = EXCLUDED.input_data,
    tone = EXCLUDED.tone,
    focus = EXCLUDED.focus,
    language = EXCLUDED.language,
    word_count = EXCLUDED.word_count,
    positivity_score = EXCLUDED.positivity_score,
    was_regenerated = TRUE,
    regeneration_count = report_comments.regeneration_count + 1,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- FUNCTION: approve_report_comment
-- Approves a report comment
-- ============================================================================
CREATE OR REPLACE FUNCTION approve_report_comment(
  p_comment_id UUID,
  p_edited_comment TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original_length INTEGER;
BEGIN
  -- Get original length for edit tracking
  SELECT word_count INTO v_original_length
  FROM report_comments
  WHERE id = p_comment_id AND teacher_id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE report_comments
  SET 
    status = 'approved',
    approved_at = NOW(),
    approved_by = auth.uid(),
    edited_comment = p_edited_comment,
    edit_diff_length = CASE 
      WHEN p_edited_comment IS NOT NULL 
      THEN ABS(array_length(regexp_split_to_array(p_edited_comment, '\s+'), 1) - v_original_length)
      ELSE 0
    END,
    updated_at = NOW()
  WHERE id = p_comment_id
    AND teacher_id = auth.uid();

  RETURN TRUE;
END;
$$;

-- ============================================================================
-- FUNCTION: get_class_comments
-- Gets all comments for a class/term
-- ============================================================================
CREATE OR REPLACE FUNCTION get_class_comments(
  p_class_instance_id UUID,
  p_term_id UUID
)
RETURNS TABLE (
  id UUID,
  student_id UUID,
  student_name TEXT,
  student_code TEXT,
  generated_comment TEXT,
  edited_comment TEXT,
  status TEXT,
  input_data JSONB,
  word_count INTEGER,
  positivity_score DECIMAL,
  similarity_score DECIMAL,
  was_regenerated BOOLEAN,
  regeneration_count INTEGER,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id,
    rc.student_id,
    s.full_name as student_name,
    s.student_code,
    rc.generated_comment,
    rc.edited_comment,
    rc.status,
    rc.input_data,
    rc.word_count,
    rc.positivity_score,
    rc.similarity_score,
    rc.was_regenerated,
    rc.regeneration_count,
    rc.approved_at,
    rc.created_at
  FROM report_comments rc
  JOIN student s ON rc.student_id = s.id
  WHERE rc.class_instance_id = p_class_instance_id
    AND rc.term_id = p_term_id
    AND rc.teacher_id = auth.uid()
  ORDER BY s.full_name;
END;
$$;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_student_report_data TO authenticated;
GRANT EXECUTE ON FUNCTION save_report_comment TO authenticated;
GRANT EXECUTE ON FUNCTION approve_report_comment TO authenticated;
GRANT EXECUTE ON FUNCTION get_class_comments TO authenticated;
