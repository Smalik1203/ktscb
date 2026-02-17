/**
 * Transport Management System - Live Buses Hook (Realtime)
 *
 * Subscribes to Supabase Realtime broadcast for live GPS updates.
 * Falls back to a single RPC call on mount / reconnect for initial state.
 *
 * Replaces the previous 6-second polling model:
 * - DB queries drop from ~2,000/min (polling) to ~4/min (upserts only)
 * - Viewers get sub-second updates instead of 0-6s delay
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useIsScreenActive } from '../../../hooks/useIsScreenActive';
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

// ---------- Hook ----------

export function useLiveBuses(): UseLiveBusesReturn {
  const { profile } = useAuth();
  const isActive = useIsScreenActive();
  const [allBuses, setAllBuses] = useState<LiveBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch full bus state via RPC (used on mount + reconnect)
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

      // Deduplicate by bus_id — keep first occurrence (RPC orders by most recent trip)
      const raw = (data as LiveBus[]) ?? [];
      const seen = new Set<string>();
      const deduped = raw.filter(b => {
        if (seen.has(b.bus_id)) return false;
        seen.add(b.bus_id);
        return true;
      });
      setAllBuses(deduped);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      log.error('[TMS] Live buses fetch error:', err);
      setError('Network error fetching bus positions');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [profile?.school_code]);

  // Realtime subscription — subscribe when active, unsubscribe when inactive
  useEffect(() => {
    if (!isActive || !profile?.school_code) return;

    // Fetch initial state on (re-)activation
    fetchBuses();

    // Subscribe to Realtime broadcast channel for this school
    const channelName = `buses:${profile.school_code}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'gps-update' }, ({ payload }) => {
        if (!mountedRef.current) return;
        const { driver_id, lat, lng, speed, heading, recorded_at } = payload;
        setAllBuses(prev =>
          prev.map(bus =>
            bus.driver_id === driver_id
              ? { ...bus, lat, lng, speed, heading, recorded_at }
              : bus
          )
        );
      })
      .on('broadcast', { event: 'trip-started' }, () => {
        // New trip started — re-fetch full state to get bus metadata
        if (mountedRef.current) fetchBuses();
      })
      .on('broadcast', { event: 'trip-ended' }, ({ payload }) => {
        if (!mountedRef.current) return;
        const { driver_id } = payload;
        setAllBuses(prev => prev.filter(bus => bus.driver_id !== driver_id));
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          log.warn('[TMS] Realtime channel error — falling back to single RPC fetch');
          if (mountedRef.current) fetchBuses();
        }
      });

    // Cleanup: remove channel when going inactive, screen change, or unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isActive, profile?.school_code, fetchBuses]);

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
