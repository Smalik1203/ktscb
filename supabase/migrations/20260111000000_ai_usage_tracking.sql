-- AI Usage Limits and Logs
-- Tracks AI generation usage per user with rate limiting and analytics

-- ============================================================================
-- AI Usage Limits Table (for rate limiting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_code TEXT NOT NULL,
  
  -- Usage counters
  generations_today INTEGER DEFAULT 0,
  generations_this_month INTEGER DEFAULT 0,
  
  -- Limits (can be customized per user/school)
  daily_limit INTEGER DEFAULT 10,
  monthly_limit INTEGER DEFAULT 100,
  
  -- Tracking
  last_generation_at TIMESTAMPTZ,
  last_reset_daily TIMESTAMPTZ DEFAULT NOW(),
  last_reset_monthly TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per user
  UNIQUE(user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_limits_user_id ON public.ai_usage_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_limits_school ON public.ai_usage_limits(school_code);

-- Enable Row Level Security
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own limits
CREATE POLICY "Users can view own ai_usage_limits"
  ON public.ai_usage_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all (for Edge Functions)
-- Note: Edge Functions use service role key which bypasses RLS

-- ============================================================================
-- AI Generation Logs Table (for analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_code TEXT NOT NULL,
  
  -- Request details
  question_count_requested INTEGER NOT NULL,
  has_context BOOLEAN DEFAULT FALSE,
  image_size_bytes INTEGER,
  
  -- Response details
  questions_generated INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Performance metrics
  duration_ms INTEGER,
  
  -- Cost tracking (estimated based on OpenAI pricing)
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd DECIMAL(10, 6),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_logs_school_date 
  ON public.ai_generation_logs(school_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_date 
  ON public.ai_generation_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at 
  ON public.ai_generation_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view own ai_generation_logs"
  ON public.ai_generation_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all logs from their school
CREATE POLICY "Admins can view school ai_generation_logs"
  ON public.ai_generation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.school_code = ai_generation_logs.school_code
      AND u.role IN ('admin', 'superadmin')
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to check rate limits (returns true if allowed, false if blocked)
CREATE OR REPLACE FUNCTION check_ai_rate_limit(p_user_id UUID)
RETURNS TABLE(allowed BOOLEAN, daily_remaining INTEGER, monthly_remaining INTEGER, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limits RECORD;
  v_daily_remaining INTEGER;
  v_monthly_remaining INTEGER;
BEGIN
  -- Get or create usage limits for user
  SELECT * INTO v_limits 
  FROM public.ai_usage_limits 
  WHERE user_id = p_user_id;
  
  -- If no record exists, user is allowed (will be created on first use)
  IF v_limits IS NULL THEN
    RETURN QUERY SELECT true, 10, 100, 'OK'::TEXT;
    RETURN;
  END IF;
  
  -- Check if daily reset is needed (new day)
  IF DATE(v_limits.last_reset_daily) < CURRENT_DATE THEN
    UPDATE public.ai_usage_limits 
    SET generations_today = 0, last_reset_daily = NOW()
    WHERE user_id = p_user_id;
    v_limits.generations_today := 0;
  END IF;
  
  -- Check if monthly reset is needed (new month)
  IF DATE_TRUNC('month', v_limits.last_reset_monthly) < DATE_TRUNC('month', NOW()) THEN
    UPDATE public.ai_usage_limits 
    SET generations_this_month = 0, last_reset_monthly = NOW()
    WHERE user_id = p_user_id;
    v_limits.generations_this_month := 0;
  END IF;
  
  -- Calculate remaining
  v_daily_remaining := v_limits.daily_limit - v_limits.generations_today;
  v_monthly_remaining := v_limits.monthly_limit - v_limits.generations_this_month;
  
  -- Check limits
  IF v_daily_remaining <= 0 THEN
    RETURN QUERY SELECT false, 0, v_monthly_remaining, 'Daily limit reached'::TEXT;
    RETURN;
  END IF;
  
  IF v_monthly_remaining <= 0 THEN
    RETURN QUERY SELECT false, v_daily_remaining, 0, 'Monthly limit reached'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_daily_remaining, v_monthly_remaining, 'OK'::TEXT;
END;
$$;

-- Function to increment usage after successful generation
CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_id UUID, p_school_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.ai_usage_limits (user_id, school_code, generations_today, generations_this_month, last_generation_at)
  VALUES (p_user_id, p_school_code, 1, 1, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    generations_today = ai_usage_limits.generations_today + 1,
    generations_this_month = ai_usage_limits.generations_this_month + 1,
    last_generation_at = NOW(),
    updated_at = NOW();
END;
$$;

-- Function to log AI generation attempt
CREATE OR REPLACE FUNCTION log_ai_generation(
  p_user_id UUID,
  p_school_code TEXT,
  p_question_count_requested INTEGER,
  p_has_context BOOLEAN,
  p_image_size_bytes INTEGER,
  p_questions_generated INTEGER,
  p_success BOOLEAN,
  p_error_message TEXT,
  p_duration_ms INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_input_tokens INTEGER;
  v_output_tokens INTEGER;
  v_estimated_cost DECIMAL(10, 6);
BEGIN
  -- Estimate tokens based on typical usage
  -- Image (low detail): ~85 tokens, Prompt: ~150 tokens
  v_input_tokens := 235;
  
  -- Output: ~80 tokens per question
  v_output_tokens := COALESCE(p_questions_generated, 0) * 80;
  
  -- Estimate cost (GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output)
  v_estimated_cost := (v_input_tokens * 0.00000015) + (v_output_tokens * 0.0000006);
  
  INSERT INTO public.ai_generation_logs (
    user_id, school_code, question_count_requested, has_context, 
    image_size_bytes, questions_generated, success, error_message,
    duration_ms, input_tokens, output_tokens, estimated_cost_usd
  )
  VALUES (
    p_user_id, p_school_code, p_question_count_requested, p_has_context,
    p_image_size_bytes, p_questions_generated, p_success, p_error_message,
    p_duration_ms, v_input_tokens, v_output_tokens, v_estimated_cost
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================================================
-- Analytics Views
-- ============================================================================

-- View for daily AI usage summary (for admin dashboard)
CREATE OR REPLACE VIEW public.ai_usage_daily_summary AS
SELECT 
  school_code,
  DATE(created_at) as date,
  COUNT(*) as total_generations,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_generations,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_generations,
  SUM(COALESCE(questions_generated, 0)) as total_questions,
  AVG(duration_ms)::INTEGER as avg_duration_ms,
  SUM(COALESCE(estimated_cost_usd, 0)) as total_cost_usd,
  COUNT(DISTINCT user_id) as unique_users
FROM public.ai_generation_logs
GROUP BY school_code, DATE(created_at);

-- Comment explaining the tables
COMMENT ON TABLE public.ai_usage_limits IS 'Tracks AI generation rate limits per user';
COMMENT ON TABLE public.ai_generation_logs IS 'Logs all AI question generation attempts for analytics';
