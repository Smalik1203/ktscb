import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';

type ClassInstance = {
  id: string;
  class_id: string;
  academic_year_id: string;
  class_teacher_id: string | null;
  grade: string;
  section: string;
  school_code: string;
  created_at: string;
  class?: {
    grade: string;
    section: string;
  };
  year?: {
    year_start: number;
    year_end: number;
  };
  teacher?: {
    full_name: string;
  };
};

type CreateClassInstanceInput = {
  grade: string;
  section: string;
  academic_year_id: string;
  class_teacher_id: string;
  school_code: string;
  school_name: string;
  created_by: string;
};

type UpdateClassInstanceInput = {
  id: string;
  grade: string;
  section: string;
  class_teacher_id: string;
};

/**
 * Fetch all class instances for a school
 */
export function useClassInstances(schoolCode: string | null | undefined) {
  return useQuery({
    queryKey: ['class_instances', schoolCode],
    queryFn: async () => {
      if (!schoolCode) {
        throw new Error('School code is required');
      }

      log.info('Fetching class instances', { schoolCode });

      const { data, error } = await supabase
        .from('class_instances')
        .select(`
          id,
          grade,
          section,
          class_teacher_id,
          created_at,
          class_id,
          academic_year_id,
          class:classes (id, grade, section),
          year:academic_years (id, year_start, year_end),
          teacher:admin (full_name)
        `)
        .eq('school_code', schoolCode)
        .order('grade', { ascending: false })
        .order('section');

      if (error) {
        log.error('Failed to fetch class instances', error);
        throw error;
      }

      if (!data) return [];
      return data.map((item: any) => ({
        id: item.id,
        grade: String(item.grade || ''),
        section: item.section,
        class_teacher_id: item.class_teacher_id,
        created_at: item.created_at,
        class_id: item.class_id || (item.class?.id || ''),
        academic_year_id: item.academic_year_id || (item.year?.id || ''),
        school_code: schoolCode || '',
      })) as ClassInstance[];
    },
    enabled: !!schoolCode,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Create a new class instance
 */
export function useCreateClassInstance(schoolCode: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateClassInstanceInput) => {
      log.info('Creating class instance', { grade: input.grade, section: input.section });

      let classId: string;

      // Check if class template exists
      const { data: existingClass } = await supabase
        .from('classes')
        .select('id')
        .eq('grade', Number(input.grade))
        .eq('section', input.section)
        .eq('school_code', input.school_code)
        .eq('created_by', input.created_by);

      if (existingClass && existingClass.length > 0) {
        classId = existingClass[0].id;
      } else {
        // Create new class template
        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert({
            grade: Number(input.grade),
            section: input.section,
            school_name: input.school_name,
            school_code: input.school_code,
            created_by: input.created_by,
          })
          .select('id, school_name, school_code, grade, section, created_by, created_at')
          .single();

        if (classError) {
          log.error('Failed to create class template', classError);
          throw classError;
        }

        classId = newClass.id;
      }

      // Check if class instance already exists for this academic year
      const { data: existingInstance } = await supabase
        .from('class_instances')
        .select('id')
        .eq('class_id', classId)
        .eq('academic_year_id', input.academic_year_id)
        .eq('school_code', input.school_code);

      if (existingInstance && existingInstance.length > 0) {
        throw new Error('Class already exists for this academic year');
      }

      // Create class instance
      const { data, error: insertError } = await supabase
        .from('class_instances')
        .insert({
          class_id: classId,
          academic_year_id: input.academic_year_id,
          class_teacher_id: input.class_teacher_id,
          school_code: input.school_code,
          created_by: input.created_by,
          grade: Number(input.grade),
          section: input.section,
        })
        .select('id, class_id, class_teacher_id, created_by, school_code, created_at, academic_year_id, grade, section')
        .single();

      if (insertError) {
        log.error('Failed to create class instance', insertError);
        throw insertError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_instances', schoolCode] });
    },
  });
}

/**
 * Update a class instance
 */
export function useUpdateClassInstance(schoolCode: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateClassInstanceInput) => {
      log.info('Updating class instance', { id: input.id });

      const { error } = await supabase
        .from('class_instances')
        .update({
          grade: Number(input.grade),
          section: input.section,
          class_teacher_id: input.class_teacher_id,
        })
        .eq('id', input.id);

      if (error) {
        log.error('Failed to update class instance', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_instances', schoolCode] });
    },
  });
}

/**
 * Delete a class instance
 */
export function useDeleteClassInstance(schoolCode: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classId: string) => {
      log.info('Deleting class instance', { classId });

      const { error } = await supabase
        .from('class_instances')
        .delete()
        .eq('id', classId);

      if (error) {
        log.error('Failed to delete class instance', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_instances', schoolCode] });
    },
  });
}

