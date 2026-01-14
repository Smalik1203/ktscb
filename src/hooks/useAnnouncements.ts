import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Announcement {
    id: string;
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    target_type: 'all' | 'class' | 'role';
    class_instance_id: string | null;
    target_role: string | null;
    school_code: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    pinned: boolean;
    likes_count: number;
    views_count: number;
    // Joined data
    creator?: {
        full_name: string;
    };
    class?: {
        grade: number;
        section: string | null;
    };
}

interface CreateAnnouncementInput {
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    target_type: 'all' | 'class';
    class_instance_id?: string;
    school_code: string;
    created_by: string;
}

const PAGE_SIZE = 20;

/**
 * Fetch announcements feed with infinite scroll
 */
export function useAnnouncementsFeed(schoolCode?: string) {
    return useInfiniteQuery({
        queryKey: ['announcements', 'feed', schoolCode],
        queryFn: async ({ pageParam = 0 }) => {
            const from = pageParam * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error, count } = await supabase
                .from('announcements')
                .select(`
          *,
          creator:users!created_by(full_name),
          class:class_instances(grade, section)
        `, { count: 'exact' })
                .eq('school_code', schoolCode!)
                .order('pinned', { ascending: false })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            return {
                announcements: data || [],
                nextPage: data && data.length === PAGE_SIZE ? pageParam + 1 : undefined,
                totalCount: count || 0,
            };
        },
        enabled: !!schoolCode,
        getNextPageParam: (lastPage) => lastPage.nextPage,
        staleTime: 1 * 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Create a new announcement (calls Edge Function)
 */
export function useCreateAnnouncement() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: CreateAnnouncementInput) => {
            const { data, error } = await supabase.functions.invoke('post-announcement', {
                body: {
                    announcement: input,
                },
            });

            if (error) {
                throw new Error(error.message || 'Failed to create announcement');
            }

            return data;
        },
        onSuccess: () => {
            // Invalidate announcements feed
            queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] });
        },
        onError: (error) => {
            console.error('Failed to create announcement:', error);
        },
    });
}

/**
 * Delete an announcement
 */
export function useDeleteAnnouncement() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (announcementId: string) => {
            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', announcementId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] });
        },
    });
}

/**
 * Pin/unpin an announcement
 */
export function useTogglePin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
            const { error } = await supabase
                .from('announcements')
                .update({ pinned })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] });
        },
    });
}
