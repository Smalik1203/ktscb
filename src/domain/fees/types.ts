/**
 * Domain Types for Fees & Invoices
 * 
 * Production-ready types with no `any`, proper nullability, and business rule enforcement.
 * These types represent the domain model, not raw database rows.
 */

import { z } from 'zod';

// ==================== BASE SCHEMAS ====================

const uuidSchema = z.string().uuid();
const nonEmptyStringSchema = z.string().min(1);
const positiveNumberSchema = z.number().positive();
const nonNegativeNumberSchema = z.number().nonnegative();
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
const billingPeriodSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Billing period must be in YYYY-MM format');

// ==================== INVOICE STATUS ====================

export const InvoiceStatusSchema = z.enum(['DUE', 'PARTIAL', 'PAID']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

// ==================== PAYMENT METHOD ====================

export const PaymentMethodSchema = z.enum(['cash', 'card', 'online', 'cheque', 'bank_transfer']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

// ==================== INVOICE ITEM SCHEMA ====================

export const InvoiceItemSchema = z.object({
  id: uuidSchema,
  invoice_id: uuidSchema,
  label: nonEmptyStringSchema,
  amount: z.number(), // Can be negative for discounts/refunds
  created_at: z.string(), // ISO timestamp
});

export type DomainInvoiceItem = z.infer<typeof InvoiceItemSchema>;

// ==================== INVOICE PAYMENT SCHEMA ====================

export const InvoicePaymentSchema = z.object({
  id: uuidSchema,
  invoice_id: uuidSchema,
  invoice_item_id: uuidSchema.nullable(),
  amount_inr: positiveNumberSchema,
  payment_method: PaymentMethodSchema,
  payment_date: dateStringSchema,
  receipt_number: z.string().nullable(),
  remarks: z.string().nullable(),
  recorded_by_user_id: uuidSchema,
  recorded_at: z.string(), // ISO timestamp
  // Resolved at read time (not stored in DB)
  recorded_by_name: z.string().optional(),
});

export type DomainInvoicePayment = z.infer<typeof InvoicePaymentSchema>;

// ==================== INVOICE SCHEMA ====================

export const InvoiceSchema = z.object({
  id: uuidSchema,
  school_code: nonEmptyStringSchema,
  student_id: uuidSchema,
  billing_period: billingPeriodSchema,
  total_amount: nonNegativeNumberSchema,
  paid_amount: nonNegativeNumberSchema,
  status: InvoiceStatusSchema,
  notes: z.string().nullable(),
  academic_year_id: uuidSchema.nullable(),
  due_date: dateStringSchema.nullable(),
  created_at: z.string(), // ISO timestamp
  // Joined data (optional, resolved at read time)
  student: z.object({
    id: uuidSchema,
    full_name: nonEmptyStringSchema,
    student_code: nonEmptyStringSchema,
  }).optional(),
});

export type DomainInvoice = z.infer<typeof InvoiceSchema>;

// ==================== INVOICE WITH ITEMS & PAYMENTS ====================

export const InvoiceDetailSchema = z.object({
  invoice: InvoiceSchema,
  items: z.array(InvoiceItemSchema),
  payments: z.array(InvoicePaymentSchema),
});

export type DomainInvoiceDetail = z.infer<typeof InvoiceDetailSchema>;

// ==================== INPUT SCHEMAS ====================

export const CreateInvoiceItemInputSchema = z.object({
  label: nonEmptyStringSchema,
  amount: z.number(), // Can be negative for discounts
});

export type CreateInvoiceItemInput = z.infer<typeof CreateInvoiceItemInputSchema>;

export const CreateInvoiceInputSchema = z.object({
  school_code: nonEmptyStringSchema,
  student_id: uuidSchema,
  billing_period: billingPeriodSchema,
  items: z.array(CreateInvoiceItemInputSchema).min(1, 'At least one item is required'),
  academic_year_id: uuidSchema,
  due_date: dateStringSchema,
  notes: z.string().nullable().optional(),
}).refine(
  (data) => {
    const total = data.items.reduce((sum, item) => sum + item.amount, 0);
    return total > 0;
  },
  { message: 'Invoice total must be greater than zero', path: ['items'] }
);

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

export const RecordPaymentInputSchema = z.object({
  invoice_id: uuidSchema,
  amount: positiveNumberSchema,
  method: PaymentMethodSchema,
  receipt_number: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  invoice_item_id: uuidSchema.nullable().optional(),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentInputSchema>;

export const UpdateInvoiceItemInputSchema = z.object({
  label: nonEmptyStringSchema.optional(),
  amount: z.number().optional(),
}).refine(
  (data) => data.label !== undefined || data.amount !== undefined,
  { message: 'At least one field (label or amount) must be provided' }
);

export type UpdateInvoiceItemInput = z.infer<typeof UpdateInvoiceItemInputSchema>;

// ==================== BUSINESS RULE HELPERS ====================

/**
 * Calculate invoice status based on amounts
 * Business Rule: Status is derived from total_amount and paid_amount
 */
export function calculateInvoiceStatus(
  totalAmount: number,
  paidAmount: number
): InvoiceStatus {
  if (paidAmount <= 0) return 'DUE';
  if (paidAmount >= totalAmount) return 'PAID';
  return 'PARTIAL';
}

/**
 * Validate payment amount doesn't exceed remaining balance
 * Business Rule: Payment cannot exceed invoice balance
 */
export function validatePaymentAmount(
  amount: number,
  totalAmount: number,
  paidAmount: number
): { valid: boolean; error?: string } {
  const remaining = totalAmount - paidAmount;
  if (amount > remaining) {
    return {
      valid: false,
      error: `Payment amount (₹${amount}) exceeds remaining balance (₹${remaining})`,
    };
  }
  return { valid: true };
}

/**
 * Calculate invoice total from items
 * Business Rule: Total is sum of all item amounts
 */
export function calculateInvoiceTotal(items: Array<{ amount: number }>): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}


