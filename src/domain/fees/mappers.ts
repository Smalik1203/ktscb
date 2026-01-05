/**
 * Mappers between Database Types and Domain Types
 * 
 * Separates data access concerns from domain logic.
 * All database rows are transformed to domain types here.
 */

import type { Database } from '../../types/database.types';
import type {
  DomainInvoice,
  DomainInvoiceItem,
  DomainInvoicePayment,
  DomainInvoiceDetail,
} from './types';

type DbInvoice = Database['public']['Tables']['fee_invoices']['Row'];
type DbInvoiceItem = Database['public']['Tables']['fee_invoice_items']['Row'];
// Extend DbPayment to include new columns that exist in DB but not in generated types
type DbPayment = Database['public']['Tables']['fee_payments']['Row'] & {
  invoice_id?: string | null;
  invoice_item_id?: string | null;
  recorded_by_user_id?: string | null;
  recorded_at?: string | null;
};

// ==================== INVOICE MAPPER ====================

export function mapDbInvoiceToDomain(
  dbInvoice: DbInvoice,
  student?: { id: string; full_name: string; student_code: string } | null
): DomainInvoice {
  return {
    id: dbInvoice.id,
    school_code: dbInvoice.school_code,
    student_id: dbInvoice.student_id,
    billing_period: dbInvoice.billing_period,
    total_amount: Number(dbInvoice.total_amount),
    paid_amount: Number(dbInvoice.paid_amount),
    status: dbInvoice.status as DomainInvoice['status'],
    notes: dbInvoice.notes,
    academic_year_id: dbInvoice.academic_year_id,
    due_date: dbInvoice.due_date,
    created_at: dbInvoice.created_at,
    student: student || undefined,
  };
}

// ==================== INVOICE ITEM MAPPER ====================

export function mapDbInvoiceItemToDomain(
  dbItem: DbInvoiceItem
): DomainInvoiceItem {
  return {
    id: dbItem.id,
    invoice_id: dbItem.invoice_id,
    label: dbItem.label,
    amount: Number(dbItem.amount),
    created_at: dbItem.created_at,
  };
}

// ==================== PAYMENT MAPPER ====================

export function mapDbPaymentToDomain(
  dbPayment: DbPayment,
  recordedByName?: string
): DomainInvoicePayment {
  return {
    id: dbPayment.id,
    invoice_id: dbPayment.invoice_id,
    invoice_item_id: dbPayment.invoice_item_id,
    amount_inr: Number(dbPayment.amount_inr),
    payment_method: dbPayment.payment_method as DomainInvoicePayment['payment_method'],
    payment_date: dbPayment.payment_date,
    receipt_number: dbPayment.receipt_number,
    remarks: dbPayment.remarks,
    recorded_by_user_id: dbPayment.recorded_by_user_id,
    recorded_at: dbPayment.recorded_at,
    recorded_by_name: recordedByName,
  };
}

// ==================== INVOICE DETAIL MAPPER ====================

export function mapDbInvoiceDetailToDomain(
  dbInvoice: DbInvoice & {
    student?: { id: string; full_name: string; student_code: string } | null;
    items?: DbInvoiceItem[];
    payments?: (DbPayment & { recorded_by_name?: string })[];
  }
): DomainInvoiceDetail {
  const invoice = mapDbInvoiceToDomain(dbInvoice, dbInvoice.student);
  
  const items: DomainInvoiceItem[] = (dbInvoice.items || []).map(mapDbInvoiceItemToDomain);
  
  const payments: DomainInvoicePayment[] = (dbInvoice.payments || []).map((p) =>
    mapDbPaymentToDomain(p, p.recorded_by_name)
  );

  return {
    invoice,
    items,
    payments,
  };
}

