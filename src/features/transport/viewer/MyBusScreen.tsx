import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Text,
  Animated as RNAnimated,
  Easing,
} from 'react-native';
import MapView, { AnimatedRegion, Marker, MarkerAnimated } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useTheme } from '../../../contexts/ThemeContext';
import { Card } from '../../../ui/Card';
import { Body, Caption, Heading } from '../../../ui/Text';
import { useMyBus } from './useMyBus';
import { haversineKm, formatDistance } from '../geo';

const METERS_PER_DEG_LAT = 111_320;

function projectBusPosition(
  lat: number,
  lng: number,
  speedMs: number,
  headingDeg: number,
  seconds: number,
): { latitude: number; longitude: number } {
  const hRad = (headingDeg * Math.PI) / 180;
  const dist = speedMs * seconds;
  const dLat = (dist * Math.cos(hRad)) / METERS_PER_DEG_LAT;
  const dLng =
    (dist * Math.sin(hRad)) /
    (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return { latitude: lat + dLat, longitude: lng + dLng };
}

function formatSpeed(speedMs: number | null): string {
  if (speedMs === null || speedMs < 0) return '--';
  return `${Math.round(speedMs * 3.6)} km/h`;
}

function formatTime(ts: string | null): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const INACTIVE_THRESHOLD_SEC = 300;

function isBusInactive(recordedAt: string | null): boolean {
  if (!recordedAt) return true;
  const ageSec = (Date.now() - new Date(recordedAt).getTime()) / 1000;
  return ageSec > INACTIVE_THRESHOLD_SEC;
}

export default function MyBusScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const { busStatus, loading, error, noBusAssigned, refresh } = useMyBus();
  const mapRef = useRef<MapView>(null);
  const [studentLoc, setStudentLoc] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const last = await Location.getLastKnownPositionAsync();
      if (last && !cancelled) {
        setStudentLoc({ lat: last.coords.latitude, lng: last.coords.longitude });
      }
      if (cancelled) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 50 },
        (loc) => {
          if (!cancelled) setStudentLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      );
    })();
    return () => { cancelled = true; sub?.remove(); };
  }, []);

  // Animated coordinate for smooth marker glide
  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude: busStatus?.lat ?? 0,
      longitude: busStatus?.lng ?? 0,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  // ── Dead-reckoning position animation (Uber-style) ──
  const runningAnim = useRef<any>(null);
  const lastBusPos = useRef({ lat: busStatus?.lat ?? 0, lng: busStatus?.lng ?? 0 });
  const lastGpsMs = useRef(0);
  const isFirstPos = useRef(true);

  const busSpeed = busStatus?.speed ?? 0;
  const busHeading = busStatus?.heading ?? 0;
  const isBusMoving = busSpeed > 0.5;

  useEffect(() => {
    const lat = busStatus?.lat;
    const lng = busStatus?.lng;
    if (lat == null || lng == null) return;

    // Cancel in-progress animation
    if (runningAnim.current) {
      runningAnim.current.stop();
      runningAnim.current = null;
    }

    const now = Date.now();
    const rawInterval = lastGpsMs.current > 0 ? now - lastGpsMs.current : 4000;
    lastGpsMs.current = now;

    const dLat = Math.abs(lat - lastBusPos.current.lat);
    const dLng = Math.abs(lng - lastBusPos.current.lng);
    lastBusPos.current = { lat, lng };

    // Animate map camera to actual GPS position
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      1200,
    );

    // ── Snap cases: first mount · big jump · GPS silence ──
    if (isFirstPos.current || dLat > 0.005 || dLng > 0.005 || rawInterval > 10_000) {
      isFirstPos.current = false;
      animatedCoord.setValue({ latitude: lat, longitude: lng } as any);

      // Start fresh projection from snapped position
      if (isBusMoving) {
        const projMs = Math.min(8000, Math.max(2000, rawInterval * 1.3));
        const target = projectBusPosition(lat, lng, busSpeed, busHeading, projMs / 1000);
        const anim = animatedCoord.timing({
          ...target, latitudeDelta: 0, longitudeDelta: 0,
          duration: projMs, easing: Easing.linear, useNativeDriver: false,
        });
        runningAnim.current = anim;
        anim.start(() => { runningAnim.current = null; });
      }
      return;
    }
    isFirstPos.current = false;

    if (isBusMoving) {
      // ── Moving: project ahead at speed + heading (dead reckoning) ──
      const projMs = Math.min(8000, Math.max(2000, rawInterval * 1.3));
      const target = projectBusPosition(lat, lng, busSpeed, busHeading, projMs / 1000);
      const anim = animatedCoord.timing({
        ...target, latitudeDelta: 0, longitudeDelta: 0,
        duration: projMs, easing: Easing.linear, useNativeDriver: false,
      });
      runningAnim.current = anim;
      anim.start(() => { runningAnim.current = null; });
    } else {
      // ── Stopped: settle to actual GPS position ──
      const anim = animatedCoord.timing({
        latitude: lat, longitude: lng, latitudeDelta: 0, longitudeDelta: 0,
        duration: 500, useNativeDriver: false,
      });
      runningAnim.current = anim;
      anim.start(() => { runningAnim.current = null; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busStatus?.lat, busStatus?.lng, isBusMoving, animatedCoord]);

  // ── Heading rotation smoothing ──
  const headingAnim = useRef(new RNAnimated.Value(busStatus?.heading ?? 0)).current;
  const prevHeading = useRef(busStatus?.heading ?? 0);

  useEffect(() => {
    const target = busStatus?.heading ?? 0;
    // Shortest rotation path — avoids 350° spin when 10° would do
    const delta = ((target - prevHeading.current + 540) % 360) - 180;
    if (Math.abs(delta) < 1) {
      prevHeading.current = target;
      return;
    }
    const animTarget = prevHeading.current + delta;
    RNAnimated.timing(headingAnim, {
      toValue: animTarget,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      const normalized = ((target % 360) + 360) % 360;
      prevHeading.current = normalized;
      headingAnim.setValue(normalized);
    });
  }, [busStatus?.heading, headingAnim]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Body color="secondary" style={{ marginTop: spacing.md }}>
          Finding your bus...
        </Body>
      </View>
    );
  }

  if (noBusAssigned) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background.primary }]}>
        <View style={[styles.emptyIcon, { backgroundColor: `${colors.text.tertiary}15` }]}>
          <MaterialIcons name="directions-bus" size={48} color={colors.text.tertiary} />
        </View>
        <Heading level={4} align="center" style={{ marginTop: spacing.lg }}>
          No Bus Assigned
        </Heading>
        <Body color="secondary" align="center" style={{ marginTop: spacing.sm, paddingHorizontal: 40 }}>
          You haven&apos;t been assigned to a bus yet. Please contact your school administrator.
        </Body>
      </View>
    );
  }

  const hasTrip = busStatus?.trip_active ?? false;
  const busLat = busStatus?.lat ?? null;
  const busLng = busStatus?.lng ?? null;
  const hasLocation = busLat != null && busLng != null;
  const totalStudents = busStatus?.total_students ?? 0;
  const pickupCount = busStatus?.pickup_count ?? 0;
  const pickupPct = totalStudents > 0 ? (pickupCount / totalStudents) * 100 : 0;
  const distanceLabel =
    busLat != null && busLng != null && studentLoc
      ? formatDistance(haversineKm(busLat, busLng, studentLoc.lat, studentLoc.lng))
      : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refresh} colors={[colors.primary.main]} />
      }
    >
      {/* Bus info header */}
      <Card variant="elevated" padding="md" style={{ marginTop: spacing.md }}>
        <View style={styles.busHeader}>
          <View style={[styles.busIconBg, { backgroundColor: `${colors.primary.main}15` }]}>
            <MaterialIcons name="directions-bus" size={28} color={colors.primary.main} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Heading level={4}>{busStatus?.bus_number ?? '--'}</Heading>
            <Caption color="secondary">{busStatus?.plate_number ?? '--'}</Caption>
          </View>

          {/* Trip status badge */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: hasTrip
                  ? `${colors.success.main}15`
                  : `${colors.text.tertiary}15`,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: hasTrip ? colors.success.main : colors.text.tertiary,
                },
              ]}
            />
            <Caption
              style={{
                fontWeight: '600',
                color: hasTrip ? colors.success.main : colors.text.tertiary,
              }}
            >
              {hasTrip ? 'On Route' : 'Idle'}
            </Caption>
          </View>
        </View>

        {/* Driver name */}
        <View style={[styles.driverRow, { marginTop: spacing.sm }]}>
          <MaterialIcons name="person" size={16} color={colors.text.secondary} />
          <Caption color="secondary" style={{ marginLeft: 6 }}>
            Driver: {busStatus?.driver_name ?? '--'}
          </Caption>
        </View>
      </Card>

      {/* Inactive alert: trip active but no GPS for 5+ min */}
      {hasTrip && isBusInactive(busStatus?.recorded_at ?? null) && (
        <Card variant="outlined" padding="md" style={{ marginTop: spacing.md, borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MaterialIcons name="warning-amber" size={22} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#B45309' }}>Inactive</Text>
              <Caption color="secondary" style={{ marginTop: 2 }}>
                No location update for 5+ minutes. Trip is still active — location may resume shortly.
              </Caption>
            </View>
          </View>
        </Card>
      )}

      {/* Map card */}
      {hasLocation && busLat != null && busLng != null && (
        <View style={[styles.mapWrapper, { borderColor: colors.border.DEFAULT, marginTop: spacing.md }]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: busLat,
              longitude: busLng,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            showsScale={false}
            showsTraffic={false}
            showsBuildings={false}
            showsIndoors={false}
            toolbarEnabled={false}
            zoomControlEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            scrollEnabled={false}
            zoomEnabled={false}
            loadingEnabled
            loadingIndicatorColor={colors.primary.main}
          >
            <MarkerAnimated
              coordinate={animatedCoord}
              anchor={{ x: 0.5, y: 0.5 }}
              rotation={headingAnim as any}
              flat
              tracksViewChanges={false}
            >
              <View style={[styles.markerOuter, { backgroundColor: `${colors.primary.main}30` }]}>
                <View style={[styles.markerInner, { backgroundColor: colors.primary.main }]}>
                  <MaterialIcons name="directions-bus" size={16} color="#FFFFFF" />
                </View>
              </View>
            </MarkerAnimated>

            {/* Student's own location marker */}
            {studentLoc && (
              <Marker
                coordinate={{ latitude: studentLoc.lat, longitude: studentLoc.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.studentMarkerOuter}>
                  <View style={styles.studentMarkerInner} />
                </View>
              </Marker>
            )}
          </MapView>

          {/* Distance badge */}
          {distanceLabel && (
            <View style={[styles.distanceBadge, { backgroundColor: colors.background.primary }]}>
              <MaterialIcons name="place" size={13} color="#2563EB" />
              <Text style={styles.distanceBadgeText}>{distanceLabel}</Text>
            </View>
          )}

          {/* Speed badge — always show; "--" when device doesn't report speed */}
          <View style={[styles.speedBadge, { backgroundColor: colors.background.primary }]}>
            <Caption style={{ fontWeight: '700', color: colors.text.primary }}>
              {formatSpeed(busStatus?.speed ?? null)}
            </Caption>
          </View>

          {/* Time badge */}
          <View style={[styles.timeBadge, { backgroundColor: colors.background.primary }]}>
            <Caption color="tertiary" style={{ fontSize: 10 }}>
              {formatTime(busStatus?.recorded_at ?? null)}
            </Caption>
          </View>
        </View>
      )}

      {/* No location / no trip message */}
      {!hasTrip && (
        <Card variant="outlined" padding="lg" style={{ marginTop: spacing.md, alignItems: 'center' }}>
          <MaterialIcons name="schedule" size={36} color={colors.text.tertiary} />
          <Body color="secondary" align="center" style={{ marginTop: spacing.sm }}>
            No active trip right now
          </Body>
          <Caption color="tertiary" align="center" style={{ marginTop: spacing.xs }}>
            The bus location will appear when the driver starts a trip
          </Caption>
        </Card>
      )}

      {hasTrip && !hasLocation && (
        <Card variant="outlined" padding="lg" style={{ marginTop: spacing.md, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Body color="secondary" align="center" style={{ marginTop: spacing.sm }}>
            Waiting for first location update...
          </Body>
        </Card>
      )}

      {/* Pickup progress */}
      {hasTrip && (
        <Card variant="elevated" padding="md" style={{ marginTop: spacing.md }}>
          <View style={styles.pickupHeader}>
            <View style={styles.pickupLeft}>
              <MaterialIcons name="people" size={18} color={colors.primary.main} />
              <Body style={{ marginLeft: 8, fontWeight: '600' }}>Pickup Progress</Body>
            </View>
            <Body style={{ fontWeight: '700' }}>
              {pickupCount} / {totalStudents}
            </Body>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressBg, { backgroundColor: `${colors.text.tertiary}20`, marginTop: spacing.sm }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor:
                    pickupPct === 100 ? colors.success.main : colors.primary.main,
                  width: `${pickupPct}%`,
                },
              ]}
            />
          </View>

          {/* Personal pickup status */}
          <View
            style={[
              styles.personalStatus,
              {
                backgroundColor: busStatus?.am_i_picked_up
                  ? `${colors.success.main}12`
                  : `${colors.warning.main}12`,
                marginTop: spacing.md,
              },
            ]}
          >
            <MaterialIcons
              name={busStatus?.am_i_picked_up ? 'check-circle' : 'schedule'}
              size={20}
              color={busStatus?.am_i_picked_up ? colors.success.main : colors.warning.main}
            />
            <Body
              style={{
                marginLeft: 8,
                fontWeight: '600',
                color: busStatus?.am_i_picked_up ? colors.success.main : colors.warning.main,
              }}
            >
              {busStatus?.am_i_picked_up ? 'You have been picked up' : 'Waiting for pickup'}
            </Body>
          </View>
        </Card>
      )}

      {/* Error banner */}
      {error && (
        <Card variant="outlined" padding="sm" style={{ marginTop: spacing.md, borderColor: colors.error.main }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="error-outline" size={16} color={colors.error.main} />
            <Caption color="error" style={{ marginLeft: 6 }}>{error}</Caption>
          </View>
        </Card>
      )}

      {/* Info footer */}
      <View style={[styles.infoFooter, { marginTop: spacing.lg }]}>
        <MaterialIcons name="info-outline" size={14} color={colors.text.tertiary} />
        <Caption color="tertiary" style={{ marginLeft: 6, flex: 1 }}>
          Location updates are received in real time when the bus is on route.
        </Caption>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bus header
  busHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  busIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Map
  mapWrapper: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentMarkerOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  distanceBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  distanceBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  speedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  timeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },

  // Pickup progress
  pickupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  personalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  // Footer
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
});
