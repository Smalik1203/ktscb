/**
 * Transport Management System - Live Buses Hook
 *
 * Polls `get_live_bus_positions` RPC every 10 seconds to retrieve
 * all active buses with their latest GPS position for the admin view.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { log } from '../../../lib/logger';

// ---------- Types ----------

export interface LiveBus {
  trip_id: string;
  driver_id: string;
  bus_id: string;
  bus_number: string;
  plate_number: string;
  driver_name: string;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string | null;
  started_at: string;
  pickup_count: number;
  total_students: number;
}

interface UseLiveBusesReturn {
  /** All active buses (unfiltered) */
  allBuses: LiveBus[];
  /** Filtered buses (if selectedBusId is set, otherwise same as allBuses) */
  buses: LiveBus[];
  /** Whether the initial load is in progress */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Currently selected bus ID for filtering */
  selectedBusId: string | null;
  /** Set a bus ID to filter, or null for all */
  setSelectedBusId: (id: string | null) => void;
  /** Force a manual refresh */
  refresh: () => void;
}

const POLL_INTERVAL = 6_000; // 6 seconds

// ---------- Hook ----------

export function useLiveBuses(): UseLiveBusesReturn {
  const { profile } = useAuth();
  const [allBuses, setAllBuses] = useState<LiveBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchBuses = useCallback(async () => {
    if (!profile?.school_code) return;

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'get_live_bus_positions',
        { p_school_code: profile.school_code }
      );

      if (!mountedRef.current) return;

      if (rpcError) {
        log.warn('[TMS] Live buses RPC error:', rpcError.message);
        setError('Failed to fetch live bus positions');
        return;
      }

      setAllBuses((data as LiveBus[]) ?? []);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      log.error('[TMS] Live buses fetch error:', err);
      setError('Network error fetching bus positions');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [profile?.school_code]);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    fetchBuses();

    const interval = setInterval(fetchBuses, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchBuses]);

  // Filter by selected bus
  const buses = selectedBusId
    ? allBuses.filter((b) => b.bus_id === selectedBusId)
    : allBuses;

  return {
    allBuses,
    buses,
    loading,
    error,
    selectedBusId,
    setSelectedBusId,
    refresh: fetchBuses,
  };
}
