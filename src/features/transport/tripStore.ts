/**
 * Transport Management System - Trip State Store
 *
 * Zustand store with AsyncStorage persistence for trip lifecycle management.
 *
 * IMPORTANT: The background location task runs in a headless JS context where
 * Zustand is NOT available. The headless task reads/writes directly via AsyncStorage
 * using the same key (`@tms/trip-state`). This store is for the React UI only.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TripState, TripStatus, GpsPayload } from './types';
import { TMS_STORAGE_KEYS } from './types';

interface TripStoreActions {
  /** Mark trip as active with a generated ID */
  startTrip: () => void;
  /** Mark trip as stopping (while background task shuts down) */
  setStoppingTrip: () => void;
  /** Fully reset to idle state */
  stopTrip: () => void;
  /** Update the last known location from the background task */
  updateLastLocation: (location: GpsPayload) => void;
  /** Set a user-facing error message */
  setError: (message: string | null) => void;
}

type TripStore = TripState & TripStoreActions;

const initialState: TripState = {
  tripId: null,
  status: 'idle',
  startedAt: null,
  lastLocation: null,
  errorMessage: null,
};

export const useTripStore = create<TripStore>()(
  persist(
    (set) => ({
      ...initialState,

      startTrip: () =>
        set({
          tripId: generateTripId(),
          status: 'active',
          startedAt: new Date().toISOString(),
          lastLocation: null,
          errorMessage: null,
        }),

      setStoppingTrip: () =>
        set({ status: 'stopping' }),

      stopTrip: () =>
        set({ ...initialState }),

      updateLastLocation: (location: GpsPayload) =>
        set({ lastLocation: location }),

      setError: (message: string | null) =>
        set({ errorMessage: message }),
    }),
    {
      name: TMS_STORAGE_KEYS.TRIP_STATE,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist data fields, not action functions
      partialize: (state) => ({
        tripId: state.tripId,
        status: state.status,
        startedAt: state.startedAt,
        lastLocation: state.lastLocation,
        errorMessage: state.errorMessage,
      }),
    }
  )
);

/**
 * Generate a short unique trip ID.
 * Format: trip_<timestamp>_<random>
 */
function generateTripId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `trip_${ts}_${rand}`;
}

/**
 * Read trip state directly from AsyncStorage.
 * Used by the headless background task where Zustand is not available.
 */
export async function readTripStateFromStorage(): Promise<TripState | null> {
  try {
    const raw = await AsyncStorage.getItem(TMS_STORAGE_KEYS.TRIP_STATE);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    // Zustand persist wraps state in { state: {...}, version: 0 }
    const state = parsed?.state ?? parsed;

    if (!state || typeof state !== 'object') return null;

    return {
      tripId: state.tripId ?? null,
      status: state.status ?? 'idle',
      startedAt: state.startedAt ?? null,
      lastLocation: state.lastLocation ?? null,
      errorMessage: state.errorMessage ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Write the last location directly to AsyncStorage.
 * Used by the headless background task.
 */
export async function writeLastLocationToStorage(location: GpsPayload): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TMS_STORAGE_KEYS.TRIP_STATE);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? parsed;
    state.lastLocation = location;

    // Preserve the Zustand persist wrapper structure
    if (parsed?.state) {
      parsed.state = state;
      await AsyncStorage.setItem(TMS_STORAGE_KEYS.TRIP_STATE, JSON.stringify(parsed));
    } else {
      await AsyncStorage.setItem(TMS_STORAGE_KEYS.TRIP_STATE, JSON.stringify(state));
    }
  } catch {
    // Silently fail — non-critical for background operation
  }
}
