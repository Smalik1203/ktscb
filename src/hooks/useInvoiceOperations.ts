/**
 * Invoice Operations Hooks
 * 
 * Separates UI concerns from data access.
 * All invoice mutations go through these hooks.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '../services/fees';
import type {
  CreateInvoiceInput,
  RecordPaymentInput,
  UpdateInvoiceItemInput,
  CreateInvoiceItemInput,
  UpdateInvoiceInput,
} from '../domain/fees/types';

/**
 * Hook for creating invoices
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => invoiceService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
    },
  });
}

/**
 * Hook for recording payments
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordPaymentInput) => invoiceService.recordPayment(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', variables.invoice_id] });
    },
  });
}

/**
 * Hook for adding items to an invoice
 */
export function useAddInvoiceItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { invoiceId: string; items: CreateInvoiceItemInput[] }) =>
      invoiceService.addItems(params.invoiceId, params.items),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', variables.invoiceId] });
    },
  });
}

/**
 * Hook for removing items from an invoice
 */
export function useRemoveInvoiceItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { invoiceId: string; itemIds: string[] }) =>
      invoiceService.removeItems(params.invoiceId, params.itemIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', variables.invoiceId] });
    },
  });
}

/**
 * Hook for updating an invoice item
 */
export function useUpdateInvoiceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { itemId: string; updates: UpdateInvoiceItemInput }) =>
      invoiceService.updateItem(params.itemId, params.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail'] });
    },
  });
}

/**
 * Hook for deleting an invoice
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceId: string) => invoiceService.delete(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail'] });
    },
  });
}

/**
 * Hook for updating an invoice (due date, notes)
 */
export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { invoiceId: string; updates: UpdateInvoiceInput }) =>
      invoiceService.update(params.invoiceId, params.updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', variables.invoiceId] });
    },
  });
}
