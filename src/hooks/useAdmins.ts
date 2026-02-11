import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';
import { DB } from '../types/db.constants';

type Admin = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  admin_code: string;
  school_code: string;
  school_name: string;
  created_at: string;
};

export interface AdminsPaginationResult {
  data: Admin[];
  total: number;
  page: number;
  pageSize: number;
}

type CreateAdminInput = {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  admin_code: string;
};

type UpdateAdminInput = {
  id: string;
  full_name: string;
  phone: string;
  admin_code: string;
};

/**
 * Fetch all admins for a specific school with pagination
 */
export function useAdmins(
  schoolCode: string | null | undefined,
  options?: { page?: number; pageSize?: number; search?: string }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const search = options?.search?.trim();
  
  return useQuery<AdminsPaginationResult>({
    queryKey: ['admins', schoolCode, page, pageSize, search],
    queryFn: async () => {
      if (!schoolCode) {
        return { data: [], total: 0, page, pageSize };
      }

      log.info('Fetching admins', { schoolCode });

      // Get total count - try admin table first
      let adminCountQuery = supabase
        .from(DB.tables.admin)
        .select('id', { count: 'exact', head: true })
        .eq(DB.columns.schoolCode, schoolCode)
        .eq('role', 'admin');

      if (search) {
        const filter = [
          `full_name.ilike.%${search}%`,
          `email.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
          `admin_code.ilike.%${search}%`,
        ].join(',');
        adminCountQuery = adminCountQuery.or(filter);
      }

      const { count: adminCount, error: adminCountError } = await adminCountQuery;

      let totalCount = 0;
      let useAdminTable = false;

      if (!adminCountError && adminCount !== null) {
        totalCount = adminCount;
        useAdminTable = true;
      } else {
        // Fallback to users table for count
        let usersCountQuery = supabase
          .from(DB.tables.users)
          .select('id', { count: 'exact', head: true })
          .eq(DB.columns.schoolCode, schoolCode)
          .eq('role', 'admin');

        if (search) {
          const filter = [
            `full_name.ilike.%${search}%`,
            `email.ilike.%${search}%`,
            `phone.ilike.%${search}%`,
            `admin_code.ilike.%${search}%`,
          ].join(',');
          usersCountQuery = usersCountQuery.or(filter);
        }

        const { count: usersCount, error: usersCountError } = await usersCountQuery;

        if (usersCountError) {
          log.error('Failed to fetch admin count', usersCountError);
          throw usersCountError;
        }

        totalCount = usersCount || 0;
      }

      // Fetch paginated data
      if (useAdminTable) {
        let adminDataQuery = supabase
          .from(DB.tables.admin)
          .select('id, full_name, email, phone, role, admin_code, school_code, school_name, created_at')
          .eq(DB.columns.schoolCode, schoolCode)
          .eq('role', 'admin')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (search) {
          const filter = [
            `full_name.ilike.%${search}%`,
            `email.ilike.%${search}%`,
            `phone.ilike.%${search}%`,
            `admin_code.ilike.%${search}%`,
          ].join(',');
          adminDataQuery = adminDataQuery.or(filter);
        }

        const { data: adminData, error: adminError } = await adminDataQuery;

        if (!adminError && adminData) {
          return {
            data: adminData.map((admin: any) => ({
              id: admin.id,
              full_name: admin.full_name,
              email: admin.email,
              phone: String(admin.phone || ''),
              role: admin.role,
              admin_code: admin.admin_code || '',
              school_code: admin.school_code,
              school_name: admin.school_name || '',
              created_at: admin.created_at,
            })) as Admin[],
            total: totalCount,
            page,
            pageSize,
          };
        }
      }

      // Fallback to users table
      let usersDataQuery = supabase
        .from(DB.tables.users)
        .select('id, full_name, email, phone, role, admin_code, school_code, school_name, created_at')
        .eq(DB.columns.schoolCode, schoolCode)
        .eq('role', 'admin')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search) {
        const filter = [
          `full_name.ilike.%${search}%`,
          `email.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
          `admin_code.ilike.%${search}%`,
        ].join(',');
        usersDataQuery = usersDataQuery.or(filter);
      }

      const { data: usersData, error: usersError } = await usersDataQuery;

      if (usersError) {
        log.error('Failed to fetch admins', usersError);
        throw usersError;
      }

      return {
        data: (usersData || []).map((admin: any) => ({
          id: admin.id,
          full_name: admin.full_name,
          email: admin.email,
          phone: String(admin.phone || ''),
          role: admin.role,
          admin_code: admin.admin_code || '',
          school_code: admin.school_code,
          school_name: admin.school_name || '',
          created_at: admin.created_at,
        })) as Admin[],
        total: totalCount,
        page,
        pageSize,
      };
    },
    enabled: !!schoolCode,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Create a new admin via Edge Function
 */
export function useCreateAdmin(schoolCode: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAdminInput) => {
      const startTime = Date.now();
      
      log.debug('Creating admin - starting request', {
        email: input.email,
        schoolCode,
        adminCode: input.admin_code,
      });
      
      if (!schoolCode) {
        log.error('School code is missing for admin creation');
        throw new Error('School code is required');
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        log.error('Failed to get session for admin creation', sessionError);
        throw new Error('Failed to get session: ' + sessionError.message);
      }
      
      const token = session?.access_token;

      if (!token) {
        log.error('No auth token found for admin creation', { hasSession: !!session });
        throw new Error('Not authenticated. Please log in.');
      }

      log.debug('Auth token obtained for admin creation', {
        userId: session.user?.id,
        userEmail: session.user?.email,
      });

      // Runtime-safe: validate env var exists
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.trim() === '') {
        throw new Error('Supabase configuration is missing. Please restart the app.');
      }
      const url = `${supabaseUrl}/functions/v1/create-admin`;
      const requestBody = {
        full_name: input.full_name,
        email: input.email,
        password: input.password,
        phone: input.phone,
        role: 'admin',
        admin_code: input.admin_code,
      };

      log.info('Creating admin via Edge Function', { email: input.email, url });

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        log.debug('Admin creation response received', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });
      } catch (fetchError: any) {
        log.error('Network error during admin creation', {
          name: fetchError.name,
          message: fetchError.message,
        });
        throw new Error('Network request failed: ' + fetchError.message);
      }

      let result;
      try {
        const responseText = await response.text();
        log.debug('Parsing admin creation response', { responseLength: responseText.length });
        
        // Validate response is not empty before parsing
        if (!responseText || responseText.trim().length === 0) {
          throw new Error('Empty response from server');
        }
        
        result = JSON.parse(responseText);
      } catch (parseError: any) {
        log.error('Failed to parse admin creation response', {
          name: parseError.name,
          message: parseError.message,
        });
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        log.error('Admin creation request failed', {
          status: response.status,
          statusText: response.statusText,
          error: result.error,
          details: result.details,
        });
        
        const errorMessage = result.error || result.details || 'Failed to create admin';
        throw new Error(errorMessage);
      }

      const duration = Date.now() - startTime;
      log.info('Admin created successfully', {
        email: input.email,
        duration: `${duration}ms`,
      });

      return result;
    },
    onSuccess: (data) => {
      log.debug('Admin creation mutation succeeded', { hasData: !!data });
      queryClient.invalidateQueries({ queryKey: ['admins', schoolCode] });
    },
    onError: (error: any) => {
      log.error('Admin creation mutation failed', {
        name: error.name,
        message: error.message,
      });
    },
  });
}

/**
 * Update an existing admin
 */
export function useUpdateAdmin(schoolCode: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAdminInput) => {
      log.info('Updating admin', { adminId: input.id });

      // Try admin table first
      const { error: adminError } = await supabase
        .from('admin')
        .update({
          full_name: input.full_name,
          phone: Number(input.phone) || 0,
          admin_code: input.admin_code,
        })
        .eq('id', input.id);

      if (!adminError) {
        return;
      }

      // Fallback to users table
      const { error: usersError } = await supabase
        .from('users')
        .update({
          full_name: input.full_name,
          phone: input.phone,
          admin_code: input.admin_code,
        })
        .eq('id', input.id);

      if (usersError) {
        log.error('Failed to update admin', usersError);
        throw usersError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins', schoolCode] });
    },
  });
}

/**
 * Delete an admin via Edge Function
 */
export function useDeleteAdmin(schoolCode: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      log.info('Deleting admin', { userId });

      // Runtime-safe: validate env var exists
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.trim() === '') {
        throw new Error('Supabase configuration is missing. Please restart the app.');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-admin`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete admin');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins', schoolCode] });
    },
  });
}

