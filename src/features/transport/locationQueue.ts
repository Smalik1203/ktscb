/**
 * Transport Management System - Offline GPS Queue
 *
 * When GPS payloads fail to send (network down, server error), they are
 * enqueued here and retried later with exponential backoff.
 *
 * Storage: AsyncStorage under `@tms/gps-queue`
 * Max queue size: 500 entries (oldest dropped if exceeded)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GpsPayload } from './types';
import { TMS_STORAGE_KEYS } from './types';
import { sendGpsUpdate } from './gpsService';
import { log } from '../../lib/logger';

const MAX_QUEUE_SIZE = 500;
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s, 8s, 16s

// ---------- Queue CRUD ----------

/**
 * Read the current queue from AsyncStorage.
 */
async function readQueue(): Promise<GpsPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(TMS_STORAGE_KEYS.GPS_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Write the queue back to AsyncStorage.
 */
async function writeQueue(queue: GpsPayload[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      TMS_STORAGE_KEYS.GPS_QUEUE,
      JSON.stringify(queue)
    );
  } catch (error) {
    log.error('[TMS Queue] Failed to persist queue:', error);
  }
}

// ---------- Public API ----------

/**
 * Add a failed payload to the offline queue.
 * If the queue exceeds MAX_QUEUE_SIZE, the oldest entries are dropped.
 */
export async function enqueue(payload: GpsPayload): Promise<void> {
  try {
    const queue = await readQueue();
    queue.push(payload);

    // Drop oldest entries if over capacity
    if (queue.length > MAX_QUEUE_SIZE) {
      const dropped = queue.length - MAX_QUEUE_SIZE;
      queue.splice(0, dropped);
      log.warn(`[TMS Queue] Queue overflow — dropped ${dropped} oldest entries`);
    }

    await writeQueue(queue);
  } catch (error) {
    log.error('[TMS Queue] Enqueue failed:', error);
  }
}

/**
 * Get the number of queued payloads.
 */
export async function getQueueSize(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

/**
 * Clear the entire queue.
 */
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TMS_STORAGE_KEYS.GPS_QUEUE);
  } catch (error) {
    log.error('[TMS Queue] Clear failed:', error);
  }
}

/**
 * Flush the offline queue by sending all pending payloads.
 *
 * - Sends in order (oldest first)
 * - Uses exponential backoff on failure
 * - Stops after MAX_RETRIES consecutive failures
 * - Removes successfully sent entries from the queue
 *
 * @param accessToken - Supabase JWT for authorization
 * @returns Number of payloads successfully sent
 */
export async function flush(accessToken: string): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  log.info(`[TMS Queue] Flushing ${queue.length} queued GPS payloads`);

  let sent = 0;
  let consecutiveFailures = 0;
  const failedPayloads: GpsPayload[] = [];

  for (let i = 0; i < queue.length; i++) {
    const payload = queue[i];

    const result = await sendGpsUpdate(payload, accessToken);

    if (result.success) {
      sent++;
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
      failedPayloads.push(payload);

      if (consecutiveFailures >= MAX_RETRIES) {
        log.warn(
          `[TMS Queue] Stopping flush after ${MAX_RETRIES} consecutive failures`
        );
        // Keep failed payloads + remaining unsent payloads in the queue
        const remaining = [...failedPayloads, ...queue.slice(i + 1)];
        await writeQueue(remaining);
        return sent;
      }

      // Exponential backoff before retrying the next item
      const delay = BASE_DELAY_MS * Math.pow(2, consecutiveFailures - 1);
      await sleep(delay);
    }
  }

  // If everything was sent, clear the queue
  if (failedPayloads.length === 0) {
    await clearQueue();
  } else {
    // Some failed but we didn't hit MAX_RETRIES — keep the failed ones
    await writeQueue(failedPayloads);
  }

  log.info(`[TMS Queue] Flush complete — sent ${sent}/${queue.length}`);
  return sent;
}

// ---------- Helpers ----------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
