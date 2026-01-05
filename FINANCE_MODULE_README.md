# Finance Module - Cash-Basis Accounting

**Status:** ✅ Implemented  
**Access:** Super Admin Only  
**Date:** 2025-01-29

---

## Overview

The Finance Module provides school-scoped cash-basis accounting for tracking income and expenses. It integrates seamlessly with the existing fee payment system, automatically creating income transactions when fees are paid.

---

## Accounting Assumptions

### Cash-Basis Accounting

This module uses **cash-basis accounting**, meaning:

- ✅ Transactions are recorded when **money changes hands** (payment date)
- ✅ Income is recognized when **received** (not when invoiced)
- ✅ Expenses are recognized when **paid** (not when incurred)
- ❌ No accruals, deferrals, or accounts receivable/payable

**Why Cash-Basis?**
- Simpler for small schools
- Matches actual cash flow
- CA-friendly for small businesses
- Can be upgraded to accrual later if needed

### Transaction Rules

1. **Amounts are always positive**
   - `type` field determines direction: `income` or `expense`
   - Database constraint: `amount > 0`

2. **School Isolation**
   - All transactions are scoped to `school_code`
   - RLS policies enforce strict isolation
   - No cross-school access

3. **Audit Trail**
   - Every transaction tracks `created_by` (user UUID)
   - Fee-derived income is **read-only** (auto-generated)
   - Manual entries can be edited/deleted (soft delete)

4. **Idempotency**
   - Fee payments create finance transactions automatically
   - `finance_transaction_links` prevents duplicate entries
   - Unique constraint: `(source_type, source_id)`

---

## Database Schema

### Tables

1. **`finance_accounts`**
   - Cash, Bank, UPI accounts
   - School-scoped, unique names per school

2. **`finance_categories`**
   - Income categories: "Fees", etc.
   - Expense categories: "Salary", "Rent", "Utilities", etc.
   - School-scoped, unique names per school and type

3. **`finance_transactions`**
   - Core transaction table
   - Links to category and account
   - Soft delete via `deleted_at`

4. **`finance_transaction_links`**
   - Links transactions to their source
   - `source_type`: `fee_payment` | `manual` | `salary`
   - `source_id`: ID of source record (e.g., `fee_payments.id`)

### Indexes

- `(school_code, txn_date DESC)` - Date-range queries
- `(school_code, type, txn_date DESC)` - Type-filtered queries
- `(source_type, source_id)` - Idempotency checks

---

## Integration with Fee Payments

### Automatic Income Creation

When a fee payment is recorded (`invoiceService.recordPayment()`):

1. ✅ Payment is saved to `fee_payments`
2. ✅ Invoice `paid_amount` is updated
3. ✅ **Finance transaction is auto-created** (if super admin):
   - Type: `income`
   - Category: "Fees" (auto-created if missing)
   - Account: Based on `payment_method`:
     - `cash` → Cash account
     - `cheque`/`card` → Bank account
     - `online`/`other` → UPI account
   - Linked via `finance_transaction_links`:
     - `source_type` = `fee_payment`
     - `source_id` = `fee_payments.id`

### Idempotency

- Checks `finance_transaction_links` before creating
- Prevents duplicate transactions if payment is recorded twice
- Uses unique constraint: `(source_type, source_id)`

---

## Service Layer

### `financeService`

**Core Operations:**
- `createTransaction()` - Create income/expense transaction
- `listTransactions()` - Query transactions with filters
- `listAccounts()` - Get all accounts for school
- `listCategories()` - Get categories (optionally filtered by type)
- `deleteTransaction()` - Soft delete (manual entries only)

**Helper Functions:**
- `ensureDefaultAccounts()` - Auto-create Cash, Bank, UPI accounts
- `ensureFeesCategory()` - Auto-create "Fees" income category
- `mapPaymentMethodToAccount()` - Map payment method to account type

### `financeReportsService`

**Reports:**
- `getIncomeVsExpense()` - Summary for date range
- `getMonthlySummary()` - Monthly breakdown

---

## UI Components

### Finance Screen (`/finance`)

**Access:** Super Admin Only

**Features:**
- 📊 Summary cards: Total Income, Total Expense, Net Income
- 📋 Transactions list with filters (date, type, category, account)
- ➕ Add Expense modal
- 📅 Date range selector
- 🔄 Pull-to-refresh

**Transaction Display:**
- Shows amount, category, account, description, date
- Color-coded by type (income = green, expense = red)
- Read-only indicator for fee-derived income

---

## Security

### Row-Level Security (RLS)

All tables enforce strict RLS:

```sql
-- Super admin can only access their school's data
jwt_role() = 'superadmin' 
AND school_code = jwt_school_code()
```

### Service Layer Validation

- ✅ All writes go through `financeService` (no direct Supabase calls)
- ✅ School code validation on every operation
- ✅ Amount validation: `amount > 0`
- ✅ Type validation: category type must match transaction type
- ✅ Capability checks: `management.view` (super admin only)

---

## Reporting & Export

### Current Implementation

- ✅ Income vs Expense summary
- ✅ Monthly summary
- ⏳ CSV export (Phase 6 - pending)
- ⏳ PDF reports (Phase 6 - pending)

### Future Enhancements

- Date-range exports
- Category-wise breakdowns
- Account-wise summaries
- GST-ready reports

---

## Audit & Safety

### Soft Deletes

- ✅ All transactions use `deleted_at` (no hard deletes)
- ✅ Fee-derived income **cannot be deleted** (read-only)
- ✅ Manual entries can be soft-deleted

### Audit Trail

- ✅ `created_by` - User UUID (immutable)
- ✅ `created_at` - Timestamp
- ✅ `finance_transaction_links` - Source tracking

### Inconsistency Detection

- ⏳ Log inconsistencies (Phase 7 - pending)
- ⏳ Reconciliation reports (future)

---

## Usage Examples

### Adding an Expense

```typescript
await financeService.createTransaction({
  school_code: 'SCHOOL001',
  txn_date: '2025-01-29',
  amount: 5000,
  type: 'expense',
  category_id: 'salary-category-id',
  account_id: 'bank-account-id',
  description: 'Teacher salary - January',
  source_type: 'manual',
  source_id: crypto.randomUUID(),
});
```

### Querying Transactions

```typescript
const { data, total } = await financeService.listTransactions({
  school_code: 'SCHOOL001',
  start_date: '2025-01-01',
  end_date: '2025-01-31',
  type: 'expense',
  limit: 50,
});
```

### Getting Reports

```typescript
const summary = await financeReportsService.getIncomeVsExpense(
  'SCHOOL001',
  '2025-01-01',
  '2025-01-31'
);
// Returns: { total_income, total_expense, net_income, period_start, period_end }
```

---

## Migration Notes

### Backfilling Existing Payments

To create finance transactions for existing `fee_payments`:

1. Query all `fee_payments` where `amount_inr IS NOT NULL`
2. For each payment:
   - Get or create default accounts
   - Get or create "Fees" category
   - Map `payment_method` to account
   - Create `finance_transaction` (income)
   - Create `finance_transaction_links` (source_type='fee_payment', source_id=fee_payments.id)
3. Check idempotency before inserting

**Migration script:** (To be created if needed)

---

## Future Enhancements

### Phase 6: Reporting & Export
- CSV export for transactions
- PDF reports (reuse invoice PDF infrastructure)
- Date-range selector improvements

### Phase 7: Audit & Safety
- Inconsistency logging
- Reconciliation reports
- Enhanced audit trail

### Future Phases
- GST integration
- Accrual accounting support
- Multi-currency support
- Budget vs Actual reports
- Voucher system

---

## Troubleshooting

### Finance transaction not created for fee payment

**Check:**
1. Is user super admin? (Only super admin can create finance transactions)
2. Check browser console for errors (finance errors are logged but don't fail payment)
3. Verify default accounts exist (auto-created on first use)
4. Check `finance_transaction_links` for existing entry (idempotency)

### Cannot delete transaction

**Reason:** Fee-derived income transactions are read-only

**Solution:** Only manual entries can be deleted. Fee-derived income must be handled via fee payment system.

---

## Support

For issues or questions:
1. Check `FINANCE_MODULE_DISCOVERY.md` for schema details
2. Review service layer code: `src/services/finance.ts`
3. Check RLS policies in migration: `supabase/migrations/20250129000000_finance_module.sql`

---

**Last Updated:** 2025-01-29

