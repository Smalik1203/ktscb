/**
 * Transport Management System - Live Bus Map (Superadmin)
 *
 * Full-screen map showing all active buses with their real-time positions.
 * Features:
 * - Bus filter dropdown
 * - Tap a bus marker → opens swipeable card carousel
 * - Swipe left/right to browse buses, map auto-follows
 * - Re-centre pill when user pans away
 * - Receives live updates via Supabase Realtime broadcast
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Text,
  Animated as RNAnimated,
  Dimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ListRenderItemInfo,
} from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { Body, Caption } from '../../../ui/Text';
import { Card } from '../../../ui/Card';
import { useLiveBuses, type LiveBus } from './useLiveBuses';
import { BusMarker } from './BusMarker';
import { sendLocationPing } from '../locationPing';
import { haversineKm, formatDistance } from '../geo';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HORIZONTAL_MARGIN = 12;
const CARD_WIDTH = SCREEN_WIDTH - CARD_HORIZONTAL_MARGIN * 2;

// ---------- Helpers ----------

/** No signal for 5+ min = inactive (trip may still be active on server). */
const INACTIVE_THRESHOLD_SEC = 300; // 5 minutes

type BusStatus = 'active' | 'inactive';

/**
 * Active = we received a GPS update within the last 5 minutes.
 * Inactive = no update for 5+ minutes (trip may still be active — show alert).
 */
function getBusStatus(_speed: number | null, recordedAt: string | null): BusStatus {
  if (!recordedAt) return 'inactive';
  const ageSec = Math.max(0, (Date.now() - new Date(recordedAt).getTime()) / 1000);
  return ageSec <= INACTIVE_THRESHOLD_SEC ? 'active' : 'inactive';
}

const STATUS_CONFIG = {
  active:   { label: 'Active',   color: '#16A34A', bg: '#DCFCE7', icon: 'directions-bus' as const },
  inactive: { label: 'Inactive', color: '#6B7280', bg: '#F3F4F6', icon: 'signal-wifi-off' as const },
};

function formatSpeed(speedMs: number | null): string {
  if (speedMs === null || speedMs < 0) return '-- km/h';
  return `${Math.round(speedMs * 3.6)} km/h`;
}

function formatElapsed(startedAt: string): string {
  const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const hrs = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function getTimeSinceUpdate(ts: string | null): string {
  if (!ts) return 'No data';
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

// ---------- Pulsing Dot ----------

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  const anim = useRef(new RNAnimated.Value(0.3)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        RNAnimated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}>
      <RNAnimated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: anim,
        }}
      />
    </View>
  );
}

// ---------- Bus Card (single item in the carousel) ----------

function BusCard({
  bus,
  primaryColor,
  textPrimary,
  textSecondary,
  textTertiary,
  cardBackground,
  cardSecondaryBg,
  borderLight,
  onRequestLocation,
  schoolCoords,
}: {
  bus: LiveBus;
  primaryColor: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  cardBackground: string;
  cardSecondaryBg: string;
  borderLight: string;
  onRequestLocation: (driverId: string) => void;
  schoolCoords: { lat: number; lng: number } | null;
}) {
  const status = getBusStatus(bus.speed, bus.recorded_at);
  const cfg = STATUS_CONFIG[status];
  const pickupPct =
    bus.total_students > 0 ? (bus.pickup_count / bus.total_students) * 100 : 0;
  const pickupDone = bus.pickup_count === bus.total_students && bus.total_students > 0;

  // Distance from bus to school
  const distanceLabel =
    bus.lat != null && bus.lng != null && schoolCoords
      ? formatDistance(haversineKm(bus.lat, bus.lng, schoolCoords.lat, schoolCoords.lng))
      : null;

  return (
    <View style={[styles.cardInner, { width: CARD_WIDTH, backgroundColor: cardBackground }]}>
      {/* Header: icon + name + status */}
      <View style={styles.cardHeader}>
        <View style={[styles.busIconBox, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name="directions-bus" size={22} color={cfg.color} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.busName, { color: textPrimary }]}>{bus.bus_number}</Text>
          <Text style={[styles.plateText, { color: textTertiary }]}>{bus.plate_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          {status === 'active' ? (
            <PulsingDot color={cfg.color} size={7} />
          ) : (
            <MaterialIcons name="signal-wifi-off" size={12} color={cfg.color} />
          )}
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* 3-column stats: Speed | Trip | Driver */}
      <View style={[styles.statsRow, { backgroundColor: cardSecondaryBg }]}>
        <View style={styles.statCell}>
          <MaterialIcons name="speed" size={15} color="#2563EB" />
          <Text style={[styles.statValue, { color: textPrimary }]}>
            {formatSpeed(bus.speed)}
          </Text>
        </View>
        <View style={[styles.statCell, styles.statCellBorder, { borderColor: borderLight }]}>
          <MaterialIcons name="schedule" size={15} color="#9333EA" />
          <Text style={[styles.statValue, { color: textPrimary }]}>
            {formatElapsed(bus.started_at)}
          </Text>
        </View>
        <View style={styles.statCell}>
          <MaterialIcons name="person" size={15} color="#16A34A" />
          <Text style={[styles.statValue, { color: textPrimary }]} numberOfLines={1}>
            {bus.driver_name}
          </Text>
        </View>
      </View>

      {/* Pickup bar — compact inline */}
      <View style={styles.pickupRow}>
        <MaterialIcons name="people" size={14} color={textTertiary} />
        <View style={[styles.pickupBarBg, { backgroundColor: `${textTertiary}15` }]}>
          <View
            style={[
              styles.pickupBarFill,
              {
                backgroundColor: pickupDone ? '#16A34A' : primaryColor,
                width: `${pickupPct}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.pickupText, { color: pickupDone ? '#16A34A' : textPrimary }]}>
          {bus.pickup_count}/{bus.total_students}
        </Text>
      </View>

      {/* Footer: distance + last updated + request location */}
      <View style={styles.footerRow}>
        <View style={styles.footerLeft}>
          {distanceLabel && (
            <>
              <MaterialIcons name="place" size={11} color="#2563EB" />
              <Text style={[styles.footerText, { color: '#2563EB', fontWeight: '700', marginRight: 6 }]}>
                {distanceLabel}
              </Text>
            </>
          )}
          <MaterialIcons name="update" size={11} color={textTertiary} />
          <Text style={[styles.footerText, { color: textTertiary }]}>
            {getTimeSinceUpdate(bus.recorded_at)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshPill, { backgroundColor: status === 'inactive' ? '#2563EB' : `${textTertiary}18` }]}
          onPress={() => onRequestLocation(bus.driver_id)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="refresh"
            size={12}
            color={status === 'inactive' ? '#FFF' : textSecondary}
          />
          <Text style={[styles.refreshPillText, { color: status === 'inactive' ? '#FFF' : textSecondary }]}>
            {status === 'inactive' ? 'Request Location' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>
      {/* Raw coordinates (latitude, longitude) from device GPS — for verification */}
      {bus.lat != null && bus.lng != null && (
        <Text style={[styles.footerText, { color: textTertiary, marginTop: 4, fontSize: 10 }]} numberOfLines={1}>
          {bus.lat.toFixed(5)}, {bus.lng.toFixed(5)}
        </Text>
      )}
    </View>
  );
}

// ---------- Screen ----------

export default function LiveBusMapScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const mapRef = useRef<MapView>(null);
  const {
    allBuses,
    buses,
    loading,
    error,
    selectedBusId,
    setSelectedBusId,
    refresh,
  } = useLiveBuses();

  const [selectedBus, setSelectedBus] = useState<LiveBus | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const carouselRef = useRef<FlatList<LiveBus>>(null);

  // School coordinates (for distance calculation)
  const [schoolCoords, setSchoolCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!profile?.school_code) return;
    supabase
      .from('schools')
      .select('lat, lng')
      .eq('school_code', profile.school_code)
      .single()
      .then(({ data }) => {
        if (data?.lat != null && data?.lng != null) {
          setSchoolCoords({ lat: data.lat, lng: data.lng });
        }
      });
  }, [profile?.school_code]);

  // Unique buses for filter dropdown
  const uniqueBuses = useMemo(() => {
    const map = new Map<string, { bus_id: string; bus_number: string }>();
    for (const b of allBuses) {
      if (!map.has(b.bus_id)) {
        map.set(b.bus_id, { bus_id: b.bus_id, bus_number: b.bus_number });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.bus_number.localeCompare(b.bus_number)
    );
  }, [allBuses]);

  // Auto-fit map to show all buses
  const fitMapToBuses = useCallback(() => {
    if (!mapRef.current || buses.length === 0) return;
    const coords = buses
      .filter((b) => b.lat !== null && b.lng !== null)
      .map((b) => ({ latitude: b.lat!, longitude: b.lng! }));
    if (coords.length === 0) return;

    if (coords.length === 1) {
      mapRef.current.animateToRegion(
        { latitude: coords[0].latitude, longitude: coords[0].longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        600
      );
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 280, left: 50 },
        animated: true,
      });
    }
  }, [buses]);

  // Fit on first load
  const hasInitialFit = useRef(false);
  useEffect(() => {
    if (!loading && buses.length > 0 && !hasInitialFit.current) {
      hasInitialFit.current = true;
      const timerId = setTimeout(fitMapToBuses, 500);
      return () => clearTimeout(timerId);
    }
  }, [loading, buses, fitMapToBuses]);

  // Follow mode
  const [followMode, setFollowMode] = useState(true);

  // Update selected bus info on polling refresh
  const selectedBusIdRef = useRef<string | null>(null);
  selectedBusIdRef.current = selectedBus?.bus_id ?? null;

  useEffect(() => {
    if (!selectedBusIdRef.current) return;
    const updated = buses.find((b) => b.bus_id === selectedBusIdRef.current);
    if (updated) {
      setSelectedBus(updated);
    } else {
      // Bus was removed (trip ended) — clear selection to prevent stale state
      setSelectedBus(null);
      setCardOpen(false);
      setFollowMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buses]);

  // Auto-center on selected bus
  useEffect(() => {
    if (!followMode || !selectedBus) return;
    if (selectedBus.lat == null || selectedBus.lng == null) return;
    mapRef.current?.animateToRegion(
      { latitude: selectedBus.lat, longitude: selectedBus.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      800
    );
  }, [followMode, selectedBus?.lat, selectedBus?.lng, selectedBus]);

  const handleMapPanDrag = useCallback(() => {
    if (followMode) setFollowMode(false);
  }, [followMode]);

  // ---- Open card carousel centred on a bus ----
  const openCardForBus = useCallback(
    (bus: LiveBus) => {
      setSelectedBus(bus);
      setCardOpen(true);
      setFollowMode(true);
      // Scroll carousel to this bus after it opens
      const idx = buses.findIndex((b) => b.bus_id === bus.bus_id);
      if (idx >= 0 && idx < buses.length) {
        setTimeout(() => {
          carouselRef.current?.scrollToIndex({ index: idx, animated: false });
        }, 50);
      }
    },
    [buses]
  );

  // ---- Carousel swipe handler ----
  const handleCarouselScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const idx = Math.round(offsetX / CARD_WIDTH);
      if (idx >= 0 && idx < buses.length) {
        const bus = buses[idx];
        if (bus.bus_id !== selectedBusIdRef.current) {
          setSelectedBus(bus);
          setFollowMode(true);
        }
      }
    },
    [buses]
  );

  // Page indicator (current index)
  const currentIdx = useMemo(() => {
    if (!selectedBus) return 0;
    const idx = buses.findIndex((b) => b.bus_id === selectedBus.bus_id);
    return idx >= 0 ? idx : 0;
  }, [selectedBus, buses]);

  // ---- Request location from driver ----
  const handleRequestLocation = useCallback(
    async (driverId: string) => {
      try {
        await sendLocationPing(driverId);
        // Re-fetch after a short delay to pick up the fresh GPS data
        setTimeout(refresh, 3000);
      } catch {
        // Non-critical — the next poll will pick it up
      }
    },
    [refresh]
  );

  // ---- Render card item ----
  const renderCard = useCallback(
    ({ item }: ListRenderItemInfo<LiveBus>) => (
      <BusCard
        bus={item}
        primaryColor={colors.primary.main}
        textPrimary={colors.text.primary}
        textSecondary={colors.text.secondary}
        textTertiary={colors.text.tertiary}
        cardBackground={colors.surface.primary}
        cardSecondaryBg={colors.background.secondary}
        borderLight={colors.border.light}
        onRequestLocation={handleRequestLocation}
        schoolCoords={schoolCoords}
      />
    ),
    [colors, handleRequestLocation, schoolCoords]
  );

  const cardKeyExtractor = useCallback((item: LiveBus) => item.bus_id, []);

  // ---------- Render ----------

  return (
    <View style={styles.container}>
      {/* ======== HEADER BAR (outside map) ======== */}
      <View style={[styles.headerBar, { backgroundColor: colors.background.primary }]}>
        <View style={styles.headerRow}>
          {/* Filter button */}
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: colors.background.secondary }]}
            onPress={() => setFilterOpen(!filterOpen)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="directions-bus" size={18} color={colors.primary.main} />
            <Text style={[styles.filterBtnText, { color: colors.text.primary }]} numberOfLines={1}>
              {selectedBusId
                ? uniqueBuses.find((b) => b.bus_id === selectedBusId)?.bus_number ?? 'Bus'
                : 'All Buses'}
            </Text>
            <View style={[styles.countBadge, { backgroundColor: colors.primary.main }]}>
              <Text style={styles.countBadgeText}>{allBuses.length}</Text>
            </View>
            <MaterialIcons
              name={filterOpen ? 'expand-less' : 'expand-more'}
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>

          {/* Centre button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.background.secondary }]}
            onPress={() => {
              refresh();
              if (selectedBus) {
                setFollowMode(true);
              } else {
                fitMapToBuses();
              }
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={selectedBus && !followMode ? 'gps-not-fixed' : 'my-location'}
              size={20}
              color={colors.primary.main}
            />
          </TouchableOpacity>
        </View>

        {/* Filter dropdown (slides down from header) */}
        {filterOpen && (
          <View style={[styles.filterDropdown, { backgroundColor: colors.background.primary }]}>
            <ScrollView style={{ maxHeight: 200 }} bounces={false}>
              <TouchableOpacity
                style={[styles.filterOption, !selectedBusId && { backgroundColor: `${colors.primary.main}10` }]}
                onPress={() => {
                  setSelectedBusId(null);
                  setFilterOpen(false);
                  setSelectedBus(null);
                  setCardOpen(false);
                  setFollowMode(false);
                  fitMapToBuses();
                }}
              >
                <View style={[styles.filterDot, { backgroundColor: colors.primary.main }]} />
                <Text style={[styles.filterOptionText, { color: colors.text.primary, fontWeight: !selectedBusId ? '700' : '400' }]}>
                  All Buses
                </Text>
                <Text style={[styles.filterOptionCount, { color: colors.text.tertiary }]}>
                  {allBuses.length} active
                </Text>
              </TouchableOpacity>

              {uniqueBuses.map((b) => (
                <TouchableOpacity
                  key={b.bus_id}
                  style={[
                    styles.filterOption,
                    selectedBusId === b.bus_id && { backgroundColor: `${colors.primary.main}10` },
                  ]}
                  onPress={() => {
                    setSelectedBusId(b.bus_id);
                    setFilterOpen(false);
                    setFollowMode(true);
                    const match = allBuses.find((ab) => ab.bus_id === b.bus_id);
                    if (match?.lat && match?.lng) {
                      mapRef.current?.animateToRegion(
                        { latitude: match.lat, longitude: match.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 },
                        600
                      );
                    }
                    if (match) openCardForBus(match);
                  }}
                >
                  <MaterialIcons name="directions-bus" size={16} color={colors.text.secondary} />
                  <Text
                    style={[
                      styles.filterOptionText,
                      { color: colors.text.primary, fontWeight: selectedBusId === b.bus_id ? '700' : '400' },
                    ]}
                  >
                    {b.bus_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ======== MAP AREA (fills remaining space) ======== */}
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: 17.385,
          longitude: 78.4867,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
          showsUserLocation={false}
          showsCompass={false}
          showsScale
          toolbarEnabled={false}
          loadingEnabled
          loadingIndicatorColor={colors.primary.main}
          onPanDrag={handleMapPanDrag}
        >
          {buses
            .filter((b) => b.lat !== null && b.lng !== null)
            .map((bus) => (
            <BusMarker
              key={bus.bus_id}
              lat={bus.lat!}
              lng={bus.lng!}
              busNumber={bus.bus_number}
              heading={bus.heading}
              speed={bus.speed}
              recordedAt={bus.recorded_at}
              isSelected={selectedBus?.bus_id === bus.bus_id}
              onPress={() => openCardForBus(bus)}
            />
            ))}
        </MapView>

        {/* Inactive alert: trip still active but no GPS for 5+ min */}
        {buses.length > 0 && (() => {
          const inactiveBuses = buses.filter((b) => getBusStatus(b.speed, b.recorded_at) === 'inactive');
          if (inactiveBuses.length === 0) return null;
          const selectedInactive = selectedBus && getBusStatus(selectedBus.speed, selectedBus.recorded_at) === 'inactive';
          return (
            <View style={styles.inactiveAlertBanner}>
              <View style={styles.inactiveAlertInner}>
                <MaterialIcons name="warning-amber" size={18} color="#B45309" />
                <Text style={styles.inactiveAlertText}>
                  {selectedInactive && selectedBus
                    ? `No location update for ${selectedBus.bus_number} in 5+ min. Trip still active.`
                    : inactiveBuses.length === 1
                      ? '1 bus has had no location update for 5+ min. Trip still active.'
                      : `${inactiveBuses.length} buses have had no location update for 5+ min.`}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Re-centre pill (overlaid on map) */}
        {selectedBus && !followMode && (
          <TouchableOpacity
            style={styles.recentreBtn}
            onPress={() => setFollowMode(true)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="gps-fixed" size={14} color="#FFF" />
            <Text style={styles.recentreText}>Re-centre on bus</Text>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        )}

        {/* Empty state */}
        {!loading && buses.length === 0 && (
          <View style={[styles.emptyCard, { bottom: insets.bottom + 16 }]}>
            <Card variant="elevated" padding="lg" style={{ alignItems: 'center' }}>
              <View style={[styles.emptyIcon, { backgroundColor: `${colors.text.tertiary}10` }]}>
                <MaterialIcons name="directions-bus" size={36} color={colors.text.tertiary} />
              </View>
              <Body color="secondary" align="center" style={{ marginTop: spacing.md, fontWeight: '600' }}>
                No active buses right now
              </Body>
              <Caption color="tertiary" align="center" style={{ marginTop: spacing.xs }}>
                Buses will appear when drivers start their trips
              </Caption>
            </Card>
          </View>
        )}

        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner}>
            <View style={styles.errorBannerInner}>
              <MaterialIcons name="wifi-off" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        )}

        {/* ===== Swipeable bus card carousel (overlaid on map bottom) ===== */}
        {cardOpen && buses.length > 0 && (
          <View style={[styles.carouselWrapper, { bottom: insets.bottom + 12 }]}>
            {/* Close + page indicator row */}
            <View style={styles.closeBtnRow}>
              {buses.length > 1 && (
                <Text style={[styles.pageIndicator, { color: colors.text.secondary }]}>
                  {currentIdx + 1} / {buses.length}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.background.primary }]}
                onPress={() => {
                  setCardOpen(false);
                  setSelectedBus(null);
                  setFollowMode(false);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {/* Horizontal card list */}
            <FlatList
              ref={carouselRef}
              data={buses}
              keyExtractor={cardKeyExtractor}
              renderItem={renderCard}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH}
              decelerationRate="fast"
              onMomentumScrollEnd={handleCarouselScroll}
              getItemLayout={(_data, index) => ({
                length: CARD_WIDTH,
                offset: CARD_WIDTH * index,
                index,
              })}
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}
            />

            {/* Swipe dots */}
            {buses.length > 1 && (
              <View style={styles.dotsRow}>
                {buses.map((b, i) => (
                  <View
                    key={b.bus_id}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          i === currentIdx ? colors.primary.main : `${colors.text.tertiary}30`,
                      },
                      i === currentIdx && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ===== Header bar (outside map) =====
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    zIndex: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  filterBtnText: { flex: 1, fontSize: 15, fontWeight: '700' },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter dropdown (inside header, below the row)
  filterDropdown: {
    marginTop: 6,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterOptionText: { flex: 1, fontSize: 14 },
  filterOptionCount: { fontSize: 12 },

  // ===== Map area =====
  mapArea: { flex: 1 },

  // Re-centre (overlaid on map)
  recentreBtn: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 15,
    gap: 6,
  },
  recentreText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },

  // Empty
  emptyCard: { position: 'absolute', left: 16, right: 16 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Error
  errorBanner: { position: 'absolute', top: 12, left: 16, right: 16, zIndex: 5 },
  errorBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  errorText: { fontSize: 12, color: '#DC2626', fontWeight: '500', flex: 1 },

  // Inactive alert (trip active but no GPS 5+ min)
  inactiveAlertBanner: { position: 'absolute', top: 12, left: 16, right: 16, zIndex: 10 },
  inactiveAlertInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
  },
  inactiveAlertText: { fontSize: 12, color: '#B45309', fontWeight: '600', flex: 1 },

  // ===== Carousel =====
  carouselWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 5,
  },
  closeBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: CARD_HORIZONTAL_MARGIN + 4,
    marginBottom: 6,
    gap: 8,
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  carousel: {
    flexGrow: 0,
  },
  carouselContent: {
    paddingHorizontal: 0,
  },
  cardInner: {
    marginHorizontal: CARD_HORIZONTAL_MARGIN,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#FFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    borderRadius: 4,
  },

  // ===== Card internals =====
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  busIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flex: 1 },
  busName: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  plateText: { fontSize: 12, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  // 3-column stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 8,
  },
  statCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  statCellBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: { fontSize: 12, fontWeight: '700' },

  // Pickup bar (compact inline)
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  pickupBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  pickupBarFill: {
    height: 5,
    borderRadius: 3,
  },
  pickupText: {
    fontSize: 12,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'right',
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '500',
  },
  refreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 3,
  },
  refreshPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
