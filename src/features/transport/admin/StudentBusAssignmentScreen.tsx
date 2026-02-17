/**
 * Student Bus Assignment Screen
 *
 * List students with their bus assignment. Tap to assign/change bus via modal.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { spacing, typography, borderRadius, shadows } from '../../../../lib/design-system';
import { SearchBar } from '../../../ui/SearchBar';
import { EmptyState } from '../../../ui/EmptyState';
import { Modal } from '../../../ui/Modal';

// ---------- Types ----------

interface StudentRow {
  id: string;
  full_name: string;
  class_instance_id: string | null;
  class_label: string | null;
  bus_id: string | null;
  bus_number: string | null;
  assignment_id: string | null;
}

interface ClassOption {
  id: string;
  label: string; // "Grade X - Section"
}

interface BusOption {
  id: string;
  bus_number: string;
}

// ---------- Screen ----------

export default function StudentBusAssignmentScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useAuth();
  const schoolCode = profile?.school_code;

  // State
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [busOptions, setBusOptions] = useState<BusOption[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Assignment modal
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [assigning, setAssigning] = useState(false);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // ---------- Fetch ----------

  const fetchData = useCallback(async () => {
    if (!schoolCode) return;
    try {
      // 1. Fetch students
      const { data: studentRows, error: sErr } = await supabase
        .from('student')
        .select('id, full_name, class_instance_id')
        .eq('school_code', schoolCode)
        .order('full_name');
      if (sErr) throw sErr;

      // 2. Fetch all bus assignments for this school
      const { data: assignments, error: aErr } = await supabase
        .from('student_bus_assignments')
        .select('id, student_id, bus_id')
        .eq('school_code', schoolCode);
      if (aErr) throw aErr;

      const assignmentMap: Record<string, { assignment_id: string; bus_id: string }> = {};
      for (const a of assignments || []) {
        assignmentMap[a.student_id] = { assignment_id: a.id, bus_id: a.bus_id };
      }

      // 3. Fetch buses
      const { data: buses, error: bErr } = await supabase
        .from('buses')
        .select('id, bus_number')
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .order('bus_number');
      if (bErr) throw bErr;

      setBusOptions(buses || []);

      // 4. Fetch class instances for filter chips
      const { data: classRows } = await supabase
        .from('class_instances')
        .select('id, grade, section')
        .eq('school_code', schoolCode)
        .order('grade')
        .order('section');

      const classOpts: ClassOption[] = (classRows || []).map((c) => ({
        id: c.id,
        label: `Grade ${c.grade} - ${c.section}`,
      }));
      setClassOptions(classOpts);

      const busMap: Record<string, string> = {};
      for (const b of buses || []) {
        busMap[b.id] = b.bus_number;
      }

      // Build class lookup
      const classLabelMap: Record<string, string> = {};
      for (const c of classOpts) {
        classLabelMap[c.id] = c.label;
      }

      // 5. Merge students with assignments
      const merged: StudentRow[] = (studentRows || []).map((s) => {
        const assignment = assignmentMap[s.id];
        return {
          id: s.id,
          full_name: s.full_name,
          class_instance_id: s.class_instance_id,
          class_label: s.class_instance_id ? classLabelMap[s.class_instance_id] || null : null,
          bus_id: assignment?.bus_id || null,
          bus_number: assignment ? busMap[assignment.bus_id] || null : null,
          assignment_id: assignment?.assignment_id || null,
        };
      });

      setStudents(merged);
    } catch (err) {
      console.error('Failed to fetch assignment data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ---------- Filtered ----------

  const filtered = useMemo(() => {
    let result = students;

    // Filter by class
    if (selectedClassId) {
      result = result.filter((s) => s.class_instance_id === selectedClassId);
    }

    // Filter by search text
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.bus_number?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [students, search, selectedClassId]);

  // ---------- Assign / Unassign ----------

  const assignBus = async (busId: string | null) => {
    if (!selectedStudent || !schoolCode) return;
    setAssigning(true);

    try {
      if (busId === null) {
        // Remove assignment
        if (selectedStudent.assignment_id) {
          const { error } = await supabase
            .from('student_bus_assignments')
            .delete()
            .eq('id', selectedStudent.assignment_id);
          if (error) throw error;
        }
      } else if (selectedStudent.assignment_id) {
        // Update existing
        const { error } = await supabase
          .from('student_bus_assignments')
          .update({ bus_id: busId })
          .eq('id', selectedStudent.assignment_id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('student_bus_assignments')
          .insert({
            student_id: selectedStudent.id,
            bus_id: busId,
            school_code: schoolCode,
          });
        if (error) throw error;
      }

      setSelectedStudent(null);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to assign bus.');
    } finally {
      setAssigning(false);
    }
  };

  // ---------- Render ----------

  const renderStudentRow = ({ item }: { item: StudentRow }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setSelectedStudent(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <MaterialIcons name="school" size={20} color={colors.primary[600]} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.full_name}
          </Text>
          {item.class_label && (
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {item.class_label}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardRight}>
        {item.bus_number ? (
          <View style={[styles.busBadge, { backgroundColor: colors.primary[50] }]}>
            <MaterialIcons name="directions-bus" size={14} color={colors.primary[600]} />
            <Text style={[styles.busBadgeText, { color: colors.primary[700] }]}>
              {item.bus_number}
            </Text>
          </View>
        ) : (
          <View style={[styles.busBadge, { backgroundColor: colors.warning[50] }]}>
            <Text style={[styles.busBadgeText, { color: colors.warning[700] }]}>
              Unassigned
            </Text>
          </View>
        )}
        <MaterialIcons name="chevron-right" size={20} color={colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  );

  // Counts (based on filtered list so they reflect the active class filter)
  const assignedCount = filtered.filter((s) => s.bus_id).length;
  const unassignedCount = filtered.length - assignedCount;

  return (
    <View style={styles.container}>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search students..." />

      {/* Class filter chips */}
      {classOptions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <TouchableOpacity
            style={[styles.chip, !selectedClassId && styles.chipActive]}
            onPress={() => setSelectedClassId(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, !selectedClassId && styles.chipTextActive]}>
              All Classes
            </Text>
          </TouchableOpacity>
          {classOptions.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selectedClassId === c.id && styles.chipActive]}
              onPress={() => setSelectedClassId(selectedClassId === c.id ? null : c.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selectedClassId === c.id && styles.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Summary bar */}
      {!loading && filtered.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: colors.primary[600] }]}>{filtered.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: colors.success[600] }]}>{assignedCount}</Text>
            <Text style={styles.summaryLabel}>Assigned</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: colors.warning[600] }]}>{unassignedCount}</Text>
            <Text style={styles.summaryLabel}>Unassigned</Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary[600]} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Students"
          message={search ? 'No students match your search.' : 'No students found in this school.'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Bus Picker Modal */}
      <Modal
        visible={!!selectedStudent}
        onDismiss={() => setSelectedStudent(null)}
        title={selectedStudent ? `Assign Bus — ${selectedStudent.full_name}` : 'Assign Bus'}
        size="md"
      >
        {assigning ? (
          <ActivityIndicator size="large" color={colors.primary[600]} style={{ padding: 40 }} />
        ) : (
          <>
            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => assignBus(null)}
            >
              <Text style={[styles.pickerOptionText, !selectedStudent?.bus_id && styles.pickerOptionActive]}>
                Remove Assignment
              </Text>
              {!selectedStudent?.bus_id && (
                <MaterialIcons name="check" size={20} color={colors.primary[600]} />
              )}
            </TouchableOpacity>
            {busOptions.map((bus) => (
              <TouchableOpacity
                key={bus.id}
                style={styles.pickerOption}
                onPress={() => assignBus(bus.id)}
              >
                <View style={styles.pickerOptionLeft}>
                  <MaterialIcons name="directions-bus" size={20} color={colors.text.secondary} />
                  <Text
                    style={[
                      styles.pickerOptionText,
                      selectedStudent?.bus_id === bus.id && styles.pickerOptionActive,
                    ]}
                  >
                    {bus.bus_number}
                  </Text>
                </View>
                {selectedStudent?.bus_id === bus.id && (
                  <MaterialIcons name="check" size={20} color={colors.primary[600]} />
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </Modal>
    </View>
  );
}

// ---------- Styles ----------

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.app },
    list: { padding: spacing.md, paddingBottom: 20 },
    chipRow: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      gap: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    chipActive: {
      backgroundColor: colors.primary[600],
      borderColor: colors.primary[600],
    },
    chipText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium as any,
      color: colors.text.secondary,
    },
    chipTextActive: {
      color: '#FFF',
      fontWeight: typography.fontWeight.semibold as any,
    },
    summary: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface.primary,
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      borderRadius: borderRadius.md,
      ...shadows.xs,
    },
    summaryItem: { alignItems: 'center' },
    summaryCount: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold as any,
    },
    summaryLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.xs,
      ...shadows.xs,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary[50],
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    cardInfo: { flex: 1 },
    cardTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium as any,
      color: colors.text.primary,
    },
    cardSubtitle: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      marginTop: 1,
    },
    cardRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    busBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
    },
    busBadgeText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold as any,
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
    pickerOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pickerOptionText: {
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
    },
    pickerOptionActive: {
      fontWeight: typography.fontWeight.semibold as any,
      color: colors.primary[600],
    },
  });
}
