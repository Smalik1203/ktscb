/**
 * Transport Management System - Driver Live Map
 *
 * Compact map card showing the driver's current position as a marker.
 * Auto-centres when the location updates. Uses Apple Maps on iOS and
 * Google Maps on Android (requires API key in app.config.js).
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { Caption } from '../../ui/Text';

interface DriverMapProps {
  /** Current latitude */
  lat: number;
  /** Current longitude */
  lng: number;
  /** Heading in degrees (0–360) for marker rotation */
  heading: number | null;
  /** Speed in m/s (shown as label) */
  speed: number | null;
  /** Timestamp of last update */
  recordedAt: string;
}

export function DriverMap({ lat, lng, heading, speed, recordedAt }: DriverMapProps) {
  const { colors, spacing } = useTheme();
  const mapRef = useRef<MapView>(null);

  // Animate to new position when coords change
  useEffect(() => {
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      600 // smooth 600ms animation
    );
  }, [lat, lng]);

  const speedKmh = speed !== null && speed >= 0 ? Math.round(speed * 3.6) : null;

  return (
    <View style={[styles.wrapper, { borderColor: colors.border.DEFAULT }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        // Uses Apple Maps on iOS (no key needed).
        // On Android, uses Google Maps if EXPO_PUBLIC_GOOGLE_MAPS_KEY is set
        // in app.config.js, otherwise falls back to the default provider.
        initialRegion={{
          latitude: lat,
          longitude: lng,
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
        loadingBackgroundColor={colors.background.secondary}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          rotation={heading ?? 0}
          flat
        >
          <View style={[styles.markerOuter, { backgroundColor: `${colors.primary.main}30` }]}>
            <View style={[styles.markerInner, { backgroundColor: colors.primary.main }]}>
              <MaterialIcons name="navigation" size={16} color="#FFFFFF" />
            </View>
          </View>
        </Marker>
      </MapView>

      {/* Overlay: speed badge (top-left) */}
      {speedKmh !== null && (
        <View style={[styles.speedBadge, { backgroundColor: colors.background.primary }]}>
          <Caption style={{ fontWeight: '700', color: colors.text.primary }}>
            {speedKmh} km/h
          </Caption>
        </View>
      )}

      {/* Overlay: timestamp (bottom-right) */}
      <View style={[styles.timeBadge, { backgroundColor: colors.background.primary }]}>
        <Caption color="tertiary" style={{ fontSize: 10 }}>
          {new Date(recordedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Marker
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

  // Badges
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
});
