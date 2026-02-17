/**
 * Transport Management System — Animated Bus Marker (Uber-style)
 *
 * Dead-reckoning projection: between GPS updates the marker keeps moving at
 * the last known speed + heading. When a new GPS fix arrives the animation
 * smoothly course-corrects to the actual position *and* continues projecting
 * ahead — so the marker never sits still while the bus is moving.
 *
 * See .cursor/rules/animation-policy.mdc for the full policy.
 */

import React, { useEffect, useRef, useState, memo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Animated as RNAnimated,
  Easing,
} from 'react-native';
import { AnimatedRegion, MarkerAnimated } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// ── Types ──────────────────────────────────────────────────────

interface BusMarkerProps {
  lat: number;
  lng: number;
  busNumber: string;
  heading: number | null;
  speed: number | null;
  recordedAt: string | null;
  isSelected: boolean;
  onPress: () => void;
}

// ── Constants ──────────────────────────────────────────────────

const DEFAULT_GPS_INTERVAL = 4000;   // ms — assumed first interval
const MIN_PROJECTION_MS = 2000;
const MAX_PROJECTION_MS = 8000;
const INTERVAL_BUFFER = 1.3;         // project slightly past next update
const SETTLE_DURATION = 500;         // ms — ease to actual pos when stopped
const HEADING_DURATION = 400;        // ms — rotation smoothing
const ENTRY_DURATION = 300;          // ms — mount fade + scale
const SPEED_THRESHOLD = 0.5;         // m/s — below = "stopped"
const STALE_THRESHOLD_SEC = 300;     // 5 min — grey "inactive" colour
const JUMP_THRESHOLD_DEG = 0.005;    // ~0.5 km — snap, don't animate
const GPS_SILENCE_MS = 10_000;       // 10 s gap — snap + freeze
const METERS_PER_DEG_LAT = 111_320;

// ── Helpers ────────────────────────────────────────────────────

function getMarkerColor(
  speed: number | null,
  recordedAt: string | null,
): string {
  if (!recordedAt) return '#9CA3AF';
  const ageSec = (Date.now() - new Date(recordedAt).getTime()) / 1000;
  if (ageSec > STALE_THRESHOLD_SEC) return '#9CA3AF';
  if (speed !== null && speed > SPEED_THRESHOLD) return '#16A34A';
  return '#F59E0B';
}

/** Shortest rotation delta — avoids 350° spin when 10° would do. */
function shortestHeadingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** Dead-reckoning: project position forward at speed + heading. */
function projectPosition(
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

/** Clamp projection duration to [MIN, MAX]. */
function clampProjection(intervalMs: number): number {
  return Math.min(
    MAX_PROJECTION_MS,
    Math.max(MIN_PROJECTION_MS, intervalMs * INTERVAL_BUFFER),
  );
}

// ── Component ──────────────────────────────────────────────────

export const BusMarker = memo(function BusMarker({
  lat,
  lng,
  busNumber,
  heading,
  speed,
  recordedAt,
  isSelected,
  onPress,
}: BusMarkerProps) {
  const markerColor = getMarkerColor(speed, recordedAt);

  /* ── tracksViewChanges ───────────────────────────────────── */
  const renderDelay = Platform.OS === 'android' ? 2000 : 500;
  const [trackChanges, setTrackChanges] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setTrackChanges(false), renderDelay);
    return () => clearTimeout(t);
  }, [renderDelay]);

  const prevIsSelected = useRef(isSelected);
  const prevColor = useRef(markerColor);
  useEffect(() => {
    if (
      prevIsSelected.current !== isSelected ||
      prevColor.current !== markerColor
    ) {
      prevIsSelected.current = isSelected;
      prevColor.current = markerColor;
      setTrackChanges(true);
      const t = setTimeout(() => setTrackChanges(false), renderDelay);
      return () => clearTimeout(t);
    }
  }, [isSelected, markerColor, renderDelay]);

  /* ── AnimatedRegion (position) ───────────────────────────── */
  const coordinate = useRef(
    new AnimatedRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  const runningAnim = useRef<any>(null);
  const lastPos = useRef({ lat, lng });
  const lastGpsMs = useRef(0);
  const isFirst = useRef(true);

  // Latest speed/heading in refs — read inside effects without
  // listing them as deps (avoids re-fires on tiny float changes).
  const speedRef = useRef(speed);
  const headingRef = useRef(heading);
  speedRef.current = speed;
  headingRef.current = heading;

  const isMoving = speed !== null && speed > SPEED_THRESHOLD;

  /* ── Position + projection effect ────────────────────────── */
  useEffect(() => {
    // 1. Cancel anything running
    if (runningAnim.current) {
      runningAnim.current.stop();
      runningAnim.current = null;
    }

    const now = Date.now();
    const rawInterval =
      lastGpsMs.current > 0
        ? now - lastGpsMs.current
        : DEFAULT_GPS_INTERVAL;
    lastGpsMs.current = now;

    const dLat = Math.abs(lat - lastPos.current.lat);
    const dLng = Math.abs(lng - lastPos.current.lng);
    lastPos.current = { lat, lng };

    const curSpeed = speedRef.current ?? 0;
    const curHeading = headingRef.current ?? 0;

    // 2. Snap cases: first mount · big jump · GPS silence
    if (
      isFirst.current ||
      dLat > JUMP_THRESHOLD_DEG ||
      dLng > JUMP_THRESHOLD_DEG ||
      rawInterval > GPS_SILENCE_MS
    ) {
      isFirst.current = false;
      coordinate.setValue({ latitude: lat, longitude: lng } as any);

      // Start fresh projection from snapped position
      if (isMoving && curSpeed > SPEED_THRESHOLD) {
        const projMs = clampProjection(rawInterval);
        const target = projectPosition(
          lat, lng, curSpeed, curHeading, projMs / 1000,
        );
        const anim = coordinate.timing({
          ...target,
          latitudeDelta: 0,
          longitudeDelta: 0,
          duration: projMs,
          easing: Easing.linear,
          useNativeDriver: false,
        });
        runningAnim.current = anim;
        anim.start(() => {
          runningAnim.current = null;
        });
      }
      return;
    }
    isFirst.current = false;

    // 3. Moving → project ahead (Uber-style dead reckoning)
    if (isMoving && curSpeed > SPEED_THRESHOLD) {
      const projMs = clampProjection(rawInterval);
      const target = projectPosition(
        lat, lng, curSpeed, curHeading, projMs / 1000,
      );
      // timing() starts from wherever the marker IS right now →
      // any drift from the previous projection is naturally corrected.
      const anim = coordinate.timing({
        ...target,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration: projMs,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      runningAnim.current = anim;
      anim.start(() => {
        runningAnim.current = null;
      });
    } else {
      // 4. Stopped → settle to actual GPS position
      const anim = coordinate.timing({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration: SETTLE_DURATION,
        useNativeDriver: false,
      });
      runningAnim.current = anim;
      anim.start(() => {
        runningAnim.current = null;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, isMoving, coordinate]);

  /* ── Heading smoothing ───────────────────────────────────── */
  const headingAnim = useRef(new RNAnimated.Value(heading ?? 0)).current;
  const prevHeadingVal = useRef(heading ?? 0);

  useEffect(() => {
    const target = heading ?? 0;
    const delta = shortestHeadingDelta(prevHeadingVal.current, target);
    if (Math.abs(delta) < 1) {
      prevHeadingVal.current = target;
      return;
    }
    RNAnimated.timing(headingAnim, {
      toValue: prevHeadingVal.current + delta,
      duration: HEADING_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      const n = ((target % 360) + 360) % 360;
      prevHeadingVal.current = n;
      headingAnim.setValue(n);
    });
  }, [heading, headingAnim]);

  /* ── Entry animation (fade + scale) ──────────────────────── */
  const entryOpacity = useRef(new RNAnimated.Value(0)).current;
  const entryScale = useRef(new RNAnimated.Value(0.6)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(entryOpacity, {
        toValue: 1,
        duration: ENTRY_DURATION,
        useNativeDriver: true,
      }),
      RNAnimated.timing(entryScale, {
        toValue: 1,
        duration: ENTRY_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entryOpacity, entryScale]);

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <MarkerAnimated
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={headingAnim as any}
      flat
      onPress={onPress}
      tracksViewChanges={trackChanges}
    >
      <RNAnimated.View
        style={[
          styles.wrapper,
          { opacity: entryOpacity, transform: [{ scale: entryScale }] },
        ]}
      >
        {isSelected && (
          <View style={[styles.selectedRing, { borderColor: '#1D4ED8' }]} />
        )}
        <View style={[styles.circle, { backgroundColor: markerColor }]}>
          <MaterialIcons name="directions-bus" size={16} color="#FFF" />
        </View>
      </RNAnimated.View>
    </MarkerAnimated>
  );
});

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  selectedRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
});
