-- =====================================================
-- FINANCE MODULE - AUDIT LOG TABLE
-- Created: 2025-01-29
-- Purpose: Track all finance operations for audit trail
-- Phase 7: Audit & Safety
-- =====================================================

-- =====================================================
-- TABLE: finance_audit_log
-- Purpose: Log all finance operations (create, update, delete)
-- =====================================================
CREATE TABLE IF NOT EXISTS finance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('create', 'update', 'delete', 'export', 'reconcile')),
  resource_type text NOT NULL CHECK (resource_type IN ('transaction', 'account', 'category', 'report')),
  resource_id uuid, -- ID of the resource (transaction, account, etc.)
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_role text NOT NULL,
  action_details jsonb, -- Flexible JSON for event-specific data
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_finance_audit_log_school_code 
ON finance_audit_log(school_code, created_at DESC)
WHERE school_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_audit_log_resource 
ON finance_audit_log(resource_type, resource_id)
WHERE resource_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_audit_log_user 
ON finance_audit_log(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE finance_audit_log ENABLE ROW LEVEL SECURITY;

-- Super admin can view audit logs for their school
CREATE POLICY "superadmin_view_finance_audit_log" ON finance_audit_log
  FOR SELECT
  USING (
    jwt_role() = 'superadmin'::text 
    AND school_code = jwt_school_code()
  );

-- Service role can insert audit logs (via Edge Functions or service layer)
-- Note: Service role bypasses RLS, but we add policy for completeness
CREATE POLICY "service_insert_finance_audit_log" ON finance_audit_log
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS anyway

-- =====================================================
-- FUNCTION: Log finance operation
-- =====================================================
CREATE OR REPLACE FUNCTION log_finance_operation(
  p_school_code text,
  p_event_type text,
  p_resource_type text,
  p_resource_id uuid,
  p_user_id uuid,
  p_user_role text,
  p_action_details jsonb DEFAULT '{}'::jsonb,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO finance_audit_log (
    school_code,
    event_type,
    resource_type,
    resource_id,
    user_id,
    user_role,
    action_details,
    ip_address,
    user_agent
  ) VALUES (
    p_school_code,
    p_event_type,
    p_resource_type,
    p_resource_id,
    p_user_id,
    p_user_role,
    p_action_details,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Detect finance inconsistencies
-- =====================================================
CREATE OR REPLACE FUNCTION detect_finance_inconsistencies(
  p_school_code text,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
) RETURNS TABLE (
  inconsistency_type text,
  description text,
  severity text,
  affected_count bigint,
  details jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH date_filter AS (
    SELECT 
      COALESCE(p_start_date, '1900-01-01'::date) AS start_date,
      COALESCE(p_end_date, CURRENT_DATE) AS end_date
  ),
  -- Check 1: Fee payments without finance transactions
  missing_finance_txns AS (
    SELECT 
      'missing_finance_transaction'::text AS inconsistency_type,
      'Fee payment exists but no finance transaction found'::text AS description,
      'high'::text AS severity,
      COUNT(*)::bigint AS affected_count,
      jsonb_agg(
        jsonb_build_object(
          'fee_payment_id', fp.id,
          'amount', fp.amount_inr,
          'payment_date', fp.payment_date,
          'student_id', fp.student_id
        )
      ) AS details
    FROM fee_payments fp
    CROSS JOIN date_filter df
    LEFT JOIN finance_transaction_links ftl 
      ON ftl.source_type = 'fee_payment' 
      AND ftl.source_id::uuid = fp.id
    WHERE fp.school_code = p_school_code
      AND fp.payment_date BETWEEN df.start_date AND df.end_date
      AND fp.amount_inr IS NOT NULL
      AND fp.amount_inr > 0
      AND ftl.id IS NULL
  ),
  -- Check 2: Finance transactions without valid category
  invalid_categories AS (
    SELECT 
      'invalid_category'::text AS inconsistency_type,
      'Finance transaction references non-existent or inactive category'::text AS description,
      'medium'::text AS severity,
      COUNT(*)::bigint AS affected_count,
      jsonb_agg(
        jsonb_build_object(
          'transaction_id', ft.id,
          'category_id', ft.category_id,
          'amount', ft.amount,
          'txn_date', ft.txn_date
        )
      ) AS details
    FROM finance_transactions ft
    CROSS JOIN date_filter df
    LEFT JOIN finance_categories fc 
      ON fc.id = ft.category_id 
      AND fc.school_code = ft.school_code
      AND fc.is_active = true
    WHERE ft.school_code = p_school_code
      AND ft.txn_date BETWEEN df.start_date AND df.end_date
      AND ft.deleted_at IS NULL
      AND (fc.id IS NULL OR fc.is_active = false)
  ),
  -- Check 3: Finance transactions without valid account
  invalid_accounts AS (
    SELECT 
      'invalid_account'::text AS inconsistency_type,
      'Finance transaction references non-existent or inactive account'::text AS description,
      'medium'::text AS severity,
      COUNT(*)::bigint AS affected_count,
      jsonb_agg(
        jsonb_build_object(
          'transaction_id', ft.id,
          'account_id', ft.account_id,
          'amount', ft.amount,
          'txn_date', ft.txn_date
        )
      ) AS details
    FROM finance_transactions ft
    CROSS JOIN date_filter df
    LEFT JOIN finance_accounts fa 
      ON fa.id = ft.account_id 
      AND fa.school_code = ft.school_code
      AND fa.is_active = true
    WHERE ft.school_code = p_school_code
      AND ft.txn_date BETWEEN df.start_date AND df.end_date
      AND ft.deleted_at IS NULL
      AND (fa.id IS NULL OR fa.is_active = false)
  ),
  -- Check 4: Orphaned transaction links
  orphaned_links AS (
    SELECT 
      'orphaned_link'::text AS inconsistency_type,
      'Transaction link references deleted transaction'::text AS description,
      'low'::text AS severity,
      COUNT(*)::bigint AS affected_count,
      jsonb_agg(
        jsonb_build_object(
          'link_id', ftl.id,
          'transaction_id', ftl.finance_transaction_id,
          'source_type', ftl.source_type,
          'source_id', ftl.source_id
        )
      ) AS details
    FROM finance_transaction_links ftl
    LEFT JOIN finance_transactions ft 
      ON ft.id = ftl.finance_transaction_id
    WHERE ft.id IS NULL OR ft.deleted_at IS NOT NULL
  )
  SELECT * FROM missing_finance_txns
  UNION ALL
  SELECT * FROM invalid_categories
  UNION ALL
  SELECT * FROM invalid_accounts
  UNION ALL
  SELECT * FROM orphaned_links;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE finance_audit_log IS 'Audit trail for all finance operations - Phase 7';
COMMENT ON FUNCTION log_finance_operation IS 'Log a finance operation to audit trail';
COMMENT ON FUNCTION detect_finance_inconsistencies IS 'Detect inconsistencies in finance data (missing links, invalid references, etc.)';

