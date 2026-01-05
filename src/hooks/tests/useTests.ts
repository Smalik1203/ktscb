import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { TestInput, TestWithDetails } from '../../types/test.types';

export function useTests(schoolCode: string, classInstanceId?: string, options?: { limit?: number; offset?: number; test_mode?: 'online' | 'offline' }) {
  return useQuery({
    queryKey: ['tests', schoolCode, classInstanceId, options?.limit, options?.offset, options?.test_mode],
    queryFn: async () => {
      const tests = await api.tests.getWithStats(schoolCode, classInstanceId, options);
      return tests as TestWithDetails[];
    },
    enabled: !!schoolCode,
  });
}

export function useTest(testId: string) {
  return useQuery({
    queryKey: ['test', testId],
    queryFn: () => api.tests.getById(testId),
    enabled: !!testId,
  });
}

export function useCreateTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (testData: TestInput) => api.tests.create(testData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    },
  });
}

export function useUpdateTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, testData }: { testId: string; testData: Partial<TestInput> }) =>
      api.tests.update(testId, testData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['test', variables.testId] });
    },
  });
}

export function useDeleteTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (testId: string) => api.tests.delete(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    },
  });
}
