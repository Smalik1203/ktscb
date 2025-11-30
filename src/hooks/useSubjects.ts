import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';
import { DB } from '../types/db.constants';
import type { DomainSubject } from '../lib/normalize';

export interface SubjectsPaginationResult {
  data: DomainSubject[];
  total: number;
  page: number;
  pageSize: number;
}

type CreateSubjectInput = {
  subject_name: string;
  school_code: string;
  created_by: string;
};

type UpdateSubjectInput = {
  id: string;
  subject_name: string;
};

/**
 * Fetch all subjects for a school and provide mutation functions with pagination
 */
export function useSubjects(
  schoolCode: string | null | undefined,
  options?: { page?: number; pageSize?: number }
) {
  const queryClient = useQueryClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const query = useQuery<SubjectsPaginationResult>({
    queryKey: ['subjects', schoolCode, page, pageSize],
    queryFn: async () => {
      if (!schoolCode) {
        return { data: [], total: 0, page, pageSize };
      }

      log.info('Fetching subjects', { schoolCode });

      // Get total count
      const { count, error: countError } = await supabase
        .from(DB.tables.subjects)
        .select('*', { count: 'exact', head: true })
        .eq(DB.columns.schoolCode, schoolCode);

      if (countError) {
        log.error('Failed to fetch subject count', countError);
        throw countError;
      }

      // Fetch paginated data using queries.ts
      const { listSubjects } = await import('../data/queries');
      const result = await listSubjects(schoolCode, { from, to });

      if (result.error) {
        log.error('Failed to fetch subjects', result.error);
        throw result.error;
      }

      return {
        data: result.data || [],
        total: count || 0,
        page,
        pageSize,
      };
    },
    enabled: !!schoolCode,
    staleTime: 60_000, // 1 minute
  });

  const createSubject = useMutation({
    mutationFn: async (input: CreateSubjectInput) => {
      log.info('Creating subject', { subject_name: input.subject_name });

      const { data, error } = await supabase
        .from('subjects')
        .insert({
          subject_name: input.subject_name,
          school_code: input.school_code,
          created_by: input.created_by,
        })
        .select()
        .single();

      if (error) {
        // Handle duplicate error (unique constraint violation)
        if (error.code === '23505') {
          throw new Error('This subject already exists for your school');
        }
        log.error('Failed to create subject', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', schoolCode] });
    },
  });

  const updateSubject = useMutation({
    mutationFn: async (input: UpdateSubjectInput) => {
      log.info('Updating subject', { id: input.id });

      const { error } = await supabase
        .from('subjects')
        .update({
          subject_name: input.subject_name,
        })
        .eq('id', input.id);

      if (error) {
        // Handle duplicate error
        if (error.code === '23505') {
          throw new Error('A subject with this name already exists');
        }
        log.error('Failed to update subject', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', schoolCode] });
    },
  });

  const deleteSubject = useMutation({
    mutationFn: async (subjectId: string) => {
      log.info('Deleting subject', { subjectId });

      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId);

      if (error) {
        log.error('Failed to delete subject', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', schoolCode] });
    },
  });

  return {
    ...query,
    createSubject,
    updateSubject,
    deleteSubject,
  };
}
