-- Update push_notification_tokens for production security
-- 1. Add unique constraint on token
-- 2. Update RLS policies (users cannot read others' tokens)

-- Add unique constraint
ALTER TABLE push_notification_tokens 
  ADD CONSTRAINT unique_token UNIQUE (token);

-- Drop existing insecure policies
DROP POLICY IF EXISTS "Users can view own tokens" ON push_notification_tokens;
DROP POLICY IF EXISTS "Admins can read all tokens" ON push_notification_tokens;

-- Users can only manage their own tokens (no SELECT for regular users)
-- Service role (Edge Functions) can read all tokens

-- Keep existing INSERT/UPDATE/DELETE policies (already correct)
-- No SELECT policy = users cannot read tokens (not even their own from client)
-- Edge Functions use service role which bypasses RLS
