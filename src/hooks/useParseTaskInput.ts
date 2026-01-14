import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';

/**
 * Parse Task Input Hook
 * 
 * Calls the parse-task-input edge function to convert
 * natural language (voice or text) into structured task data.
 */

// Types matching edge function response
export interface FieldResult<T> {
    value: T | null;
    source: 'explicit' | 'inferred' | 'default' | 'unmatched';
    confidence: number;
    raw_input?: string;
    match_status?: 'single_match' | 'multiple_matches' | 'no_match';
    options?: Array<{ id: string; label: string; similarity: number }>;
}

export interface ParsedTask {
    title: FieldResult<string>;
    description: FieldResult<string>;
    class: FieldResult<{ id: string; label: string }>;
    subject: FieldResult<{ id: string; name: string }>;
    due_date: FieldResult<string>;
    due_date_display: string;
    assigned_date: FieldResult<string>;
    priority: FieldResult<'low' | 'medium' | 'high' | 'urgent'>;
    instructions: FieldResult<string>;
}

export interface ParseTaskResult {
    success: boolean;
    transcription?: string;
    parsed_task?: ParsedTask;
    overall_confidence?: number;
    requires_confirmation: boolean;
    fields_needing_review: string[];
    errors: Array<{ field: string; code: string; message: string }>;
    log_id?: string;
}

export interface ParseTaskInput {
    input_type: 'voice' | 'text';
    audio_base64?: string;
    text?: string;
    school_code: string;
    academic_year_id: string;
    available_classes: Array<{ id: string; label: string; grade?: string; section?: string }>;
    available_subjects: Array<{ id: string; name: string }>;
}

export interface UpdateSmartTaskLogInput {
    log_id: string;
    was_edited: boolean;
    edits_made?: Record<string, { old: unknown; new: unknown }>;
    final_task_id?: string;
    status: 'confirmed' | 'cancelled' | 'error';
    error_message?: string;
}

/**
 * Hook to parse task input using AI
 */
export function useParseTaskInput() {
    const queryClient = useQueryClient();

    // Main parsing mutation
    const parseMutation = useMutation({
        mutationKey: ['parseTaskInput'],
        mutationFn: async (input: ParseTaskInput): Promise<ParseTaskResult> => {
            log.info('Parsing task input', {
                input_type: input.input_type,
                school_code: input.school_code,
                classes_count: input.available_classes.length,
                subjects_count: input.available_subjects.length,
            });

            const { data, error } = await supabase.functions.invoke('parse-task-input', {
                body: input,
            });

            if (error) {
                log.error('Parse task input error', error);
                throw new Error(error.message || 'Failed to parse task input');
            }

            if (!data.success) {
                const errorMsg = data.errors?.[0]?.message || 'Failed to parse task input';
                throw new Error(errorMsg);
            }

            log.info('Task parsed successfully', {
                overall_confidence: data.overall_confidence,
                fields_needing_review: data.fields_needing_review,
            });

            return data as ParseTaskResult;
        },
    });

    // Update log after confirmation/cancellation
    const updateLogMutation = useMutation({
        mutationKey: ['updateSmartTaskLog'],
        mutationFn: async (input: UpdateSmartTaskLogInput) => {
            log.info('Updating smart task log', { log_id: input.log_id, status: input.status });

            const updateData: Record<string, unknown> = {
                was_edited: input.was_edited,
                status: input.status,
                confirmed_at: input.status === 'confirmed' ? new Date().toISOString() : null,
            };

            if (input.edits_made) {
                updateData.edits_made = input.edits_made;
            }
            if (input.final_task_id) {
                updateData.final_task_id = input.final_task_id;
            }
            if (input.error_message) {
                updateData.error_message = input.error_message;
            }

            // Use raw fetch to update log since smart_task_logs may not be in generated types yet
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
                if (supabaseUrl) {
                    await fetch(`${supabaseUrl}/rest/v1/smart_task_logs?id=eq.${input.log_id}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                            'apikey': session.access_token,
                            'Prefer': 'return=minimal',
                        },
                        body: JSON.stringify(updateData),
                    });
                }
            }
        },
    });

    return {
        // Parse mutation
        parseTaskInput: parseMutation.mutateAsync,
        isParsing: parseMutation.isPending,
        parseError: parseMutation.error,
        parseResult: parseMutation.data,
        resetParse: parseMutation.reset,

        // Log update mutation
        updateLog: updateLogMutation.mutateAsync,
        isUpdatingLog: updateLogMutation.isPending,
    };
}

/**
 * Helper to check if a field needs confirmation
 */
export function fieldNeedsConfirmation(
    field: FieldResult<unknown>,
    threshold: number = 0.7
): boolean {
    if (!field.value) return true;
    if (field.confidence < threshold) return true;
    if (field.match_status === 'multiple_matches') return true;
    if (field.match_status === 'no_match') return true;
    return false;
}

/**
 * Helper to get field status for UI
 */
export function getFieldStatus(
    field: FieldResult<unknown>
): 'confirmed' | 'needs_review' | 'missing' {
    if (!field.value) return 'missing';
    if (field.confidence >= 0.8 && field.match_status !== 'multiple_matches') return 'confirmed';
    return 'needs_review';
}

/**
 * Helper to format confidence as percentage
 */
export function formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
}

export default useParseTaskInput;
