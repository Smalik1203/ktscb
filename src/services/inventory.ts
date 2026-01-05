/**
 * Inventory Items Service
 * 
 * Handles all inventory item operations with proper authorization and validation.
 * All operations are school-scoped and require appropriate capabilities.
 */

import { supabase } from '../lib/supabase';
import { parseOrThrow, InventoryItemInputSchema, type InventoryItemInput } from '../lib/domain-schemas';
import { log } from '../lib/logger';
import { assertCapability, type AuthorizableUser } from '../domain/auth/assert';
import type { Capability } from '../domain/auth/capabilities';

// =============================================================================
// Authorization Helpers
// =============================================================================

/**
 * Get the current authenticated user context for service-level authorization.
 */
async function getCurrentAuthUser(): Promise<(AuthorizableUser & { school_code: string | null }) | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('id, role, school_code')
    .eq('id', user.id)
    .maybeSingle();

  if (!userData) return null;

  return {
    id: userData.id,
    role: userData.role,
    school_code: userData.school_code,
  };
}

/**
 * Assert that the current authenticated user has the required capability.
 * Also ensures school_code is present (required for school-scoped operations).
 */
async function assertCurrentUserCapability(capability: Capability): Promise<AuthorizableUser & { school_code: string }> {
  const user = await getCurrentAuthUser();
  assertCapability(user, capability);
  if (!user!.school_code) {
    throw new Error('User does not have a school_code assigned');
  }
  return user as AuthorizableUser & { school_code: string };
}

// =============================================================================
// Inventory Items Service
// =============================================================================

export const inventoryItemsService = {
  /**
   * Create a new inventory item.
   * Requires: inventory.create capability
   */
  async create(input: InventoryItemInput): Promise<{ id: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate input with Zod
    const validatedInput = parseOrThrow(InventoryItemInputSchema, input, 'inventoryItemsService.create');

    // Ensure school_code matches user's school and check capability
    const userProfile = await assertCurrentUserCapability('inventory.create');
    if (validatedInput.school_code !== userProfile.school_code) {
      throw new Error('School code mismatch');
    }

    // Ensure created_by matches current user
    if (validatedInput.created_by !== user.id) {
      throw new Error('created_by must match current user');
    }

    log.info('Creating inventory item', { name: validatedInput.name, school_code: validatedInput.school_code });

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        school_code: validatedInput.school_code,
        name: validatedInput.name,
        category: validatedInput.category,
        description: validatedInput.description || null,
        track_quantity: validatedInput.track_quantity,
        current_quantity: validatedInput.current_quantity || null,
        low_stock_threshold: validatedInput.low_stock_threshold || null,
        track_serially: validatedInput.track_serially,
        can_be_issued: validatedInput.can_be_issued,
        issue_to: validatedInput.issue_to || null,
        must_be_returned: validatedInput.must_be_returned,
        return_duration_days: validatedInput.return_duration_days || null,
        is_chargeable: validatedInput.is_chargeable,
        charge_type: validatedInput.charge_type || null,
        charge_amount: validatedInput.charge_amount || null,
        auto_add_to_fees: validatedInput.auto_add_to_fees,
        fee_category: validatedInput.fee_category || null,
        unit_cost: validatedInput.unit_cost || null,
        allow_price_override: validatedInput.allow_price_override,
        internal_notes: validatedInput.internal_notes || null,
        is_active: validatedInput.is_active,
        created_by: validatedInput.created_by,
      })
      .select('id')
      .single();

    if (error) {
      log.error('Failed to create inventory item', error);
      throw error;
    }

    return { id: data.id };
  },

  /**
   * Get all inventory items for a school.
   * Requires: inventory.read capability
   */
  async list(schoolCode: string): Promise<any[]> {
    const userProfile = await assertCurrentUserCapability('inventory.read');
    if (schoolCode !== userProfile.school_code) {
      throw new Error('School code mismatch');
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('school_code', schoolCode)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to list inventory items', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get a single inventory item by ID.
   * Requires: inventory.read capability
   */
  async getById(itemId: string): Promise<any | null> {
    const userProfile = await assertCurrentUserCapability('inventory.read');

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .eq('school_code', userProfile.school_code)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      log.error('Failed to get inventory item', error);
      throw error;
    }

    return data;
  },

  /**
   * Update an inventory item.
   * Requires: inventory.manage capability
   */
  async update(itemId: string, updates: Partial<Omit<InventoryItemInput, 'school_code' | 'created_by'>>): Promise<void> {
    const userProfile = await assertCurrentUserCapability('inventory.manage');

    // Verify item exists and belongs to school
    const existing = await this.getById(itemId);
    if (!existing) {
      throw new Error('Inventory item not found');
    }

    if (existing.school_code !== userProfile.school_code) {
      throw new Error('School code mismatch');
    }

    log.info('Updating inventory item', { itemId, updates });

    const { error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', itemId)
      .eq('school_code', userProfile.school_code);

    if (error) {
      log.error('Failed to update inventory item', error);
      throw error;
    }
  },

  /**
   * Soft delete an inventory item (set is_active = false).
   * Requires: inventory.manage capability
   */
  async delete(itemId: string): Promise<void> {
    await assertCurrentUserCapability('inventory.manage');

    await this.update(itemId, { is_active: false });
  },

  /**
   * Issue inventory item to student or staff
   * Requires: inventory.manage capability
   */
  async issue(input: {
    inventory_item_id: string;
    issued_to_type: 'student' | 'staff';
    issued_to_id: string;
    quantity: number;
    serial_number?: string;
    charge_amount_override?: number;
  }): Promise<{ id: string; fee_invoice_item_id?: string }> {
    await assertCurrentUserCapability('inventory.manage');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const userProfile = await assertCurrentUserCapability('inventory.manage');

    // Get inventory item to validate
    const item = await this.getById(input.inventory_item_id);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    if (item.school_code !== userProfile.school_code) {
      throw new Error('School code mismatch');
    }

    if (!item.can_be_issued) {
      throw new Error('This item cannot be issued');
    }

    // Validate issue_to
    if (item.issue_to === 'student' && input.issued_to_type !== 'student') {
      throw new Error('This item can only be issued to students');
    }
    if (item.issue_to === 'staff' && input.issued_to_type !== 'staff') {
      throw new Error('This item can only be issued to staff');
    }

    // Check quantity availability
    if (item.track_quantity && item.current_quantity !== null) {
      if (item.current_quantity < input.quantity) {
        throw new Error(`Insufficient quantity. Available: ${item.current_quantity}`);
      }
    }

    // Calculate charge amount
    let chargeAmount = null;
    let chargeType = null;
    if (item.is_chargeable) {
      chargeAmount = input.charge_amount_override ?? item.charge_amount;
      chargeType = item.charge_type;
      if (!chargeAmount || chargeAmount <= 0) {
        throw new Error('Charge amount is required for chargeable items');
      }
    }

    // Calculate expected return date
    let expectedReturnDate: string | null = null;
    if (item.must_be_returned && item.return_duration_days) {
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + item.return_duration_days);
      expectedReturnDate = returnDate.toISOString().split('T')[0];
    }

    // Create issue record
    const { data: issue, error: issueError } = await supabase
      .from('inventory_issues')
      .insert({
        school_code: userProfile.school_code,
        inventory_item_id: input.inventory_item_id,
        issued_to_type: input.issued_to_type,
        issued_to_id: input.issued_to_id,
        quantity: input.quantity,
        serial_number: input.serial_number || null,
        issue_date: new Date().toISOString().split('T')[0],
        expected_return_date: expectedReturnDate,
        charge_amount: chargeAmount,
        charge_type: chargeType,
        status: 'issued',
        issued_by: user.id,
      })
      .select('id')
      .single();

    if (issueError) {
      log.error('Failed to create inventory issue', issueError);
      throw issueError;
    }

    // Update inventory item quantity
    if (item.track_quantity && item.current_quantity !== null) {
      const newQuantity = item.current_quantity - input.quantity;
      await this.update(input.inventory_item_id, {
        current_quantity: newQuantity,
      });
    }

    // Add to fees if auto_add_to_fees is enabled
    let feeInvoiceItemId: string | null = null;
    if (item.auto_add_to_fees && item.is_chargeable && input.issued_to_type === 'student' && chargeAmount) {
      try {
        // Import invoice service dynamically to avoid circular dependency
        const { invoiceService } = await import('./fees');

        // Get active academic year
        const { data: academicYear } = await supabase
          .from('academic_years')
          .select('id, year_start, year_end')
          .eq('school_code', userProfile.school_code)
          .eq('is_active', true)
          .single();

        if (academicYear) {
          // Get or create invoice for student
          // Use same format as GenerateFeesModal: "YYYY-YYYY" (no spaces)
          const billingPeriod = `${academicYear.year_start}-${academicYear.year_end}`;

          // Check if invoice exists for current period
          const { data: existingInvoice } = await supabase
            .from('fee_invoices')
            .select('id')
            .eq('student_id', input.issued_to_id)
            .eq('school_code', userProfile.school_code)
            .eq('billing_period', billingPeriod)
            .eq('academic_year_id', academicYear.id)
            .maybeSingle();

          let invoiceId: string | undefined;
          if (existingInvoice) {
            invoiceId = existingInvoice.id;
          } else {
            // Create new invoice
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + 1); // Due in 1 month

            const { data: newInvoice, error: invError } = await supabase
              .from('fee_invoices')
              .insert({
                school_code: userProfile.school_code,
                student_id: input.issued_to_id,
                billing_period: billingPeriod,
                academic_year_id: academicYear.id,
                due_date: dueDate.toISOString().split('T')[0],
                total_amount: 0,
                paid_amount: 0,
                created_by: user.id,
              })
              .select('id')
              .single();

            if (invError) {
              log.error('Failed to create invoice for inventory issue', invError);
              // Don't throw - issue was created, just fee addition failed
            } else if (newInvoice) {
              invoiceId = newInvoice.id;
            }
          }

          if (invoiceId) {
            // Add item to invoice using invoiceService
            await invoiceService.addItems(invoiceId, [{
              label: `${item.name}${input.quantity > 1 ? ` (x${input.quantity})` : ''}`,
              amount: chargeAmount * input.quantity,
            }]);

            // Get the invoice item ID we just created
            const { data: invoiceItem } = await supabase
              .from('fee_invoice_items')
              .select('id')
              .eq('invoice_id', invoiceId)
              .eq('label', `${item.name}${input.quantity > 1 ? ` (x${input.quantity})` : ''}`)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (invoiceItem) {
              feeInvoiceItemId = invoiceItem.id;

              // Update issue with invoice item ID
              await supabase
                .from('inventory_issues')
                .update({ fee_invoice_item_id: feeInvoiceItemId })
                .eq('id', issue.id);
            }
          }
        }
      } catch (feeError: any) {
        log.error('Failed to add inventory charge to fees', feeError);
        // Don't throw - issue was created successfully, fee addition is optional
      }
    }

    return { id: issue.id, fee_invoice_item_id: feeInvoiceItemId || undefined };
  },

  /**
   * List all inventory issues for a school
   * Requires: inventory.read capability
   */
  async listIssues(schoolCode: string, filters?: {
    status?: 'issued' | 'returned' | 'overdue' | 'lost';
    inventory_item_id?: string;
    issued_to_type?: 'student' | 'staff';
    issued_to_id?: string;
  }): Promise<any[]> {
    const userProfile = await assertCurrentUserCapability('inventory.read');
    if (schoolCode !== userProfile.school_code) {
      throw new Error('School code mismatch');
    }

    let query = supabase
      .from('inventory_issues')
      .select(`
        *,
        inventory_item:inventory_item_id(id, name, category)
      `)
      .eq('school_code', schoolCode)
      .order('issue_date', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.inventory_item_id) {
      query = query.eq('inventory_item_id', filters.inventory_item_id);
    }
    if (filters?.issued_to_type) {
      query = query.eq('issued_to_type', filters.issued_to_type);
    }
    if (filters?.issued_to_id) {
      query = query.eq('issued_to_id', filters.issued_to_id);
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to list inventory issues', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Fetch student and staff names separately
    const studentIds = [...new Set(data.filter((i: any) => i.issued_to_type === 'student').map((i: any) => i.issued_to_id))];
    const staffIds = [...new Set(data.filter((i: any) => i.issued_to_type === 'staff').map((i: any) => i.issued_to_id))];

    const studentNames = new Map<string, { full_name: string; student_code?: string }>();
    const staffNames = new Map<string, { full_name: string }>();

    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from('student')
        .select('id, full_name, student_code')
        .in('id', studentIds);

      if (students) {
        students.forEach((s: any) => {
          studentNames.set(s.id, { full_name: s.full_name, student_code: s.student_code });
        });
      }
    }

    if (staffIds.length > 0) {
      const { data: staff } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', staffIds)
        .eq('school_code', schoolCode);

      if (staff) {
        staff.forEach((s: any) => {
          staffNames.set(s.id, { full_name: s.full_name });
        });
      }
    }

    // Merge names into issues
    return data.map((issue: any) => {
      if (issue.issued_to_type === 'student' && studentNames.has(issue.issued_to_id)) {
        // Runtime-safe: check has() then get() with fallback
        const student = studentNames.get(issue.issued_to_id);
        if (student) {
          return {
            ...issue,
            issued_to_name: student.student_code
              ? `${student.full_name} (${student.student_code})`
              : student.full_name,
          };
        }
      } else if (issue.issued_to_type === 'staff' && staffNames.has(issue.issued_to_id)) {
        // Runtime-safe: check has() then get() with fallback
        const staff = staffNames.get(issue.issued_to_id);
        if (staff) {
          return {
            ...issue,
            issued_to_name: staff.full_name,
          };
        }
      }
      return {
        ...issue,
        issued_to_name: issue.issued_to_type === 'student' ? 'Unknown Student' : 'Unknown Staff',
      };
    });
  },

  /**
   * Return/delete an issued inventory item
   * Reverses quantity and handles fee refunds
   * Requires: inventory.manage capability
   */
  async returnIssue(
    issueId: string,
    options?: {
      return_notes?: string;
      mark_as_lost?: boolean;
    }
  ): Promise<void> {
    await assertCurrentUserCapability('inventory.manage');

    const userProfile = await assertCurrentUserCapability('inventory.manage');

    // Get the issue record
    const { data: issue, error: issueError } = await supabase
      .from('inventory_issues')
      .select(`
        *,
        inventory_item:inventory_item_id(*)
      `)
      .eq('id', issueId)
      .eq('school_code', userProfile.school_code)
      .single();

    if (issueError || !issue) {
      throw new Error('Inventory issue not found');
    }

    if (issue.status === 'returned') {
      throw new Error('This item has already been returned');
    }

    const item = issue.inventory_item;
    if (!item) {
      throw new Error('Inventory item not found');
    }

    // Update issue status
    const newStatus = options?.mark_as_lost ? 'lost' : 'returned';
    const { error: updateError } = await supabase
      .from('inventory_issues')
      .update({
        status: newStatus,
        returned_date: newStatus === 'returned' ? new Date().toISOString().split('T')[0] : null,
        return_notes: options?.return_notes || null,
      })
      .eq('id', issueId)
      .eq('school_code', userProfile.school_code);

    if (updateError) {
      log.error('Failed to update inventory issue status', updateError);
      throw updateError;
    }

    // Reverse inventory quantity (add it back)
    if (item.track_quantity && item.current_quantity !== null) {
      const newQuantity = item.current_quantity + issue.quantity;
      await this.update(issue.inventory_item_id, {
        current_quantity: newQuantity,
      });
    }

    // Handle fee reversal - ALWAYS reverse if charge was applied
    // Check both issue.charge_amount (stored on issue) and issue.charge_type
    const chargeAmount = issue.charge_amount || 0;
    const chargeType = issue.charge_type;

    if (chargeAmount > 0 && chargeType && issue.issued_to_type === 'student') {
      try {
        // Import invoice service dynamically
        const { invoiceService } = await import('./fees');

        let invoiceItemId = issue.fee_invoice_item_id;
        let invoiceId: string | null = null;

        // If fee_invoice_item_id exists, get the invoice_id from it
        if (invoiceItemId) {
          const { data: invoiceItem } = await supabase
            .from('fee_invoice_items')
            .select('invoice_id, amount')
            .eq('id', invoiceItemId)
            .maybeSingle();

          if (invoiceItem) {
            invoiceId = invoiceItem.invoice_id;
          }
        }

        // If we don't have invoice_id, try to find it by searching for the item
        // This handles cases where fee_invoice_item_id wasn't stored properly
        if (!invoiceId && issue.issued_to_id) {
          // Get active academic year
          const { data: academicYear } = await supabase
            .from('academic_years')
            .select('id, year_start, year_end')
            .eq('school_code', userProfile.school_code)
            .eq('is_active', true)
            .single();

          if (academicYear) {
            const billingPeriod = `${academicYear.year_start}-${academicYear.year_end}`;

            // Find invoice for this student and period
            const { data: invoice } = await supabase
              .from('fee_invoices')
              .select('id')
              .eq('student_id', issue.issued_to_id)
              .eq('school_code', userProfile.school_code)
              .eq('billing_period', billingPeriod)
              .eq('academic_year_id', academicYear.id)
              .maybeSingle();

            if (invoice) {
              invoiceId = invoice.id;

              // Try to find the invoice item by label matching
              const itemLabel = `${item.name}${issue.quantity > 1 ? ` (x${issue.quantity})` : ''}`;
              const { data: matchingItem } = await supabase
                .from('fee_invoice_items')
                .select('id')
                .eq('invoice_id', invoiceId)
                .eq('label', itemLabel)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (matchingItem) {
                invoiceItemId = matchingItem.id;
              }
            }
          }
        }

        if (invoiceId) {
          if (chargeType === 'deposit') {
            // For deposits, add a refund item (negative amount)
            await invoiceService.addItems(invoiceId, [{
              label: `Refund: ${item.name}${issue.quantity > 1 ? ` (x${issue.quantity})` : ''} - Returned`,
              amount: -Math.abs(chargeAmount) * issue.quantity,
            }]);
          } else {
            // For one-time charges, remove the invoice item
            if (invoiceItemId) {
              // Delete the specific invoice item
              const { error: deleteError } = await supabase
                .from('fee_invoice_items')
                .delete()
                .eq('id', invoiceItemId);

              if (deleteError) {
                log.error('Failed to delete invoice item', deleteError);
                throw deleteError; // Throw to ensure we know it failed
              }
            } else {
              // If we don't have the item ID, try to find and delete by label
              const itemLabel = `${item.name}${issue.quantity > 1 ? ` (x${issue.quantity})` : ''}`;
              const { data: matchingItems } = await supabase
                .from('fee_invoice_items')
                .select('id')
                .eq('invoice_id', invoiceId)
                .eq('label', itemLabel);

              if (matchingItems && matchingItems.length > 0) {
                // Delete the most recent matching item
                const { error: deleteError } = await supabase
                  .from('fee_invoice_items')
                  .delete()
                  .eq('id', matchingItems[0].id);

                if (deleteError) {
                  log.error('Failed to delete invoice item by label', deleteError);
                  throw deleteError;
                }
              } else {
                log.warn('Could not find invoice item to delete', { invoiceId, itemLabel });
                // Still try to add negative item as fallback
                await invoiceService.addItems(invoiceId, [{
                  label: `Refund: ${item.name}${issue.quantity > 1 ? ` (x${issue.quantity})` : ''} - Returned`,
                  amount: -Math.abs(chargeAmount) * issue.quantity,
                }]);
              }
            }

            // Recalculate invoice total after deletion
            const { data: remainingItems } = await supabase
              .from('fee_invoice_items')
              .select('amount')
              .eq('invoice_id', invoiceId);

            if (remainingItems) {
              const newTotal = remainingItems.reduce(
                (sum, item) => sum + parseFloat(item.amount.toString()),
                0
              );

              const { error: updateError } = await supabase
                .from('fee_invoices')
                .update({ total_amount: newTotal })
                .eq('id', invoiceId);

              if (updateError) {
                log.error('Failed to update invoice total after item deletion', updateError);
                throw updateError;
              }
            }
          }

          log.info('Successfully reversed inventory charge', {
            issueId,
            invoiceId,
            chargeType: chargeType,
            amount: chargeAmount * issue.quantity
          });
        } else {
          log.warn('Could not find invoice to reverse charge', {
            issueId,
            studentId: issue.issued_to_id,
            chargeAmount: issue.charge_amount
          });
        }
      } catch (feeError: any) {
        log.error('Failed to reverse inventory charge from fees', feeError);
        // Re-throw to ensure the user knows fee reversal failed
        throw new Error(`Failed to reverse charge: ${feeError.message || 'Unknown error'}`);
      }
    }

    log.info('Inventory issue returned', { issueId, status: newStatus });
  },
};

