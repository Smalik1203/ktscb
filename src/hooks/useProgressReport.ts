/**
 * useProgressReport - React hook for generating student progress reports
 * Similar pattern to useInvoice for consistency
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';

export interface ProgressReportResponse {
  success: boolean;
  html_content: string;
  student_id: string;
  student_name: string;
  total_tests: number;
  overall_average: number;
  overall_grade?: string; // Optional - not shown in UI anymore
  data?: {
    student?: any;
    academics?: any;
    tasks?: any;
    syllabus?: any;
    attendance?: any;
    fees?: any;
  };
}

export interface ProgressReportError {
  code: string;
  error: string;
  details?: string;
  hint?: string;
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

const ERROR_MESSAGES: Record<string, string> = {
  [ErrorCodes.UNAUTHORIZED]: 'Please log in to download your progress report.',
  [ErrorCodes.FORBIDDEN]: 'You do not have permission to view this report.',
  [ErrorCodes.NOT_FOUND]: 'Student record not found.',
  [ErrorCodes.VALIDATION_ERROR]: 'Invalid request. Please try again.',
  [ErrorCodes.INTERNAL_ERROR]: 'Server error. Please try again later.',
  [ErrorCodes.TIMEOUT]: 'Request timed out. Please check your connection.',
  [ErrorCodes.NETWORK_ERROR]: 'Network error. Please check your connection.',
};

interface UseProgressReportOptions {
  onSuccess?: (data: ProgressReportResponse) => void;
  onError?: (error: ProgressReportError) => void;
}

export function useProgressReport(options?: UseProgressReportOptions) {
  const [currentReport, setCurrentReport] = useState<ProgressReportResponse | null>(null);

  const generateReportMutation = useMutation<
    ProgressReportResponse,
    ProgressReportError,
    { studentId?: string }
  >({
    mutationFn: async ({ studentId }) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45-second timeout (report is more complex)

      try {
        const { data, error } = await supabase.functions.invoke('generate-progress-report', {
          body: studentId ? { student_id: studentId } : {},
        });

        clearTimeout(timeoutId);

        if (error) {
          log.error('Progress report Edge Function error:', error);

          // Try to parse error response
          let errorData: ProgressReportError;
          try {
            if (error.context?.body) {
              const bodyText = await error.context.body.text?.();
              if (bodyText && bodyText.trim().length > 0) {
                try {
                  errorData = JSON.parse(bodyText);
                } catch (parseError) {
                  // Not valid JSON - create error from text
                  throw new Error(`Invalid JSON in error response: ${bodyText.substring(0, 100)}`);
                }
              } else {
                throw new Error('Empty body');
              }
            } else {
              throw new Error('No context');
            }
          } catch {
            errorData = {
              code: ErrorCodes.INTERNAL_ERROR,
              error: 'Failed to generate report',
              details: error.message,
            };
          }

          throw errorData;
        }

        if (!data || !data.success) {
          throw {
            code: ErrorCodes.INTERNAL_ERROR,
            error: data?.error || 'Unknown error occurred',
            details: data?.details,
          } as ProgressReportError;
        }

        return data as ProgressReportResponse;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
          throw {
            code: ErrorCodes.TIMEOUT,
            error: 'Request timed out',
            details: 'The report generation took too long to respond.',
            hint: 'Please check your network connection or try again later.',
          } as ProgressReportError;
        }

        // Re-throw if already formatted
        if (err.code && err.error) {
          throw err;
        }

        throw {
          code: ErrorCodes.NETWORK_ERROR,
          error: 'Network error',
          details: err.message || 'Failed to connect to server',
        } as ProgressReportError;
      }
    },
    onSuccess: (data) => {
      setCurrentReport(data);
      log.info('Progress report generated successfully for:', data.student_name);
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      log.error('Progress report generation failed:', error);
      const userMessage = ERROR_MESSAGES[error.code] || error.error || 'An unexpected error occurred';
      Alert.alert('Report Generation Failed', userMessage);
      options?.onError?.(error);
    },
  });

  const generateReport = useCallback(
    async (studentId?: string) => {
      return generateReportMutation.mutateAsync({ studentId });
    },
    [generateReportMutation]
  );

  const clearReport = useCallback(() => {
    setCurrentReport(null);
  }, []);

  return {
    generateReport,
    clearReport,
    currentReport,
    isGenerating: generateReportMutation.isPending,
    error: generateReportMutation.error,
    reset: generateReportMutation.reset,
    retry: () => {
      if (generateReportMutation.variables) {
        generateReportMutation.mutate(generateReportMutation.variables);
      }
    },
  };
}

// Viewer state management hook
export function useProgressReportViewer() {
  const [isVisible, setIsVisible] = useState(false);
  const [reportData, setReportData] = useState<ProgressReportResponse | null>(null);

  const showReport = useCallback((data: ProgressReportResponse) => {
    setReportData(data);
    setIsVisible(true);
  }, []);

  const hideReport = useCallback(() => {
    setIsVisible(false);
    // Delay clearing data to allow close animation
    setTimeout(() => setReportData(null), 300);
  }, []);

  return {
    isVisible,
    reportData,
    showReport,
    hideReport,
  };
}

