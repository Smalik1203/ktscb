/**
 * Transport Management System - Trip Manager Hook
 *
 * React hook that orchestrates:
 * - Location permission requests
 * - Starting / stopping background location tracking
 * - Trip state via Zustand store
 * - Offline queue monitoring & flushing
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { LOCATION_TASK_NAME } from './types';
import type { PermissionStatus as TmsPermissionStatus, TripStatus } from './types';
import { useTripStore } from './tripStore';
import { flush as flushQueue, getQueueSize } from './locationQueue';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { log } from '../../lib/logger';

// ---------- Types ----------

interface TripManagerReturn {
  /** Current trip status */
  status: TripStatus;
  /** User-facing error message */
  error: string | null;
  /** ISO timestamp when the current trip started */
  startedAt: string | null;
  /** Active trip ID */
  tripId: string | null;
  /** Driver's assigned bus ID */
  busId: string | null;
  /** Last known GPS coordinates with speed */
  lastLocation: {
    lat: number;
    lng: number;
    speed: number | null;
    heading: number | null;
    recorded_at: string;
  } | null;
  /** Number of payloads waiting in offline queue */
  queueSize: number;
  /** Whether a start/stop operation is in progress */
  loading: boolean;
  /** Permission status for display */
  permissionStatus: TmsPermissionStatus;
  /** Start a new trip */
  startTrip: () => Promise<void>;
  /** Stop the current trip */
  stopTrip: () => Promise<void>;
  /** Open device settings for granting permissions */
  openSettings: () => void;
}

// ---------- Hook ----------

export function useTripManager(): TripManagerReturn {
  const store = useTripStore();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [busId, setBusId] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<TmsPermissionStatus>('undetermined');

  // Prevent double-start
  const startingRef = useRef(false);

  // ---------- Fetch driver's bus ID ----------

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    const fetchBusId = async () => {
      try {
        const { data } = await supabase
          .from('drivers')
          .select('bus_id')
          .eq('id', user.id)
          .single();
        if (mounted && data?.bus_id) {
          setBusId(data.bus_id);
        }
      } catch {
        // Non-critical — pickup checklist will show empty
      }
    };
    fetchBusId();
    return () => { mounted = false; };
  }, [user?.id]);

  // ---------- Queue polling ----------

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const size = await getQueueSize();
      if (mounted) setQueueSize(size);
    };
    poll();
    const interval = setInterval(poll, 10_000); // every 10s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // ---------- Restore on mount ----------

  useEffect(() => {
    // Zustand persist handles rehydration automatically.
    // We just need to sync the background task state with the store.
    const syncTaskState = async () => {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(
          LOCATION_TASK_NAME
        );
        if (store.status === 'active' && !isRegistered) {
          // Store says active but task isn't running — clean up
          log.warn('[TMS] Trip state active but task not registered — resetting');
          store.stopTrip();
        }
      } catch {
        // TaskManager may not be available in all contexts
      }
    };
    syncTaskState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Permissions ----------

  /** Open the app's own location permission settings page (Android) */
  const openAppLocationSettings = useCallback(() => {
    if (Platform.OS === 'android') {
      const pkg = Constants.expoConfig?.android?.package ?? 'com.kts.mobile';
      IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: `package:${pkg}` }
      ).catch(() => Linking.openSettings());
    } else {
      Linking.openSettings();
    }
  }, []);

  const checkAndRequestPermissions =
    useCallback(async (): Promise<boolean> => {
      try {
        // 1. Check if GPS is on
        const isEnabled = await Location.hasServicesEnabledAsync();
        log.info('[TMS] GPS enabled:', isEnabled);
        if (!isEnabled) {
          setPermissionStatus('gps_disabled');
          store.setError(
            'Location services are turned off. Please enable GPS in your device settings.'
          );
          return false;
        }

        // 2. Request foreground permission
        const { status: fgStatus } =
          await Location.requestForegroundPermissionsAsync();
        log.info('[TMS] FG permission result:', fgStatus);

        if (fgStatus !== 'granted') {
          const { canAskAgain } =
            await Location.getForegroundPermissionsAsync();
          setPermissionStatus(canAskAgain ? 'denied' : 'denied_permanently');
          store.setError(
            canAskAgain
              ? 'Location permission is required to track your trip. Please grant access.'
              : 'Location permission was permanently denied. Please enable it in Settings.'
          );
          return false;
        }

        // 3. Check if background is already granted
        const currentBg = await Location.getBackgroundPermissionsAsync();
        log.info('[TMS] Current BG permission:', currentBg.status);

        if (currentBg.status === 'granted') {
          log.info('[TMS] BG permission already granted');
          setPermissionStatus('granted');
          store.setError(null);
          return true;
        }

        // 4. Try requesting background permission
        //    Wrap in its own try/catch because this throws on some Android devices
        let bgGranted = false;
        try {
          const { status: bgStatus } =
            await Location.requestBackgroundPermissionsAsync();
          log.info('[TMS] BG permission result:', bgStatus);
          bgGranted = bgStatus === 'granted';

          // Double-check — some devices report wrong on first call
          if (!bgGranted) {
            const recheck = await Location.getBackgroundPermissionsAsync();
            bgGranted = recheck.status === 'granted';
            log.info('[TMS] BG recheck:', recheck.status);
          }
        } catch (bgError) {
          log.warn('[TMS] BG permission request threw:', bgError);
          // Fall through — will prompt user to open settings
        }

        if (bgGranted) {
          setPermissionStatus('granted');
          store.setError(null);
          return true;
        }

        // 5. Background not granted — prompt user to open settings manually
        setPermissionStatus('denied');
        store.setError(
          'Background location is required. Please tap "Open Settings" and set Location to "Allow all the time".'
        );

        // Show an alert with a button to open settings
        Alert.alert(
          'Background Location Required',
          'This app needs "Allow all the time" location access to track the bus while the screen is off.\n\nTap "Open Settings", then go to Permissions > Location > Allow all the time.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openAppLocationSettings },
          ]
        );

        return false;
      } catch (error) {
        log.error('[TMS] Permission error:', error);
        store.setError(
          `Permission error: ${error instanceof Error ? error.message : 'Unknown'}. Tap below to open Settings.`
        );
        setPermissionStatus('denied_permanently');
        return false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openAppLocationSettings]);

  // ---------- Start Trip ----------

  const startTrip = useCallback(async () => {
    if (startingRef.current || store.status === 'active') {
      log.warn('[TMS] Start trip called while already active or starting');
      return;
    }

    startingRef.current = true;
    setLoading(true);
    store.setError(null);

    try {
      // 1. Permissions
      const hasPermission = await checkAndRequestPermissions();
      if (!hasPermission) {
        return;
      }

      // 2. Ensure no duplicate task
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        LOCATION_TASK_NAME
      );
      if (isRegistered) {
        log.warn('[TMS] Task already registered — stopping before restart');
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      // 3. Update store (persists to AsyncStorage for headless task)
      store.startTrip();

      // 4. Create trip record in Supabase
      const tripState = useTripStore.getState();
      if (tripState.tripId && user?.id && profile?.school_code) {
        const { error: tripInsertError } = await supabase
          .from('trips')
          .insert({
            id: tripState.tripId,
            driver_id: user.id,
            school_code: profile.school_code,
            started_at: tripState.startedAt,
            status: 'active',
          });

        if (tripInsertError) {
          // Log but don't block — local tracking still works
          log.warn('[TMS] Failed to create server trip record:', tripInsertError.message);
        }
      }

      // 5. Start background location updates
      //
      // distanceInterval: 0 ensures updates keep coming even when the bus is
      // stationary (at a stop, in traffic, etc.). Without this, Android requires
      // the device to move N metres before firing the next update, which causes
      // the admin to see "Xm ago" growing while the bus is just sitting still.
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15_000, // ~15 seconds
        distanceInterval: 0,  // send updates even when stationary
        deferredUpdatesInterval: 15_000,
        showsBackgroundLocationIndicator: true, // iOS
        foregroundService: {
          notificationTitle: 'Trip Active',
          notificationBody: 'Live location tracking is running',
          notificationColor: '#6B3FA0',
        },
        // Android: keep the task alive even when screen is off
        ...(Platform.OS === 'android' && {
          pausesUpdatesAutomatically: false,
        }),
      });

      log.info('[TMS] Background location tracking started');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start location tracking';
      log.error('[TMS] Start trip error:', message);
      store.setError(message);
      store.stopTrip(); // Reset state on failure
    } finally {
      setLoading(false);
      startingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.status, checkAndRequestPermissions]);

  // ---------- Stop Trip ----------

  const stopTrip = useCallback(async () => {
    if (store.status === 'idle') {
      log.warn('[TMS] Stop trip called while already idle');
      return;
    }

    setLoading(true);
    store.setStoppingTrip();

    try {
      // 1. Close trip in Supabase (before clearing local state)
      const currentTripId = store.tripId;
      if (currentTripId) {
        const { error: tripUpdateError } = await supabase
          .from('trips')
          .update({
            ended_at: new Date().toISOString(),
            status: 'completed',
          })
          .eq('id', currentTripId);

        if (tripUpdateError) {
          log.warn('[TMS] Failed to close server trip record:', tripUpdateError.message);
        }
      }

      // 2. Stop the background task
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        LOCATION_TASK_NAME
      );
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        log.info('[TMS] Background location tracking stopped');
      }

      // 3. Flush offline queue
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          const sent = await flushQueue(token);
          if (sent > 0) {
            log.info(`[TMS] Flushed ${sent} queued GPS updates on stop`);
          }
        }
      } catch (flushError) {
        log.warn('[TMS] Queue flush on stop failed:', flushError);
        // Non-fatal — queue will be flushed next time
      }

      // 4. Reset store
      store.stopTrip();
      setQueueSize(await getQueueSize());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to stop location tracking';
      log.error('[TMS] Stop trip error:', message);
      store.setError(message);
      // Still reset to idle even on error — better than being stuck in 'stopping'
      store.stopTrip();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.status]);

  // ---------- Settings ----------

  const openSettings = useCallback(() => {
    openAppLocationSettings();
  }, [openAppLocationSettings]);

  // ---------- Return ----------

  return {
    status: store.status,
    error: store.errorMessage,
    startedAt: store.startedAt,
    tripId: store.tripId,
    busId,
    lastLocation: store.lastLocation
      ? {
          lat: store.lastLocation.lat,
          lng: store.lastLocation.lng,
          speed: store.lastLocation.speed,
          heading: store.lastLocation.heading,
          recorded_at: store.lastLocation.recorded_at,
        }
      : null,
    queueSize,
    loading,
    permissionStatus,
    startTrip,
    stopTrip,
    openSettings,
  };
}
