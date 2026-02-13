/**
 * Transport Management System - My Bus Screen (Student)
 *
 * Shows the student's assigned bus live location and pickup status.
 * Features:
 * - Map card showing bus position
 * - Trip status (active / no active trip)
 * - Pickup progress with personal status
 * - Last update time + speed
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import MapView, { AnimatedRegion, MarkerAnimated } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { Card } from '../../../ui/Card';
import { Body, Caption, Heading } from '../../../ui/Text';
import { useMyBus } from './useMyBus';

// ---------- Helpers ----------

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

// ---------- Screen ----------

export default function MyBusScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const { busStatus, loading, error, noBusAssigned, refresh } = useMyBus();
  const mapRef = useRef<MapView>(null);
  const markerRef = useRef<typeof MarkerAnimated | null>(null);

  // Animated coordinate for smooth marker glide
  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude: busStatus?.lat ?? 0,
      longitude: busStatus?.lng ?? 0,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  // Animate map + marker when bus position updates
  useEffect(() => {
    const lat = busStatus?.lat;
    const lng = busStatus?.lng;
    if (lat == null || lng == null) return;

    // Animate map camera
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      1200
    );

    // Animate marker position
    if (Platform.OS === 'android' && markerRef.current) {
      try {
        (markerRef.current as any).animateMarkerToCoordinate(
          { latitude: lat, longitude: lng },
          1500
        );
      } catch {
        animatedCoord.setValue({ latitude: lat, longitude: lng } as any);
      }
    } else {
      animatedCoord
        .timing({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0,
          longitudeDelta: 0,
          duration: 1500,
          useNativeDriver: false,
        })
        .start();
    }
  }, [busStatus?.lat, busStatus?.lng, animatedCoord]);

  // ---------- Loading ----------

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

  // ---------- No bus assigned ----------

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
          You haven't been assigned to a bus yet. Please contact your school administrator.
        </Body>
      </View>
    );
  }

  // ---------- Has bus ----------

  const hasTrip = busStatus?.trip_active ?? false;
  const busLat = busStatus?.lat ?? null;
  const busLng = busStatus?.lng ?? null;
  const hasLocation = busLat != null && busLng != null;
  const totalStudents = busStatus?.total_students ?? 0;
  const pickupCount = busStatus?.pickup_count ?? 0;
  const pickupPct = totalStudents > 0 ? (pickupCount / totalStudents) * 100 : 0;

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
              ref={(ref: any) => { markerRef.current = ref; }}
              coordinate={animatedCoord}
              anchor={{ x: 0.5, y: 0.5 }}
              rotation={busStatus?.heading ?? 0}
              flat
            >
              <View style={[styles.markerOuter, { backgroundColor: `${colors.primary.main}30` }]}>
                <View style={[styles.markerInner, { backgroundColor: colors.primary.main }]}>
                  <MaterialIcons name="directions-bus" size={16} color="#FFFFFF" />
                </View>
              </View>
            </MarkerAnimated>
          </MapView>

          {/* Speed badge */}
          {busStatus?.speed != null && busStatus.speed >= 0 && (
            <View style={[styles.speedBadge, { backgroundColor: colors.background.primary }]}>
              <Caption style={{ fontWeight: '700', color: colors.text.primary }}>
                {formatSpeed(busStatus.speed)}
              </Caption>
            </View>
          )}

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
          Location updates every ~15 seconds when the bus is on route.
        </Caption>
      </View>
    </ScrollView>
  );
}

// ---------- Styles ----------

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
