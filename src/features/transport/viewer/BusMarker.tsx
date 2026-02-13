/**
 * Transport Management System - Animated Bus Marker
 *
 * Custom map marker that **glides** smoothly to new positions instead of
 * jumping. Uses `Marker.AnimatedMarker` (MapView.Animated) with
 * `animateMarkerToCoordinate` on Android and coordinate timing on iOS.
 *
 * Colour coding (freshness-aware):
 * - Green when moving (speed > 0.5 m/s AND data < 60s old)
 * - Amber when stopped (speed ≤ 0.5 AND data < 60s old)
 * - Grey when no signal (data > 60s old)
 * - Blue ring when selected
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { AnimatedRegion, MarkerAnimated } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

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

const ANIMATION_DURATION = 1500;
const SPEED_THRESHOLD = 0.5;       // m/s
const STALE_THRESHOLD_SEC = 60;    // 60s = "no signal"

function getMarkerColor(speed: number | null, recordedAt: string | null): string {
  if (!recordedAt) return '#9CA3AF'; // grey
  const ageSec = (Date.now() - new Date(recordedAt).getTime()) / 1000;
  if (ageSec > STALE_THRESHOLD_SEC) return '#9CA3AF'; // grey — stale
  if (speed !== null && speed > SPEED_THRESHOLD) return '#16A34A'; // green — moving
  return '#F59E0B'; // amber — stopped
}

export function BusMarker({
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

  // Keep tracksViewChanges ON briefly so the custom view (bus icon) renders,
  // then turn it OFF for performance.
  const [trackChanges, setTrackChanges] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTrackChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Re-enable tracking briefly when visual state changes
  const prevIsSelected = useRef(isSelected);
  const prevColor = useRef(markerColor);
  useEffect(() => {
    if (prevIsSelected.current !== isSelected || prevColor.current !== markerColor) {
      prevIsSelected.current = isSelected;
      prevColor.current = markerColor;
      setTrackChanges(true);
      const timer = setTimeout(() => setTrackChanges(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isSelected, markerColor]);

  // Animated coordinate for smooth movement
  const coordinate = useRef(
    new AnimatedRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  const markerRef = useRef<typeof MarkerAnimated | null>(null);

  // Animate to new position when lat/lng change
  useEffect(() => {
    if (Platform.OS === 'android') {
      if (markerRef.current) {
        try {
          (markerRef.current as any).animateMarkerToCoordinate(
            { latitude: lat, longitude: lng },
            ANIMATION_DURATION
          );
        } catch {
          coordinate.setValue({ latitude: lat, longitude: lng } as any);
        }
      }
    } else {
      coordinate
        .timing({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0,
          longitudeDelta: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: false,
        })
        .start();
    }
  }, [lat, lng, coordinate]);

  return (
    <MarkerAnimated
      ref={(ref: any) => { markerRef.current = ref; }}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={heading ?? 0}
      flat
      onPress={onPress}
      tracksViewChanges={trackChanges}
    >
      <View style={styles.wrapper}>
        {/* Outer ring (selected highlight) */}
        {isSelected && (
          <View style={[styles.selectedRing, { borderColor: '#1D4ED8' }]} />
        )}

        {/* Main circle */}
        <View style={[styles.circle, { backgroundColor: markerColor }]}>
          <MaterialIcons name="directions-bus" size={16} color="#FFF" />
        </View>
      </View>
    </MarkerAnimated>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  selectedRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
