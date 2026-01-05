-- =====================================================
-- DELETE ALL FEE DATA
-- Created: 2025-01-31
-- Purpose: Remove all fee-related data from database
-- WARNING: This is a destructive operation - cannot be undone!
-- =====================================================

-- =====================================================
-- STEP 1: Delete finance transaction links to fee payments
-- =====================================================
DELETE FROM finance_transaction_links 
WHERE source_type = 'fee_payment';

-- =====================================================
-- STEP 2: Delete fee payments (invoice-first system)
-- =====================================================
DELETE FROM fee_payments;

-- =====================================================
-- STEP 3: Delete fee invoice items
-- =====================================================
DELETE FROM fee_invoice_items;

-- =====================================================
-- STEP 4: Delete fee invoices
-- =====================================================
DELETE FROM fee_invoices;

-- =====================================================
-- STEP 5: Delete legacy fee system data
-- =====================================================

-- Delete fee student plan items (legacy)
DELETE FROM fee_student_plan_items;

-- Delete fee student plans (legacy)
DELETE FROM fee_student_plans;

-- Delete fee component types (legacy)
DELETE FROM fee_component_types;

-- =====================================================
-- STEP 6: Reset sequences (optional, for clean IDs)
-- =====================================================
-- Note: Sequences will auto-increment from current max, but we can reset them
-- Uncomment if you want to reset IDs to start from 1

-- ALTER SEQUENCE IF EXISTS fee_invoices_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS fee_invoice_items_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS fee_payments_id_seq RESTART WITH 1;

-- =====================================================
-- VERIFICATION QUERIES (uncomment to verify deletion)
-- =====================================================

-- SELECT COUNT(*) as remaining_invoices FROM fee_invoices;
-- SELECT COUNT(*) as remaining_items FROM fee_invoice_items;
-- SELECT COUNT(*) as remaining_payments FROM fee_payments;
-- SELECT COUNT(*) as remaining_plans FROM fee_student_plans;
-- SELECT COUNT(*) as remaining_components FROM fee_component_types;
-- SELECT COUNT(*) as remaining_finance_links FROM finance_transaction_links WHERE source_type = 'fee_payment';

