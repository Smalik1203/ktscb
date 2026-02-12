import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export type FeedbackType = 'student_to_admin' | 'superadmin_to_admin' | 'management_note';
export type Sentiment = 'positive' | 'neutral' | 'needs_improvement';
export type FeedbackCategory =
    | 'teaching_clarity'
    | 'pace'
    | 'behaviour'
    | 'doubt_resolution'
    | 'general'
    | 'observation'
    | 'improvement_required'
    | 'appreciation';

export interface Feedback {
    id: string;
    feedback_type: FeedbackType;
    from_user_id: string;
    to_user_id: string;
    subject_id: string | null;
    class_instance_id: string | null;
    sentiment: Sentiment | null;
    category: FeedbackCategory;
    content: string;
    requires_acknowledgement: boolean;
    acknowledged_at: string | null;
    archived_at: string | null;
    archived_by: string | null;
    school_code: string;
    created_at: string;
    updated_at: string;
    // Joined data
    from_user?: {
        full_name: string;
    };
    to_user?: {
        full_name: string;
    };
    subject?: {
        subject_name: string;
    };
    class_instance?: {
        grade: number;
        section: string | null;
    };
}

// Input types for mutations
export interface SubmitFeedbackInput {
    to_user_id: string;
    subject_id?: string;
    class_instance_id?: string;
    sentiment: Sentiment;
    category: FeedbackCategory;
    content: string;
    school_code: string;
    from_user_id: string;
}

export interface AddManagementNoteInput {
    to_user_id: string;
    category: 'observation' | 'improvement_required' | 'appreciation';
    content: string;
    requires_acknowledgement: boolean;
    school_code: string;
    from_user_id: string;
}

export interface FeedbackRecipient {
    id: string;
    full_name: string;
    role: string;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Submit feedback from student to admin
 */
export function useSubmitFeedback() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: SubmitFeedbackInput) => {
            const { data, error } = await supabase
                .from('feedback')
                .insert({
                    feedback_type: 'student_to_admin',
                    from_user_id: input.from_user_id,
                    to_user_id: input.to_user_id,
                    subject_id: input.subject_id || null,
                    class_instance_id: input.class_instance_id || null,
                    sentiment: input.sentiment,
                    category: input.category,
                    content: input.content,
                    school_code: input.school_code,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedback'] });
        },
    });
}

/**
 * Fetch feedback received by an admin (teacher view)
 * Uses the admin-safe view that hides student identity
 */
export function useFeedbackReceived(userId: string | undefined) {
    return useQuery({
        queryKey: ['feedback', 'received', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('feedback_for_admin')
                .select('*')
                .eq('to_user_id', userId!)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!userId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Fetch all feedback for a school (super admin view)
 */
export function useAllSchoolFeedback(schoolCode: string | undefined | null) {
    return useQuery({
        queryKey: ['feedback', 'all', schoolCode],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('feedback')
                .select(`
          *,
          from_user:users!from_user_id(full_name),
          to_user:users!to_user_id(full_name),
          subject:subjects(subject_name),
          class_instance:class_instances(grade, section)
        `)
                .eq('school_code', schoolCode!)
                .is('archived_at', null)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []) as Feedback[];
        },
        enabled: !!schoolCode,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });
}

/**
 * Add a management note (super admin only)
 */
export function useAddManagementNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: AddManagementNoteInput) => {
            const { data, error } = await supabase
                .from('feedback')
                .insert({
                    feedback_type: 'management_note',
                    from_user_id: input.from_user_id,
                    to_user_id: input.to_user_id,
                    category: input.category,
                    content: input.content,
                    requires_acknowledgement: input.requires_acknowledgement,
                    school_code: input.school_code,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedback'] });
        },
    });
}

/**
 * Acknowledge a feedback item (admin/teacher)
 */
export function useAcknowledgeFeedback() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (feedbackId: string) => {
            const { error } = await supabase
                .from('feedback')
                .update({ acknowledged_at: new Date().toISOString() })
                .eq('id', feedbackId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedback'] });
        },
    });
}

/**
 * Archive a feedback item (super admin only)
 */
export function useArchiveFeedback() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ feedbackId, userId }: { feedbackId: string; userId: string }) => {
            const { error } = await supabase
                .from('feedback')
                .update({
                    archived_at: new Date().toISOString(),
                    archived_by: userId,
                })
                .eq('id', feedbackId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedback'] });
        },
    });
}

/**
 * Fetch teachers/admins for feedback dropdown (students use this)
 * Includes super_admin/superadmin roles and handles null school_code for super admins
 */
export function useFeedbackRecipients(schoolCode: string | undefined | null) {
    return useQuery<FeedbackRecipient[]>({
        queryKey: ['feedback', 'recipients', schoolCode],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, role')
                .in('role', ['admin', 'teacher', 'superadmin', 'super_admin'])
                .or(`school_code.eq.${schoolCode!},school_code.is.null`)
                .order('full_name');

            if (error) throw error;
            return (data || []) as FeedbackRecipient[];
        },
        enabled: !!schoolCode,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Get students for feedback (for admin/teacher to send feedback to students)
 */
export interface StudentForFeedback {
    id: string;
    full_name: string;
    role: string;
    class_instance_id: string | null;
}

export function useStudentsForFeedback(schoolCode: string | undefined | null) {
    return useQuery<StudentForFeedback[]>({
        queryKey: ['feedback', 'students', schoolCode],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, role, class_instance_id')
                .eq('school_code', schoolCode!)
                .eq('role', 'student')
                .order('full_name');

            if (error) throw error;
            return (data || []) as StudentForFeedback[];
        },
        enabled: !!schoolCode,
        staleTime: 5 * 60 * 1000,
    });
}

export interface SendStudentFeedbackInput {
    to_user_id: string;
    category: 'observation' | 'improvement_required' | 'appreciation' | 'behaviour' | 'general';
    content: string;
    school_code: string;
    from_user_id: string;
}

/**
 * Send feedback from admin/teacher to student
 */
export function useSendStudentFeedback() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: SendStudentFeedbackInput) => {
            const { data, error } = await supabase
                .from('feedback')
                .insert({
                    feedback_type: 'admin_to_student',
                    from_user_id: input.from_user_id,
                    to_user_id: input.to_user_id,
                    category: input.category,
                    content: input.content,
                    school_code: input.school_code,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedback'] });
        },
    });
}

/**
 * Get feedback received by a student (from admins/teachers)
 */
export function useFeedbackForStudent(studentId: string | undefined | null) {
    return useQuery({
        queryKey: ['feedback', 'for-student', studentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('feedback')
                .select(`
                    *,
                    from_user:users!feedback_from_user_id_fkey(id, full_name, role)
                `)
                .eq('to_user_id', studentId!)
                .eq('feedback_type', 'admin_to_student')
                .is('archived_at', null)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!studentId,
        staleTime: 30 * 1000,
    });
}

/**
 * Get feedback sent TO students (for SuperAdmin dashboard)
 */
export function useFeedbackToStudents(schoolCode: string | undefined | null) {
    return useQuery({
        queryKey: ['feedback', 'to-students', schoolCode],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('feedback')
                .select(`
                    *,
                    from_user:users!feedback_from_user_id_fkey(id, full_name, role),
                    to_user:users!feedback_to_user_id_fkey(id, full_name, role)
                `)
                .eq('school_code', schoolCode!)
                .eq('feedback_type', 'admin_to_student')
                .is('archived_at', null)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!schoolCode,
        staleTime: 30 * 1000,
    });
}

// ============================================================================
// UTILITY CONSTANTS
// ============================================================================

export const SENTIMENT_OPTIONS = [
    { value: 'positive', label: 'Positive', color: '#059669' },
    { value: 'neutral', label: 'Neutral', color: '#6B7280' },
    { value: 'needs_improvement', label: 'Needs Improvement', color: '#D97706' },
] as const;

export const STUDENT_FEEDBACK_CATEGORIES = [
    { value: 'teaching_clarity', label: 'Teaching Clarity' },
    { value: 'pace', label: 'Pace' },
    { value: 'behaviour', label: 'Behaviour' },
    { value: 'doubt_resolution', label: 'Doubt Resolution' },
    { value: 'general', label: 'General' },
] as const;

export const MANAGEMENT_NOTE_CATEGORIES = [
    { value: 'observation', label: 'Observation' },
    { value: 'improvement_required', label: 'Improvement Required' },
    { value: 'appreciation', label: 'Appreciation' },
] as const;

export const STUDENT_REMARK_CATEGORIES = [
    { value: 'observation', label: 'Observation' },
    { value: 'behaviour', label: 'Behaviour' },
    { value: 'improvement_required', label: 'Needs Improvement' },
    { value: 'appreciation', label: 'Appreciation' },
    { value: 'general', label: 'General' },
] as const;

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
    teaching_clarity: 'Teaching Clarity',
    pace: 'Pace',
    behaviour: 'Behaviour',
    doubt_resolution: 'Doubt Resolution',
    general: 'General',
    observation: 'Observation',
    improvement_required: 'Improvement Required',
    appreciation: 'Appreciation',
};

