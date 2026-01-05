// src/hooks/useInvoice.ts
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';

export interface InvoiceResponse {
  success: boolean;
  invoice_number: string;
  html_url: string | null;
  html_content: string;
  payment_id: string;
  amount: string;
  student_name: string;
  payment_date: string;
  expires_in: number;
  cached?: boolean;
  print_instructions: string;
}

export interface InvoiceError {
  error: string;
  details?: string;
  hint?: string;
  code?: string;
}

export interface UseInvoiceOptions {
  onSuccess?: (data: InvoiceResponse) => void;
  onError?: (error: InvoiceError) => void;
  showAlerts?: boolean; // Default true - show native alerts for errors
}

// Timeout for Edge Function call (30 seconds)
const INVOICE_TIMEOUT_MS = 30000;

/**
 * Creates a user-friendly error message from an InvoiceError
 */
const getErrorMessage = (error: InvoiceError): string => {
  if (error.hint) {
    return `${error.error}\n\n${error.hint}`;
  }
  if (error.details) {
    return `${error.error}\n\nDetails: ${error.details}`;
  }
  return error.error;
};

/**
 * Maps technical errors to user-friendly messages
 */
const mapErrorToUserMessage = (error: unknown): InvoiceError => {
  // Handle network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      error: 'Network error',
      details: 'Please check your internet connection and try again.',
      code: 'NETWORK_ERROR',
    };
  }

  // Handle timeout
  if (error instanceof Error && error.message.includes('timeout')) {
    return {
      error: 'Request timed out',
      details: 'The server took too long to respond. Please try again.',
      code: 'TIMEOUT',
    };
  }

  // Handle auth errors
  if (error instanceof Error && error.message.includes('Authentication')) {
    return {
      error: 'Session expired',
      details: 'Please log in again to continue.',
      code: 'AUTH_ERROR',
    };
  }

  // Handle InvoiceError type
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return error as InvoiceError;
  }

  // Generic error
  return {
    error: 'Something went wrong',
    details: error instanceof Error ? error.message : 'Unknown error occurred',
    code: 'UNKNOWN',
  };
};

/**
 * Hook for generating and managing fee invoices/receipts
 * Uses the generate-invoice-pdf Edge Function
 */
export function useInvoice(options?: UseInvoiceOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceResponse | null>(null);
  const showAlerts = options?.showAlerts !== false; // Default true

  const generateInvoiceMutation = useMutation({
    mutationFn: async ({
      paymentId,
      forceRegenerate = false,
    }: {
      paymentId: string;
      forceRegenerate?: boolean;
    }): Promise<InvoiceResponse> => {
      setIsGenerating(true);

      try {
        // Validate payment ID format
        if (!paymentId || typeof paymentId !== 'string' || paymentId.length < 10) {
          throw {
            error: 'Invalid payment ID',
            details: 'The payment ID format is invalid.',
            code: 'INVALID_INPUT',
          } as InvoiceError;
        }

        // Get current session for auth
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          log.error('Session error:', sessionError);
          throw {
            error: 'Authentication error',
            details: sessionError.message,
            code: 'AUTH_ERROR',
          } as InvoiceError;
        }

        if (!session) {
          throw {
            error: 'Session expired',
            details: 'Please log in again to generate invoices.',
            code: 'NO_SESSION',
          } as InvoiceError;
        }

        // Call Edge Function with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), INVOICE_TIMEOUT_MS);

        let data: any;
        let error: any;

        try {
          const result = await supabase.functions.invoke('generate-invoice-pdf', {
            body: {
              payment_id: paymentId,
              force_regenerate: forceRegenerate,
            },
          });
          data = result.data;
          error = result.error;
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw {
              error: 'Request timed out',
              details: 'Invoice generation took too long. Please try again.',
              code: 'TIMEOUT',
            } as InvoiceError;
          }
          throw fetchError;
        } finally {
          clearTimeout(timeoutId);
        }

        // Handle Edge Function errors
        if (error) {
          log.error('Invoice Edge Function error:', error);
          
          // Parse error response if it's JSON
          let errorDetails = error.message || 'Unknown error';
          if (error.context?.body) {
            try {
              const errorBody = JSON.parse(error.context.body);
              errorDetails = errorBody.details || errorBody.error || errorDetails;
            } catch {
              // Not JSON, use as-is
            }
          }

          throw {
            error: 'Failed to generate invoice',
            details: errorDetails,
            hint: 'If this persists, please contact support.',
            code: 'EDGE_FUNCTION_ERROR',
          } as InvoiceError;
        }

        // Handle empty response
        if (!data) {
          throw {
            error: 'Empty response',
            details: 'Server returned no data. Please try again.',
            code: 'EMPTY_RESPONSE',
          } as InvoiceError;
        }

        // Handle non-success response
        if (!data.success) {
          throw {
            error: data.error || 'Invoice generation failed',
            details: data.details,
            hint: data.hint,
            code: 'GENERATION_FAILED',
          } as InvoiceError;
        }

        // Validate response has required fields
        if (!data.html_content || !data.invoice_number) {
          throw {
            error: 'Invalid invoice data',
            details: 'Server returned incomplete invoice data.',
            code: 'INVALID_RESPONSE',
          } as InvoiceError;
        }

        return data as InvoiceResponse;
      } catch (err) {
        // Re-throw if already an InvoiceError
        if (typeof err === 'object' && err !== null && 'code' in err) {
          throw err;
        }
        // Map other errors
        throw mapErrorToUserMessage(err);
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: (data) => {
      setCurrentInvoice(data);
      log.info('Invoice generated successfully:', data.invoice_number);
      options?.onSuccess?.(data);
    },
    onError: (error: InvoiceError) => {
      log.error('Invoice generation failed:', error);
      
      // Show alert to user if enabled
      if (showAlerts) {
        Alert.alert(
          'Invoice Generation Failed',
          getErrorMessage(error),
          [{ text: 'OK', style: 'default' }]
        );
      }
      
      options?.onError?.(error);
    },
  });

  const generateInvoice = useCallback(
    async (paymentId: string, forceRegenerate = false) => {
      try {
        return await generateInvoiceMutation.mutateAsync({ paymentId, forceRegenerate });
      } catch (error) {
        // Error is already handled in onError callback
        // Re-throw for callers who want to handle it
        throw error;
      }
    },
    [generateInvoiceMutation]
  );

  const clearInvoice = useCallback(() => {
    setCurrentInvoice(null);
    generateInvoiceMutation.reset();
  }, [generateInvoiceMutation]);

  /**
   * Retry invoice generation after a failure
   */
  const retry = useCallback(
    (paymentId: string) => {
      generateInvoiceMutation.reset();
      return generateInvoice(paymentId, true); // Force regenerate on retry
    },
    [generateInvoice, generateInvoiceMutation]
  );

  return {
    generateInvoice,
    clearInvoice,
    retry,
    isGenerating: isGenerating || generateInvoiceMutation.isPending,
    currentInvoice,
    error: generateInvoiceMutation.error as InvoiceError | null,
    isError: generateInvoiceMutation.isError,
    reset: generateInvoiceMutation.reset,
  };
}

/**
 * Hook for viewing a specific invoice (re-print functionality)
 */
export function useInvoiceViewer() {
  const [isVisible, setIsVisible] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceResponse | null>(null);

  const showInvoice = useCallback((data: InvoiceResponse) => {
    setInvoiceData(data);
    setIsVisible(true);
  }, []);

  const hideInvoice = useCallback(() => {
    setIsVisible(false);
    // Delay clearing data to allow exit animation
    setTimeout(() => setInvoiceData(null), 300);
  }, []);

  return {
    isVisible,
    invoiceData,
    showInvoice,
    hideInvoice,
  };
}

