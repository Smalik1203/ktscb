import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface UserActivityStats {
  students: {
    total: number;
    withAccount: number;
    noAccount: number;
    active: number;       // Logged in within 7 days
    inactive: number;     // Logged in 7-30 days ago
    dormant: number;      // Logged in >30 days ago
    neverLoggedIn: number;
  };
  admins: {
    total: number;
    withAccount: number;
    noAccount: number;
    active: number;
    inactive: number;
    dormant: number;
    neverLoggedIn: number;
  };
  recentLogins: {
    id: string;
    name: string;
    user_type: 'student' | 'admin';
    last_sign_in: string;
  }[];
}

export function useUserActivityStats(schoolCode: string | null | undefined) {
  return useQuery({
    queryKey: ['user-activity-stats', schoolCode],
    queryFn: async (): Promise<UserActivityStats> => {
      if (!schoolCode) throw new Error('No school code');

      // Call the database function (using type assertion as function may not be in generated types)
      const { data, error } = await (supabase as any).rpc('get_user_activity_stats', {
        p_school_code: schoolCode,
      });

      if (error) {
        throw error;
      }

      // Return the data with proper defaults
      return {
        students: {
          total: data?.students?.total || 0,
          withAccount: data?.students?.withAccount || 0,
          noAccount: data?.students?.noAccount || 0,
          active: data?.students?.active || 0,
          inactive: data?.students?.inactive || 0,
          dormant: data?.students?.dormant || 0,
          neverLoggedIn: data?.students?.neverLoggedIn || 0,
        },
        admins: {
          total: data?.admins?.total || 0,
          withAccount: data?.admins?.withAccount || 0,
          noAccount: data?.admins?.noAccount || 0,
          active: data?.admins?.active || 0,
          inactive: data?.admins?.inactive || 0,
          dormant: data?.admins?.dormant || 0,
          neverLoggedIn: data?.admins?.neverLoggedIn || 0,
        },
        recentLogins: data?.recentLogins || [],
      };
    },
    enabled: !!schoolCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
