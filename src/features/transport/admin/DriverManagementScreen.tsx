/**
 * Driver Management Screen
 *
 * List drivers, create new drivers (via Edge Function), edit, assign to buses.
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
  ScrollView,
} from 'react-native';
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
import { Modal } from '../../../ui/Modal';
import { validatePassword } from '../../../utils/sanitize';

// ---------- Types ----------

interface Driver {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  license_number: string | null;
  bus_id: string | null;
  bus_number: string | null;
  is_active: boolean;
}

interface BusOption {
  id: string;
  bus_number: string;
}

// ---------- Screen ----------

export default function DriverManagementScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useAuth();
  const schoolCode = profile?.school_code;

  // List state
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Buses for picker
  const [busOptions, setBusOptions] = useState<BusOption[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);

  // Bus picker modal
  const [showBusPicker, setShowBusPicker] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // ---------- Data Fetching ----------

  const fetchDrivers = useCallback(async () => {
    if (!schoolCode) return;
    try {
      // Fetch drivers joined with users for name/email
      const { data: driverRows, error } = await supabase
        .from('drivers')
        .select('id, bus_id, license_number, phone, is_active')
        .eq('school_code', schoolCode)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const driverIds = (driverRows || []).map((d) => d.id);
      let userMap: Record<string, { full_name: string; email: string | null }> = {};
      if (driverIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', driverIds);
        for (const u of users || []) {
          userMap[u.id] = { full_name: u.full_name, email: u.email };
        }
      }

      // Fetch bus numbers
      const busIds = (driverRows || []).filter((d) => d.bus_id).map((d) => d.bus_id!);
      let busMap: Record<string, string> = {};
      if (busIds.length > 0) {
        const { data: buses } = await supabase
          .from('buses')
          .select('id, bus_number')
          .in('id', busIds);
        for (const b of buses || []) {
          busMap[b.id] = b.bus_number;
        }
      }

      const enriched: Driver[] = (driverRows || []).map((d) => ({
        id: d.id,
        full_name: userMap[d.id]?.full_name || 'Unknown',
        email: userMap[d.id]?.email || null,
        phone: d.phone,
        license_number: d.license_number,
        bus_id: d.bus_id,
        bus_number: d.bus_id ? busMap[d.bus_id] || null : null,
        is_active: d.is_active,
      }));

      setDrivers(enriched);
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolCode]);

  const fetchBuses = useCallback(async () => {
    if (!schoolCode) return;
    const { data } = await supabase
      .from('buses')
      .select('id, bus_number')
      .eq('school_code', schoolCode)
      .eq('is_active', true)
      .order('bus_number');
    setBusOptions(data || []);
  }, [schoolCode]);

  useEffect(() => {
    fetchDrivers();
    fetchBuses();
  }, [fetchDrivers, fetchBuses]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDrivers();
    fetchBuses();
  };

  // ---------- Filtered List ----------

  const filtered = useMemo(() => {
    if (!search.trim()) return drivers;
    const q = search.toLowerCase();
    return drivers.filter(
      (d) =>
        d.full_name.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.phone?.includes(q) ||
        d.bus_number?.toLowerCase().includes(q)
    );
  }, [drivers, search]);

  // ---------- Form Helpers ----------

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setLicenseNumber('');
    setSelectedBusId(null);
    setIsActive(true);
    setEditingDriver(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFullName(driver.full_name);
    setEmail(driver.email || '');
    setPhone(driver.phone || '');
    setLicenseNumber(driver.license_number || '');
    setSelectedBusId(driver.bus_id);
    setIsActive(driver.is_active);
    setShowForm(true);
  };

  const selectedBusLabel = useMemo(() => {
    if (!selectedBusId) return 'None';
    return busOptions.find((b) => b.id === selectedBusId)?.bus_number || 'Unknown';
  }, [selectedBusId, busOptions]);

  // ---------- Save ----------

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation', 'Full name is required.');
      return;
    }
    if (!schoolCode) return;

    setSaving(true);
    try {
      if (editingDriver) {
        // Update existing driver + user
        const { data: updatedDriver, error: driverErr } = await supabase
          .from('drivers')
          .update({
            bus_id: selectedBusId,
            license_number: licenseNumber.trim() || null,
            phone: phone.trim() || null,
            is_active: isActive,
          })
          .eq('id', editingDriver.id)
          .select('id')
          .single();
        if (driverErr) throw driverErr;
        if (!updatedDriver) throw new Error('Update failed — you may not have permission to edit drivers.');

        const { error: userErr } = await supabase
          .from('users')
          .update({
            full_name: fullName.trim(),
            phone: phone.trim() || null,
          })
          .eq('id', editingDriver.id);
        if (userErr) throw userErr;

        setShowForm(false);
        resetForm();
        fetchDrivers();
      } else {
        // Create new driver via Edge Function
        if (!email.trim() || !email.includes('@')) {
          Alert.alert('Validation', 'A valid email is required for new drivers.');
          setSaving(false);
          return;
        }

        if (!password.trim()) {
          Alert.alert('Validation', 'Password is required for new drivers.');
          setSaving(false);
          return;
        }

        // Validate password strength (same rules as admin/student creation)
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
          const missing: string[] = [];
          if (!passwordValidation.requirements.minLength) missing.push('at least 8 characters');
          if (!passwordValidation.requirements.hasLetter) missing.push('at least one letter');
          if (!passwordValidation.requirements.hasNumber) missing.push('at least one number');
          Alert.alert('Validation Error', `Password must contain: ${missing.join(', ')}`);
          setSaving(false);
          return;
        }

        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) {
          Alert.alert('Error', 'Not authenticated.');
          setSaving(false);
          return;
        }

        const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const response = await fetch(`${baseUrl}/functions/v1/create-driver`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password: password,
            phone: phone.trim() || undefined,
            school_code: schoolCode,
            license_number: licenseNumber.trim() || undefined,
            bus_id: selectedBusId || undefined,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create driver');
        }

        Alert.alert('Driver Created', `${result.driver.full_name} has been created successfully.`);

        setShowForm(false);
        resetForm();
        fetchDrivers();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save driver.');
    } finally {
      setSaving(false);
    }
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
            {editingDriver ? 'Edit Driver' : 'Add Driver'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.formBody}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Input
            label="Full Name"
            placeholder="Driver's full name"
            value={fullName}
            onChangeText={setFullName}
            required
          />
          <Input
            label="Email"
            placeholder="driver@school.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            required={!editingDriver}
            disabled={!!editingDriver}
          />
          {!editingDriver && (
            <Input
              label="Password"
              placeholder="Min 8 chars, letter + number"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              required
            />
          )}
          <Input
            label="Phone"
            placeholder="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Input
            label="License Number"
            placeholder="DL number"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
          />

          {/* Bus Picker */}
          <View>
            <Text style={styles.fieldLabel}>Assign Bus</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowBusPicker(true)}
            >
              <MaterialIcons name="directions-bus" size={20} color={colors.text.secondary} />
              <Text style={styles.pickerText}>{selectedBusLabel}</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {editingDriver && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ true: colors.primary[500] }}
              />
            </View>
          )}

          <Button onPress={handleSave} loading={saving} fullWidth>
            {editingDriver ? 'Update Driver' : 'Create Driver'}
          </Button>
        </ScrollView>

        {/* Bus Picker Modal */}
        <Modal
          visible={showBusPicker}
          onDismiss={() => setShowBusPicker(false)}
          title="Select Bus"
          size="md"
        >
          <TouchableOpacity
            style={styles.pickerOption}
            onPress={() => { setSelectedBusId(null); setShowBusPicker(false); }}
          >
            <Text style={[styles.pickerOptionText, !selectedBusId && styles.pickerOptionActive]}>
              None (Unassigned)
            </Text>
          </TouchableOpacity>
          {busOptions.map((bus) => (
            <TouchableOpacity
              key={bus.id}
              style={styles.pickerOption}
              onPress={() => { setSelectedBusId(bus.id); setShowBusPicker(false); }}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  selectedBusId === bus.id && styles.pickerOptionActive,
                ]}
              >
                {bus.bus_number}
              </Text>
              {selectedBusId === bus.id && (
                <MaterialIcons name="check" size={20} color={colors.primary[600]} />
              )}
            </TouchableOpacity>
          ))}
        </Modal>
      </View>
    );
  }

  // ---------- Render: List ----------

  const renderDriverCard = ({ item }: { item: Driver }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardAvatar, { backgroundColor: item.is_active ? colors.primary[100] : colors.neutral[200] }]}>
          <MaterialIcons name="person" size={24} color={item.is_active ? colors.primary[600] : colors.neutral[500]} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.full_name}</Text>
          {item.email && <Text style={styles.cardSubtitle}>{item.email}</Text>}
        </View>
        <View style={[styles.statusDot, { backgroundColor: item.is_active ? colors.success[500] : colors.neutral[400] }]} />
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.stat}>
          <MaterialIcons name="directions-bus" size={16} color={colors.text.tertiary} />
          <Text style={styles.statText}>{item.bus_number || 'No bus'}</Text>
        </View>
        {item.phone && (
          <View style={styles.stat}>
            <MaterialIcons name="phone" size={16} color={colors.text.tertiary} />
            <Text style={styles.statText}>{item.phone}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search drivers..." />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary[600]} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Drivers"
          message={search ? 'No drivers match your search.' : 'Add your first driver to get started.'}
          actionLabel={!search ? 'Add Driver' : undefined}
          onAction={!search ? openCreate : undefined}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderDriverCard}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <FAB icon="person-add" onPress={openCreate} />
    </View>
  );
}

// ---------- Styles ----------

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.app },
    list: { padding: spacing.md, paddingBottom: 80 },
    card: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadows.sm,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    cardAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    cardInfo: { flex: 1 },
    cardTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold as any,
      color: colors.text.primary,
    },
    cardSubtitle: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginTop: 2,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    cardFooter: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.md },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: typography.fontSize.sm, color: colors.text.tertiary },
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
    formBody: { padding: spacing.md },
    fieldLabel: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium as any,
      color: colors.text.secondary,
      marginBottom: spacing.xs,
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: borderRadius.input,
      padding: spacing.md,
      gap: spacing.sm,
    },
    pickerText: {
      flex: 1,
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
    },
    pickerOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    pickerOptionText: {
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
    },
    pickerOptionActive: {
      fontWeight: typography.fontWeight.semibold as any,
      color: colors.primary[600],
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
