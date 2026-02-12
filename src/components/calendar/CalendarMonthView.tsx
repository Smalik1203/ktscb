/**
 * CalendarMonthView
 *
 * Month grid with colored event-type dots, count badges, and a stronger
 * today indicator. Designed for school ERP — fast visual parsing of
 * exam / holiday / meeting / event days at a glance.
 */

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, RefreshControlProps, Platform,
} from 'react-native';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { CalendarEvent } from '../../hooks/useCalendarEvents';

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

const { width, height } = Dimensions.get('window');
const cellWidth = width / 7;
const cellHeight = Math.max((height - 220) / 6, 90);

// ── Event type → color mapping (shared with CalendarScreen) ────────
const EVENT_TYPE_COLORS: Record<string, string> = {
  holiday: '#10b981',   // green
  exam: '#f59e0b',      // amber
  ptm: '#3b82f6',       // blue
  assembly: '#8b5cf6',  // purple
  'sports day': '#ec4899', // pink
  'cultural event': '#ef4444', // red
};

function getTypeColor(type: string, fallback: string): string {
  return EVENT_TYPE_COLORS[type.toLowerCase()] || fallback;
}

export { EVENT_TYPE_COLORS };

export default function CalendarMonthView({
  currentDate,
  events,
  onDateClick,
  onEventClick,
  refreshControl,
}: CalendarMonthViewProps) {
  const { colors, isDark, shadows, spacing, borderRadius } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, shadows, spacing, borderRadius), [colors, isDark, shadows, spacing, borderRadius]);

  // ── Helpers ──────────────────────────────────────────────────
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((event) => {
      const eventStart = new Date(event.start_date);
      const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;
      const checkDate = new Date(dateStr);
      return checkDate >= eventStart && checkDate <= eventEnd;
    });
  };

  const isHolidayDate = (date: Date): boolean =>
    getEventsForDate(date).some((e) => e.event_type === 'holiday');

  const isWeekendDate = (date: Date): boolean => date.getDay() === 0;

  const generateCalendarDays = (): Date[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1, 12, 0, 0);
    const dayOfWeek = firstDay.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(year, month, 1 - diff + i, 12, 0, 0));
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  // ── Unique event-type dots for a cell (max 4) ───────────────
  const getUniqueDots = (dayEvents: CalendarEvent[]) => {
    const seen = new Set<string>();
    const dots: string[] = [];
    for (const e of dayEvents) {
      const key = e.event_type.toLowerCase();
      if (!seen.has(key) && dots.length < 4) {
        seen.add(key);
        dots.push(getTypeColor(e.event_type, colors.neutral[400]));
      }
    }
    return dots;
  };

  return (
    <View style={styles.container}>
      {/* Week day headers */}
      <View style={styles.weekHeader}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <View key={day} style={styles.weekHeaderCell}>
            <Text style={[styles.weekHeaderText, day === 'Sun' && styles.sundayText]}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.gridContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}
        >
          <View style={styles.grid}>
            {calendarDays.map((day, index) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = day.toDateString() === today.toDateString();
              const isWeekend = isWeekendDate(day);
              const isHoliday = isHolidayDate(day);
              const dayEvents = getEventsForDate(day);
              const dots = getUniqueDots(dayEvents);
              const eventCount = dayEvents.length;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.cell,
                    isWeekend && styles.weekendCell,
                    isHoliday && styles.holidayCell,
                    isToday && styles.todayCell,
                  ]}
                  onPress={() => {
                    if (dayEvents.length === 1) onEventClick(dayEvents[0]);
                    else onDateClick(day);
                  }}
                  activeOpacity={0.6}
                >
                  {/* Date number + count badge */}
                  <View style={styles.dateRow}>
                    <View style={[
                      styles.dateCircle,
                      isToday && styles.dateCircleToday,
                    ]}>
                      <Text style={[
                        styles.dateText,
                        !isCurrentMonth && styles.dateTextMuted,
                        isToday && styles.dateTextToday,
                        (isWeekend || isHoliday) && isCurrentMonth && !isToday && styles.dateTextSpecial,
                      ]}>
                        {day.getDate()}
                      </Text>
                    </View>
                    {eventCount > 0 && isCurrentMonth && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{eventCount}</Text>
                      </View>
                    )}
                  </View>

                  {/* Colored dots row */}
                  {dots.length > 0 && isCurrentMonth && (
                    <View style={styles.dotsRow}>
                      {dots.map((dotColor, i) => (
                        <View key={i} style={[styles.dot, { backgroundColor: dotColor }]} />
                      ))}
                    </View>
                  )}

                  {/* First event title preview (if space) */}
                  {dayEvents.length > 0 && isCurrentMonth && (
                    <Text style={styles.eventPreview} numberOfLines={1}>
                      {dayEvents[0].title}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const createStyles = (
  colors: ThemeColors, isDark: boolean, shadows: any, spacing: any, borderRadius: any,
) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },

  // ── Week header ────────────────────────────────────────────
  weekHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    paddingVertical: 10,
    ...shadows.xs,
  },
  weekHeaderCell: { width: cellWidth, alignItems: 'center' },
  weekHeaderText: {
    fontSize: 11, fontWeight: '600' as const, color: colors.text.tertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sundayText: { color: colors.error[500] },

  // ── Grid ───────────────────────────────────────────────────
  gridContainer: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: colors.surface.primary,
    minHeight: '100%',
  },

  // ── Cell ───────────────────────────────────────────────────
  cell: {
    width: cellWidth, height: cellHeight,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? colors.neutral[700] : colors.neutral[100],
    paddingHorizontal: 4, paddingTop: 4, paddingBottom: 2,
    backgroundColor: colors.surface.primary,
  },
  todayCell: {
    backgroundColor: isDark ? `${colors.primary[600]}18` : colors.primary[50],
  },
  weekendCell: {
    backgroundColor: isDark ? colors.surface.secondary : colors.background.secondary,
  },
  holidayCell: {
    backgroundColor: isDark ? `${colors.success[600]}12` : '#f0fdf4',
  },

  // ── Date number row ────────────────────────────────────────
  dateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 2,
  },
  dateCircle: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
  },
  dateCircleToday: {
    backgroundColor: colors.primary[600],
  },
  dateText: {
    fontSize: 13, fontWeight: '600' as const, color: colors.text.primary,
  },
  dateTextMuted: { color: colors.text.tertiary, fontWeight: '400' as const },
  dateTextToday: { color: '#fff', fontWeight: '700' as const },
  dateTextSpecial: { color: colors.error[500] },

  // ── Count badge ────────────────────────────────────────────
  countBadge: {
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: isDark ? colors.neutral[600] : colors.neutral[200],
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  countBadgeText: { fontSize: 9, fontWeight: '700' as const, color: colors.text.secondary },

  // ── Dots ───────────────────────────────────────────────────
  dotsRow: { flexDirection: 'row', gap: 3, marginBottom: 2, paddingLeft: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  // ── Event preview ──────────────────────────────────────────
  eventPreview: {
    fontSize: 9, fontWeight: '500' as const, color: colors.text.secondary,
    lineHeight: 12, paddingLeft: 2,
  },
});
