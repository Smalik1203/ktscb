-- Secure Push Notification Token Management

-- 1. Create or update the RPC to register a push token
CREATE OR REPLACE FUNCTION public.register_push_token(
    p_token TEXT,
    p_device_type TEXT
) RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get current authenticated user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- SECURITY: Remove this token if it exists for ANY OTHER user
    -- This handles token rotation and shared device scenarios where 
    -- User A logs out and User B logs in on the same device.
    DELETE FROM public.push_notification_tokens 
    WHERE token = p_token AND user_id != v_user_id;

    -- Upsert the token for the current user
    INSERT INTO public.push_notification_tokens (user_id, token, device_type, updated_at)
    VALUES (v_user_id, p_token, p_device_type, NOW())
    ON CONFLICT (token) DO UPDATE 
    SET 
        user_id = EXCLUDED.user_id,
        device_type = EXCLUDED.device_type,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the RPC to remove a push token
CREATE OR REPLACE FUNCTION public.remove_push_token(
    p_token TEXT
) RETURNS VOID AS $$
BEGIN
    -- SECURITY: Only allow deleting if the token belongs to the current user
    DELETE FROM public.push_notification_tokens 
    WHERE token = p_token AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure RLS is enabled but restrict direct access
-- Note: Assuming table exists based on previous audit
ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Remove broad policies if they exist (clean slate)
DROP POLICY IF EXISTS "Users can manage own tokens" ON public.push_notification_tokens;
DROP POLICY IF EXISTS "Admins can view all tokens" ON public.push_notification_tokens;

-- Only Allow SELECT to users for their own tokens (for verification if needed)
CREATE POLICY "Users can view own tokens" ON public.push_notification_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view everything
CREATE POLICY "Admins can view all tokens" ON public.push_notification_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'superadmin')
        )
    );

-- CRITICAL: Direct INSERT/UPDATE/DELETE are now ONLY possible via RPC 
-- because we have no policies allowing them. 
-- SECURITY DEFINER in the functions bypasses RLS within the function context.
