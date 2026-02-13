/**
 * Transport Management System - My Bus Hook
 *
 * Polls `get_my_bus_status` RPC every 10 seconds to retrieve
 * the student's assigned bus live position and pickup progress.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { log } from '../../../lib/logger';

// ---------- Types ----------

export interface MyBusStatus {
  bus_id: string;
  bus_number: string;
  plate_number: string;
  driver_name: string;
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

const POLL_INTERVAL = 6_000; // 6 seconds

// ---------- Hook ----------

export function useMyBus(): UseMyBusReturn {
  const { user } = useAuth();
  const [busStatus, setBusStatus] = useState<MyBusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noBusAssigned, setNoBusAssigned] = useState(false);
  const mountedRef = useRef(true);

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

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();

    const interval = setInterval(fetchStatus, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchStatus]);

  return {
    busStatus,
    loading,
    error,
    noBusAssigned,
    refresh: fetchStatus,
  };
}
