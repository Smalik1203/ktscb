/**
 * Supabase Edge Function: create-driver
 *
 * Creates a new driver user atomically:
 * 1. Creates auth user
 * 2. Inserts into users table
 * 3. Inserts into drivers table
 *
 * Only callable by superadmin / admin for their school.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface CreateDriverPayload {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  school_code: string;
  license_number?: string;
  bus_id?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // 1. Verify caller JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const jwt = authHeader.replace('Bearer ', '');

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser(jwt);
    if (authError || !caller) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    // 2. Check caller is superadmin or admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: callerRecord } = await supabaseAdmin
      .from('users')
      .select('role, school_code')
      .eq('id', caller.id)
      .maybeSingle();

    if (!callerRecord || !['superadmin', 'admin', 'cb_admin'].includes(callerRecord.role)) {
      return jsonResponse({ error: 'Unauthorized: admin role required' }, 403);
    }

    // 3. Parse and validate payload
    let payload: CreateDriverPayload;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!payload.full_name || typeof payload.full_name !== 'string' || payload.full_name.trim().length === 0) {
      return jsonResponse({ error: 'full_name is required' }, 400);
    }
    if (!payload.email || typeof payload.email !== 'string' || !payload.email.includes('@')) {
      return jsonResponse({ error: 'Valid email is required' }, 400);
    }
    if (!payload.password || typeof payload.password !== 'string' || payload.password.length < 8) {
      return jsonResponse({ error: 'Password is required (min 8 characters)' }, 400);
    }

    // Use caller's school_code if not provided
    const schoolCode = payload.school_code || callerRecord.school_code;
    if (!schoolCode) {
      return jsonResponse({ error: 'school_code is required' }, 400);
    }

    // Ensure admin can only create drivers for their own school
    if (callerRecord.school_code && callerRecord.school_code !== schoolCode) {
      return jsonResponse({ error: 'Cannot create drivers for another school' }, 403);
    }

    // 4. Create auth user with the provided password
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.full_name.trim(),
        role: 'driver',
      },
    });

    if (createAuthError || !authData.user) {
      console.error('Auth user creation failed:', createAuthError?.message);
      return jsonResponse({ error: createAuthError?.message || 'Failed to create auth user' }, 400);
    }

    const newUserId = authData.user.id;

    // 6. Insert into users table
    const { error: usersError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        full_name: payload.full_name.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone?.trim() || null,
        role: 'driver',
        school_code: schoolCode,
      });

    if (usersError) {
      console.error('Users insert failed:', usersError.message);
      // Cleanup: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return jsonResponse({ error: 'Failed to create user profile' }, 500);
    }

    // 7. Insert into drivers table
    const { error: driversError } = await supabaseAdmin
      .from('drivers')
      .insert({
        id: newUserId,
        school_code: schoolCode,
        bus_id: payload.bus_id || null,
        license_number: payload.license_number?.trim() || null,
        phone: payload.phone?.trim() || null,
        is_active: true,
      });

    if (driversError) {
      console.error('Drivers insert failed:', driversError.message);
      // Cleanup: delete user record and auth user
      await supabaseAdmin.from('users').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return jsonResponse({ error: 'Failed to create driver record' }, 500);
    }

    // 8. Success
    return jsonResponse({
      success: true,
      driver: {
        id: newUserId,
        full_name: payload.full_name.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone?.trim() || null,
        school_code: schoolCode,
        bus_id: payload.bus_id || null,
        license_number: payload.license_number?.trim() || null,
      },
    });
  } catch (error) {
    console.error('Unexpected error in create-driver:', error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
