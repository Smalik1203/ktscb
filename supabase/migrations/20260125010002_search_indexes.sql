-- =====================================================
-- Search Indexes for Server-side Filtering
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users/Admin search
CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
  ON users USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm
  ON users USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_phone_trgm
  ON users USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_admin_code_trgm
  ON users USING gin (admin_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_admin_full_name_trgm
  ON admin USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_admin_email_trgm
  ON admin USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_admin_phone_trgm
  ON admin USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_admin_admin_code_trgm
  ON admin USING gin (admin_code gin_trgm_ops);

-- Student search
CREATE INDEX IF NOT EXISTS idx_student_full_name_trgm
  ON student USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_student_email_trgm
  ON student USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_student_phone_trgm
  ON student USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_student_code_trgm
  ON student USING gin (student_code gin_trgm_ops);

