/**
 * Inventory Items Hooks
 * 
 * React Query hooks for inventory item operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryItemsService } from '../services/inventory';
import type { InventoryItemInput } from '../lib/domain-schemas';
import { log } from '../lib/logger';

/**
 * Get all inventory items for a school
 */
export function useInventoryItems(schoolCode: string | null | undefined) {
  return useQuery({
    queryKey: ['inventory-items', schoolCode],
    queryFn: async () => {
      if (!schoolCode) return [];
      return inventoryItemsService.list(schoolCode);
    },
    enabled: !!schoolCode,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Get a single inventory item by ID
 */
export function useInventoryItem(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['inventory-item', itemId],
    queryFn: async () => {
      if (!itemId) return null;
      return inventoryItemsService.getById(itemId);
    },
    enabled: !!itemId,
    staleTime: 30_000,
  });
}

/**
 * Create a new inventory item
 */
export function useCreateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InventoryItemInput) => {
      log.info('Creating inventory item via hook', { name: input.name });
      return inventoryItemsService.create(input);
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch inventory items list
      queryClient.invalidateQueries({ queryKey: ['inventory-items', variables.school_code] });
    },
  });
}

/**
 * Update an inventory item
 */
export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Partial<Omit<InventoryItemInput, 'school_code' | 'created_by'>> }) => {
      return inventoryItemsService.update(itemId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item'] });
    },
  });
}

/**
 * Delete (soft delete) an inventory item
 */
export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      return inventoryItemsService.delete(itemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
  });
}

/**
 * Issue an inventory item
 */
export function useIssueInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      inventory_item_id: string;
      issued_to_type: 'student' | 'staff';
      issued_to_id: string;
      quantity: number;
      serial_number?: string;
      charge_amount_override?: number;
    }) => {
      return inventoryItemsService.issue(input);
    },
    onSuccess: (_, variables) => {
      // Invalidate inventory items to refresh quantity
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', variables.inventory_item_id] });
      // Invalidate invoices if fee was added
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
      // Invalidate inventory issues
      queryClient.invalidateQueries({ queryKey: ['inventory-issues'] });
    },
  });
}

/**
 * Get all inventory issues for a school
 */
export function useInventoryIssues(
  schoolCode: string | null | undefined,
  filters?: {
    status?: 'issued' | 'returned' | 'overdue' | 'lost';
    inventory_item_id?: string;
    issued_to_type?: 'student' | 'staff';
    issued_to_id?: string;
  }
) {
  return useQuery({
    queryKey: ['inventory-issues', schoolCode, filters],
    queryFn: async () => {
      if (!schoolCode) return [];
      return inventoryItemsService.listIssues(schoolCode, filters);
    },
    enabled: !!schoolCode,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Return an issued inventory item
 */
export function useReturnInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      issueId: string;
      return_notes?: string;
      mark_as_lost?: boolean;
    }) => {
      return inventoryItemsService.returnIssue(input.issueId, {
        return_notes: input.return_notes,
        mark_as_lost: input.mark_as_lost,
      });
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-issues'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
    },
  });
}

