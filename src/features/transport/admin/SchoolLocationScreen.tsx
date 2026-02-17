/**
 * School Location Screen
 *
 * Lets admins set the school's GPS coordinates (used for bus distance calculations).
 *
 * - Google Places Autocomplete search (via fetch, no extra dependencies)
 * - Draggable map pin for fine-tuning
 * - Saves lat/lng to the `schools` table
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../ui/Button';

// ---------- Config ----------

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';
const DEBOUNCE_MS = 350;

// Default: Hyderabad, India
const DEFAULT_REGION: Region = {
  latitude: 17.385,
  longitude: 78.4867,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

// ---------- Types ----------

interface Prediction {
  place_id: string;
  description: string;
}

// ---------- Screen ----------

export default function SchoolLocationScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const schoolCode = profile?.school_code;
  const mapRef = useRef<MapView>(null);

  // Marker position
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('');

  // Search
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save
  const [saving, setSaving] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(true);

  // ---------- Load existing coordinates ----------

  useEffect(() => {
    if (!schoolCode) return;
    supabase
      .from('schools')
      .select('lat, lng, school_name')
      .eq('school_code', schoolCode)
      .single()
      .then(({ data }) => {
        if (data?.lat != null && data?.lng != null) {
          setPin({ lat: data.lat, lng: data.lng });
          setAddress(data.school_name ?? 'Current location');
          setTimeout(() => {
            mapRef.current?.animateToRegion(
              {
                latitude: data.lat,
                longitude: data.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              },
              500
            );
          }, 400);
        }
        setLoadingCurrent(false);
      });
  }, [schoolCode]);

  // ---------- Google Places Autocomplete ----------

  const searchPlaces = useCallback(async (input: string) => {
    if (!input.trim() || !GOOGLE_KEY) {
      setPredictions([]);
      return;
    }
    setSearching(true);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}` +
        `&key=${GOOGLE_KEY}` +
        `&components=country:in` +
        `&types=establishment|geocode`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status === 'OK' && json.predictions) {
        setPredictions(
          json.predictions.slice(0, 5).map((p: any) => ({
            place_id: p.place_id,
            description: p.description,
          }))
        );
      } else {
        setPredictions([]);
      }
    } catch {
      setPredictions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(text), DEBOUNCE_MS);
  };

  // ---------- Select a prediction ----------

  const selectPlace = useCallback(
    async (placeId: string, description: string) => {
      Keyboard.dismiss();
      setPredictions([]);
      setQuery(description);
      setAddress(description);

      try {
        const url =
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${placeId}` +
          `&fields=geometry` +
          `&key=${GOOGLE_KEY}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.status === 'OK' && json.result?.geometry?.location) {
          const { lat, lng } = json.result.geometry.location;
          setPin({ lat, lng });
          mapRef.current?.animateToRegion(
            { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
            600
          );
        }
      } catch {
        Alert.alert('Error', 'Failed to fetch place details.');
      }
    },
    []
  );

  // ---------- Drag pin ----------

  const handleMarkerDragEnd = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setPin({ lat: latitude, lng: longitude });
      setAddress('Custom location');
      setQuery('');
    },
    []
  );

  // ---------- Tap map to move pin ----------

  const handleMapPress = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setPin({ lat: latitude, lng: longitude });
      setAddress('Custom location');
    },
    []
  );

  // ---------- Save ----------

  const handleSave = async () => {
    if (!pin || !schoolCode) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ lat: pin.lat, lng: pin.lng })
        .eq('school_code', schoolCode);
      if (error) throw error;
      Alert.alert('Saved', 'School location has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Render ----------

  const bgPrimary = colors.background.primary ?? colors.background.app;
  const bgSecondary = colors.background.secondary ?? colors.surface?.primary ?? '#F3F4F6';

  return (
    <View style={[styles.container, { backgroundColor: bgPrimary }]}>
      {/* Search bar */}
      <View style={[styles.searchWrapper, { backgroundColor: bgPrimary }]}>
        <View style={[styles.searchBar, { backgroundColor: bgSecondary }]}>
          <MaterialIcons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Search for your school..."
            placeholderTextColor={colors.text.tertiary}
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setPredictions([]);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
          {searching && <ActivityIndicator size="small" color={colors.primary.main ?? colors.primary[600]} />}
        </View>

        {/* Predictions dropdown */}
        {predictions.length > 0 && (
          <View style={[styles.dropdown, { backgroundColor: bgPrimary, borderColor: colors.border?.light ?? '#E5E7EB' }]}>
            {predictions.map((p) => (
              <TouchableOpacity
                key={p.place_id}
                style={styles.dropdownItem}
                onPress={() => selectPlace(p.place_id, p.description)}
              >
                <MaterialIcons name="place" size={18} color={colors.text.secondary} />
                <Text style={[styles.dropdownText, { color: colors.text.primary }]} numberOfLines={2}>
                  {p.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {loadingCurrent ? (
          <View style={styles.loadingMap}>
            <ActivityIndicator size="large" color={colors.primary.main ?? colors.primary[600]} />
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={
              pin
                ? { latitude: pin.lat, longitude: pin.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }
                : DEFAULT_REGION
            }
            showsUserLocation={false}
            showsCompass={false}
            toolbarEnabled={false}
            loadingEnabled
            loadingIndicatorColor={colors.primary.main ?? colors.primary[600]}
            onPress={handleMapPress}
          >
            {pin && (
              <Marker
                coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                draggable
                onDragEnd={handleMarkerDragEnd}
                tracksViewChanges={false}
              >
                <View style={styles.pinWrapper}>
                  <View style={styles.pinHead}>
                    <MaterialIcons name="school" size={18} color="#FFF" />
                  </View>
                  <View style={styles.pinTail} />
                </View>
              </Marker>
            )}
          </MapView>
        )}

        {/* Instruction overlay */}
        {!pin && !loadingCurrent && (
          <View style={styles.instructionOverlay}>
            <Text style={styles.instructionText}>
              Search above or tap the map to place the pin
            </Text>
          </View>
        )}
      </View>

      {/* Bottom bar: address + save */}
      <View style={[styles.bottomBar, { backgroundColor: bgPrimary, borderTopColor: colors.border?.light ?? '#E5E7EB' }]}>
        {pin && (
          <View style={styles.addressRow}>
            <MaterialIcons name="place" size={16} color={colors.primary.main ?? colors.primary[600]} />
            <Text style={[styles.addressText, { color: colors.text.secondary }]} numberOfLines={1}>
              {address || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}
            </Text>
            <Text style={[styles.coordText, { color: colors.text.tertiary }]}>
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </Text>
          </View>
        )}
        <Button onPress={handleSave} loading={saving} disabled={!pin} fullWidth>
          Save School Location
        </Button>
      </View>
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Search
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    zIndex: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  dropdown: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
  },

  // Map
  mapContainer: {
    flex: 1,
  },
  loadingMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionOverlay: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  instructionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Pin marker
  pinWrapper: {
    alignItems: 'center',
  },
  pinHead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#DC2626',
    marginTop: -2,
  },

  // Bottom
  bottomBar: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  coordText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
