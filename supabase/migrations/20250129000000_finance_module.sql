-- =====================================================
-- FINANCE MODULE - CASH-BASIS ACCOUNTING
-- Created: 2025-01-29
-- Purpose: School-scoped finance management for income and expenses
-- Access: Super Admin only
-- =====================================================

-- =====================================================
-- TABLE 1: finance_accounts
-- Purpose: Track different accounts (Cash, Bank, UPI, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  name text NOT NULL, -- e.g., "Cash", "Bank Account", "UPI"
  type text NOT NULL CHECK (type IN ('cash', 'bank', 'virtual')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  
  -- Ensure unique account names per school
  UNIQUE(school_code, name)
);

-- Index for school-scoped queries
CREATE INDEX IF NOT EXISTS idx_finance_accounts_school_code 
ON finance_accounts(school_code, is_active)
WHERE school_code IS NOT NULL;

-- =====================================================
-- TABLE 2: finance_categories
-- Purpose: Categorize income and expenses
-- =====================================================
CREATE TABLE IF NOT EXISTS finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  name text NOT NULL, -- e.g., "Fees", "Salary", "Rent"
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  
  -- Ensure unique category names per school and type
  UNIQUE(school_code, name, type)
);

-- Index for school-scoped queries
CREATE INDEX IF NOT EXISTS idx_finance_categories_school_code 
ON finance_categories(school_code, type, is_active)
WHERE school_code IS NOT NULL;

-- =====================================================
-- TABLE 3: finance_transactions
-- Purpose: Core transaction table (cash-basis accounting)
-- =====================================================
CREATE TABLE IF NOT EXISTS finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL,
  txn_date date NOT NULL, -- Transaction date (cash-basis: when money changes hands)
  amount numeric NOT NULL CHECK (amount > 0), -- Always positive (type determines income/expense)
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category_id uuid NOT NULL REFERENCES finance_categories(id),
  account_id uuid NOT NULL REFERENCES finance_accounts(id),
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz -- Soft delete (no hard deletes for audit)
  -- Note: School matching for category_id and account_id enforced via RLS and service layer validation
);

-- Critical indexes for date-range queries and reporting
CREATE INDEX IF NOT EXISTS idx_finance_transactions_school_date 
ON finance_transactions(school_code, txn_date DESC)
WHERE deleted_at IS NULL AND school_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_school_type_date 
ON finance_transactions(school_code, type, txn_date DESC)
WHERE deleted_at IS NULL AND school_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_category 
ON finance_transactions(category_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_account 
ON finance_transactions(account_id)
WHERE deleted_at IS NULL;

-- =====================================================
-- TABLE 4: finance_transaction_links
-- Purpose: Link finance transactions to their source (fee_payments, manual entries, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS finance_transaction_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finance_transaction_id uuid NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('fee_payment', 'manual', 'salary')),
  source_id uuid NOT NULL, -- Flexible: can reference fee_payments.id, or NULL for manual
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one finance transaction per source (idempotency)
  UNIQUE(source_type, source_id)
);

-- Indexes for joins and idempotency checks
CREATE INDEX IF NOT EXISTS idx_finance_transaction_links_txn_id 
ON finance_transaction_links(finance_transaction_id);

CREATE INDEX IF NOT EXISTS idx_finance_transaction_links_source 
ON finance_transaction_links(source_type, source_id)
WHERE source_id IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transaction_links ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICY: finance_accounts
-- =====================================================

-- Super admin can manage accounts for their school
CREATE POLICY "superadmin_manage_finance_accounts" ON finance_accounts
  FOR ALL
  USING (
    jwt_role() = 'superadmin'::text 
    AND school_code = jwt_school_code()
  )
  WITH CHECK (
    jwt_role() = 'superadmin'::text 
    AND school_code = jwt_school_code()
  );

-- =====================================================
-- RLS POLICY: finance_categories
-- =====================================================

-- Super admin can manage categories for their school
CREATE POLICY "superadmin_manage_finance_categories" ON finance_categories
  FOR ALL
  USING (
    jwt_role() = 'superadmin'::text 
    AND school_code = jwt_school_code()
  )
  WITH CHECK (
    jwt_role() = 'superadmin'::text 
    AND school_code = jwt_school_code()
  );

-- =====================================================
-- RLS POLICY: finance_transactions
-- =====================================================

-- Super admin can manage transactions for their school
CREATE POLICY "superadmin_manage_finance_transactions" ON finance_transactions
  FOR ALL
  USING (
    jwt_role() = 'superadmin'::text 
    AND school_code = jwt_school_code()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    jwt_role() = 'superadmin'::text 
    AND school_code = jwt_school_code()
  );

-- =====================================================
-- RLS POLICY: finance_transaction_links
-- =====================================================

-- Super admin can view links (read-only, managed via transactions)
CREATE POLICY "superadmin_view_finance_transaction_links" ON finance_transaction_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM finance_transactions
      WHERE id = finance_transaction_links.finance_transaction_id
        AND jwt_role() = 'superadmin'::text
        AND school_code = jwt_school_code()
    )
  );

-- Super admin can insert links (via service layer)
CREATE POLICY "superadmin_insert_finance_transaction_links" ON finance_transaction_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM finance_transactions
      WHERE id = finance_transaction_links.finance_transaction_id
        AND jwt_role() = 'superadmin'::text
        AND school_code = jwt_school_code()
    )
  );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_finance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER finance_accounts_updated_at
  BEFORE UPDATE ON finance_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_updated_at();

CREATE TRIGGER finance_categories_updated_at
  BEFORE UPDATE ON finance_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_updated_at();

CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_updated_at();

-- =====================================================
-- INITIAL DATA: Default Accounts & Categories
-- =====================================================
-- Note: These will be created per-school by the service layer
-- This is a template for what should exist

-- Default accounts (created on first use per school):
-- - "Cash" (type: cash)
-- - "Bank Account" (type: bank)
-- - "UPI" (type: virtual)

-- Default categories (created on first use per school):
-- Income:
-- - "Fees" (type: income) - Auto-created when fee payment is recorded
-- Expense:
-- - "Salary" (type: expense)
-- - "Rent" (type: expense)
-- - "Utilities" (type: expense)
-- - "Supplies" (type: expense)
-- - "Other" (type: expense)

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE finance_accounts IS 'Financial accounts (Cash, Bank, UPI) - school-scoped';
COMMENT ON TABLE finance_categories IS 'Income and expense categories - school-scoped';
COMMENT ON TABLE finance_transactions IS 'Cash-basis accounting transactions - school-scoped, super admin only';
COMMENT ON TABLE finance_transaction_links IS 'Links finance transactions to their source (fee_payments, manual, etc.) for audit trail';

COMMENT ON COLUMN finance_transactions.txn_date IS 'Transaction date - cash-basis accounting (when money changes hands)';
COMMENT ON COLUMN finance_transactions.amount IS 'Always positive - type (income/expense) determines direction';
COMMENT ON COLUMN finance_transactions.deleted_at IS 'Soft delete timestamp - no hard deletes for audit integrity';
COMMENT ON COLUMN finance_transaction_links.source_type IS 'Source of transaction: fee_payment (auto), manual (user entry), salary (future)';
COMMENT ON COLUMN finance_transaction_links.source_id IS 'ID of source record (fee_payments.id, or NULL for manual)';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify tables created
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'finance_accounts',
    'finance_categories',
    'finance_transactions',
    'finance_transaction_links'
  )
ORDER BY tablename;

-- Verify indexes created
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'finance_accounts',
    'finance_categories',
    'finance_transactions',
    'finance_transaction_links'
  )
ORDER BY tablename, indexname;

-- Verify RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'finance_accounts',
    'finance_categories',
    'finance_transactions',
    'finance_transaction_links'
  )
ORDER BY tablename, policyname;

