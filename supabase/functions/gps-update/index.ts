/**
 * Supabase Edge Function: gps-update
 *
 * Receives GPS location updates from the driver app and inserts them into
 * the `gps_logs` table. The driver's identity (and therefore their assigned
 * bus) is derived from the JWT — the client never sends a bus_id.
 *
 * Endpoint: POST /functions/v1/gps-update
 * Auth:     Bearer <supabase access token>
 *
 * Request body:
 *   { lat: number, lng: number, speed: number|null, heading: number|null, recorded_at: string, trip_id?: string }
 *
 * Response:
 *   200 { success: true }
 *   400 { error: string }  — invalid payload
 *   401 { error: string }  — missing/invalid JWT
 *   500 { error: string }  — server error
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ---------- Types ----------

interface GpsPayload {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
  trip_id: string | null;
}

// ---------- Validation ----------

function validatePayload(body: unknown): { valid: true; data: GpsPayload } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { lat, lng, speed, heading, recorded_at, trip_id } = body as Record<string, unknown>;

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return { valid: false, error: 'lat must be a number between -90 and 90' };
  }
  if (typeof lng !== 'number' || lng < -180 || lng > 180) {
    return { valid: false, error: 'lng must be a number between -180 and 180' };
  }
  if (speed !== null && typeof speed !== 'number') {
    return { valid: false, error: 'speed must be a number or null' };
  }
  if (heading !== null && typeof heading !== 'number') {
    return { valid: false, error: 'heading must be a number or null' };
  }
  if (typeof recorded_at !== 'string' || recorded_at.length === 0) {
    return { valid: false, error: 'recorded_at must be a non-empty ISO 8601 string' };
  }
  if (trip_id !== undefined && trip_id !== null && typeof trip_id !== 'string') {
    return { valid: false, error: 'trip_id must be a string or null' };
  }

  // Validate timestamp is parseable
  const ts = new Date(recorded_at);
  if (isNaN(ts.getTime())) {
    return { valid: false, error: 'recorded_at is not a valid date' };
  }

  return {
    valid: true,
    data: {
      lat: lat as number,
      lng: lng as number,
      speed: (speed as number | null) ?? null,
      heading: (heading as number | null) ?? null,
      recorded_at: ts.toISOString(),
      trip_id: (typeof trip_id === 'string' && trip_id.length > 0) ? trip_id : null,
    },
  };
}

// ---------- CORS ----------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------- Handler ----------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Create a Supabase client scoped to the user's JWT
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      }
    );

    // Verify the token and get the user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validatePayload(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = validation.data;

    // 3. Use service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 4. Look up the driver's user record and school_code
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role, school_code')
      .eq('id', user.id)
      .maybeSingle();

    if (userError || !userRecord) {
      console.error('User lookup failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Insert GPS log (trip_id is nullable — only set when the client sends it)
    const { error: insertError } = await supabaseAdmin
      .from('gps_logs')
      .insert({
        driver_id: user.id,
        trip_id: payload.trip_id,
        school_code: userRecord.school_code,
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.speed,
        heading: payload.heading,
        recorded_at: payload.recorded_at,
      });

    if (insertError) {
      console.error('GPS log insert failed:', insertError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to save GPS data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Success
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in gps-update:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
