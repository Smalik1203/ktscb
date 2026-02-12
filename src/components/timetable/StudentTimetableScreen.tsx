import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DatePickerModal } from '../common/DatePickerModal';
import { EmptyStateIllustration } from '../../ui';
import { format, isToday as isTodayFn, addDays, subDays } from 'date-fns';
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

// Professional Palette - slightly more muted/sophisticated
const getSubjectColor = (subjectName: string = '', colors: ThemeColors) => {
  const palette = [
    '#3B82F6', // Blue 500
    '#10B981', // Emerald 500
    '#F59E0B', // Amber 500
    '#EF4444', // Red 500
    '#8B5CF6', // Violet 500
    '#EC4899', // Pink 500
    '#06B6D4', // Cyan 500
    '#6366F1', // Indigo 500
    '#F97316', // Orange 500
    '#14B8A6', // Teal 500
  ];

  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % palette.length;
  return palette[index];
};

function TimetableRow({
  slot,
  isTaught,
  colors,
  styles,
  isDark,
  isLast
}: {
  slot: TimetableSlot;
  isTaught: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  isDark: boolean;
  isLast: boolean;
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

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const isTodayDate = isTodayFn(new Date(slot.class_date));
  const isCurrent = isTodayDate && currentTime >= slot.start_time && currentTime <= slot.end_time;

  // 1. Break Slot
  if (slot.slot_type === 'break') {
    return (
      <View style={styles.breakRowContainer}>
        {/* Time Column */}
        <View style={styles.timeColumn}>
          <Text style={styles.startTime} numberOfLines={1}>{formatTime(slot.start_time)}</Text>
          <Text style={styles.duration} numberOfLines={1}>{formatTime(slot.end_time)}</Text>
        </View>

        {/* Timeline Column */}
        <View style={styles.timelineColumn}>
          <View style={[styles.timelineLine, isLast && styles.timelineLineLast]} />
          <View style={styles.timelineDotBreak}>
            <MaterialIcons name="local-cafe" size={12} color={colors.warning[600]} />
          </View>
        </View>

        {/* Content Column */}
        <View style={styles.breakContentColumn}>
          <View style={styles.breakCard}>
            <Text style={styles.breakTitle}>{slot.name || 'Break'}</Text>
          </View>
        </View>
      </View>
    );
  }

  // 2. Regular Class Slot
  const subjectColor = getSubjectColor(slot.subject_name || 'Unassigned', colors);

  return (
    <View style={styles.rowContainer}>
      {/* Time Column */}
      <View style={styles.timeColumn}>
        <Text style={[styles.startTime, isCurrent && { color: subjectColor }]} numberOfLines={1}>
          {formatTime(slot.start_time)}
        </Text>
        <Text style={styles.duration} numberOfLines={1}>
          {formatTime(slot.end_time)}
        </Text>
      </View>

      {/* Timeline Column */}
      <View style={styles.timelineColumn}>
        <View style={[styles.timelineLine, isLast && styles.timelineLineLast]} />
        <View
          style={[
            styles.timelineDot,
            {
              borderColor: subjectColor,
              backgroundColor: isCurrent ? subjectColor : colors.background.app
            }
          ]}
        />
      </View>

      {/* Content Column */}
      <View style={styles.contentColumn}>
        <View
          style={[
            styles.eventCard,
            isCurrent && {
              ...styles.currentCardShadow,
              backgroundColor: colors.surface.elevated
            },
            { borderLeftColor: subjectColor, borderLeftWidth: 4 }
          ]}
        >
          <View style={styles.cardContent}>
            <View style={styles.eventHeader}>
              <Text style={styles.subjectName} numberOfLines={1}>
                {slot.subject_name || 'Unassigned'}
              </Text>
              {isTaught && (
                <View style={styles.taughtBadge}>
                  <MaterialIcons name="check" size={12} color={colors.success[600]} />
                </View>
              )}
            </View>

            <View style={styles.eventDetails}>
              <View style={styles.detailItem}>
                <MaterialIcons name="menu-book" size={14} color={colors.text.tertiary} />
                <Text style={styles.detailText} numberOfLines={1}>
                  {slot.topic_title || slot.plan_text || 'No topic assigned'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialIcons name="person" size={14} color={colors.text.tertiary} />
                <Text style={styles.detailText} numberOfLines={1}>
                  {slot.teacher_name || 'No teacher'}
                </Text>
              </View>
            </View>
          </View>
        </View>
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

  const styles = useMemo(
    () => createStyles(colors, typography, themeSpacing, themeBorderRadius, themeShadows, isDark),
    [colors, typography, themeSpacing, themeBorderRadius, themeShadows, isDark]
  );

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

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
        .select('id, class_date, period_number, slot_type, name, start_time, end_time, subject_id, teacher_id, plan_text, syllabus_topic_id')
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

      // 2. Get IDs
      const subjectIds = [...new Set((slotsData as any[]).map(s => s.subject_id).filter(Boolean))];
      const teacherIds = [...new Set((slotsData as any[]).map(s => s.teacher_id).filter(Boolean))];
      const topicIds = [...new Set((slotsData as any[]).map(s => s.syllabus_topic_id).filter(Boolean))];

      // 3. Fetch details
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

      const subjectsMap = new Map((subjectsRes.data as any[] || []).map(s => [s.id, s.subject_name]));
      const teachersMap = new Map((teachersRes.data as any[] || []).map(t => [t.id, t.full_name]));
      const topicsMap = new Map((topicsRes.data as any[] || []).map(t => [t.id, t.title]));

      // 4. Fetch taught status
      const { data: progressData } = await supabase
        .from('syllabus_progress')
        .select('timetable_slot_id')
        .eq('class_instance_id', profile.class_instance_id)
        .eq('date', dateStr);

      const taughtIds = new Set(
        (progressData as any[] || []).map(p => p.timetable_slot_id).filter(Boolean)
      );

      // 5. Enrich slots
      const enrichedSlots = (slotsData as any[]).map(slot => ({
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
      // Timetable fetch failed - error state set below
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [dateStr, profile?.class_instance_id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTimetable(false);
    setRefreshing(false);
  };

  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary[600] as string} />
          <Text style={styles.loadingText}>Loading timetable...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialIcons name="error" size={48} color={colors.error[600]} />
          <Text style={styles.errorTitle}>Failed to load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => fetchTimetable()}
            style={{ backgroundColor: colors.primary[600], paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!profile?.class_instance_id) {
    return (
      <View style={styles.container}>
        <EmptyStateIllustration
          type="general"
          title="No Class Assigned"
          description="Contact administrator."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Minimized Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevDay} style={styles.navButton}>
          <MaterialIcons name="chevron-left" size={24} color={colors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateText}>{format(selectedDate, 'MMMM d')}</Text>
          <Text style={styles.dayText}>{format(selectedDate, 'EEEE, yyyy')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNextDay} style={styles.navButton}>
          <MaterialIcons name="chevron-right" size={24} color={colors.text.secondary} />
        </TouchableOpacity>

        {!isTodayFn(selectedDate) && (
          <TouchableOpacity onPress={handleToday} style={styles.todayButton}>
            <Text style={styles.todayText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

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
          <View style={{ marginTop: themeSpacing['4xl'] }}>
            <EmptyStateIllustration
              type="calendar"
              title="No Classes"
              description="Enjoy your day off!"
            />
          </View>
        ) : (
          <View style={styles.listContainer}>
            {slots.map((slot, index) => (
              <TimetableRow
                key={slot.id}
                slot={slot}
                isTaught={taughtSlotIds.has(slot.id)}
                colors={colors}
                styles={styles}
                isDark={isDark}
                isLast={index === slots.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        initialDate={selectedDate}
        onDismiss={() => setShowDatePicker(false)}
        onConfirm={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
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
    fontSize: typography.fontSize.sm,
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    zIndex: 10,
  },
  navButton: {
    padding: spacing.sm,
  },
  dateSelector: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  dayText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayButton: {
    position: 'absolute',
    right: spacing.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50], // Very subtle
  },
  todayText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },

  // Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  listContainer: {
    // No gap, contiguous flow
  },

  // Row Layout
  rowContainer: {
    flexDirection: 'row',
    minHeight: 90,
  },
  breakRowContainer: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timeColumn: {
    width: 72,
    alignItems: 'flex-end',
    paddingRight: spacing.sm,
    paddingTop: 2, // Align with top of card
  },
  startTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  duration: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  breakTimeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },

  // Timeline
  timelineColumn: {
    width: 20,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timelineLine: {
    position: 'absolute',
    top: 12, // Start below dot center
    bottom: -100, // Extend to next row
    width: 2,
    backgroundColor: isDark ? colors.border.light : '#E5E7EB', // Gray-200
  },
  timelineLineLast: {
    bottom: 0,
    display: 'none', // Or just end
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: colors.background.app,
    zIndex: 1,
    marginTop: 6, // Optical alignment with time text
  },
  timelineDotBreak: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginTop: 0,
  },

  // Content
  contentColumn: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  breakContentColumn: {
    flex: 1,
    paddingBottom: spacing.sm,
  },

  // Card
  eventCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
    // Removed border width and color
    flexDirection: 'row',
  },
  currentCardShadow: {
    ...shadows.md,
  },
  accentStrip: {
    width: 4,
    height: '100%',
  },
  cardContent: {
    flex: 1,
    padding: spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  subjectName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  taughtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  taughtText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
    textTransform: 'uppercase',
  },
  eventDetails: {
    gap: 6,
    marginTop: spacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },

  // Break Styles
  breakCard: {
    backgroundColor: isDark ? colors.surface.secondary : colors.neutral[50], // Keep neutral bg
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Removed border
  },
  breakTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  breakDuration: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
});
