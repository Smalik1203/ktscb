/**
 * Transport Management System - Trip Screen
 *
 * Driver-facing screen optimised for in-vehicle use:
 * - Large, centred hero status with pulsing animation when active
 * - Live elapsed-time counter
 * - Big tap targets for Start / Stop
 * - Speed + location at a glance
 * - Offline queue badge
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  TouchableOpacity,
  Text as RNText,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Heading, Body, Caption } from '../../ui/Text';
import { Badge } from '../../ui/Badge';
import { useTripManager } from './useTripManager';
import { DriverMap } from './DriverMap';
import { PickupChecklist } from './trip/PickupChecklist';
import { useLocationPingListener } from './locationPing';

// ---------- Elapsed timer hook ----------

function useElapsedTime(startedAt: string | null, active: boolean): string {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startedAt || !active) {
      setElapsed('00:00:00');
      return;
    }

    const tick = () => {
      const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
      const hrs = Math.floor(diff / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1_000);
      setElapsed(
        `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [startedAt, active]);

  return elapsed;
}

// ---------- Pulsing dot component ----------

function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.6,
            duration: 1000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.pulseContainer}>
      {/* Pulsing ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: color,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
      {/* Solid centre dot */}
      <View style={[styles.pulseDot, { backgroundColor: color }]} />
    </View>
  );
}

// ---------- Speed formatter ----------

function formatSpeed(speedMs: number | null): string {
  if (speedMs === null || speedMs < 0) return '--';
  const kmh = speedMs * 3.6;
  return `${Math.round(kmh)}`;
}

function formatHeading(heading: number | null): string {
  if (heading === null) return '--';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(heading / 45) % 8;
  return dirs[idx];
}

// ---------- Screen ----------

export default function TripScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, spacing, borderRadius, typography } = useTheme();
  const {
    status,
    error,
    startedAt,
    tripId,
    busId,
    lastLocation,
    queueSize,
    loading,
    permissionStatus,
    startTrip,
    stopTrip,
    openSettings,
  } = useTripManager();

  const isActive = status === 'active';
  const isStopping = status === 'stopping';
  const isIdle = status === 'idle';

  const elapsed = useElapsedTime(startedAt, isActive);

  // Listen for admin location pings — only when trip is active
  const { user } = useAuth();
  useLocationPingListener(isActive ? user?.id : undefined);

  // ---------- Render ----------

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl + 16 },
      ]}
    >
      {/* ===== Hero Status Area ===== */}
      <View style={[styles.heroSection, { paddingTop: spacing.xl }]}>
        {/* Large status icon */}
        <View
          style={[
            styles.heroIconWrapper,
            {
              backgroundColor: isActive
                ? `${colors.success.main}18`
                : isStopping
                  ? `${colors.warning.main}18`
                  : `${colors.text.tertiary}12`,
            },
          ]}
        >
          <MaterialIcons
            name={isActive ? 'gps-fixed' : isStopping ? 'hourglass-top' : 'directions-bus'}
            size={48}
            color={
              isActive
                ? colors.success.main
                : isStopping
                  ? colors.warning.main
                  : colors.text.tertiary
            }
          />
          {isActive && (
            <View style={styles.pulseAnchor}>
              <PulsingDot color={colors.success.main} />
            </View>
          )}
        </View>

        {/* Status label */}
        <Heading
          level={3}
          align="center"
          style={{
            marginTop: spacing.md,
            color: isActive
              ? colors.success.main
              : isStopping
                ? colors.warning.main
                : colors.text.primary,
          }}
        >
          {isActive ? 'Trip in Progress' : isStopping ? 'Stopping Trip...' : 'Ready to Drive'}
        </Heading>

        {/* Elapsed time — only when active */}
        {isActive && (
          <View style={[styles.timerContainer, { marginTop: spacing.sm }]}>
            <MaterialIcons name="timer" size={18} color={colors.text.secondary} />
            <Heading
              level={2}
              align="center"
              color="secondary"
              style={{ marginLeft: spacing.xs, letterSpacing: 2 }}
            >
              {elapsed}
            </Heading>
          </View>
        )}

        {/* Subtitle when idle */}
        {isIdle && (
          <Body color="secondary" align="center" style={{ marginTop: spacing.xs }}>
            Press the button below to begin tracking
          </Body>
        )}
      </View>

      {/* ===== Error Banner ===== */}
      {error && (
        <Card
          variant="outlined"
          padding="md"
          style={{
            marginTop: spacing.lg,
            borderColor: colors.error.main,
          }}
        >
          <View style={styles.rowCenter}>
            <MaterialIcons name="error-outline" size={20} color={colors.error.main} />
            <Body color="error" style={{ marginLeft: spacing.sm, flex: 1 }}>
              {error}
            </Body>
          </View>
          {(permissionStatus === 'denied_permanently' ||
            permissionStatus === 'gps_disabled') && (
            <Button
              variant="outline"
              size="sm"
              onPress={openSettings}
              style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
            >
              Open Settings
            </Button>
          )}
        </Card>
      )}

      {/* ===== Live Stats Cards (active only) ===== */}
      {isActive && (
        <View style={[styles.statsRow, { marginTop: spacing.lg }]}>
          {/* Speed */}
          <Card variant="elevated" padding="md" style={styles.statCard}>
            <Caption color="secondary" align="center">Speed</Caption>
            <View style={styles.statValueRow}>
              <Heading level={2} align="center">
                {formatSpeed(lastLocation?.speed ?? null)}
              </Heading>
              <Caption color="tertiary" style={{ marginLeft: 2, marginTop: 4 }}>km/h</Caption>
            </View>
          </Card>

          {/* Direction */}
          <Card variant="elevated" padding="md" style={styles.statCard}>
            <Caption color="secondary" align="center">Heading</Caption>
            <View style={styles.statValueRow}>
              <Heading level={2} align="center">
                {formatHeading(lastLocation?.heading ?? null)}
              </Heading>
            </View>
          </Card>

          {/* Queue */}
          <Card variant="elevated" padding="md" style={styles.statCard}>
            <Caption color="secondary" align="center">Pending</Caption>
            <View style={styles.statValueRow}>
              <Heading
                level={2}
                align="center"
                style={queueSize > 0 ? { color: colors.warning.main } : undefined}
              >
                {String(queueSize)}
              </Heading>
            </View>
          </Card>
        </View>
      )}

      {/* ===== Live Map (active + has location) ===== */}
      {isActive && lastLocation && (
        <View style={{ marginTop: spacing.md }}>
          <DriverMap
            lat={lastLocation.lat}
            lng={lastLocation.lng}
            heading={lastLocation.heading}
            speed={lastLocation.speed}
            recordedAt={lastLocation.recorded_at}
          />
        </View>
      )}

      {/* ===== Location Details (active only) ===== */}
      {isActive && lastLocation && (
        <Card variant="outlined" padding="sm" style={{ marginTop: spacing.sm }}>
          <View style={styles.rowCenter}>
            <MaterialIcons name="my-location" size={14} color={colors.primary.main} />
            <Caption color="secondary" style={{ marginLeft: spacing.xs, flex: 1 }}>
              {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
            </Caption>
            <Caption color="tertiary">
              {new Date(lastLocation.recorded_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </Caption>
          </View>
        </Card>
      )}

      {/* ===== Pickup Checklist (active trip + bus assigned) ===== */}
      {isActive && tripId && busId && (
        <View style={{ marginTop: spacing.lg }}>
          <PickupChecklist tripId={tripId} busId={busId} />
        </View>
      )}

      {/* ===== Offline queue banner (idle, but queued items remain) ===== */}
      {isIdle && queueSize > 0 && (
        <Card variant="outlined" padding="md" style={{ marginTop: spacing.lg, borderColor: colors.warning.main }}>
          <View style={styles.rowCenter}>
            <MaterialIcons name="cloud-off" size={18} color={colors.warning.main} />
            <Body color="secondary" style={{ marginLeft: spacing.sm, flex: 1 }}>
              {queueSize} update{queueSize !== 1 ? 's' : ''} waiting to upload
            </Body>
            <Badge variant="warning" size="sm">{String(queueSize)}</Badge>
          </View>
        </Card>
      )}

      {/* ===== Main Action Button ===== */}
      <View style={[styles.actionArea, { marginTop: isActive ? spacing.xl : spacing['2xl'] ?? 32 }]}>
        {isIdle ? (
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onPress={startTrip}
            loading={loading}
            disabled={loading}
            icon={
              !loading ? (
                <MaterialIcons name="play-arrow" size={28} color={colors.text.inverse} />
              ) : undefined
            }
            style={{ minHeight: 60, borderRadius: 16 }}
            accessibilityLabel="Start Trip"
            accessibilityHint="Begins GPS location tracking for your bus trip"
          >
            Start Trip
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="xl"
            fullWidth
            onPress={stopTrip}
            loading={loading || isStopping}
            disabled={loading || isStopping}
            icon={
              !loading && !isStopping ? (
                <MaterialIcons name="stop" size={28} color={colors.text.inverse} />
              ) : undefined
            }
            style={{ minHeight: 60, borderRadius: 16 }}
            accessibilityLabel="Stop Trip"
            accessibilityHint="Stops GPS location tracking and ends the current trip"
          >
            {isStopping ? 'Stopping...' : 'End Trip'}
          </Button>
        )}
      </View>

      {/* ===== Info Footer ===== */}
      <View style={[styles.infoFooter, { marginTop: spacing.xl }]}>
        <MaterialIcons name="info-outline" size={14} color={colors.text.tertiary} />
        <Caption color="tertiary" style={{ marginLeft: spacing.xs, flex: 1 }}>
          Tracking continues in the background. A notification will appear while a trip is active.
        </Caption>
      </View>

      {/* ===== Back to Home (when idle) ===== */}
      {isIdle && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.replace('/(tabs)' as any)}
          style={[styles.homeButton, {
            marginTop: spacing.lg,
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.light,
          }]}
        >
          <MaterialIcons name="home" size={20} color={colors.primary.main} />
          <RNText style={{
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.semibold as any,
            color: colors.primary.main,
            marginLeft: 8,
          }}>
            Back to Dashboard
          </RNText>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  heroIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseAnchor: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Pulse
  pulseContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Timer
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },

  // Shared
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Action
  actionArea: {
    paddingHorizontal: 4,
  },

  // Footer
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },

  // Home button
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 4,
  },
});
