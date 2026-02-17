import type { PostgrestError } from '@supabase/supabase-js';
import { logger } from './logger';

export type SupabaseError = PostgrestError | (Error & { code?: string; status?: number });

export interface HandleSupabaseErrorContext {
  table?: string;
  action?: string;
  [key: string]: unknown;
}

export interface HandleSupabaseErrorOptions {
  throw?: boolean;
}

export function handleSupabaseError(
  error: SupabaseError | null,
  context?: HandleSupabaseErrorContext,
  options?: HandleSupabaseErrorOptions
): void {
  if (error == null) return;

  const payload = {
    ...context,
    ...(typeof (error as PostgrestError).code === 'string' && {
      code: (error as PostgrestError).code,
      details: (error as PostgrestError).details,
      hint: (error as PostgrestError).hint,
    }),
    ...(typeof (error as Error & { status?: number }).status === 'number' && {
      status: (error as Error & { status?: number }).status,
    }),
  };

  logger.error(error, payload);

  if (options?.throw) {
    throw error;
  }
}
