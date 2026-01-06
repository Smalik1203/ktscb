/**
 * Finance Service - Cash-Basis Accounting
 * 
 * School-scoped finance management for income and expenses.
 * Access: Super Admin only
 * 
 * Rules:
 * - All writes go through this service (no direct Supabase calls from components)
 * - Amount must be > 0 (type determines income vs expense)
 * - All transactions are school-scoped
 * - Fee-derived income is read-only (managed automatically)
 */

import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';
import { assertCapability, type AuthorizableUser } from '../domain/auth/assert';
import type { Capability } from '../domain/auth/capabilities';

// =============================================================================
// Types
// =============================================================================

export interface FinanceAccount {
  id: string;
  school_code: string;
  name: string;
  type: 'cash' | 'bank' | 'virtual';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface FinanceCategory {
  id: string;
  school_code: string;
  name: string;
  type: 'income' | 'expense';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface FinanceTransaction {
  id: string;
  school_code: string;
  txn_date: string; // YYYY-MM-DD
  amount: number;
  type: 'income' | 'expense';
  category_id: string;
  account_id: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Joined data
  category?: FinanceCategory;
  account?: FinanceAccount;
}

export interface FinanceTransactionLink {
  id: string;
  finance_transaction_id: string;
  source_type: 'fee_payment' | 'manual' | 'salary';
  source_id: string;
  created_at: string;
}

export interface CreateTransactionInput {
  school_code: string;
  txn_date: string; // YYYY-MM-DD
  amount: number;
  type: 'income' | 'expense';
  category_id: string;
  account_id: string;
  description?: string;
  source_type?: 'fee_payment' | 'manual' | 'salary';
  source_id?: string; // For fee_payment: fee_payments.id
}

export interface ListTransactionsFilters {
  school_code: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  type?: 'income' | 'expense';
  category_id?: string;
  account_id?: string;
  limit?: number;
  offset?: number;
}

export interface IncomeVsExpense {
  total_income: number;
  total_expense: number;
  net_income: number;
  period_start: string;
  period_end: string;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  total_income: number;
  total_expense: number;
  net_income: number;
  transaction_count: number;
}

// =============================================================================
// Auth Helper
// =============================================================================

async function getCurrentAuthUser(): Promise<(AuthorizableUser & { school_code: string | null }) | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('id, role, school_code')
    .eq('id', user.id)
    .maybeSingle();

  if (!userData) return null;
  return { id: userData.id, role: userData.role, school_code: userData.school_code };
}

async function assertCurrentUserCapability(capability: Capability): Promise<AuthorizableUser & { school_code: string }> {
  const user = await getCurrentAuthUser();
  assertCapability(user, capability);
  if (!user!.school_code) {
    throw new Error('User does not have a school_code assigned');
  }
  return user as AuthorizableUser & { school_code: string };
}

/**
 * Get school_code for current super admin user
 */
async function getSuperAdminSchoolCode(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: superAdmin } = await supabase
    .from('super_admin')
    .select('school_code')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!superAdmin || !superAdmin.school_code) {
    throw new Error('Super admin not found or missing school_code');
  }

  return superAdmin.school_code;
}

/**
 * Log finance operation to audit trail
 * Phase 7: Audit & Safety
 */
async function logFinanceOperation(
  schoolCode: string,
  eventType: 'create' | 'update' | 'delete' | 'export' | 'reconcile',
  resourceType: 'transaction' | 'account' | 'category' | 'report',
  resourceId: string | null,
  userId: string,
  userRole: string,
  actionDetails?: Record<string, any>
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_finance_operation', {
      p_school_code: schoolCode,
      p_event_type: eventType,
      p_resource_type: resourceType,
      p_resource_id: resourceId as string,
      p_user_id: userId,
      p_user_role: userRole,
      p_action_details: actionDetails || {},
      p_ip_address: undefined, // Can be added from request headers if needed
      p_user_agent: undefined, // Can be added from request headers if needed
    });

    if (error) {
      // Log error but don't fail the operation
      log.error('Failed to log finance operation:', error);
    }
  } catch (error) {
    // Silent fail - audit logging should not break operations
    log.error('Audit logging error:', error);
  }
}

// =============================================================================
// Finance Service
// =============================================================================

export const financeService = {
  /**
   * Get or create default accounts for a school
   * Returns account IDs mapped by payment method
   */
  async ensureDefaultAccounts(schoolCode: string, userId: string): Promise<{
    cash: string;
    bank: string;
    online: string;
  }> {
    // Get or create Cash account
    let { data: cashAccount } = await supabase
      .from('finance_accounts')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('name', 'Cash')
      .maybeSingle();

    if (!cashAccount) {
      const { data, error } = await supabase
        .from('finance_accounts')
        .insert({
          school_code: schoolCode,
          name: 'Cash',
          type: 'cash',
          is_active: true,
          created_by: userId,
        })
        .select('id')
        .single();
      if (error) throw error;
      cashAccount = data;
    }

    // Get or create Bank account
    let { data: bankAccount } = await supabase
      .from('finance_accounts')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('name', 'Bank Account')
      .maybeSingle();

    if (!bankAccount) {
      const { data, error } = await supabase
        .from('finance_accounts')
        .insert({
          school_code: schoolCode,
          name: 'Bank Account',
          type: 'bank',
          is_active: true,
          created_by: userId,
        })
        .select('id')
        .single();
      if (error) throw error;
      bankAccount = data;
    }

    // Get or create Online/UPI account
    let { data: onlineAccount } = await supabase
      .from('finance_accounts')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('name', 'UPI')
      .maybeSingle();

    if (!onlineAccount) {
      const { data, error } = await supabase
        .from('finance_accounts')
        .insert({
          school_code: schoolCode,
          name: 'UPI',
          type: 'virtual',
          is_active: true,
          created_by: userId,
        })
        .select('id')
        .single();
      if (error) throw error;
      onlineAccount = data;
    }

    return {
      cash: cashAccount.id,
      bank: bankAccount.id,
      online: onlineAccount.id,
    };
  },

  /**
   * Get or create default "Fees" income category
   */
  async ensureFeesCategory(schoolCode: string, userId: string): Promise<string> {
    let { data: category } = await supabase
      .from('finance_categories')
      .select('id')
      .eq('school_code', schoolCode)
      .eq('name', 'Fees')
      .eq('type', 'income')
      .maybeSingle();

    if (!category) {
      const { data, error } = await supabase
        .from('finance_categories')
        .insert({
          school_code: schoolCode,
          name: 'Fees',
          type: 'income',
          is_active: true,
          created_by: userId,
        })
        .select('id')
        .single();
      if (error) throw error;
      category = data;
    }

    return category.id;
  },

  /**
   * Map payment_method to account type
   */
  mapPaymentMethodToAccount(paymentMethod: string): 'cash' | 'bank' | 'online' {
    switch (paymentMethod) {
      case 'cash':
        return 'cash';
      case 'cheque':
      case 'card':
        return 'bank';
      case 'online':
      case 'other':
      default:
        return 'online';
    }
  },

  /**
   * Create a finance transaction
   * Used for both fee payments (auto) and manual entries
   */
  async createTransaction(input: CreateTransactionInput): Promise<{ id: string }> {
    // Validate: Super admin only
    const user = await assertCurrentUserCapability('management.view'); // Super admin has this
    if (user.role !== 'superadmin') {
      throw new Error('Finance transactions can only be created by super admin');
    }

    // Validate amount
    if (input.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Validate school_code matches authenticated user
    const userSchoolCode = await getSuperAdminSchoolCode();
    if (input.school_code !== userSchoolCode) {
      throw new Error('School code mismatch');
    }

    // Validate category and account belong to same school
    const { data: category } = await supabase
      .from('finance_categories')
      .select('school_code, type')
      .eq('id', input.category_id)
      .single();

    if (!category || category.school_code !== input.school_code) {
      throw new Error('Category not found or school mismatch');
    }

    // Validate type matches category type
    if (category.type !== input.type) {
      throw new Error(`Category type (${category.type}) does not match transaction type (${input.type})`);
    }

    const { data: account } = await supabase
      .from('finance_accounts')
      .select('school_code')
      .eq('id', input.account_id)
      .single();

    if (!account || account.school_code !== input.school_code) {
      throw new Error('Account not found or school mismatch');
    }

    // Check idempotency if source_id provided
    if (input.source_type && input.source_id) {
      const { data: existingLink } = await supabase
        .from('finance_transaction_links')
        .select('id, finance_transaction_id')
        .eq('source_type', input.source_type)
        .eq('source_id', input.source_id)
        .maybeSingle();

      if (existingLink) {
        // Transaction already exists for this source - return existing
        return { id: existingLink.finance_transaction_id };
      }
    }

    // Create transaction
    const { data: transaction, error: txnError } = await supabase
      .from('finance_transactions')
      .insert({
        school_code: input.school_code,
        txn_date: input.txn_date,
        amount: input.amount,
        type: input.type,
        category_id: input.category_id,
        account_id: input.account_id,
        description: input.description || null,
        created_by: user.id!,
      })
      .select('id')
      .single();

    if (txnError) throw txnError;

    // Create link if source provided
    if (input.source_type && input.source_id) {
      const { error: linkError } = await supabase
        .from('finance_transaction_links')
        .insert({
          finance_transaction_id: transaction.id,
          source_type: input.source_type,
          source_id: input.source_id,
        });

      if (linkError) {
        // Rollback transaction if link creation fails
        await supabase
          .from('finance_transactions')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', transaction.id);
        throw linkError;
      }
    }

    // Log audit trail
    await logFinanceOperation(
      input.school_code,
      'create',
      'transaction',
      transaction.id,
      user.id!,
      user.role!,
      {
        amount: input.amount,
        type: input.type,
        category_id: input.category_id,
        account_id: input.account_id,
        source_type: input.source_type,
        source_id: input.source_id,
      }
    );

    return { id: transaction.id };
  },

  /**
   * List transactions with filters
   */
  async listTransactions(filters: ListTransactionsFilters): Promise<{
    data: FinanceTransaction[];
    total: number;
  }> {
    const user = await assertCurrentUserCapability('management.view');
    if (user.role !== 'superadmin') {
      throw new Error('Finance transactions can only be viewed by super admin');
    }

    // Validate school_code
    const userSchoolCode = await getSuperAdminSchoolCode();
    if (filters.school_code !== userSchoolCode) {
      throw new Error('School code mismatch');
    }

    let query = supabase
      .from('finance_transactions')
      .select(`
        id,
        school_code,
        txn_date,
        amount,
        type,
        category_id,
        account_id,
        description,
        created_by,
        created_at,
        updated_at,
        deleted_at,
        category:finance_categories(id, name, type),
        account:finance_accounts(id, name, type)
      `, { count: 'exact' })
      .eq('school_code', filters.school_code)
      .is('deleted_at', null)
      .order('txn_date', { ascending: false });

    if (filters.start_date) {
      query = query.gte('txn_date', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('txn_date', filters.end_date);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }

    if (filters.account_id) {
      query = query.eq('account_id', filters.account_id);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as FinanceTransaction[],
      total: count || 0,
    };
  },

  /**
   * Get all accounts for a school
   */
  async listAccounts(schoolCode: string): Promise<FinanceAccount[]> {
    const user = await assertCurrentUserCapability('management.view');
    if (user.role !== 'superadmin') {
      throw new Error('Finance accounts can only be viewed by super admin');
    }

    const userSchoolCode = await getSuperAdminSchoolCode();
    if (schoolCode !== userSchoolCode) {
      throw new Error('School code mismatch');
    }

    const { data, error } = await supabase
      .from('finance_accounts')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []) as FinanceAccount[];
  },

  /**
   * Get all categories for a school
   */
  async listCategories(schoolCode: string, type?: 'income' | 'expense'): Promise<FinanceCategory[]> {
    const user = await assertCurrentUserCapability('management.view');
    if (user.role !== 'superadmin') {
      throw new Error('Finance categories can only be viewed by super admin');
    }

    const userSchoolCode = await getSuperAdminSchoolCode();
    if (schoolCode !== userSchoolCode) {
      throw new Error('School code mismatch');
    }

    let query = supabase
      .from('finance_categories')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('is_active', true)
      .order('name');

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as FinanceCategory[];
  },

  /**
   * Soft delete a transaction (for manual entries only)
   * Fee-derived transactions cannot be deleted
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    const user = await assertCurrentUserCapability('management.view');
    if (user.role !== 'superadmin') {
      throw new Error('Finance transactions can only be deleted by super admin');
    }

    // Check if transaction is linked to fee_payment (read-only)
    const { data: link } = await supabase
      .from('finance_transaction_links')
      .select('source_type')
      .eq('finance_transaction_id', transactionId)
      .eq('source_type', 'fee_payment')
      .maybeSingle();

    if (link) {
      throw new Error('Cannot delete fee-derived income transactions');
    }

    // Soft delete
    const { error } = await supabase
      .from('finance_transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', transactionId);

    if (error) throw error;

    // Log audit trail
    const schoolCode = await getSuperAdminSchoolCode();
    await logFinanceOperation(
      schoolCode,
      'delete',
      'transaction',
      transactionId,
      user.id!,
      user.role!,
      { soft_delete: true }
    );
  },

  /**
   * Detect inconsistencies in finance data
   * Phase 7: Audit & Safety
   */
  async detectInconsistencies(
    schoolCode: string,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    inconsistency_type: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    affected_count: number;
    details: any[];
  }>> {
    const user = await assertCurrentUserCapability('management.view');
    if (user.role !== 'superadmin') {
      throw new Error('Inconsistency detection can only be run by super admin');
    }

    const userSchoolCode = await getSuperAdminSchoolCode();
    if (schoolCode !== userSchoolCode) {
      throw new Error('School code mismatch');
    }

    const { data, error } = await supabase.rpc('detect_finance_inconsistencies', {
      p_school_code: schoolCode,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      inconsistency_type: item.inconsistency_type,
      description: item.description,
      severity: item.severity as 'high' | 'medium' | 'low',
      affected_count: Number(item.affected_count),
      details: item.details || [],
    }));
  },
};

// =============================================================================
// Finance Reports Service
// =============================================================================

export const financeReportsService = {
  /**
   * Get income vs expense summary for a date range
   */
  async getIncomeVsExpense(
    schoolCode: string,
    startDate: string,
    endDate: string
  ): Promise<IncomeVsExpense> {
    const user = await assertCurrentUserCapability('management.view');
    if (user.role !== 'superadmin') {
      throw new Error('Finance reports can only be viewed by super admin');
    }

    const userSchoolCode = await getSuperAdminSchoolCode();
    if (schoolCode !== userSchoolCode) {
      throw new Error('School code mismatch');
    }

    const { data: income, error: incomeError } = await supabase
      .from('finance_transactions')
      .select('amount')
      .eq('school_code', schoolCode)
      .eq('type', 'income')
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null);

    if (incomeError) throw incomeError;

    const { data: expense, error: expenseError } = await supabase
      .from('finance_transactions')
      .select('amount')
      .eq('school_code', schoolCode)
      .eq('type', 'expense')
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null);

    if (expenseError) throw expenseError;

    const totalIncome = (income || []).reduce((sum, txn) => sum + Number(txn.amount), 0);
    const totalExpense = (expense || []).reduce((sum, txn) => sum + Number(txn.amount), 0);

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_income: totalIncome - totalExpense,
      period_start: startDate,
      period_end: endDate,
    };
  },

  /**
   * Get monthly summary for a date range
   */
  async getMonthlySummary(
    schoolCode: string,
    startDate: string,
    endDate: string
  ): Promise<MonthlySummary[]> {
    const user = await assertCurrentUserCapability('management.view');
    if (user.role !== 'superadmin') {
      throw new Error('Finance reports can only be viewed by super admin');
    }

    const userSchoolCode = await getSuperAdminSchoolCode();
    if (schoolCode !== userSchoolCode) {
      throw new Error('School code mismatch');
    }

    // Get all transactions in date range
    const { data: transactions, error } = await supabase
      .from('finance_transactions')
      .select('txn_date, amount, type')
      .eq('school_code', schoolCode)
      .gte('txn_date', startDate)
      .lte('txn_date', endDate)
      .is('deleted_at', null)
      .order('txn_date');

    if (error) throw error;

    // Group by month
    const monthlyMap = new Map<string, MonthlySummary>();

    (transactions || []).forEach((txn) => {
      const month = txn.txn_date.substring(0, 7); // YYYY-MM

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          month,
          total_income: 0,
          total_expense: 0,
          net_income: 0,
          transaction_count: 0,
        });
      }

      const summary = monthlyMap.get(month)!;
      const amount = Number(txn.amount);

      if (txn.type === 'income') {
        summary.total_income += amount;
      } else {
        summary.total_expense += amount;
      }

      summary.transaction_count += 1;
    });

    // Calculate net income and sort
    const summaries = Array.from(monthlyMap.values()).map((s) => ({
      ...s,
      net_income: s.total_income - s.total_expense,
    }));

    summaries.sort((a, b) => a.month.localeCompare(b.month));

    return summaries;
  },
};

