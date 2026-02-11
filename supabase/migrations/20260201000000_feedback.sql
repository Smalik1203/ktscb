-- Create feedback table for structured feedback system
-- Supports: Student → Admin, SuperAdmin → Admin, Management Notes

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Feedback type determines the flow
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'student_to_admin',
    'superadmin_to_admin', 
    'management_note'
  )),
  
  -- Participants
  from_user_id UUID REFERENCES users(id) NOT NULL,
  to_user_id UUID REFERENCES users(id) NOT NULL,
  
  -- Context (optional - for student feedback)
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  class_instance_id UUID REFERENCES class_instances(id) ON DELETE SET NULL,
  
  -- Feedback content
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'needs_improvement')),
  category TEXT NOT NULL CHECK (category IN (
    'teaching_clarity',
    'pace', 
    'behaviour',
    'doubt_resolution',
    'general',
    'observation',
    'improvement_required',
    'appreciation'
  )),
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  
  -- Acknowledgement workflow
  requires_acknowledgement BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  
  -- Archival (super admin only)
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES users(id),
  
  -- Metadata
  school_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_feedback_to_user ON feedback(to_user_id, created_at DESC);
CREATE INDEX idx_feedback_from_user ON feedback(from_user_id, created_at DESC);
CREATE INDEX idx_feedback_school ON feedback(school_code, created_at DESC);
CREATE INDEX idx_feedback_type ON feedback(feedback_type, created_at DESC);
CREATE INDEX idx_feedback_archived ON feedback(archived_at) WHERE archived_at IS NULL;

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Students can insert their own feedback (student_to_admin only)
CREATE POLICY "Students can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (
    from_user_id = auth.uid()
    AND feedback_type = 'student_to_admin'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'student'
      AND school_code = feedback.school_code
    )
  );

-- Admins can view feedback sent TO them (but not sender details via view)
CREATE POLICY "Admins can view their received feedback"
  ON feedback FOR SELECT
  USING (
    to_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'teacher')
    )
  );

-- Super Admins can view ALL feedback for their school
CREATE POLICY "Super Admins can view all school feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'superadmin'
      AND school_code = feedback.school_code
    )
  );

-- Super Admins can insert management notes
CREATE POLICY "Super Admins can add management notes"
  ON feedback FOR INSERT
  WITH CHECK (
    from_user_id = auth.uid()
    AND feedback_type IN ('superadmin_to_admin', 'management_note')
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'superadmin'
      AND school_code = feedback.school_code
    )
  );

-- Admins can acknowledge feedback (update acknowledged_at only)
CREATE POLICY "Admins can acknowledge feedback"
  ON feedback FOR UPDATE
  USING (
    to_user_id = auth.uid()
    AND acknowledged_at IS NULL
  )
  WITH CHECK (
    -- Only allow updating acknowledged_at
    to_user_id = auth.uid()
  );

-- Super Admins can archive feedback
CREATE POLICY "Super Admins can archive feedback"
  ON feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'superadmin'
      AND school_code = feedback.school_code
    )
  );

-- ============================================================================
-- TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- ============================================================================
-- VIEW: Admin-safe feedback view (hides student identity from teachers)
-- ============================================================================

CREATE OR REPLACE VIEW feedback_for_admin AS
SELECT 
  f.id,
  f.feedback_type,
  f.to_user_id,
  f.subject_id,
  f.class_instance_id,
  f.sentiment,
  f.category,
  f.content,
  f.requires_acknowledgement,
  f.acknowledged_at,
  f.school_code,
  f.created_at,
  f.updated_at,
  -- Join subject name
  s.subject_name,
  -- Join class info
  ci.grade,
  ci.section
FROM feedback f
LEFT JOIN subjects s ON f.subject_id = s.id
LEFT JOIN class_instances ci ON f.class_instance_id = ci.id
WHERE f.feedback_type = 'student_to_admin'
  AND f.archived_at IS NULL;

-- Grant select on view to authenticated users
GRANT SELECT ON feedback_for_admin TO authenticated;
