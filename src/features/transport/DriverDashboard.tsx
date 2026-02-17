/**
 * Transport Management System - Driver Dashboard
 *
 * Replaces the standard dashboard for driver-role users.
 * Shows:
 * - Assigned bus info (number, plate, student count)
 * - Active trip status / Start Ride button
 * - Today's stats (trips, pickups)
 * - Recent completed trips with duration and pickup count
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Text as RNText,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { log } from '../../lib/logger';

// ---------- Types ----------

interface BusInfo {
  id: string;
  bus_number: string;
  plate_number: string;
  capacity: number;
  total_students: number;
}

interface ActiveTrip {
  trip_id: string;
  started_at: string;
}

interface RecentTrip {
  trip_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  duration_seconds: number;
  pickup_count: number;
}

interface TodayStats {
  trips_today: number;
  pickups_today: number;
}

interface DriverDashboardData {
  bus: BusInfo | null;
  active_trip: ActiveTrip | null;
  recent_trips: RecentTrip[];
  today_stats: TodayStats;
}

// ---------- Helpers ----------

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

// ---------- Component ----------

export default function DriverDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const [data, setData] = useState<DriverDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.auth_id) return;
    try {
      const { data: result, error } = await supabase.rpc('get_driver_dashboard', {
        p_driver_id: profile.auth_id,
      });
      if (error) {
        log.warn('[TMS] Driver dashboard fetch error:', error.message);
        return;
      }
      setData(result as DriverDashboardData);
    } catch (err) {
      log.error('[TMS] Driver dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.auth_id]);

  // Refetch whenever this screen gains focus (prevents stale data after navigating back)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  const bus = data?.bus;
  const activeTrip = data?.active_trip;
  const recentTrips = data?.recent_trips ?? [];
  const todayStats = data?.today_stats ?? { trips_today: 0, pickups_today: 0 };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background.primary }}
      contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary.main}
          colors={[colors.primary.main]}
        />
      }
    >
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(0).springify()}
        style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm }}
      >
        <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary }}>
          {getGreeting()}
        </RNText>
        <RNText style={{ fontSize: 26, fontWeight: typography.fontWeight.bold as any, color: colors.text.primary, marginTop: 2 }}>
          {profile?.full_name || 'Driver'}
        </RNText>
        <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary, marginTop: 2 }}>
          School Bus Driver
        </RNText>
      </Animated.View>

      {/* Bus Assignment Card */}
      <Animated.View
        entering={FadeInDown.delay(80).springify()}
        style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}
      >
        <View style={[styles.card, {
          backgroundColor: colors.surface.primary,
          borderRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor: colors.border.light,
          ...shadows.md,
        }]}>
          {bus ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={[styles.busIconBox, { backgroundColor: colors.primary[50], borderRadius: borderRadius.lg }]}>
                  <MaterialIcons name="directions-bus" size={32} color={colors.primary[600]} />
                </View>
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <RNText style={{ fontSize: 22, fontWeight: typography.fontWeight.bold as any, color: colors.text.primary }}>
                    {bus.bus_number}
                  </RNText>
                  <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary, marginTop: 2 }}>
                    {bus.plate_number}
                  </RNText>
                </View>
                {activeTrip && (
                  <View style={[styles.liveBadge, { backgroundColor: colors.success[100] }]}>
                    <View style={[styles.liveDot, { backgroundColor: colors.success[600] }]} />
                    <RNText style={{ fontSize: 11, fontWeight: '700' as any, color: colors.success[700] }}>
                      LIVE
                    </RNText>
                  </View>
                )}
              </View>

              {/* Bus stats row */}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={[styles.statChip, { backgroundColor: colors.background.secondary, borderRadius: borderRadius.md }]}>
                  <MaterialIcons name="people" size={16} color={colors.text.secondary} />
                  <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.primary, fontWeight: '600' as any, marginLeft: 4 }}>
                    {bus.total_students}
                  </RNText>
                  <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginLeft: 4 }}>
                    Students
                  </RNText>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.background.secondary, borderRadius: borderRadius.md }]}>
                  <MaterialIcons name="event-seat" size={16} color={colors.text.secondary} />
                  <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.primary, fontWeight: '600' as any, marginLeft: 4 }}>
                    {bus.capacity}
                  </RNText>
                  <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginLeft: 4 }}>
                    Capacity
                  </RNText>
                </View>
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <MaterialIcons name="directions-bus" size={40} color={colors.text.tertiary} />
              <RNText style={{ fontSize: typography.fontSize.base, color: colors.text.secondary, marginTop: spacing.sm, textAlign: 'center' }}>
                No bus assigned yet
              </RNText>
              <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary, marginTop: 4, textAlign: 'center' }}>
                Contact your admin to get assigned to a bus
              </RNText>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Start / Continue Ride Button */}
      {bus && (
        <Animated.View
          entering={FadeInDown.delay(160).springify()}
          style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/transport' as any)}
            style={[styles.rideButton, {
              backgroundColor: activeTrip ? colors.success[600] : colors.primary[600],
              borderRadius: borderRadius.xl,
              ...shadows.lg,
            }]}
          >
            <View style={styles.rideButtonInner}>
              <View style={[styles.rideIconCircle, {
                backgroundColor: activeTrip ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)',
              }]}>
                <MaterialIcons
                  name={activeTrip ? 'navigation' : 'play-arrow'}
                  size={28}
                  color="#FFFFFF"
                />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <RNText style={{ fontSize: 18, fontWeight: typography.fontWeight.bold as any, color: '#FFFFFF' }}>
                  {activeTrip ? 'Continue Trip' : 'Start Trip'}
                </RNText>
                <RNText style={{ fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                  {activeTrip
                    ? `Started ${formatDate(activeTrip.started_at)}`
                    : 'Begin GPS tracking and pickups'}
                </RNText>
              </View>
              <MaterialIcons name="arrow-forward" size={24} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Today's Stats */}
      <Animated.View
        entering={FadeInDown.delay(240).springify()}
        style={{ paddingHorizontal: spacing.md, marginTop: spacing.lg }}
      >
        <RNText style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold as any, color: colors.text.primary, marginBottom: spacing.sm }}>
          Today
        </RNText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={[styles.todayCard, {
            flex: 1,
            backgroundColor: colors.surface.primary,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.light,
            ...shadows.sm,
          }]}>
            <View style={[styles.todayIconBox, { backgroundColor: colors.info[50], borderRadius: borderRadius.md }]}>
              <MaterialIcons name="route" size={22} color={colors.info[600]} />
            </View>
            <RNText style={{ fontSize: 28, fontWeight: typography.fontWeight.bold as any, color: colors.text.primary, marginTop: spacing.sm }}>
              {todayStats.trips_today}
            </RNText>
            <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.secondary, marginTop: 2 }}>
              Trips
            </RNText>
          </View>
          <View style={[styles.todayCard, {
            flex: 1,
            backgroundColor: colors.surface.primary,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.light,
            ...shadows.sm,
          }]}>
            <View style={[styles.todayIconBox, { backgroundColor: colors.success[50], borderRadius: borderRadius.md }]}>
              <MaterialIcons name="how-to-reg" size={22} color={colors.success[600]} />
            </View>
            <RNText style={{ fontSize: 28, fontWeight: typography.fontWeight.bold as any, color: colors.text.primary, marginTop: spacing.sm }}>
              {todayStats.pickups_today}
            </RNText>
            <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.secondary, marginTop: 2 }}>
              Pickups
            </RNText>
          </View>
        </View>
      </Animated.View>

      {/* Recent Trips */}
      <Animated.View
        entering={FadeInDown.delay(320).springify()}
        style={{ paddingHorizontal: spacing.md, marginTop: spacing.lg }}
      >
        <RNText style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold as any, color: colors.text.primary, marginBottom: spacing.sm }}>
          Recent Trips
        </RNText>

        {recentTrips.length === 0 ? (
          <View style={[styles.emptyTrips, {
            backgroundColor: colors.surface.primary,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.light,
          }]}>
            <MaterialIcons name="history" size={36} color={colors.text.tertiary} />
            <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary, marginTop: spacing.sm, textAlign: 'center' }}>
              No completed trips yet
            </RNText>
            <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginTop: 4, textAlign: 'center' }}>
              Your trip history will appear here
            </RNText>
          </View>
        ) : (
          <View style={[styles.tripsList, {
            backgroundColor: colors.surface.primary,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.light,
            ...shadows.sm,
          }]}>
            {recentTrips.map((trip, index) => (
              <React.Fragment key={trip.trip_id}>
                {index > 0 && (
                  <View style={{ height: 1, backgroundColor: colors.border.light, marginHorizontal: spacing.md }} />
                )}
                <View style={styles.tripRow}>
                  {/* Left: icon */}
                  <View style={[styles.tripIcon, {
                    backgroundColor: trip.status === 'completed' ? colors.success[50] : colors.neutral[100],
                    borderRadius: borderRadius.md,
                  }]}>
                    <MaterialIcons
                      name={trip.status === 'completed' ? 'check-circle' : 'cancel'}
                      size={20}
                      color={trip.status === 'completed' ? colors.success[600] : colors.neutral[400]}
                    />
                  </View>

                  {/* Middle: date + status */}
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <RNText style={{ fontSize: typography.fontSize.sm, fontWeight: '600' as any, color: colors.text.primary }}>
                      {formatDate(trip.started_at)}
                    </RNText>
                    <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginTop: 2 }}>
                      {trip.status === 'completed' ? 'Completed' : 'Cancelled'}
                    </RNText>
                  </View>

                  {/* Right: duration + pickups */}
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialIcons name="schedule" size={13} color={colors.text.tertiary} />
                      <RNText style={{ fontSize: typography.fontSize.sm, fontWeight: '600' as any, color: colors.text.primary, marginLeft: 3 }}>
                        {formatDuration(trip.duration_seconds)}
                      </RNText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <MaterialIcons name="people" size={13} color={colors.text.tertiary} />
                      <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.secondary, marginLeft: 3 }}>
                        {trip.pickup_count} pickup{trip.pickup_count !== 1 ? 's' : ''}
                      </RNText>
                    </View>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: 20,
  },
  busIconBox: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  rideButton: {
    overflow: 'hidden',
  },
  rideButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  rideIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayCard: {
    padding: 16,
  },
  todayIconBox: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTrips: {
    padding: 32,
    alignItems: 'center',
  },
  tripsList: {
    overflow: 'hidden',
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  tripIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
