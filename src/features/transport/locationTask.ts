/**
 * Transport Management System - Background Location Task
 *
 * This file MUST be imported at the top level of the app entry point
 * (app/_layout.tsx) so the task is registered before any navigation renders.
 *
 * The task runs in a headless JS context — no React, no Zustand, no hooks.
 * It reads trip state and tokens directly from AsyncStorage.
 */

import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_TASK_NAME, TMS_STORAGE_KEYS } from './types';
import type { GpsPayload } from './types';
import { readTripStateFromStorage, writeLastLocationToStorage } from './tripStore';
import { sendGpsUpdate } from './gpsService';
import { enqueue } from './locationQueue';
import { log } from '../../lib/logger';

/**
 * Get the Supabase access token from AsyncStorage.
 * The Supabase client stores the session under 'cb-session-v1'.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('cb-session-v1');
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // Supabase session storage format varies by version:
    // v2 flat:     { access_token, refresh_token, ... }
    // v2 nested:   { currentSession: { access_token, ... } }
    // v2 alt:      { session: { access_token, ... } }
    const token =
      parsed?.access_token ??
      parsed?.currentSession?.access_token ??
      parsed?.session?.access_token ??
      null;

    if (typeof token !== 'string' || token.length === 0) return null;
    return token;
  } catch {
    return null;
  }
}

/**
 * Check if this location update is newer than the last one we sent,
 * to avoid sending duplicate data points.
 */
async function isNewerThanLastSent(timestamp: number): Promise<boolean> {
  try {
    const lastTs = await AsyncStorage.getItem(TMS_STORAGE_KEYS.LAST_SENT_TIMESTAMP);
    if (!lastTs) return true;
    return timestamp > Number(lastTs);
  } catch {
    return true; // If we can't read, assume it's newer
  }
}

async function setLastSentTimestamp(timestamp: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      TMS_STORAGE_KEYS.LAST_SENT_TIMESTAMP,
      String(timestamp)
    );
  } catch {
    // Non-critical
  }
}

// ---------- Task Definition ----------

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    log.error('[TMS Task] Location task error:', error.message);
    return;
  }

  if (!data) {
    log.warn('[TMS Task] No data received from location update');
    return;
  }

  try {
    // 1. Check trip is active
    const tripState = await readTripStateFromStorage();
    if (!tripState || tripState.status !== 'active') {
      log.warn('[TMS Task] Skipped — trip not active', { status: tripState?.status ?? 'no state' });
      return;
    }

    // 2. Extract location data
    const { locations } = data as {
      locations: Array<{
        coords: {
          latitude: number;
          longitude: number;
          speed: number | null;
          heading: number | null;
        };
        timestamp: number;
      }>;
    };

    if (!locations || locations.length === 0) {
      log.warn('[TMS Task] No locations in update');
      return;
    }

    // Use the most recent location
    const location = locations[locations.length - 1];
    const { coords, timestamp } = location;

    // 3. Deduplicate — skip if same or older timestamp
    const isNewer = await isNewerThanLastSent(timestamp);
    if (!isNewer) {
      log.warn('[TMS Task] Skipped — duplicate or older timestamp', { timestamp });
      return;
    }

    // 4. Build payload (attach trip_id so GPS logs are linked to the trip)
    // Guard against invalid timestamps
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      log.warn('[TMS Task] Invalid timestamp from location update:', timestamp);
      return;
    }

    const payload: GpsPayload = {
      lat: coords.latitude,
      lng: coords.longitude,
      speed: coords.speed,
      heading: coords.heading,
      recorded_at: date.toISOString(),
      ...(tripState.tripId ? { trip_id: tripState.tripId } : {}),
    };

    // 5. Update last known location in storage (for UI)
    await writeLastLocationToStorage(payload);

    // 6. Get auth token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      log.warn('[TMS Task] No access token — queuing payload for retry');
      await enqueue(payload);
      return;
    }

    // 7. Send to Edge Function
    const result = await sendGpsUpdate(payload, accessToken);

    if (result.success) {
      await setLastSentTimestamp(timestamp);
      log.debug('[TMS Task] GPS sent', { lat: payload.lat.toFixed(5), lng: payload.lng.toFixed(5) });
    } else {
      log.warn('[TMS Task] Send failed, queuing for retry:', result.error);
      await enqueue(payload);
    }
  } catch (taskError) {
    // NEVER let the task crash — it would stop background tracking
    log.error(
      '[TMS Task] Unhandled error:',
      taskError instanceof Error ? taskError.message : String(taskError)
    );
  }
});
