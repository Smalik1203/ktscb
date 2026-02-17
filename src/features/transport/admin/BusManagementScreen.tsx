/**
 * Bus Management Screen
 *
 * CRUD for school buses. Follows the inventory-screen pattern:
 * FlatList for list view, conditional full-screen form for create/edit.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { spacing, typography, borderRadius, shadows } from '../../../../lib/design-system';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { FAB } from '../../../ui/FAB';
import { SearchBar } from '../../../ui/SearchBar';
import { EmptyState } from '../../../ui/EmptyState';

// ---------- Types ----------

interface Bus {
  id: string;
  bus_number: string;
  plate_number: string | null;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
  driver_name?: string | null;
}

// ---------- Screen ----------

export default function BusManagementScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const schoolCode = profile?.school_code;

  // List state
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [busNumber, setBusNumber] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [isActive, setIsActive] = useState(true);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // ---------- Data Fetching ----------

  const fetchBuses = useCallback(async () => {
    if (!schoolCode) return;
    try {
      // Fetch buses with their assigned driver's name
      const { data, error } = await supabase
        .from('buses')
        .select('id, bus_number, plate_number, capacity, is_active, created_at')
        .eq('school_code', schoolCode)
        .order('bus_number', { ascending: true });

      if (error) throw error;

      // Fetch driver assignments separately
      const { data: drivers } = await supabase
        .from('drivers')
        .select('bus_id, id')
        .eq('school_code', schoolCode)
        .not('bus_id', 'is', null);

      // Fetch driver names from users
      const driverUserIds = (drivers || []).map((d) => d.id);
      let driverNames: Record<string, string> = {};
      if (driverUserIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', driverUserIds);
        if (users) {
          for (const u of users) {
            driverNames[u.id] = u.full_name;
          }
        }
      }

      // Map driver names to buses
      const driverByBus: Record<string, string> = {};
      for (const d of drivers || []) {
        if (d.bus_id) {
          driverByBus[d.bus_id] = driverNames[d.id] || 'Unknown';
        }
      }

      const enriched: Bus[] = (data || []).map((b) => ({
        ...b,
        driver_name: driverByBus[b.id] || null,
      }));

      setBuses(enriched);
    } catch (err) {
      console.error('Failed to fetch buses:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolCode]);

  useEffect(() => {
    fetchBuses();
  }, [fetchBuses]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBuses();
  };

  // ---------- Filtered List ----------

  const filtered = useMemo(() => {
    if (!search.trim()) return buses;
    const q = search.toLowerCase();
    return buses.filter(
      (b) =>
        b.bus_number.toLowerCase().includes(q) ||
        b.plate_number?.toLowerCase().includes(q) ||
        b.driver_name?.toLowerCase().includes(q)
    );
  }, [buses, search]);

  // ---------- Form Helpers ----------

  const resetForm = () => {
    setBusNumber('');
    setPlateNumber('');
    setCapacity('');
    setIsActive(true);
    setEditingBus(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (bus: Bus) => {
    setEditingBus(bus);
    setBusNumber(bus.bus_number);
    setPlateNumber(bus.plate_number || '');
    setCapacity(bus.capacity?.toString() || '');
    setIsActive(bus.is_active);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!busNumber.trim()) {
      Alert.alert('Validation', 'Bus number is required.');
      return;
    }
    if (!schoolCode) return;

    setSaving(true);
    try {
      const payload = {
        bus_number: busNumber.trim(),
        plate_number: plateNumber.trim() || null,
        capacity: capacity ? parseInt(capacity, 10) : null,
        is_active: isActive,
        school_code: schoolCode,
      };

      if (editingBus) {
        const { error } = await supabase
          .from('buses')
          .update(payload)
          .eq('id', editingBus.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('buses').insert(payload);
        if (error) throw error;
      }

      setShowForm(false);
      resetForm();
      fetchBuses();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save bus.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (bus: Bus) => {
    Alert.alert('Delete Bus', `Are you sure you want to delete ${bus.bus_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('buses').delete().eq('id', bus.id);
            if (error) throw error;
            fetchBuses();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete bus.');
          }
        },
      },
    ]);
  };

  // ---------- Render: Form ----------

  if (showForm) {
    return (
      <View style={styles.container}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.formTitle}>
            {editingBus ? 'Edit Bus' : 'Add Bus'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.formBody}>
          <Input
            label="Bus Number"
            placeholder="e.g. BUS-001"
            value={busNumber}
            onChangeText={setBusNumber}
            required
          />
          <Input
            label="Plate Number"
            placeholder="e.g. KA-01-AB-1234"
            value={plateNumber}
            onChangeText={setPlateNumber}
          />
          <Input
            label="Capacity"
            placeholder="e.g. 40"
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Active</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ true: colors.primary[500] }}
            />
          </View>

          <Button onPress={handleSave} loading={saving} fullWidth>
            {editingBus ? 'Update Bus' : 'Create Bus'}
          </Button>
        </View>
      </View>
    );
  }

  // ---------- Render: List ----------

  const renderBusCard = ({ item }: { item: Bus }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openEdit(item)}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <MaterialIcons name="directions-bus" size={28} color={colors.primary[600]} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.bus_number}</Text>
          {item.plate_number && (
            <Text style={styles.cardSubtitle}>{item.plate_number}</Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: item.is_active ? colors.success[100] : colors.error[100] }]}>
          <Text style={[styles.badgeText, { color: item.is_active ? colors.success[700] : colors.error[700] }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        {item.capacity && (
          <View style={styles.stat}>
            <MaterialIcons name="people" size={16} color={colors.text.tertiary} />
            <Text style={styles.statText}>{item.capacity} seats</Text>
          </View>
        )}
        <View style={styles.stat}>
          <MaterialIcons name="person" size={16} color={colors.text.tertiary} />
          <Text style={styles.statText}>{item.driver_name || 'No driver'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search buses..."
      />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary[600]} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Buses"
          message={search ? 'No buses match your search.' : 'Add your first bus to get started.'}
          actionLabel={!search ? 'Add Bus' : undefined}
          onAction={!search ? openCreate : undefined}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderBusCard}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.locationCard}
              onPress={() => router.push('/(tabs)/transport-school-location')}
              activeOpacity={0.7}
            >
              <View style={[styles.locationIcon, { backgroundColor: `${colors.primary[600]}12` }]}>
                <MaterialIcons name="place" size={22} color={colors.primary[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.locationTitle, { color: colors.text.primary }]}>School Location</Text>
                <Text style={[styles.locationSub, { color: colors.text.tertiary }]}>Set destination for bus distance</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.text.tertiary} />
            </TouchableOpacity>
          }
        />
      )}

      <FAB icon="add" onPress={openCreate} />
    </View>
  );
}

// ---------- Styles ----------

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.app,
    },
    list: {
      padding: spacing.md,
      paddingBottom: 80,
    },
    card: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadows.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardIcon: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary[50],
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    cardInfo: {
      flex: 1,
    },
    cardTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold as any,
      color: colors.text.primary,
    },
    cardSubtitle: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
    },
    badgeText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold as any,
    },
    cardFooter: {
      flexDirection: 'row',
      marginTop: spacing.sm,
      gap: spacing.md,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.tertiary,
    },
    // School location card
    locationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
      ...shadows.sm,
    },
    locationIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold as any,
    },
    locationSub: {
      fontSize: typography.fontSize.xs,
      marginTop: 1,
    },
    // Form
    formHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    formTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold as any,
      color: colors.text.primary,
    },
    formBody: {
      padding: spacing.md,
      gap: spacing.md,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    switchLabel: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium as any,
      color: colors.text.primary,
    },
  });
}
