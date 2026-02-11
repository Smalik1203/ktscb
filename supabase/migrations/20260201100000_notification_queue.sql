-- Notification Queue for Scalable Push Notifications
-- Supports 100K+ users with background processing

-- 1. Create notification queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Notification content
  event TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  
  -- Targeting
  school_code TEXT,
  target_user_ids UUID[], -- NULL means use school_code to find users
  
  -- Processing state
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INT DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest
  
  -- Progress tracking
  total_recipients INT DEFAULT 0,
  processed_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error tracking
  last_error TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3
);

-- 2. Indexes for queue processing
CREATE INDEX idx_notification_queue_status_priority 
  ON notification_queue(status, priority, created_at) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX idx_notification_queue_school 
  ON notification_queue(school_code) 
  WHERE school_code IS NOT NULL;

-- 3. Index on push_notification_tokens for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id_btree 
  ON push_notification_tokens USING btree(user_id);

-- 4. Function to enqueue a notification
CREATE OR REPLACE FUNCTION enqueue_notification(
  p_event TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}',
  p_school_code TEXT DEFAULT NULL,
  p_user_ids UUID[] DEFAULT NULL,
  p_priority INT DEFAULT 5
) RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
  v_total INT;
BEGIN
  -- Calculate total recipients
  IF p_user_ids IS NOT NULL THEN
    v_total := array_length(p_user_ids, 1);
  ELSIF p_school_code IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total
    FROM push_notification_tokens t
    JOIN users u ON t.user_id = u.id
    WHERE u.school_code = p_school_code;
  ELSE
    RAISE EXCEPTION 'Must provide either user_ids or school_code';
  END IF;

  -- Insert into queue
  INSERT INTO notification_queue (
    event, title, body, data, 
    school_code, target_user_ids, 
    priority, total_recipients
  ) VALUES (
    p_event, p_title, p_body, p_data,
    p_school_code, p_user_ids,
    p_priority, COALESCE(v_total, 0)
  ) RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to get next batch of tokens to process
CREATE OR REPLACE FUNCTION get_notification_batch(
  p_queue_id UUID,
  p_batch_size INT DEFAULT 500
) RETURNS TABLE (
  user_id UUID,
  token TEXT
) AS $$
DECLARE
  v_job notification_queue%ROWTYPE;
  v_offset INT;
BEGIN
  -- Get the job
  SELECT * INTO v_job FROM notification_queue WHERE id = p_queue_id;
  
  IF v_job IS NULL THEN
    RETURN;
  END IF;
  
  v_offset := v_job.processed_count;
  
  -- Return tokens based on targeting method
  IF v_job.target_user_ids IS NOT NULL THEN
    -- Specific user IDs
    RETURN QUERY
    SELECT t.user_id, t.token
    FROM push_notification_tokens t
    WHERE t.user_id = ANY(v_job.target_user_ids[v_offset + 1 : v_offset + p_batch_size]);
  ELSE
    -- School-wide
    RETURN QUERY
    SELECT t.user_id, t.token
    FROM push_notification_tokens t
    JOIN users u ON t.user_id = u.id
    WHERE u.school_code = v_job.school_code
    ORDER BY t.user_id
    OFFSET v_offset
    LIMIT p_batch_size;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to update queue progress
CREATE OR REPLACE FUNCTION update_queue_progress(
  p_queue_id UUID,
  p_processed INT,
  p_success INT,
  p_failed INT,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_job notification_queue%ROWTYPE;
  v_new_processed INT;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_job FROM notification_queue WHERE id = p_queue_id FOR UPDATE;
  
  v_new_processed := v_job.processed_count + p_processed;
  
  -- Determine new status
  IF v_new_processed >= v_job.total_recipients THEN
    v_new_status := 'completed';
  ELSE
    v_new_status := 'pending'; -- Ready for next batch
  END IF;
  
  UPDATE notification_queue SET
    processed_count = v_new_processed,
    success_count = success_count + p_success,
    failed_count = failed_count + p_failed,
    status = v_new_status,
    completed_at = CASE WHEN v_new_status = 'completed' THEN NOW() ELSE NULL END,
    last_error = COALESCE(p_error, last_error)
  WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION enqueue_notification TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_notification_batch TO service_role;
GRANT EXECUTE ON FUNCTION update_queue_progress TO service_role;

-- 8. RLS for notification_queue
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON notification_queue
  FOR ALL USING (true) WITH CHECK (true);

-- Admins can view queue status
CREATE POLICY "Admins can view queue" ON notification_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'superadmin')
    )
  );

COMMENT ON TABLE notification_queue IS 'Queue for scalable push notification delivery. Supports 100K+ recipients with background processing.';
