-- Fix RLS policy for announcements to support superadmins
-- Superadmins have their school_code in the super_admin table, not users table

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view school announcements" ON announcements;

-- Create new policy that checks both users and super_admin tables
CREATE POLICY "Users can view school announcements"
  ON announcements FOR SELECT
  USING (
    school_code = (
      SELECT COALESCE(
        u.school_code,
        (SELECT sa.school_code FROM super_admin sa WHERE sa.auth_user_id = auth.uid())
      )
      FROM users u 
      WHERE u.id = auth.uid()
    )
  );

-- Also update insert policy to support superadmins properly
DROP POLICY IF EXISTS "Admins can create announcements" ON announcements;

CREATE POLICY "Admins can create announcements"
  ON announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'superadmin')
      AND (
        -- Admin with school_code in users table
        u.school_code = announcements.school_code
        OR
        -- Superadmin with school_code in super_admin table
        (u.role = 'superadmin' AND EXISTS (
          SELECT 1 FROM super_admin sa 
          WHERE sa.auth_user_id = auth.uid() 
          AND sa.school_code = announcements.school_code
        ))
      )
    )
  );

-- Update and delete policies for completeness
DROP POLICY IF EXISTS "Creators can update own announcements" ON announcements;
DROP POLICY IF EXISTS "Creators can delete own announcements" ON announcements;

-- Creators can update/delete, but also check school ownership
CREATE POLICY "Creators can update own announcements"
  ON announcements FOR UPDATE
  USING (
    created_by = auth.uid()
    AND school_code = (
      SELECT COALESCE(
        u.school_code,
        (SELECT sa.school_code FROM super_admin sa WHERE sa.auth_user_id = auth.uid())
      )
      FROM users u 
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Creators can delete own announcements"
  ON announcements FOR DELETE
  USING (
    created_by = auth.uid()
    AND school_code = (
      SELECT COALESCE(
        u.school_code,
        (SELECT sa.school_code FROM super_admin sa WHERE sa.auth_user_id = auth.uid())
      )
      FROM users u 
      WHERE u.id = auth.uid()
    )
  );
