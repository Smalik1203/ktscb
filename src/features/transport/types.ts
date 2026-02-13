/**
 * Transport Management System - Type Definitions
 *
 * Shared types for the GPS tracking feature.
 * NO React imports allowed - these are pure data types.
 */

/**
 * GPS payload sent to the Supabase Edge Function.
 * The backend derives bus/driver identity from the JWT — never send bus_id from client.
 */
export interface GpsPayload {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  recorded_at: string; // ISO 8601
  trip_id?: string;    // Links to the trips table; omitted when not in a trip
}

/**
 * Trip lifecycle status.
 */
export type TripStatus = 'idle' | 'active' | 'stopping';

/**
 * Persisted trip state (stored in AsyncStorage for headless task access).
 */
export interface TripState {
  tripId: string | null;
  status: TripStatus;
  startedAt: string | null; // ISO 8601
  lastLocation: GpsPayload | null;
  errorMessage: string | null;
}

/**
 * Result of a GPS send attempt.
 */
export interface GpsSendResult {
  success: boolean;
  error?: string;
}

/**
 * Location permission status for the UI.
 */
export type PermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'denied_permanently'
  | 'gps_disabled';

/**
 * AsyncStorage keys used by the transport module.
 * Centralised here to prevent typos and make refactoring easy.
 */
export const TMS_STORAGE_KEYS = {
  TRIP_STATE: '@tms/trip-state',
  GPS_QUEUE: '@tms/gps-queue',
  LAST_SENT_TIMESTAMP: '@tms/last-sent-ts',
} as const;

/**
 * Background task name — must match between defineTask and startLocationUpdatesAsync.
 */
export const LOCATION_TASK_NAME = 'background-location-task';
