/**
 * useReportComment - Hook for managing AI-generated report card comments
 * 
 * Used within Progress tab to generate/edit/approve comments for a student
 */

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ReportComment {
    id: string;
    studentId: string;
    studentName?: string;
    generatedComment: string;
    editedComment?: string;
    inputData?: any;
    wordCount: number;
    positivityScore: number;
    status: 'draft' | 'approved' | 'rejected';
    tone: string;
    focus: string;
    language: string;
    approvedAt?: string;
    createdAt: string;
}

interface GenerateCommentParams {
    studentId: string;
    classInstanceId: string;
    tone?: 'professional' | 'friendly' | 'encouraging';
    focus?: 'academic' | 'behavioral' | 'holistic';
    language?: 'english' | 'hindi' | 'bilingual';
}

interface UseReportCommentOptions {
    studentId?: string;
    classInstanceId?: string;
    autoGenerate?: boolean;
}

export function useReportComment(options: UseReportCommentOptions = {}) {
    const { studentId, classInstanceId, autoGenerate = false } = options;
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [editedText, setEditedText] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);

    // Fetch existing comment for this student/class
    const {
        data: existingComment,
        isLoading: isLoadingComment,
        refetch: refetchComment
    } = useQuery({
        queryKey: ['report-comment', studentId, classInstanceId],
        queryFn: async () => {
            if (!studentId || !classInstanceId) return null;

            const { data, error } = await supabase
                .from('report_comments')
                .select('id, student_id, term_id, class_instance_id, teacher_id, school_code, input_data, data_freshness_days, tone, focus, language, generated_comment, word_count, similarity_score, positivity_score, generation_version, model_used, edited_comment, edit_diff_length, was_regenerated, regeneration_count, status, approved_at, approved_by, rejection_reason, created_at, updated_at')
                .eq('student_id', studentId)
                .eq('class_instance_id', classInstanceId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                // Comment fetch failed
                return null;
            }

            return data as ReportComment | null;
        },
        enabled: !!studentId && !!classInstanceId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Generate comment mutation
    const generateMutation = useMutation({
        mutationFn: async (params: GenerateCommentParams) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-report-comment`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        studentId: params.studentId,
                        classInstanceId: params.classInstanceId,
                        schoolCode: profile?.school_code,
                        tone: params.tone || 'friendly',
                        focus: params.focus || 'holistic',
                        language: params.language || 'english',
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate comment');
            }

            const data = await response.json();
            return data.comment as ReportComment;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(['report-comment', studentId, classInstanceId], data);
        },
        onError: (error: Error) => {
            Alert.alert('Generation Failed', error.message);
        },
    });

    // Approve comment mutation
    const approveMutation = useMutation({
        mutationFn: async ({ commentId, editedComment }: { commentId: string; editedComment?: string }) => {
            const { error } = await (supabase.rpc as any)('approve_report_comment', {
                p_comment_id: commentId,
                p_edited_comment: editedComment || null,
            });

            if (error) throw error;
            return { commentId, editedComment };
        },
        onSuccess: (data) => {
            // Update cache
            queryClient.setQueryData(['report-comment', studentId, classInstanceId], (old: any) => ({
                ...old,
                status: 'approved',
                editedComment: data.editedComment,
                approvedAt: new Date().toISOString(),
            }));
            setIsEditing(false);
        },
        onError: (error: any) => {
            Alert.alert('Approval Failed', error.message || 'Failed to approve comment');
        },
    });

    // Auto-generate on first load if enabled and no existing comment
    useEffect(() => {
        if (
            autoGenerate &&
            studentId &&
            classInstanceId &&
            !existingComment &&
            !isLoadingComment &&
            !generateMutation.isPending &&
            !generateMutation.isSuccess
        ) {
            generateMutation.mutate({ studentId, classInstanceId });
        }
    }, [autoGenerate, studentId, classInstanceId, existingComment, isLoadingComment]);

    // Reset mutation data when student changes
    useEffect(() => {
        generateMutation.reset();
    }, [studentId, classInstanceId]);

    // Current comment (generated or existing) - only use mutation data if for current student
    const currentComment = generateMutation.data?.studentId === studentId
        ? generateMutation.data
        : existingComment;

    // Actions
    const generateComment = useCallback(
        (params?: Partial<GenerateCommentParams>) => {
            if (!studentId || !classInstanceId) {
                Alert.alert('Error', 'Student and class must be selected');
                return;
            }
            generateMutation.mutate({
                studentId,
                classInstanceId,
                ...params,
            });
        },
        [studentId, classInstanceId, generateMutation]
    );

    const startEditing = useCallback(() => {
        setEditedText(currentComment?.editedComment || currentComment?.generatedComment || '');
        setIsEditing(true);
    }, [currentComment]);

    const cancelEditing = useCallback(() => {
        setIsEditing(false);
        setEditedText('');
    }, []);

    const saveAndApprove = useCallback(() => {
        if (!currentComment?.id) return;
        approveMutation.mutate({
            commentId: currentComment.id,
            editedComment: editedText || undefined,
        });
    }, [currentComment, editedText, approveMutation]);

    const approveWithoutEdit = useCallback(() => {
        if (!currentComment?.id) return;
        approveMutation.mutate({
            commentId: currentComment.id,
        });
    }, [currentComment, approveMutation]);

    const regenerate = useCallback(() => {
        if (!studentId || !classInstanceId) return;
        generateMutation.mutate({ studentId, classInstanceId });
    }, [studentId, classInstanceId, generateMutation]);

    return {
        // Data
        comment: currentComment,
        isLoading: isLoadingComment,
        isGenerating: generateMutation.isPending,
        isApproving: approveMutation.isPending,
        error: generateMutation.error,

        // Editing state
        isEditing,
        editedText,
        setEditedText,

        // Actions
        generateComment,
        startEditing,
        cancelEditing,
        saveAndApprove,
        approveWithoutEdit,
        regenerate,
        refetch: refetchComment,
    };
}
