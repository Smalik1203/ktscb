import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';

type AcademicYear = {
  id: string;
  school_code: string;
  school_name: string;
  year_start: number;
  year_end: number;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  is_active: boolean;
  created_at: string;
};

type CreateAcademicYearInput = {
  year_start: number;
  year_end: number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  school_code: string;
  school_name: string;
};

type UpdateAcademicYearInput = {
  id: string;
  year_start: number;
  year_end: number;
  is_active: boolean;
};

/**
 * Fetch all academic years for a school
 */
export function useAcademicYears(schoolCode: string | null | undefined) {
  return useQuery({
    queryKey: ['academic_years', schoolCode],
    queryFn: async () => {
      if (!schoolCode) {
        throw new Error('School code is required');
      }

      log.info('Fetching academic years', { schoolCode });

      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_code', schoolCode)
        .order('year_start', { ascending: false });

      if (error) {
        log.error('Failed to fetch academic years', error);
        throw error;
      }

      return (data as AcademicYear[]) || [];
    },
    enabled: !!schoolCode,
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Fetch the active academic year for a school
 */
export function useActiveAcademicYear(schoolCode: string | null | undefined) {
  return useQuery({
    queryKey: ['academic_years', 'active', schoolCode],
    queryFn: async () => {
      if (!schoolCode) {
        throw new Error('School code is required');
      }

      log.info('Fetching active academic year', { schoolCode });

      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        log.error('Failed to fetch active academic year', error);
        throw error;
      }

      return (data as AcademicYear | null) || null;
    },
    enabled: !!schoolCode,
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Create a new academic year
 */
export function useCreateAcademicYear(schoolCode: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAcademicYearInput) => {
      log.info('Creating academic year', { year_start: input.year_start, year_end: input.year_end });

      // Validate
      if (input.year_end !== input.year_start + 1) {
        throw new Error('End year should be exactly one year after start year');
      }

      // Check if already exists
      const { data: existingYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_code', input.school_code)
        .eq('year_start', input.year_start)
        .eq('year_end', input.year_end);

      if (existingYear && existingYear.length > 0) {
        throw new Error('Academic year already exists for this period');
      }

      const { data, error } = await supabase
        .from('academic_years')
        .insert({
          school_code: input.school_code,
          school_name: input.school_name,
          year_start: input.year_start,
          year_end: input.year_end,
          start_date: input.start_date,
          end_date: input.end_date,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        log.error('Failed to create academic year', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic_years', schoolCode] });
    },
  });
}

/**
 * Update an academic year
 */
export function useUpdateAcademicYear(schoolCode: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAcademicYearInput) => {
      log.info('Updating academic year', { id: input.id });

      const { error } = await supabase
        .from('academic_years')
        .update({
          year_start: input.year_start,
          year_end: input.year_end,
          is_active: input.is_active,
        })
        .eq('id', input.id);

      if (error) {
        log.error('Failed to update academic year', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic_years', schoolCode] });
    },
  });
}

/**
 * Delete an academic year (with dependency check)
 */
export function useDeleteAcademicYear(schoolCode: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (yearId: string) => {
      log.info('Deleting academic year', { yearId });

      // Check for dependencies
      const { data: classesUsingYear } = await supabase
        .from('class_instances')
        .select('id')
        .eq('academic_year_id', yearId);

      if (classesUsingYear && classesUsingYear.length > 0) {
        throw new Error(
          `Cannot delete academic year. ${classesUsingYear.length} class(es) are using this academic year.`
        );
      }

      const { error } = await supabase
        .from('academic_years')
        .delete()
        .eq('id', yearId);

      if (error) {
        log.error('Failed to delete academic year', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic_years', schoolCode] });
    },
  });
}

