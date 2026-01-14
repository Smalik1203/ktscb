-- Create a secure function to register push tokens
-- This handles the "shared device" scenario where a token exists for another user
-- expected behavior: update the token to belong to the new user

CREATE OR REPLACE FUNCTION register_push_token(
  p_token TEXT,
  p_device_type TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO push_notification_tokens (user_id, token, device_type)
  VALUES (auth.uid(), p_token, p_device_type)
  ON CONFLICT (token) DO UPDATE
  SET user_id = EXCLUDED.user_id, -- Take the new user_id
      device_type = EXCLUDED.device_type,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION register_push_token TO authenticated;
