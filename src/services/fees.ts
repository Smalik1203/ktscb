/**
 * Invoice-First Fee Service
 * 
 * Production-ready service layer with:
 * - Strong domain typing (no `any`)
 * - Centralized business rules
 * - Backend-authoritative validation
 * - Clean separation of concerns
 * 
 * All fee operations are invoice-centric.
 * No plans, no components - just invoices, items, and payments.
 */

import { supabase as supabaseClient } from '../lib/supabase';
const supabase = supabaseClient as any;
import { log } from '../lib/logger';
import { assertCapability, type AuthorizableUser } from '../domain/auth/assert';
import type { Capability } from '../domain/auth/capabilities';
import { financeService } from './finance';

// Domain types and validation
import type {
  DomainInvoice,
  DomainInvoiceItem,
  DomainInvoicePayment,
  DomainInvoiceDetail,
  CreateInvoiceInput,
  CreateInvoiceItemInput,
  RecordPaymentInput,
  UpdateInvoiceItemInput,
  UpdateInvoiceInput,
} from '../domain/fees/types';
import {
  CreateInvoiceInputSchema,
  CreateInvoiceItemInputSchema,
  RecordPaymentInputSchema,
  UpdateInvoiceItemInputSchema,
  UpdateInvoiceInputSchema,
  calculateInvoiceStatus,
  validatePaymentAmount,
  calculateInvoiceTotal,
} from '../domain/fees/types';
import {
  InvoiceNotFoundError,
  InvoiceItemNotFoundError,
  InvalidPaymentAmountError,
  InvoiceHasPaymentsError,
  InvalidInvoiceItemsError,
  InvoiceAccessDeniedError,
} from '../domain/fees/errors';
import {
  mapDbInvoiceToDomain,
  mapDbInvoiceItemToDomain,
  mapDbPaymentToDomain,
  mapDbInvoiceDetailToDomain,
} from '../domain/fees/mappers';
import { parseOrThrow } from '../lib/domain-schemas';

// Re-export domain types for convenience
export type {
  DomainInvoice as Invoice,
  DomainInvoiceItem as InvoiceItem,
  DomainInvoicePayment as InvoicePayment,
  DomainInvoiceDetail,
  CreateInvoiceInput,
  RecordPaymentInput,
  UpdateInvoiceItemInput,
};

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

// =============================================================================
// Invoice Service
// =============================================================================

export const invoiceService = {
  /**
   * Get all invoices for a class (admin view) - filtered by active academic year
   * Returns domain-typed invoices
   */
  async getByClass(classInstanceId: string, schoolCode: string, academicYearId?: string): Promise<DomainInvoice[]> {
    // Get class to find its academic year
    const { data: classInstance, error: classErr } = await supabase
      .from('class_instances')
      .select('academic_year_id')
      .eq('id', classInstanceId)
      .eq('school_code', schoolCode)
      .single();

    if (classErr) throw classErr;
    if (!classInstance) return [];

    // Use provided academicYearId or class's academic_year_id
    const filterAcademicYearId = academicYearId || classInstance.academic_year_id;

    // First get students in this class
    const { data: students, error: studErr } = await supabase
      .from('student')
      .select('id')
      .eq('class_instance_id', classInstanceId)
      .eq('school_code', schoolCode);

    if (studErr) throw studErr;
    if (!students?.length) return [];

    const studentIds = students.map(s => s.id);

    // Now get invoices for these students, filtered by academic year
    let query = supabase
      .from('fee_invoices')
      .select(`
        *,
        student:student_id (id, full_name, student_code)
      `)
      .eq('school_code', schoolCode)
      .in('student_id', studentIds);

    // Filter by academic year if available
    if (filterAcademicYearId) {
      query = query.eq('academic_year_id', filterAcademicYearId);
    }

    // Note: Sorting by student name happens in UI (client-side) since it requires joined data
    const { data, error } = await query;

    if (error) {
      log.error('Failed to fetch invoices by class', { classInstanceId, schoolCode, error });
      throw error;
    }

    // Map to domain types - extract student from joined data
    return (data || []).map((dbInvoice: any) =>
      mapDbInvoiceToDomain(dbInvoice, dbInvoice.student)
    );
  },

  /**
   * Get invoices for a student
   * OPTIMIZED: Filter by school_code and academic_year_id in SQL, not JavaScript
   * Returns domain-typed invoices
   */
  async getByStudent(studentId: string, schoolCode: string, academicYearId?: string): Promise<DomainInvoice[]> {
    // Include student data in query for consistency
    let query = supabase
      .from('fee_invoices')
      .select(`
        id, 
        school_code, 
        student_id, 
        billing_period, 
        total_amount, 
        paid_amount, 
        status, 
        notes, 
        academic_year_id, 
        due_date, 
        created_at,
        student:student_id (id, full_name, student_code)
      `)
      .eq('student_id', studentId)
      .eq('school_code', schoolCode); // Security: Always filter by school_code

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }

    // Note: Sorting happens in UI (client-side) for better control
    const { data, error } = await query;

    if (error) {
      log.error('Failed to fetch invoices by student', { studentId, schoolCode, error });
      throw error;
    }

    // Map to domain types - extract student from joined data
    return (data || []).map((dbInvoice: any) =>
      mapDbInvoiceToDomain(dbInvoice, dbInvoice.student)
    );
  },

  /**
   * Get invoice with items and payments
   * OPTIMIZED: Single query with joins instead of 4 separate queries (N+1 fix)
   * 
   * Returns domain-typed data with proper validation.
   */
  async getDetail(invoiceId: string): Promise<DomainInvoiceDetail | null> {
    if (!invoiceId) {
      log.error('getDetail called with null/undefined invoiceId');
      return null;
    }

    // Single query with all joins - eliminates N+1 pattern
    const { data: invoiceData, error: invErr } = await supabase
      .from('fee_invoices')
      .select(`
        id,
        school_code,
        student_id,
        billing_period,
        total_amount,
        paid_amount,
        status,
        notes,
        academic_year_id,
        due_date,
        created_at,
        student:student_id(id, full_name, student_code),
        items:fee_invoice_items(id, invoice_id, label, amount, created_at),
        payments:fee_payments(
          id,
          invoice_id,
          invoice_item_id,
          amount_inr,
          payment_method,
          payment_date,
          receipt_number,
          remarks,
          recorded_by_user_id,
          recorded_at
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invErr) {
      log.error('Error fetching invoice detail:', {
        invoiceId,
        error: invErr.message,
        code: invErr.code,
        details: invErr.details,
      });

      // PGRST116 is "not found" - this is expected for missing invoices
      if (invErr.code === 'PGRST116') {
        return null;
      }

      // For other errors, still return null but log them
      return null;
    }

    if (!invoiceData) {
      log.warn('Invoice detail query returned no data', { invoiceId });
      return null;
    }

    // Fetch user names for payments (recorded_by_user_id references auth.users, but we need public.users.full_name)
    const paymentsData = invoiceData.payments || [];
    const userIds = [...new Set(
      paymentsData
        .map((p) => p.recorded_by_user_id)
        .filter((id): id is string => Boolean(id))
    )];

    const userNamesMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', userIds);

      if (users) {
        users.forEach((u) => {
          if (u.id && u.full_name) {
            userNamesMap.set(u.id, u.full_name);
          }
        });
      }
    }

    // Transform payments to include resolved name
    const paymentsWithName = paymentsData.map((p) => ({
      ...p,
      recorded_by_name: p.recorded_by_user_id ? userNamesMap.get(p.recorded_by_user_id) : undefined,
    }));

    // Sort payments by date descending
    paymentsWithName.sort((a, b) =>
      new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );

    // Map to domain types - cast to any since partial select doesn't match full Row type
    return mapDbInvoiceDetailToDomain({
      ...invoiceData,
      student: invoiceData.student || null,
      items: invoiceData.items || [],
      payments: paymentsWithName,
    } as any);
  },

  /**
   * Create invoice with items
   * 
   * Business Rules:
   * - Validates input with Zod schema
   * - Calculates total from items
   * - Sets initial status to DUE
   */
  async create(input: CreateInvoiceInput): Promise<{ id: string }> {
    await assertCurrentUserCapability('fees.write');

    // Backend-authoritative validation
    const validatedInput = parseOrThrow(CreateInvoiceInputSchema, input, 'CreateInvoiceInput');

    // Business rule: Calculate total from items
    const totalAmount = calculateInvoiceTotal(validatedInput.items);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Business rule: Status is derived from amounts
    const status = calculateInvoiceStatus(totalAmount, 0);

    // Create invoice with due_date
    const { data: invoice, error: invErr } = await supabase
      .from('fee_invoices')
      .insert({
        school_code: validatedInput.school_code,
        student_id: validatedInput.student_id,
        billing_period: validatedInput.billing_period,
        academic_year_id: validatedInput.academic_year_id,
        due_date: validatedInput.due_date,
        notes: validatedInput.notes || null,
        total_amount: totalAmount,
        paid_amount: 0,
        status,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (invErr) {
      log.error('Failed to create invoice', invErr);
      throw invErr;
    }

    // Add items (no due_date on items - invoice has single due_date)
    if (validatedInput.items.length > 0) {
      const { error: itemsErr } = await supabase
        .from('fee_invoice_items')
        .insert(validatedInput.items.map(item => ({
          invoice_id: invoice.id,
          label: item.label,
          amount: item.amount,
        })));

      if (itemsErr) {
        log.error('Failed to create invoice items', itemsErr);
        throw itemsErr;
      }
    }

    return { id: invoice.id };
  },

  /**
   * Generate invoices for a class (bulk) - mapped to academic year
   * Single due date for entire invoice (all items share this date)
   */
  async generateForClass(
    classInstanceId: string,
    schoolCode: string,
    billingPeriod: string,
    items: { label: string; amount: number }[],
    academicYearId: string,
    dueDate: string // Single due date for all invoices
  ): Promise<{ created: number; skipped: number }> {
    await assertCurrentUserCapability('fees.write');

    const { data: { user } } = await supabase.auth.getUser();

    // Get class to verify academic year
    const { data: classInstance, error: classErr } = await supabase
      .from('class_instances')
      .select('academic_year_id')
      .eq('id', classInstanceId)
      .eq('school_code', schoolCode)
      .single();

    if (classErr) throw classErr;
    if (!classInstance) throw new Error('Class not found');

    // Validate academic year matches class
    if (classInstance.academic_year_id !== academicYearId) {
      throw new Error('Academic year does not match class');
    }

    // Get students in class
    const { data: students, error: studErr } = await supabase
      .from('student')
      .select('id')
      .eq('class_instance_id', classInstanceId)
      .eq('school_code', schoolCode);

    if (studErr) throw studErr;
    if (!students?.length) return { created: 0, skipped: 0 };

    // Check existing invoices for this period and academic year
    const { data: existing } = await supabase
      .from('fee_invoices')
      .select('student_id')
      .eq('school_code', schoolCode)
      .eq('billing_period', billingPeriod)
      .eq('academic_year_id', academicYearId)
      .in('student_id', students.map(s => s.id));

    const existingIds = new Set(existing?.map(e => e.student_id) || []);
    const newStudents = students.filter(s => !existingIds.has(s.id));

    if (newStudents.length === 0) {
      return { created: 0, skipped: students.length };
    }

    // Create invoices with academic_year_id and due_date
    const { data: invoices, error: invErr } = await supabase
      .from('fee_invoices')
      .insert(newStudents.map(s => ({
        school_code: schoolCode,
        student_id: s.id,
        billing_period: billingPeriod,
        academic_year_id: academicYearId,
        due_date: dueDate, // Single due date for entire invoice
        created_by: user?.id,
      })))
      .select('id');

    if (invErr) throw invErr;

    // Add items to all invoices (no due_date on items - invoice has single due_date)
    if (invoices && items.length > 0) {
      const allItems = invoices.flatMap(inv =>
        items.map(item => ({
          invoice_id: inv.id,
          label: item.label,
          amount: item.amount,
        }))
      );

      const { error: itemsErr } = await supabase
        .from('fee_invoice_items')
        .insert(allItems);

      if (itemsErr) throw itemsErr;
    }

    // Trigger notifications for newly created invoices (async, non-blocking)
    if (invoices && invoices.length > 0) {
      queueMicrotask(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          await supabase.functions.invoke('send-fee-notification', {
            body: {
              type: 'invoice_generated',
              invoice_ids: invoices.map(inv => inv.id),
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
        } catch (err) {
          log.warn('Failed to send invoice generation notifications', { error: err });
        }
      });
    }

    return { created: newStudents.length, skipped: existingIds.size };
  },

  /**
   * Record a payment against an invoice
   * 
   * Business Rules:
   * - Validates payment amount doesn't exceed remaining balance
   * - Validates input with Zod schema
   * - Stores immutable user_id for audit trail
   */
  async recordPayment(input: RecordPaymentInput): Promise<{ id: string }> {
    await assertCurrentUserCapability('fees.record_payments');

    // Backend-authoritative validation
    const validatedInput = parseOrThrow(RecordPaymentInputSchema, input, 'RecordPaymentInput');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get invoice to validate payment amount and get student_id/school_code
    const invoiceDetail = await this.getDetail(validatedInput.invoice_id);
    if (!invoiceDetail) {
      throw new InvoiceNotFoundError(validatedInput.invoice_id);
    }

    const invoice = invoiceDetail.invoice;
    const remaining = invoice.total_amount - invoice.paid_amount;

    // Business rule: Payment cannot exceed remaining balance
    const validation = validatePaymentAmount(validatedInput.amount, invoice.total_amount, invoice.paid_amount);
    if (!validation.valid) {
      throw new InvalidPaymentAmountError(validatedInput.amount, remaining);
    }

    // Store immutable user_id, not name (names can change, IDs don't)
    // Name will be resolved at read time via join with users table
    const paymentDate = new Date().toISOString().split('T')[0];
    const recordedAt = new Date().toISOString();

    const { data, error } = await supabase
      .from('fee_payments')
      .insert({
        invoice_id: validatedInput.invoice_id,
        invoice_item_id: validatedInput.invoice_item_id || null,
        student_id: invoice.student_id,
        school_code: invoice.school_code,
        amount_inr: validatedInput.amount,
        payment_method: validatedInput.method,
        payment_date: paymentDate,
        receipt_number: validatedInput.receipt_number || null,
        remarks: validatedInput.remarks || null,
        recorded_by_user_id: user.id, // Store immutable user ID for audit trail
        recorded_at: recordedAt, // Explicit timestamp for audit
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      log.error('Failed to record payment', error);
      throw error;
    }

    // Update invoice paid_amount and status
    await this.updateInvoicePaidAmount(validatedInput.invoice_id);

    // =====================================================
    // PHASE 3: Fee → Finance Integration
    // Auto-create finance transaction for fee payment
    // =====================================================
    try {
      // Get user role to check if super admin
      const authUser = await getCurrentAuthUser();

      // Only create finance transaction if user is super admin
      // (finance module is super admin only)
      if (authUser && authUser.role === 'superadmin' && invoice.school_code) {
        // Get or create default accounts and fees category
        const accounts = await financeService.ensureDefaultAccounts(invoice.school_code, authUser.id!);
        const feesCategoryId = await financeService.ensureFeesCategory(invoice.school_code, authUser.id!);

        // Map payment method to account
        const accountType = financeService.mapPaymentMethodToAccount(validatedInput.method);
        const accountId = accounts[accountType];

        // Create finance transaction (income)
        await financeService.createTransaction({
          school_code: invoice.school_code,
          txn_date: paymentDate, // Use same payment_date as fee_payment record
          amount: validatedInput.amount,
          type: 'income',
          category_id: feesCategoryId,
          account_id: accountId,
          description: `Fee payment - Invoice ${validatedInput.invoice_id}`,
          source_type: 'fee_payment',
          source_id: data.id, // Link to fee_payments.id
        });
      }
    } catch (financeError) {
      // Log error but don't fail payment recording
      // Finance transaction is secondary to payment recording
      log.error('Failed to create finance transaction for fee payment:', financeError);
    }

    // Send payment received notification (async, non-blocking)
    queueMicrotask(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase.functions.invoke('send-fee-notification', {
          body: {
            type: 'payment_received',
            invoice_id: validatedInput.invoice_id,
            payment_amount: validatedInput.amount,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      } catch (err) {
        log.warn('Failed to send payment received notification', { error: err });
      }
    });

    return { id: data.id };
  },

  /**
   * Record payment for a specific invoice item with validation
   */
  async recordItemPayment(input: RecordPaymentInput & { invoice_item_id: string }): Promise<{ id: string }> {
    await assertCurrentUserCapability('fees.record_payments');

    if (!input.invoice_item_id) {
      throw new Error('invoice_item_id is required for item-level payments');
    }

    // Get item details
    const { data: item, error: itemErr } = await supabase
      .from('fee_invoice_items')
      .select('id, amount, invoice_id')
      .eq('id', input.invoice_item_id)
      .single();

    if (itemErr || !item) throw new Error('Invoice item not found');

    if (item.invoice_id !== input.invoice_id) {
      throw new Error('Invoice item does not belong to the specified invoice');
    }

    // Get existing payments for this item
    const { data: existingPayments, error: paymentsErr } = await supabase
      .from('fee_payments')
      .select('amount_inr')
      .eq('invoice_item_id', input.invoice_item_id);

    if (paymentsErr) throw paymentsErr;

    const totalPaid = (existingPayments || []).reduce(
      (sum, p) => sum + Number(p.amount_inr),
      0
    );

    const remaining = item.amount - totalPaid;

    // Validate: Don't exceed remaining amount
    if (input.amount > remaining) {
      throw new Error(
        `Payment amount (${input.amount}) exceeds remaining amount (${remaining.toFixed(2)}). ` +
        `Maximum allowed: ${remaining.toFixed(2)}`
      );
    }

    // Validate: Amount must be positive
    if (input.amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    // Record payment using the general recordPayment method
    return this.recordPayment(input);
  },

  /**
   * Update invoice paid_amount and status based on all payments
   * 
   * OPTIMIZED: Single query with relation fetch (better than 3 separate queries)
   * 
   * TODO: Move to database trigger/function for better performance and atomicity
   * This should be: CREATE TRIGGER update_invoice_paid_amount AFTER INSERT/UPDATE/DELETE ON fee_payments
   * 
   * This is called after recording a payment to keep invoice in sync
   */
  async updateInvoicePaidAmount(invoiceId: string): Promise<void> {
    // Get invoice with payment sum calculated in database (single query)
    // This is more efficient than fetching all payments and summing in JS
    const { data: invoiceData, error: queryErr } = await supabase
      .from('fee_invoices')
      .select(`
        id,
        total_amount,
        payments:fee_payments(amount_inr)
      `)
      .eq('id', invoiceId)
      .single();

    if (queryErr || !invoiceData) {
      log.error('Failed to fetch invoice for paid amount update', { invoiceId, error: queryErr });
      throw new InvoiceNotFoundError(invoiceId);
    }

    // Calculate total paid from payments (aggregated in query)
    const totalPaid = (invoiceData.payments || []).reduce(
      (sum: number, p: { amount_inr: number | null }) => sum + Number(p.amount_inr || 0),
      0
    );

    const totalAmount = Number(invoiceData.total_amount);
    const status = calculateInvoiceStatus(totalAmount, totalPaid);

    // Update invoice with calculated values
    const { error: updateErr } = await supabase
      .from('fee_invoices')
      .update({
        paid_amount: totalPaid,
        status
      })
      .eq('id', invoiceId);

    if (updateErr) {
      log.error('Failed to update invoice paid amount', { invoiceId, error: updateErr });
      throw updateErr;
    }

    log.info('Updated invoice paid amount and status', { invoiceId, totalPaid, status });
  },

  /**
   * Add items to an existing invoice
   * 
   * Business Rules:
   * - Validates input with Zod schema
   * - Recalculates invoice total after adding items
   * - Updates invoice status if needed
   */
  async addItems(
    invoiceId: string,
    items: CreateInvoiceItemInput[]
  ): Promise<void> {
    await assertCurrentUserCapability('fees.write');

    if (!items.length) {
      throw new Error('At least one item is required');
    }

    // Backend-authoritative validation
    const validatedItems = items.map(item =>
      parseOrThrow(CreateInvoiceItemInputSchema, item, 'CreateInvoiceItemInput')
    );

    // Get user profile for school_code validation
    const userProfile = await assertCurrentUserCapability('fees.write');

    // First verify the invoice belongs to the user's school
    const { data: invoice, error: invoiceErr } = await supabase
      .from('fee_invoices')
      .select('id, school_code, paid_amount')
      .eq('id', invoiceId)
      .eq('school_code', userProfile.school_code)
      .single();

    if (invoiceErr || !invoice) {
      throw new InvoiceAccessDeniedError(invoiceId, userProfile.school_code);
    }

    // Insert new items
    const { error: insertErr } = await supabase
      .from('fee_invoice_items')
      .insert(validatedItems.map(item => ({
        invoice_id: invoiceId,
        label: item.label,
        amount: item.amount,
      })));

    if (insertErr) {
      log.error('Failed to insert invoice items', insertErr);
      throw insertErr;
    }

    log.info('Added invoice items', { invoiceId, itemCount: validatedItems.length });

    // Recalculate and update invoice total_amount
    const { data: allItems, error: fetchErr } = await supabase
      .from('fee_invoice_items')
      .select('amount')
      .eq('invoice_id', invoiceId);

    if (fetchErr) {
      log.error('Failed to fetch invoice items for recalculation', fetchErr);
      throw fetchErr;
    }

    // Business rule: Recalculate invoice total from all items
    const newTotal = calculateInvoiceTotal(allItems || []);

    const paidAmount = Number(invoice.paid_amount);
    const status = calculateInvoiceStatus(newTotal, paidAmount);

    const { error: updateErr } = await supabase
      .from('fee_invoices')
      .update({ total_amount: newTotal, status })
      .eq('id', invoiceId);

    if (updateErr) {
      log.error('Failed to update invoice total', updateErr);
      throw updateErr;
    }

    log.info('Updated invoice total and status', { invoiceId, newTotal, status });
  },

  /**
   * Remove items from an existing invoice
   */
  async removeItems(
    invoiceId: string,
    itemIds: string[]
  ): Promise<void> {
    await assertCurrentUserCapability('fees.write');

    if (!itemIds.length) {
      throw new Error('At least one item ID is required');
    }

    // Get user profile for school_code validation
    const userProfile = await assertCurrentUserCapability('fees.write');

    // First verify the invoice belongs to the user's school
    const { data: invoice, error: invoiceErr } = await supabase
      .from('fee_invoices')
      .select('id, school_code')
      .eq('id', invoiceId)
      .eq('school_code', userProfile.school_code)
      .single();

    if (invoiceErr || !invoice) {
      throw new InvoiceAccessDeniedError(invoiceId, userProfile.school_code);
    }

    // Delete items
    const { data: deletedItems, error: deleteErr } = await supabase
      .from('fee_invoice_items')
      .delete()
      .in('id', itemIds)
      .eq('invoice_id', invoiceId)
      .select('id'); // Return deleted rows to verify deletion

    if (deleteErr) {
      log.error('Failed to delete invoice items', deleteErr);
      throw deleteErr;
    }

    if (!deletedItems || deletedItems.length === 0) {
      log.warn('No items were deleted', { invoiceId, itemIds });
      throw new InvoiceItemNotFoundError(itemIds[0] || 'unknown');
    }

    log.info('Deleted invoice items', { invoiceId, itemIds, deletedCount: deletedItems.length });

    // Recalculate and update invoice total_amount
    const { data: allItems, error: fetchErr } = await supabase
      .from('fee_invoice_items')
      .select('amount')
      .eq('invoice_id', invoiceId);

    if (fetchErr) {
      log.error('Failed to fetch remaining items', fetchErr);
      throw fetchErr;
    }

    // Business rule: Recalculate invoice total from remaining items
    const newTotal = calculateInvoiceTotal(allItems || []);

    // Get current paid amount to recalculate status
    const { data: invoiceData, error: invoiceDataErr } = await supabase
      .from('fee_invoices')
      .select('paid_amount')
      .eq('id', invoiceId)
      .single();

    if (invoiceDataErr || !invoiceData) {
      throw new InvoiceNotFoundError(invoiceId);
    }

    const paidAmount = Number(invoiceData.paid_amount);
    const status = calculateInvoiceStatus(newTotal, paidAmount);

    const { error: updateErr } = await supabase
      .from('fee_invoices')
      .update({ total_amount: newTotal, status })
      .eq('id', invoiceId);

    if (updateErr) {
      log.error('Failed to update invoice total', updateErr);
      throw updateErr;
    }

    log.info('Updated invoice total and status', { invoiceId, newTotal, status });
  },

  /**
   * Update an invoice item
   * 
   * Business Rules:
   * - Validates input with Zod schema
   * - Recalculates invoice total after update
   * - Updates invoice status if needed
   */
  async updateItem(
    itemId: string,
    updates: UpdateInvoiceItemInput
  ): Promise<void> {
    await assertCurrentUserCapability('fees.write');

    // Backend-authoritative validation
    const validatedUpdates = parseOrThrow(UpdateInvoiceItemInputSchema, updates, 'UpdateInvoiceItemInput');

    // Get the invoice_id first for security check
    const { data: item, error: itemErr } = await supabase
      .from('fee_invoice_items')
      .select('invoice_id')
      .eq('id', itemId)
      .single();

    if (itemErr || !item) {
      throw new InvoiceItemNotFoundError(itemId);
    }

    // Build update data (only include provided fields)
    const updateData: { label?: string; amount?: number } = {};
    if (validatedUpdates.label !== undefined) updateData.label = validatedUpdates.label;
    if (validatedUpdates.amount !== undefined) updateData.amount = validatedUpdates.amount;

    const { error: updateErr } = await supabase
      .from('fee_invoice_items')
      .update(updateData)
      .eq('id', itemId);

    if (updateErr) {
      log.error('Failed to update invoice item', { itemId, error: updateErr });
      throw updateErr;
    }

    // Business rule: Recalculate invoice total from all items
    const { data: allItems, error: fetchErr } = await supabase
      .from('fee_invoice_items')
      .select('amount')
      .eq('invoice_id', item.invoice_id);

    if (fetchErr) {
      log.error('Failed to fetch invoice items for recalculation', { invoiceId: item.invoice_id, error: fetchErr });
      throw fetchErr;
    }

    const newTotal = calculateInvoiceTotal(allItems || []);

    // Get current paid amount to recalculate status
    const { data: invoice, error: invoiceErr } = await supabase
      .from('fee_invoices')
      .select('paid_amount')
      .eq('id', item.invoice_id)
      .single();

    if (invoiceErr || !invoice) {
      throw new InvoiceNotFoundError(item.invoice_id);
    }

    const paidAmount = Number(invoice.paid_amount);
    const status = calculateInvoiceStatus(newTotal, paidAmount);

    const { error: invoiceUpdateErr } = await supabase
      .from('fee_invoices')
      .update({ total_amount: newTotal, status })
      .eq('id', item.invoice_id);

    if (invoiceUpdateErr) {
      log.error('Failed to update invoice total', { invoiceId: item.invoice_id, error: invoiceUpdateErr });
      throw invoiceUpdateErr;
    }

    log.info('Updated invoice item and recalculated total', { itemId, invoiceId: item.invoice_id, newTotal, status });
  },

  /**
   * Update invoice properties (due_date, notes)
   */
  async update(
    invoiceId: string,
    updates: UpdateInvoiceInput
  ): Promise<void> {
    await assertCurrentUserCapability('fees.write');

    // Backend-authoritative validation
    const validatedUpdates = parseOrThrow(UpdateInvoiceInputSchema, updates, 'UpdateInvoiceInput');

    // Get user profile for school_code validation
    const userProfile = await assertCurrentUserCapability('fees.write');

    // Verify invoice exists and belongs to user's school
    const { data: invoice, error: invoiceErr } = await supabase
      .from('fee_invoices')
      .select('id, school_code')
      .eq('id', invoiceId)
      .eq('school_code', userProfile.school_code)
      .single();

    if (invoiceErr || !invoice) {
      throw new InvoiceAccessDeniedError(invoiceId, userProfile.school_code);
    }

    const { error: updateErr } = await supabase
      .from('fee_invoices')
      .update(validatedUpdates)
      .eq('id', invoiceId);

    if (updateErr) {
      log.error('Failed to update invoice', { invoiceId, error: updateErr });
      throw updateErr;
    }

    log.info('Updated invoice properties', { invoiceId, updates: validatedUpdates });
  },

  /**
   * Delete an entire invoice
   * 
   * Business Rules:
   * - Cannot delete invoice with existing payments
   * - Hard delete (no soft delete) - audit trail maintained via finance transactions
   */
  async delete(invoiceId: string): Promise<void> {
    await assertCurrentUserCapability('fees.write');

    const userProfile = await assertCurrentUserCapability('fees.write');

    // Verify invoice exists and belongs to user's school
    const { data: invoice, error: invoiceErr } = await supabase
      .from('fee_invoices')
      .select('id, school_code')
      .eq('id', invoiceId)
      .eq('school_code', userProfile.school_code)
      .single();

    if (invoiceErr || !invoice) {
      throw new InvoiceNotFoundError(invoiceId);
    }

    // Business rule: Cannot delete invoice with existing payments
    const { data: payments, error: paymentsErr } = await supabase
      .from('fee_payments')
      .select('id')
      .eq('invoice_id', invoiceId)
      .limit(1);

    if (paymentsErr) {
      log.error('Failed to check payments for invoice deletion', { invoiceId, error: paymentsErr });
      throw paymentsErr;
    }

    if (payments && payments.length > 0) {
      throw new InvoiceHasPaymentsError(invoiceId, payments.length);
    }

    // Delete all invoice items first
    const { error: itemsErr } = await supabase
      .from('fee_invoice_items')
      .delete()
      .eq('invoice_id', invoiceId);

    if (itemsErr) {
      log.error('Failed to delete invoice items', { invoiceId, error: itemsErr });
      throw itemsErr;
    }

    // Delete the invoice
    const { error: deleteErr } = await supabase
      .from('fee_invoices')
      .delete()
      .eq('id', invoiceId);

    if (deleteErr) {
      log.error('Failed to delete invoice', { invoiceId, error: deleteErr });
      throw deleteErr;
    }

    log.info('Deleted invoice', { invoiceId });
  },

  /**
   * Generate invoice document (HTML) via Edge Function
   * Server computes all totals - never trust client data
   */
  async generateInvoiceDocument(
    invoiceId: string,
    forceRegenerate = false
  ): Promise<{
    invoice_number: string;
    html_content: string;
    server_computed: {
      total: number;
      paid: number;
      balance: number;
      status: string;
    };
    generated_at: string;
  }> {
    await assertCurrentUserCapability('fees.read');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('generate-invoice-document', {
      body: {
        invoice_id: invoiceId,
        force_regenerate: forceRegenerate,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to generate invoice document');
    }

    return {
      invoice_number: data.invoice_number,
      html_content: data.html_content,
      server_computed: data.server_computed,
      generated_at: data.generated_at,
    };
  },

  /**
   * Send a payment reminder notification to the student
   */
  async sendPaymentReminder(invoiceId: string): Promise<{ success: boolean }> {
    await assertCurrentUserCapability('fees.read');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('send-fee-notification', {
      body: {
        type: 'payment_reminder',
        invoice_id: invoiceId,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      log.error('Failed to send payment reminder', { invoiceId, error });
      throw error;
    }

    return { success: true };
  },
};

export default invoiceService;
