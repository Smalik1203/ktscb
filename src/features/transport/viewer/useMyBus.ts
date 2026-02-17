/**
 * Transport Management System - My Bus Hook (Realtime)
 *
 * Subscribes to Supabase Realtime broadcast for live GPS updates
 * on the student's assigned bus. Falls back to a single RPC call
 * on mount / reconnect for initial state.
 *
 * Replaces the previous 6-second polling model.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useIsScreenActive } from '../../../hooks/useIsScreenActive';
import { log } from '../../../lib/logger';

// ---------- Types ----------

export interface MyBusStatus {
  bus_id: string;
  bus_number: string;
  plate_number: string;
  driver_name: string;
  /** Driver ID — used to match Realtime broadcast updates */
  driver_id: string;
  trip_id: string | null;
  trip_active: boolean;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string | null;
  pickup_count: number;
  total_students: number;
  am_i_picked_up: boolean;
}

interface UseMyBusReturn {
  /** Bus status data (null if no bus assigned) */
  busStatus: MyBusStatus | null;
  /** Whether the initial load is in progress */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether the student has no bus assigned */
  noBusAssigned: boolean;
  /** Force a manual refresh */
  refresh: () => void;
}

// ---------- Hook ----------

export function useMyBus(): UseMyBusReturn {
  const { user, profile } = useAuth();
  const isActive = useIsScreenActive();
  const [busStatus, setBusStatus] = useState<MyBusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noBusAssigned, setNoBusAssigned] = useState(false);
  const mountedRef = useRef(true);
  const driverIdRef = useRef<string | null>(null);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Keep driver_id ref in sync so broadcast callbacks can read latest value
  useEffect(() => {
    driverIdRef.current = busStatus?.driver_id ?? null;
  }, [busStatus?.driver_id]);

  // Fetch full bus status via RPC (used on mount + reconnect)
  const fetchStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'get_my_bus_status',
        { p_auth_user_id: user.id }
      );

      if (!mountedRef.current) return;

      if (rpcError) {
        log.warn('[TMS] My bus RPC error:', rpcError.message);
        setError('Failed to fetch bus status');
        return;
      }

      // RPC returns an array; we only need the first row
      const rows = data as MyBusStatus[] | null;
      if (!rows || rows.length === 0) {
        setBusStatus(null);
        setNoBusAssigned(true);
      } else {
        setBusStatus(rows[0]);
        setNoBusAssigned(false);
      }

      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      log.error('[TMS] My bus fetch error:', err);
      setError('Network error fetching bus status');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user?.id]);

  // Realtime subscription — subscribe when active, unsubscribe when inactive
  useEffect(() => {
    if (!isActive || !profile?.school_code) return;

    // Fetch initial state on (re-)activation
    fetchStatus();

    // Subscribe to school-wide bus channel; filter to own bus's driver_id in handler
    const channelName = `buses:${profile.school_code}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'gps-update' }, ({ payload }) => {
        if (!mountedRef.current) return;
        // Use functional update to always read latest busStatus
        setBusStatus(prev => {
          if (!prev || prev.driver_id !== payload.driver_id) return prev;
          return {
            ...prev,
            lat: payload.lat,
            lng: payload.lng,
            speed: payload.speed,
            heading: payload.heading,
            recorded_at: payload.recorded_at,
          };
        });
      })
      .on('broadcast', { event: 'trip-started' }, ({ payload }) => {
        // Re-fetch when our bus's driver starts a trip
        if (mountedRef.current && driverIdRef.current === payload.driver_id) {
          fetchStatus();
        }
      })
      .on('broadcast', { event: 'trip-ended' }, ({ payload }) => {
        // Re-fetch when our bus's driver ends a trip
        if (mountedRef.current && driverIdRef.current === payload.driver_id) {
          fetchStatus();
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          log.warn('[TMS] Realtime channel error — falling back to single RPC fetch');
          if (mountedRef.current) fetchStatus();
        }
      });

    // Cleanup: remove channel when going inactive or unmounting
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isActive, profile?.school_code, fetchStatus]);

  return {
    busStatus,
    loading,
    error,
    noBusAssigned,
    refresh: fetchStatus,
  };
}
