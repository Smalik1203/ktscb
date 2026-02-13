/**
 * Transport Management System - Pickup Checklist
 *
 * Driver-facing component shown during an active trip.
 * Displays all students assigned to the driver's bus and allows
 * the driver to mark each as "picked up".
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { Card } from '../../../ui/Card';
import { Body, Caption, Heading } from '../../../ui/Text';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { log } from '../../../lib/logger';

// ---------- Types ----------

interface StudentPickup {
  studentId: string;
  fullName: string;
  pickupPoint: string | null;
  pickedUp: boolean;
  pickupId: string | null; // trip_pickups.id if picked up
}

interface PickupChecklistProps {
  tripId: string;
  busId: string;
}

// ---------- Component ----------

export function PickupChecklist({ tripId, busId }: PickupChecklistProps) {
  const { colors, spacing } = useTheme();
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ---------- Fetch students + pickup state ----------

  const fetchStudents = useCallback(async () => {
    if (!busId || !tripId) return;

    try {
      // 1. Get all students assigned to this bus
      const { data: assignments, error: assignErr } = await supabase
        .from('student_bus_assignments')
        .select('student_id, pickup_point, student!inner(id, full_name)')
        .eq('bus_id', busId);

      if (assignErr) {
        log.warn('[TMS] Failed to fetch bus assignments:', assignErr.message);
        return;
      }

      // 2. Get existing pickups for this trip
      const { data: pickups, error: pickupErr } = await supabase
        .from('trip_pickups')
        .select('id, student_id')
        .eq('trip_id', tripId);

      if (pickupErr) {
        log.warn('[TMS] Failed to fetch trip pickups:', pickupErr.message);
      }

      const pickupMap = new Map(
        (pickups ?? []).map((p: { id: string; student_id: string }) => [p.student_id, p.id])
      );

      // 3. Merge into a single list (skip entries without a valid student ID)
      const merged: StudentPickup[] = [];
      for (const a of assignments ?? []) {
        const rec = a as Record<string, unknown>;
        const studentData = rec.student as { id: string; full_name: string } | null;
        const studentId = studentData?.id ?? (rec.student_id as string | undefined);
        if (!studentId) continue; // skip invalid entries

        merged.push({
          studentId,
          fullName: studentData?.full_name ?? 'Unknown',
          pickupPoint: (rec.pickup_point as string) ?? null,
          pickedUp: pickupMap.has(studentId),
          pickupId: pickupMap.get(studentId) ?? null,
        });
      }

      // Sort: not picked up first, then alphabetical
      merged.sort((a, b) => {
        if (a.pickedUp !== b.pickedUp) return a.pickedUp ? 1 : -1;
        return a.fullName.localeCompare(b.fullName);
      });

      setStudents(merged);
    } catch (err) {
      log.error('[TMS] PickupChecklist fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [busId, tripId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ---------- Toggle pickup ----------

  const togglePickup = useCallback(
    async (student: StudentPickup) => {
      if (togglingId) return;
      setTogglingId(student.studentId);

      try {
        if (student.pickedUp && student.pickupId) {
          // Undo pickup
          const { error } = await supabase
            .from('trip_pickups')
            .delete()
            .eq('id', student.pickupId);

          if (error) {
            Alert.alert('Error', 'Failed to undo pickup. Please try again.');
            log.warn('[TMS] Delete pickup error:', error.message);
            return;
          }
        } else {
          // Mark as picked up
          const schoolCode = profile?.school_code;
          if (!schoolCode) {
            Alert.alert('Error', 'School code not available. Please try again.');
            return;
          }
          const { error } = await supabase.from('trip_pickups').insert({
            trip_id: tripId,
            student_id: student.studentId,
            bus_id: busId,
            school_code: schoolCode,
          });

          if (error) {
            Alert.alert('Error', 'Failed to mark pickup. Please try again.');
            log.warn('[TMS] Insert pickup error:', error.message);
            return;
          }
        }

        // Refresh list
        await fetchStudents();
      } catch (err) {
        log.error('[TMS] Toggle pickup error:', err);
        Alert.alert('Error', 'An unexpected error occurred.');
      } finally {
        setTogglingId(null);
      }
    },
    [togglingId, tripId, busId, profile?.school_code, fetchStudents]
  );

  // ---------- Computed ----------

  const pickedUpCount = students.filter((s) => s.pickedUp).length;
  const totalCount = students.length;

  // ---------- Render ----------

  if (loading) {
    return (
      <Card variant="outlined" padding="lg" style={{ alignItems: 'center' }}>
        <ActivityIndicator size="small" color={colors.primary.main} />
        <Caption color="secondary" style={{ marginTop: spacing.sm }}>
          Loading students...
        </Caption>
      </Card>
    );
  }

  if (totalCount === 0) {
    return (
      <Card variant="outlined" padding="md">
        <View style={styles.emptyRow}>
          <MaterialIcons name="info-outline" size={18} color={colors.text.tertiary} />
          <Body color="tertiary" style={{ marginLeft: spacing.sm }}>
            No students assigned to this bus
          </Body>
        </View>
      </Card>
    );
  }

  return (
    <View>
      {/* Header with progress */}
      <View style={[styles.headerRow, { marginBottom: spacing.sm }]}>
        <Heading level={5}>Pickups</Heading>
        <View style={styles.progressBadge}>
          <View
            style={[
              styles.progressDot,
              {
                backgroundColor:
                  pickedUpCount === totalCount
                    ? colors.success.main
                    : colors.warning.main,
              },
            ]}
          />
          <Body style={{ fontWeight: '600' }}>
            {pickedUpCount} / {totalCount}
          </Body>
        </View>
      </View>

      {/* Progress bar */}
      <View
        style={[
          styles.progressBarBg,
          { backgroundColor: `${colors.text.tertiary}20` },
        ]}
      >
        <View
          style={[
            styles.progressBarFill,
            {
              backgroundColor:
                pickedUpCount === totalCount
                  ? colors.success.main
                  : colors.primary.main,
              width:
                totalCount > 0 ? `${(pickedUpCount / totalCount) * 100}%` : '0%',
            },
          ]}
        />
      </View>

      {/* Student list */}
      <FlatList
        data={students}
        keyExtractor={(item) => item.studentId}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const isToggling = togglingId === item.studentId;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isToggling}
              onPress={() => togglePickup(item)}
              style={[
                styles.studentRow,
                {
                  backgroundColor: item.pickedUp
                    ? `${colors.success.main}10`
                    : colors.background.primary,
                  borderColor: item.pickedUp
                    ? colors.success.main
                    : colors.border.DEFAULT,
                },
              ]}
            >
              {/* Checkbox circle */}
              <View
                style={[
                  styles.checkCircle,
                  {
                    backgroundColor: item.pickedUp
                      ? colors.success.main
                      : 'transparent',
                    borderColor: item.pickedUp
                      ? colors.success.main
                      : colors.text.tertiary,
                  },
                ]}
              >
                {isToggling ? (
                  <ActivityIndicator size={12} color={item.pickedUp ? '#FFF' : colors.primary.main} />
                ) : item.pickedUp ? (
                  <MaterialIcons name="check" size={16} color="#FFF" />
                ) : null}
              </View>

              {/* Student info */}
              <View style={styles.studentInfo}>
                <Body
                  style={[
                    { fontWeight: '500' },
                    item.pickedUp && {
                      textDecorationLine: 'line-through',
                      color: colors.text.tertiary,
                    },
                  ]}
                >
                  {item.fullName}
                </Body>
                {item.pickupPoint && (
                  <Caption color="secondary">{item.pickupPoint}</Caption>
                )}
              </View>

              {/* Time indicator */}
              {item.pickedUp && (
                <MaterialIcons
                  name="done"
                  size={18}
                  color={colors.success.main}
                />
              )}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        style={{ marginTop: spacing.sm }}
      />
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
    gap: 2,
  },
});
