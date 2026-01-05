/**
 * Domain Errors for Fees & Invoices
 * 
 * Production-ready error types with proper error codes and messages.
 * All errors are typed and provide actionable information.
 */

export class InvoiceDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'InvoiceDomainError';
  }
}

export class InvoiceNotFoundError extends InvoiceDomainError {
  constructor(invoiceId: string) {
    super(
      `Invoice not found: ${invoiceId}`,
      'INVOICE_NOT_FOUND',
      { invoiceId }
    );
    this.name = 'InvoiceNotFoundError';
  }
}

export class InvoiceItemNotFoundError extends InvoiceDomainError {
  constructor(itemId: string) {
    super(
      `Invoice item not found: ${itemId}`,
      'INVOICE_ITEM_NOT_FOUND',
      { itemId }
    );
    this.name = 'InvoiceItemNotFoundError';
  }
}

export class InvalidPaymentAmountError extends InvoiceDomainError {
  constructor(amount: number, remaining: number) {
    super(
      `Payment amount (₹${amount}) exceeds remaining balance (₹${remaining})`,
      'INVALID_PAYMENT_AMOUNT',
      { amount, remaining }
    );
    this.name = 'InvalidPaymentAmountError';
  }
}

export class InvoiceHasPaymentsError extends InvoiceDomainError {
  constructor(invoiceId: string, paymentCount: number) {
    super(
      `Cannot delete invoice with ${paymentCount} payment(s). Please refund payments first.`,
      'INVOICE_HAS_PAYMENTS',
      { invoiceId, paymentCount }
    );
    this.name = 'InvoiceHasPaymentsError';
  }
}

export class InvalidInvoiceItemsError extends InvoiceDomainError {
  constructor(reason: string) {
    super(
      `Invalid invoice items: ${reason}`,
      'INVALID_INVOICE_ITEMS',
      { reason }
    );
    this.name = 'InvalidInvoiceItemsError';
  }
}

export class InvoiceAccessDeniedError extends InvoiceDomainError {
  constructor(invoiceId: string, schoolCode: string) {
    super(
      `Access denied to invoice ${invoiceId} for school ${schoolCode}`,
      'INVOICE_ACCESS_DENIED',
      { invoiceId, schoolCode }
    );
    this.name = 'InvoiceAccessDeniedError';
  }
}


