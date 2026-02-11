-- =====================================================
-- Login by user code (username)
-- Resolves user_code -> email so client can use
-- signInWithPassword(email, password).
-- =====================================================

CREATE OR REPLACE FUNCTION get_login_email_by_user_code(p_user_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_code text;
BEGIN
  v_code := NULLIF(LOWER(TRIM(p_user_code)), '');

  IF v_code IS NULL THEN
    RETURN NULL;
  END IF;

  -- Admin: admin_code
  SELECT email INTO v_email
  FROM admin
  WHERE LOWER(TRIM(admin_code)) = v_code
  AND email IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- Student: student_code
  SELECT email INTO v_email
  FROM student
  WHERE LOWER(TRIM(student_code)) = v_code
  AND email IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- Super admin: super_admin_code
  SELECT email INTO v_email
  FROM super_admin
  WHERE LOWER(TRIM(super_admin_code)) = v_code
  AND email IS NOT NULL
  LIMIT 1;

  RETURN v_email;
END;
$$;

COMMENT ON FUNCTION get_login_email_by_user_code(text) IS
  'Resolves user code (admin_code, student_code, or super_admin_code) to login email. Used for username+password login. Callable by anon.';

-- Allow anonymous (unauthenticated) call for login screen
GRANT EXECUTE ON FUNCTION get_login_email_by_user_code(text) TO anon;
GRANT EXECUTE ON FUNCTION get_login_email_by_user_code(text) TO authenticated;
