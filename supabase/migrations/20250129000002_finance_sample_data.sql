-- =====================================================
-- FINANCE MODULE - SAMPLE DATA
-- Created: 2025-01-29
-- Purpose: Insert sample finance data for testing
-- School: sch019 (or first available school)
-- Recorded by: sa101 (or first available super admin)
-- =====================================================

DO $$
DECLARE
  v_school_code text;
  v_super_admin_id uuid;
  v_super_admin_auth_id uuid;
  v_cash_account_id uuid;
  v_bank_account_id uuid;
  v_upi_account_id uuid;
  v_fees_category_id uuid;
  v_salary_category_id uuid;
  v_rent_category_id uuid;
  v_utilities_category_id uuid;
  v_txn_id uuid;
BEGIN
  -- Get school code (prefer sch019/SCH019, otherwise first school)
  SELECT COALESCE(
    (SELECT school_code FROM schools WHERE UPPER(school_code) = 'SCH019' LIMIT 1),
    (SELECT school_code FROM schools ORDER BY created_at LIMIT 1)
  ) INTO v_school_code;
  
  IF v_school_code IS NULL THEN
    RAISE EXCEPTION 'No schools found. Please create a school first.';
  END IF;
  
  -- Get super admin for that school (prefer sa101/SA101, otherwise first super admin for that school)
  SELECT 
    sa.id,
    sa.auth_user_id
  INTO 
    v_super_admin_id,
    v_super_admin_auth_id
  FROM super_admin sa
  WHERE UPPER(sa.school_code) = UPPER(v_school_code)
    AND (UPPER(sa.super_admin_code) = 'SA101' OR sa.super_admin_code IS NULL)
  ORDER BY CASE WHEN UPPER(sa.super_admin_code) = 'SA101' THEN 0 ELSE 1 END
  LIMIT 1;
  
  -- If no super admin found with sa101, get any super admin for that school
  IF v_super_admin_id IS NULL OR v_super_admin_auth_id IS NULL THEN
    SELECT 
      sa.id,
      sa.auth_user_id
    INTO 
      v_super_admin_id,
      v_super_admin_auth_id
    FROM super_admin sa
    WHERE UPPER(sa.school_code) = UPPER(v_school_code)
    ORDER BY sa.created_at
    LIMIT 1;
  END IF;
  
  IF v_super_admin_id IS NULL OR v_super_admin_auth_id IS NULL THEN
    RAISE EXCEPTION 'No super admin found for school %. Please create a super admin first.', v_school_code;
  END IF;
  
  RAISE NOTICE 'Using school_code: %, super_admin_id: %, auth_user_id: %', v_school_code, v_super_admin_id, v_super_admin_auth_id;
  
  -- =====================================================
  -- CREATE DEFAULT ACCOUNTS
  -- =====================================================
  
  -- Cash Account
  INSERT INTO finance_accounts (school_code, name, type, is_active, created_by)
  VALUES (v_school_code, 'Cash', 'cash', true, v_super_admin_auth_id)
  ON CONFLICT (school_code, name) DO NOTHING
  RETURNING id INTO v_cash_account_id;
  
  SELECT id INTO v_cash_account_id
  FROM finance_accounts
  WHERE school_code = v_school_code AND name = 'Cash';
  
  -- Bank Account
  INSERT INTO finance_accounts (school_code, name, type, is_active, created_by)
  VALUES (v_school_code, 'Bank Account', 'bank', true, v_super_admin_auth_id)
  ON CONFLICT (school_code, name) DO NOTHING
  RETURNING id INTO v_bank_account_id;
  
  SELECT id INTO v_bank_account_id
  FROM finance_accounts
  WHERE school_code = v_school_code AND name = 'Bank Account';
  
  -- UPI Account
  INSERT INTO finance_accounts (school_code, name, type, is_active, created_by)
  VALUES (v_school_code, 'UPI', 'virtual', true, v_super_admin_auth_id)
  ON CONFLICT (school_code, name) DO NOTHING
  RETURNING id INTO v_upi_account_id;
  
  SELECT id INTO v_upi_account_id
  FROM finance_accounts
  WHERE school_code = v_school_code AND name = 'UPI';
  
  -- =====================================================
  -- CREATE DEFAULT CATEGORIES
  -- =====================================================
  
  -- Fees Category (Income)
  INSERT INTO finance_categories (school_code, name, type, is_active, created_by)
  VALUES (v_school_code, 'Fees', 'income', true, v_super_admin_auth_id)
  ON CONFLICT (school_code, name, type) DO NOTHING
  RETURNING id INTO v_fees_category_id;
  
  SELECT id INTO v_fees_category_id
  FROM finance_categories
  WHERE school_code = v_school_code AND name = 'Fees' AND type = 'income';
  
  -- Salary Category (Expense)
  INSERT INTO finance_categories (school_code, name, type, is_active, created_by)
  VALUES (v_school_code, 'Salary', 'expense', true, v_super_admin_auth_id)
  ON CONFLICT (school_code, name, type) DO NOTHING
  RETURNING id INTO v_salary_category_id;
  
  SELECT id INTO v_salary_category_id
  FROM finance_categories
  WHERE school_code = v_school_code AND name = 'Salary' AND type = 'expense';
  
  -- Rent Category (Expense)
  INSERT INTO finance_categories (school_code, name, type, is_active, created_by)
  VALUES (v_school_code, 'Rent', 'expense', true, v_super_admin_auth_id)
  ON CONFLICT (school_code, name, type) DO NOTHING
  RETURNING id INTO v_rent_category_id;
  
  SELECT id INTO v_rent_category_id
  FROM finance_categories
  WHERE school_code = v_school_code AND name = 'Rent' AND type = 'expense';
  
  -- Utilities Category (Expense)
  INSERT INTO finance_categories (school_code, name, type, is_active, created_by)
  VALUES (v_school_code, 'Utilities', 'expense', true, v_super_admin_auth_id)
  ON CONFLICT (school_code, name, type) DO NOTHING
  RETURNING id INTO v_utilities_category_id;
  
  SELECT id INTO v_utilities_category_id
  FROM finance_categories
  WHERE school_code = v_school_code AND name = 'Utilities' AND type = 'expense';
  
  -- =====================================================
  -- INSERT SAMPLE TRANSACTIONS
  -- =====================================================
  
  -- Income Transaction 1: Fee payment via Cash
  INSERT INTO finance_transactions (
    school_code, txn_date, amount, type, category_id, account_id, description, created_by
  ) VALUES (
    v_school_code, '2025-01-15', 5000, 'income', v_fees_category_id, v_cash_account_id,
    'Fee payment - Student ABC', v_super_admin_auth_id
  )
  RETURNING id INTO v_txn_id;
  
  INSERT INTO finance_transaction_links (finance_transaction_id, source_type, source_id)
  VALUES (v_txn_id, 'manual', gen_random_uuid())
  ON CONFLICT (source_type, source_id) DO NOTHING;
  
  -- Income Transaction 2: Fee payment via Bank
  INSERT INTO finance_transactions (
    school_code, txn_date, amount, type, category_id, account_id, description, created_by
  ) VALUES (
    v_school_code, '2025-01-16', 3000, 'income', v_fees_category_id, v_bank_account_id,
    'Fee payment - Student XYZ', v_super_admin_auth_id
  )
  RETURNING id INTO v_txn_id;
  
  INSERT INTO finance_transaction_links (finance_transaction_id, source_type, source_id)
  VALUES (v_txn_id, 'manual', gen_random_uuid())
  ON CONFLICT (source_type, source_id) DO NOTHING;
  
  -- Expense Transaction 1: Teacher Salary
  INSERT INTO finance_transactions (
    school_code, txn_date, amount, type, category_id, account_id, description, created_by
  ) VALUES (
    v_school_code, '2025-01-17', 15000, 'expense', v_salary_category_id, v_bank_account_id,
    'Teacher salary - January 2025', v_super_admin_auth_id
  )
  RETURNING id INTO v_txn_id;
  
  INSERT INTO finance_transaction_links (finance_transaction_id, source_type, source_id)
  VALUES (v_txn_id, 'manual', gen_random_uuid())
  ON CONFLICT (source_type, source_id) DO NOTHING;
  
  -- Expense Transaction 2: Rent Payment
  INSERT INTO finance_transactions (
    school_code, txn_date, amount, type, category_id, account_id, description, created_by
  ) VALUES (
    v_school_code, '2025-01-18', 5000, 'expense', v_rent_category_id, v_cash_account_id,
    'Monthly rent payment', v_super_admin_auth_id
  )
  RETURNING id INTO v_txn_id;
  
  INSERT INTO finance_transaction_links (finance_transaction_id, source_type, source_id)
  VALUES (v_txn_id, 'manual', gen_random_uuid())
  ON CONFLICT (source_type, source_id) DO NOTHING;
  
  -- Income Transaction 3: Fee payment via UPI
  INSERT INTO finance_transactions (
    school_code, txn_date, amount, type, category_id, account_id, description, created_by
  ) VALUES (
    v_school_code, '2025-01-20', 2000, 'income', v_fees_category_id, v_upi_account_id,
    'Fee payment - Student DEF', v_super_admin_auth_id
  )
  RETURNING id INTO v_txn_id;
  
  INSERT INTO finance_transaction_links (finance_transaction_id, source_type, source_id)
  VALUES (v_txn_id, 'manual', gen_random_uuid())
  ON CONFLICT (source_type, source_id) DO NOTHING;
  
  -- Expense Transaction 3: Utilities
  INSERT INTO finance_transactions (
    school_code, txn_date, amount, type, category_id, account_id, description, created_by
  ) VALUES (
    v_school_code, '2025-01-22', 2500, 'expense', v_utilities_category_id, v_bank_account_id,
    'Electricity and water bill', v_super_admin_auth_id
  )
  RETURNING id INTO v_txn_id;
  
  INSERT INTO finance_transaction_links (finance_transaction_id, source_type, source_id)
  VALUES (v_txn_id, 'manual', gen_random_uuid())
  ON CONFLICT (source_type, source_id) DO NOTHING;
  
  -- Income Transaction 4: More fee payments
  INSERT INTO finance_transactions (
    school_code, txn_date, amount, type, category_id, account_id, description, created_by
  ) VALUES (
    v_school_code, '2025-01-25', 4500, 'income', v_fees_category_id, v_bank_account_id,
    'Fee payment - Student GHI', v_super_admin_auth_id
  )
  RETURNING id INTO v_txn_id;
  
  INSERT INTO finance_transaction_links (finance_transaction_id, source_type, source_id)
  VALUES (v_txn_id, 'manual', gen_random_uuid())
  ON CONFLICT (source_type, source_id) DO NOTHING;
  
  RAISE NOTICE 'Sample finance data inserted successfully for school: %', v_school_code;
  
END $$;

-- Verify inserted data
SELECT 
  'Accounts' as type,
  COUNT(*) as count
FROM finance_accounts
WHERE school_code = COALESCE((SELECT school_code FROM schools WHERE school_code = 'sch019' LIMIT 1), (SELECT school_code FROM schools ORDER BY created_at LIMIT 1))

UNION ALL

SELECT 
  'Categories' as type,
  COUNT(*) as count
FROM finance_categories
WHERE school_code = COALESCE((SELECT school_code FROM schools WHERE school_code = 'sch019' LIMIT 1), (SELECT school_code FROM schools ORDER BY created_at LIMIT 1))

UNION ALL

SELECT 
  'Transactions' as type,
  COUNT(*) as count
FROM finance_transactions
WHERE school_code = COALESCE((SELECT school_code FROM schools WHERE school_code = 'sch019' LIMIT 1), (SELECT school_code FROM schools ORDER BY created_at LIMIT 1))
  AND deleted_at IS NULL;

