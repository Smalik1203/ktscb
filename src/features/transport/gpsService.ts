/**
 * Transport Management System - GPS Sending Service
 *
 * Handles sending GPS payloads to the Supabase Edge Function.
 * Used by both the background task and the offline queue flusher.
 */

import { z } from 'zod';
import type { GpsPayload, GpsSendResult } from './types';
import { log } from '../../lib/logger';

// ---------- Validation ----------

const gpsPayloadSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  recorded_at: z.string().min(1),
  trip_id: z.string().optional(),
});

/**
 * Validate a GPS payload before sending.
 * Returns null if valid, or an error message string.
 */
export function validatePayload(payload: GpsPayload): string | null {
  const result = gpsPayloadSchema.safeParse(payload);
  if (!result.success) {
    return result.error.issues.map((i) => i.message).join('; ');
  }
  return null;
}

// ---------- Environment ----------

function getBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is not configured');
  }
  return url;
}

// ---------- Send ----------

/**
 * Send a single GPS payload to the Supabase Edge Function.
 *
 * @param payload - The GPS data to send
 * @param accessToken - Supabase JWT access token (from `supabase.auth.getSession()`)
 * @returns Result indicating success or failure
 */
export async function sendGpsUpdate(
  payload: GpsPayload,
  accessToken: string
): Promise<GpsSendResult> {
  // Validate before sending
  const validationError = validatePayload(payload);
  if (validationError) {
    log.warn('[TMS] Invalid GPS payload, skipping send:', validationError);
    return { success: false, error: `Validation: ${validationError}` };
  }

  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/functions/v1/gps-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.speed,
        heading: payload.heading,
        recorded_at: payload.recorded_at,
        ...(payload.trip_id ? { trip_id: payload.trip_id } : {}),
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'No response body');
      const errorMsg = `HTTP ${response.status}: ${text.substring(0, 200)}`;
      log.warn('[TMS] GPS send failed:', errorMsg);
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown network error';
    log.warn('[TMS] GPS send error:', message);
    return { success: false, error: message };
  }
}

/**
 * Send a batch of GPS payloads sequentially.
 * Stops on first failure and returns the index that failed.
 */
export async function sendGpsBatch(
  payloads: GpsPayload[],
  accessToken: string
): Promise<{ sent: number; error?: string }> {
  let sent = 0;
  for (const payload of payloads) {
    const result = await sendGpsUpdate(payload, accessToken);
    if (!result.success) {
      return { sent, error: result.error };
    }
    sent++;
  }
  return { sent };
}
