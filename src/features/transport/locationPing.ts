/**
 * Transport Management System - Location Ping (Realtime Broadcast)
 *
 * Allows an admin to request a fresh GPS update from a driver.
 * Uses Supabase Realtime broadcast — no extra tables needed.
 *
 * Flow:
 *   Admin → sendLocationPing(driverId) → Realtime broadcast
 *   Driver → useLocationPingListener(driverId, onPing) → captures GPS → sends to edge function
 */

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { sendGpsUpdate } from './gpsService';
import { useTripStore } from './tripStore';
import { writeLastLocationToStorage } from './tripStore';
import { log } from '../../lib/logger';
import type { GpsPayload } from './types';

const CHANNEL_PREFIX = 'location-ping';

// ---------- Admin side: send a ping ----------

/**
 * Send a location request ping to a specific driver.
 * The driver's app (if in foreground) will respond with a fresh GPS update.
 */
export async function sendLocationPing(driverId: string): Promise<void> {
  const channel = supabase.channel(`${CHANNEL_PREFIX}:${driverId}`);

  await channel.subscribe();

  await channel.send({
    type: 'broadcast',
    event: 'location-request',
    payload: { requested_at: new Date().toISOString() },
  });

  // Clean up — we only needed to send one message
  setTimeout(() => {
    supabase.removeChannel(channel);
  }, 2000);

  log.info(`[TMS] Location ping sent to driver ${driverId}`);
}

// ---------- Driver side: listen for pings ----------

/**
 * Hook that listens for location ping requests from admins.
 * When a ping arrives, immediately captures the current GPS position
 * and sends it to the edge function.
 *
 * Only active when the driver has an active trip.
 */
export function useLocationPingListener(driverId: string | undefined) {
  const respondingRef = useRef(false);

  useEffect(() => {
    if (!driverId) return;

    const channelName = `${CHANNEL_PREFIX}:${driverId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'location-request' }, async () => {
        // Prevent concurrent responses
        if (respondingRef.current) return;
        respondingRef.current = true;

        log.info('[TMS] Received location ping — capturing fresh position');

        try {
          // 1. Grab current location immediately
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const { latitude, longitude, speed, heading } = location.coords;
          const recorded_at = new Date(location.timestamp).toISOString();

          // 2. Get trip state for trip_id
          const tripState = useTripStore.getState();

          const payload: GpsPayload = {
            lat: latitude,
            lng: longitude,
            speed: speed ?? null,
            heading: heading ?? null,
            recorded_at,
            ...(tripState.tripId ? { trip_id: tripState.tripId } : {}),
          };

          // 3. Update local UI
          await writeLastLocationToStorage(payload);
          useTripStore.getState().updateLastLocation(payload);

          // 4. Send to edge function
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          if (token) {
            const result = await sendGpsUpdate(payload, token);
            if (result.success) {
              log.info('[TMS] Ping response sent successfully');
            } else {
              log.warn('[TMS] Ping response send failed:', result.error);
            }
          }
        } catch (err) {
          log.warn('[TMS] Failed to respond to location ping:', err);
        } finally {
          respondingRef.current = false;
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);
}
