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

export function useTripManager(): TripManagerReturn {
  const store = useTripStore();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [busId, setBusId] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<TmsPermissionStatus>('undetermined');

  const startingRef = useRef(false);
  const busIdRef = useRef<string | null>(null);

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
          busIdRef.current = data.bus_id;
        }
      } catch {}
    };
    fetchBusId();
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Flush any GPS data queued before a crash/restart
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) await flushQueue(token);
      } catch {
        // Non-critical — will retry on next poll
      }

      const size = await getQueueSize();
      if (mounted) setQueueSize(size);
    };
    init();

    const interval = setInterval(async () => {
      const size = await getQueueSize();
      if (mounted) setQueueSize(size);
    }, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const recoveryDone = useRef(false);

  useEffect(() => {
    if (store.status !== 'active' || recoveryDone.current) return;
    if (!user?.id) return; // Wait for auth

    let cancelled = false;

    const recover = async () => {
      try {
        const isRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isRunning || cancelled) return; // Background task is alive — nothing to recover

        recoveryDone.current = true;
        const tripId = store.tripId;
        if (!tripId) { store.stopTrip(); return; }

        // Check server trip status
        const { data } = await supabase
          .from('trips')
          .select('status')
          .eq('id', tripId)
          .single();

        if (cancelled) return;

        if (!data || data.status !== 'active') {
          // Server already ended this trip (auto-timeout or manual)
          log.info('[TMS] Interrupted trip was already ended server-side. Cleaning up.');
          store.stopTrip();
          return;
        }

        // Trip is still active on server — ask the driver
        Alert.alert(
          'Interrupted Trip',
          'Your previous trip was interrupted (app closed or phone restarted). What would you like to do?',
          [
            {
              text: 'End Trip',
              style: 'destructive',
              onPress: async () => {
                try {
                  await supabase
                    .from('trips')
                    .update({ status: 'completed', ended_at: new Date().toISOString() })
                    .eq('id', tripId);

                  // Broadcast trip-ended so viewers update instantly
                  if (profile?.school_code && user?.id) {
                    try {
                      const ch = supabase.channel(`buses:${profile.school_code}`);
                      await ch.httpSend('trip-ended', {
                        driver_id: user.id,
                        trip_id: tripId,
                      });
                      supabase.removeChannel(ch);
                    } catch {
                      // Best-effort
                    }
                  }

                  // Notify parents — use ref to avoid stale closure
                  if (busIdRef.current) {
                    supabase.functions.invoke('notify-bus-trip', {
                      body: { bus_id: busIdRef.current, trip_id: tripId, event: 'trip_ended' },
                    }).catch(() => {});
                  }
                } catch (err) {
                  log.error('[TMS] Failed to end interrupted trip:', err);
                } finally {
                  store.stopTrip();
                }
              },
            },
            {
              text: 'Resume Trip',
              onPress: async () => {
                try {
                  const hasPermission = await checkAndRequestPermissions();
                  if (!hasPermission) {
                    log.warn('[TMS] Cannot resume — no permission. Ending trip.');
                    store.stopTrip();
                    return;
                  }
                  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 10_000,
                    distanceInterval: 0,
                    deferredUpdatesInterval: 10_000,
                    showsBackgroundLocationIndicator: true,
                    foregroundService: {
                      notificationTitle: 'Trip Active',
                      notificationBody: 'Live location tracking is running',
                      notificationColor: '#6B3FA0',
                    },
                    ...(Platform.OS === 'android' && {
                      pausesUpdatesAutomatically: false,
                    }),
                  });
                  log.info('[TMS] Resumed interrupted trip successfully');
                } catch (err) {
                  log.error('[TMS] Failed to resume trip:', err);
                  store.stopTrip();
                }
              },
            },
          ],
          { cancelable: false },
        );
      } catch {
        // TaskManager not available or other error — clean up
        if (!cancelled) store.stopTrip();
      }
    };

    recover();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, store.status]);

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

        if (currentBg.status === 'granted') {
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
          bgGranted = bgStatus === 'granted';

          // Double-check — some devices report wrong on first call
          if (!bgGranted) {
            const recheck = await Location.getBackgroundPermissionsAsync();
            bgGranted = recheck.status === 'granted';
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
        } else {
          // Broadcast trip-started so viewers see the bus appear instantly
          // Uses httpSend — one-shot HTTP broadcast, no WebSocket subscription needed
          try {
            const ch = supabase.channel(`buses:${profile.school_code}`);
            await ch.httpSend('trip-started', {
              driver_id: user.id,
              trip_id: tripState.tripId,
            });
            supabase.removeChannel(ch);
          } catch (broadcastErr) {
            log.warn('[TMS] trip-started broadcast failed:', broadcastErr);
          }

          // Push notification to parents — fire-and-forget, don't block trip start
          // Use busIdRef (not busId state) to avoid stale closure
          if (busIdRef.current) {
            supabase.functions.invoke('notify-bus-trip', {
              body: { bus_id: busIdRef.current, trip_id: tripState.tripId, event: 'trip_started' },
            }).catch((err) => log.warn('[TMS] trip-started notification failed:', err));
          }
        }
      }

      // 5. Start background location updates
      //
      // Shorter timeInterval (10s) helps Android keep the foreground service
      // active when app is in background or screen off — less likely to be
      // throttled or batched. distanceInterval: 0 ensures updates even when
      // the bus is stationary.
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10_000, // 10s — more frequent to reduce background throttling
        distanceInterval: 0,   // send updates even when stationary
        deferredUpdatesInterval: 10_000,
        showsBackgroundLocationIndicator: true, // iOS
        foregroundService: {
          notificationTitle: 'Trip Active',
          notificationBody: 'Live location tracking is running',
          notificationColor: '#6B3FA0',
        },
        // Android: do not pause when app backgrounds or screen off
        ...(Platform.OS === 'android' && {
          pausesUpdatesAutomatically: false,
        }),
      });
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
        } else if (profile?.school_code && user?.id) {
          // Broadcast trip-ended so viewers see the bus disappear instantly
          // Uses httpSend — one-shot HTTP broadcast, no WebSocket subscription needed
          try {
            const ch = supabase.channel(`buses:${profile.school_code}`);
            await ch.httpSend('trip-ended', {
              driver_id: user.id,
              trip_id: currentTripId,
            });
            supabase.removeChannel(ch);
          } catch (broadcastErr) {
            log.warn('[TMS] trip-ended broadcast failed:', broadcastErr);
          }

          // Push notification to parents — fire-and-forget, don't block trip end
          // Use busIdRef (not busId state) to avoid stale closure
          if (busIdRef.current) {
            supabase.functions.invoke('notify-bus-trip', {
              body: { bus_id: busIdRef.current, trip_id: currentTripId, event: 'trip_ended' },
            }).catch((err) => log.warn('[TMS] trip-ended notification failed:', err));
          }
        }
      }

      // 2. Stop the background task
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        LOCATION_TASK_NAME
      );
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      // 3. Flush offline queue
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          await flushQueue(token);
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

  const openSettings = useCallback(() => {
    openAppLocationSettings();
  }, [openAppLocationSettings]);

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
