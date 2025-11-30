import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useClassResources(classId?: string, schoolCode?: string) {
  return useQuery({
    queryKey: ['resources', 'class', classId, schoolCode],
    queryFn: () => api.resources.getByClass(classId!, schoolCode),
    enabled: !!classId,
  });
}

export function useAllResources(schoolCode?: string, limit?: number) {
  return useQuery({
    queryKey: ['resources', 'school', schoolCode, limit],
    queryFn: () => api.resources.getAll(schoolCode!, limit),
    enabled: !!schoolCode,
    staleTime: 10 * 60 * 1000, // 10 minutes - resources don't change often
  });
}

export function useInfiniteResources(schoolCode?: string, pageSize: number = 20) {
  return useInfiniteQuery({
    queryKey: ['resources', 'school', 'infinite', schoolCode],
    queryFn: ({ pageParam }) => api.resources.getPaginated(schoolCode!, pageParam as number, pageSize),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length < pageSize) return undefined;
      return pages.length * pageSize;
    },
    enabled: !!schoolCode,
    staleTime: 10 * 60 * 1000,
  });
}
