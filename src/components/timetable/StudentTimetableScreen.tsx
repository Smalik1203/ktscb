import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Calendar, Coffee, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, shadows } from '../../theme/tokens';
import { DatePickerModal } from '../common/DatePickerModal';
import { EmptyStateIllustration } from '../ui/EmptyStateIllustration';
import { format, isToday as isTodayFn } from 'date-fns';
import { supabase } from '../../lib/supabase';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../theme/types';

interface TimetableSlot {
  id: string;
  class_date: string;
  period_number: number;
  slot_type: 'period' | 'break';
  name: string | null;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  teacher_id: string | null;
  plan_text: string | null;
  syllabus_topic_id: string | null;
  subject_name?: string;
  teacher_name?: string;
  topic_title?: string;
}

// Period Card Component
function PeriodCard({ 
  slot, 
  isTaught, 
  colors, 
  styles 
}: { 
  slot: TimetableSlot; 
  isTaught: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const formatTime = (time24?: string | null) => {
    if (!time24) return '--:--';
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    const hour = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hour)) return time24;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Determine if period is current, upcoming, or past
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const isToday = isTodayFn(new Date(slot.class_date));
  const isCurrent = isToday && currentTime >= slot.start_time && currentTime <= slot.end_time;
  const isUpcoming = isToday && slot.start_time > currentTime;
  const isPast = isToday && slot.end_time < currentTime;

  if (slot.slot_type === 'break') {
    return (
      <View style={styles.breakCard}>
        <View style={styles.breakIcon}>
          <Coffee size={18} color={colors.warning[700]} />
        </View>
        <View style={styles.breakContent}>
          <Text style={styles.breakTitle}>{slot.name || 'Break'}</Text>
          <Text style={styles.breakTime}>
            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.periodCard,
        isCurrent && styles.currentCard,
        isUpcoming && styles.upcomingCard,
        isPast && styles.pastCard,
        isTaught ? styles.taughtCard : styles.pendingCard,
      ]}
    >
      <View style={styles.periodContent}>
        {/* Time */}
        <RNText style={[styles.timeText, isTaught && styles.taughtText]}>
          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
        </RNText>

        {/* Subject */}
        <RNText style={[styles.subjectText, isTaught && styles.taughtText]} numberOfLines={2}>
          {slot.subject_name || 'Unassigned'}
        </RNText>

        {/* Topic */}
        <RNText style={[styles.detailText, isTaught && styles.taughtDetailText]} numberOfLines={1}>
          <RNText style={[styles.label, isTaught && styles.taughtLabel]}>Topic: </RNText>
          {slot.topic_title || slot.plan_text || '—'}
        </RNText>

        {/* Teacher */}
        <RNText style={[styles.detailText, isTaught && styles.taughtDetailText]} numberOfLines={1}>
          <RNText style={[styles.label, isTaught && styles.taughtLabel]}>Teacher: </RNText>
          {slot.teacher_name || '—'}
        </RNText>
      </View>
    </View>
  );
}

export function StudentTimetableScreen() {
  const { profile } = useAuth();
  const { colors, typography, spacing: themeSpacing, borderRadius: themeBorderRadius, shadows: themeShadows, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [taughtSlotIds, setTaughtSlotIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  // Create dynamic styles based on theme
  const styles = useMemo(
    () => createStyles(colors, typography, themeSpacing, themeBorderRadius, themeShadows, isDark),
    [colors, typography, themeSpacing, themeBorderRadius, themeShadows, isDark]
  );

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch timetable and taught status
  const fetchTimetable = async (showLoading = true) => {
    if (!profile?.class_instance_id) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);

      // 1. Fetch timetable slots
      const { data: slotsData, error: slotsError } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('class_instance_id', profile.class_instance_id)
        .eq('class_date', dateStr)
        .order('start_time', { ascending: true });

      if (slotsError) throw slotsError;

      if (!slotsData || slotsData.length === 0) {
        setSlots([]);
        setTaughtSlotIds(new Set());
        setLoading(false);
        return;
      }

      // 2. Get subject IDs and teacher IDs
      const subjectIds = [...new Set(slotsData.map(s => s.subject_id).filter((id): id is string => Boolean(id)))];
      const teacherIds = [...new Set(slotsData.map(s => s.teacher_id).filter((id): id is string => Boolean(id)))];
      const topicIds = [...new Set(slotsData.map(s => s.syllabus_topic_id).filter((id): id is string => Boolean(id)))];

      // 3. Fetch subjects, teachers, and topics in parallel
      const [subjectsRes, teachersRes, topicsRes] = await Promise.all([
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, subject_name').in('id', subjectIds)
          : Promise.resolve({ data: [] }),
        teacherIds.length > 0
          ? supabase.from('admin').select('id, full_name').in('id', teacherIds)
          : Promise.resolve({ data: [] }),
        topicIds.length > 0
          ? supabase.from('syllabus_topics').select('id, title').in('id', topicIds)
          : Promise.resolve({ data: [] }),
      ]);

      const subjectsMap = new Map((subjectsRes.data || []).map(s => [s.id, s.subject_name]));
      const teachersMap = new Map((teachersRes.data || []).map(t => [t.id, t.full_name]));
      const topicsMap = new Map((topicsRes.data || []).map(t => [t.id, t.title]));

      // 4. Fetch taught status from syllabus_progress
      const { data: progressData, error: progressError } = await supabase
        .from('syllabus_progress')
        .select('timetable_slot_id')
        .eq('class_instance_id', profile.class_instance_id)
        .eq('date', dateStr);

      const taughtIds = new Set(
        (progressData || []).map(p => p.timetable_slot_id).filter(Boolean)
      );

      // 5. Enrich slots with subject/teacher/topic names
      const enrichedSlots = slotsData.map(slot => ({
        ...slot,
        slot_type: slot.slot_type as 'period' | 'break',
        subject_name: slot.subject_id ? subjectsMap.get(slot.subject_id) : undefined,
        teacher_name: slot.teacher_id ? teachersMap.get(slot.teacher_id) : undefined,
        topic_title: slot.syllabus_topic_id ? topicsMap.get(slot.syllabus_topic_id) : undefined,
      }));

      setSlots(enrichedSlots);
      setTaughtSlotIds(taughtIds);
      setLoading(false);
    } catch (err: any) {
      console.error('[StudentTimetable] Error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Fetch on mount and when date changes
  useEffect(() => {
    fetchTimetable();
  }, [dateStr, profile?.class_instance_id]);

  // Handle pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTimetable(false);
    setRefreshing(false);
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading timetable...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={colors.error[600]} />
          <Text style={styles.errorTitle}>Failed to load timetable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchTimetable()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // No class assigned
  if (!profile?.class_instance_id) {
    return (
      <View style={styles.container}>
        <EmptyStateIllustration
          type="general"
          title="No Class Assigned"
          description="Please contact your administrator to assign you to a class."
        />
      </View>
    );
  }

  // Three-state handling (duplicate check - already handled above)
  // This section is redundant as loading and error states are already handled above

  return (
    <View style={styles.container}>
      {/* Date Filter */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterItem} onPress={() => setShowDatePicker(true)}>
            <View style={styles.filterIcon}>
              <Calendar size={16} color={colors.text.inverse} />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterLabel}>Date</Text>
              <Text style={styles.filterValue} numberOfLines={1}>
                {format(selectedDate, 'MMM d, yyyy')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>


      {/* Timetable List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary[600]]}
            tintColor={colors.primary[600]}
          />
        }
      >
        {slots.length === 0 ? (
          <EmptyStateIllustration
            type="calendar"
            title="No Classes Scheduled"
            description={`No classes scheduled for ${format(selectedDate, 'MMMM d, yyyy')}`}
          />
        ) : (
          <View style={styles.slotsContainer}>
            {slots.map(slot => (
              <PeriodCard
                key={slot.id}
                slot={slot}
                isTaught={taughtSlotIds.has(slot.id)}
                colors={colors}
                styles={styles}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        initialDate={selectedDate}
        onDismiss={() => setShowDatePicker(false)}
        onConfirm={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
        minimumDate={new Date(2020, 0, 1)}
        maximumDate={new Date(2030, 11, 31)}
        title="Select Date"
      />
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  isDark: boolean
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.error[600],
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Filter Section
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.app,
  },
  filterRow: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 4,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border.DEFAULT,
  },
  filterItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  filterContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  filterLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  filterValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  // Today's Classes Summary
  todaysClassesSummary: {
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  todaysClassesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  todaysClassesTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  todaysClassesBadge: {
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaysClassesBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  todaysClassesScroll: {
    maxHeight: 80,
  },
  todaysClassesScrollContent: {
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  todaysClassChip: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginRight: spacing.xs,
    minWidth: 120,
  },
  todaysClassChipCurrent: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[300],
    borderWidth: 2,
  },
  todaysClassChipUpcoming: {
    backgroundColor: colors.info[50],
    borderColor: colors.info[300],
  },
  todaysClassChipSubject: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  todaysClassChipSubjectCurrent: {
    color: colors.success[700],
  },
  todaysClassChipCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  todaysClassChipIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.success[500],
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todaysClassChipIndicatorText: {
    fontSize: typography.fontSize.xs - 2,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
  },

  // Scrollable Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  slotsContainer: {
    gap: spacing.sm,
  },

  // Period Card Styles
  periodCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...shadows.sm,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border.DEFAULT,
  },
  currentCard: {
    borderWidth: 2,
    borderColor: colors.info[600],
    ...shadows.md,
  },
  upcomingCard: {
    borderWidth: 1,
    borderColor: colors.info[400],
  },
  pastCard: {
    opacity: 0.85,
  },
  taughtCard: {
    borderLeftColor: colors.success[600],
    backgroundColor: isDark ? colors.success[100] : colors.success[50],
  },
  pendingCard: {
    borderLeftColor: colors.primary[600],
    backgroundColor: colors.surface.primary,
  },
  periodContent: {
    gap: spacing.sm,
  },
  timeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  subjectText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 20,
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taughtText: {
    color: colors.success[700],
  },
  taughtDetailText: {
    color: colors.success[700],
  },
  taughtLabel: {
    color: colors.success[600],
  },

  // Break Card Styles
  breakCard: {
    backgroundColor: isDark ? colors.warning[100] : colors.warning[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[700],
    ...shadows.xs,
  },
  breakIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.warning[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  breakContent: {
    flex: 1,
  },
  breakTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[900],
    marginBottom: spacing.xs,
  },
  breakTime: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
});
