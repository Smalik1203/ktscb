-- Smart Task Logs: Audit logging for AI-powered task creation
-- Captures all smart task creation attempts for debugging, analytics, and dispute resolution

CREATE TABLE IF NOT EXISTS smart_task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id), -- user who created (admin, teacher, etc.)
  
  -- Input data
  input_type TEXT NOT NULL CHECK (input_type IN ('voice', 'text')),
  raw_input TEXT NOT NULL,
  transcription TEXT, -- only for voice input
  audio_duration_seconds NUMERIC, -- only for voice input
  
  -- AI parsing results
  parsed_output JSONB NOT NULL,
  field_confidences JSONB NOT NULL,
  overall_confidence NUMERIC,
  fields_needing_review TEXT[], -- array of field names that needed confirmation
  
  -- User modifications
  was_edited BOOLEAN DEFAULT false,
  edits_made JSONB, -- {field: {old: ..., new: ...}}
  
  -- Final result
  final_task_id UUID REFERENCES tasks(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'error')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX idx_smart_task_logs_school ON smart_task_logs(school_code);
CREATE INDEX idx_smart_task_logs_created_by ON smart_task_logs(created_by);
CREATE INDEX idx_smart_task_logs_created ON smart_task_logs(created_at DESC);
CREATE INDEX idx_smart_task_logs_status ON smart_task_logs(status);

-- RLS policies
ALTER TABLE smart_task_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own logs
CREATE POLICY "Users can view own smart task logs"
  ON smart_task_logs FOR SELECT
  USING (auth.uid() = created_by);

-- Users can insert their own logs
CREATE POLICY "Users can insert own smart task logs"
  ON smart_task_logs FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own pending logs
CREATE POLICY "Users can update own pending logs"
  ON smart_task_logs FOR UPDATE
  USING (auth.uid() = created_by AND status = 'pending');

COMMENT ON TABLE smart_task_logs IS 'Audit log for AI-powered smart task creation. Captures inputs, AI outputs, user edits, and final results.';
