/**
 * StudentAttendanceView — Production-quality
 *
 * Design:
 * 1. Every day in range is shown — holidays (Sundays + DB holidays), present, or absent
 * 2. Unmarked school days are treated as ABSENT (consistent everywhere)
 * 3. Holidays fetched from school_calendar_events where event_type='holiday'
 * 4. Summary + weekly records use the SAME calculation: present / schoolDays
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Text } from 'react-native-paper';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Minus,
} from 'lucide-react-native';
import { ProgressRing } from '../ui/ProgressRing';
import { useStudentAttendance } from '../../hooks/useAttendance';
import { useSchoolHolidays } from '../../hooks/useCalendarEvents';
import { useAuth } from '../../contexts/AuthContext';
import { ThreeStateView } from '../common/ThreeStateView';
import { DatePickerModal } from '../common/DatePickerModal';
import { supabase } from '../../lib/supabase';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isAfter,
  isSunday,
  min as dateMin,
  max as dateMax,
  parseISO,
} from 'date-fns';
import { useCapabilities } from '../../hooks/useCapabilities';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ────────────────────── Types ──────────────────────

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent';
  created_at?: string | null;
}

/** Three states only — no 'unmarked'. Unmarked days become 'absent'. */
type DayStatus = 'present' | 'absent' | 'holiday';

interface CalendarDay {
  date: Date;
  dateString: string;
  status: DayStatus;
  /** Name of the holiday if applicable */
  holidayName?: string;
  record?: AttendanceRecord;
}

interface WeekGroup {
  weekKey: string;
  weekLabel: string;
  days: CalendarDay[];
  schoolDays: number;
  present: number;
  absent: number;
  holidays: number;
}

// ────────────────────── Helpers ──────────────────────

/**
 * Expand DB holiday records into a Map of date string → holiday name.
 * Handles multi-day holidays (start_date to end_date).
 */
const buildHolidayMap = (
  holidays: { start_date: string; end_date: string | null; title: string }[]
): Map<string, string> => {
  const map = new Map<string, string>();
  for (const h of holidays) {
    const start = parseISO(h.start_date);
    const end = h.end_date ? parseISO(h.end_date) : start;
    const days = eachDayOfInterval({ start, end });
    for (const d of days) {
      map.set(format(d, 'yyyy-MM-dd'), h.title);
    }
  }
  return map;
};

/**
 * Build a complete calendar for the date range.
 * Holiday = Sunday OR in holidayMap.
 * Unmarked school days = absent (no separate 'unmarked' status).
 */
const buildCalendar = (
  startDate: Date,
  endDate: Date,
  records: AttendanceRecord[],
  holidayMap: Map<string, string>
): CalendarDay[] => {
  const recordMap = new Map<string, AttendanceRecord>();
  for (const r of records) recordMap.set(r.date, r);

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });

  return allDays.map((d) => {
    const ds = format(d, 'yyyy-MM-dd');
    const record = recordMap.get(ds);
    const holidayName = holidayMap.get(ds);
    const isSundayDay = isSunday(d);

    let status: DayStatus;
    if (isSundayDay || holidayName) {
      status = 'holiday';
    } else if (record) {
      status = record.status;
    } else {
      // Unmarked school day = absent
      status = 'absent';
    }

    return {
      date: d,
      dateString: ds,
      status,
      holidayName: isSundayDay ? 'Sunday' : holidayName,
      record,
    };
  });
};

/**
 * Group calendar days into weeks (Mon-Sun), most recent first.
 */
const groupByWeek = (
  calendarDays: CalendarDay[],
  rangeStart: Date,
  rangeEnd: Date
): WeekGroup[] => {
  const weekMap = new Map<string, WeekGroup>();

  for (const day of calendarDays) {
    const ws = startOfWeek(day.date, { weekStartsOn: 1 });
    const we = endOfWeek(day.date, { weekStartsOn: 1 });

    const labelStart = dateMax([ws, rangeStart]);
    const labelEnd = dateMin([we, rangeEnd]);
    const weekKey = format(ws, 'yyyy-MM-dd');
    const weekLabel = `${format(labelStart, 'MMM d')} – ${format(labelEnd, 'MMM d')}`;

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekKey,
        weekLabel,
        days: [],
        schoolDays: 0,
        present: 0,
        absent: 0,
        holidays: 0,
      });
    }
    const g = weekMap.get(weekKey)!;
    g.days.push(day);

    if (day.status === 'holiday') {
      g.holidays++;
    } else {
      g.schoolDays++;
      if (day.status === 'present') g.present++;
      else g.absent++;
    }
  }

  for (const g of weekMap.values()) {
    g.days.sort((a, b) => b.dateString.localeCompare(a.dateString));
  }
  return Array.from(weekMap.values()).sort((a, b) => b.weekKey.localeCompare(a.weekKey));
};

// ────────────────────── Component ──────────────────────

export const StudentAttendanceView: React.FC = () => {
  const { colors, typography, spacing, borderRadius, shadows, isDark } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows, isDark),
    [colors, typography, spacing, borderRadius, shadows, isDark]
  );

  const { profile } = useAuth();
  const { can } = useCapabilities();
  const [refreshing, setRefreshing] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loadingStudentId, setLoadingStudentId] = useState(true);

  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return thirtyDaysAgo;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const isViewingOwnAttendance = can('attendance.read_own') && !can('attendance.mark');

  // ── Fetch student ID ──
  useEffect(() => {
    const fetchStudent = async () => {
      if (!profile?.auth_id || !isViewingOwnAttendance) {
        setLoadingStudentId(false);
        return;
      }
      setLoadingStudentId(true);
      try {
        const schoolCode = profile.school_code;
        if (!schoolCode) throw new Error('School information not found.');

        let { data, error: qErr } = await supabase
          .from('student')
          .select('id')
          .eq('auth_user_id', profile.auth_id)
          .eq('school_code', schoolCode)
          .maybeSingle();

        if (!data && !qErr && profile.email) {
          const r = await supabase
            .from('student')
            .select('id')
            .eq('email', profile.email)
            .eq('school_code', schoolCode)
            .maybeSingle();
          data = r.data;
          qErr = r.error;
        }
        if (qErr) throw new Error(qErr.message);
        if (!data) throw new Error('Student profile not found.');
        setStudentId(data.id);
      } catch (err: any) {
        // Student fetch failed - error state set below
      } finally {
        setLoadingStudentId(false);
      }
    };
    fetchStudent();
  }, [profile?.auth_id, isViewingOwnAttendance, profile?.school_code, profile?.email]);

  const schoolCode = profile?.school_code ?? null;
  const { data: attendanceRecords = [], isLoading, error, refetch } = useStudentAttendance(studentId || undefined);

  // ── Derived date strings ──
  const startDateString = startDate.toISOString().split('T')[0];
  const endDateString = endDate.toISOString().split('T')[0];

  // ── Fetch holidays from school_calendar_events ──
  const { data: dbHolidays = [] } = useSchoolHolidays(schoolCode, startDateString, endDateString);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleStartDateConfirm = useCallback((date: Date) => {
    setStartDate(date);
    setShowStartDatePicker(false);
    if (isAfter(date, endDate)) setEndDate(date);
  }, [endDate]);

  const handleEndDateConfirm = useCallback((date: Date) => {
    setEndDate(date);
    setShowEndDatePicker(false);
  }, []);

  const toggleWeek = useCallback((weekKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  }, []);

  // ── Build holiday map (DB holidays expanded into individual dates) ──
  const holidayMap = useMemo(() => buildHolidayMap(dbHolidays), [dbHolidays]);

  const filteredRecords = useMemo(
    () => attendanceRecords.filter((r) => r.date >= startDateString && r.date <= endDateString),
    [attendanceRecords, startDateString, endDateString]
  );

  // ── Build calendar with holidays integrated ──
  const calendarDays = useMemo(
    () => buildCalendar(startDate, endDate, filteredRecords, holidayMap),
    [startDate, endDate, filteredRecords, holidayMap]
  );

  // ── Stats: consistent everywhere — present / schoolDays ──
  const stats = useMemo(() => {
    let present = 0, absent = 0, holidays = 0, schoolDays = 0;
    for (const d of calendarDays) {
      if (d.status === 'holiday') { holidays++; continue; }
      schoolDays++;
      if (d.status === 'present') present++;
      else absent++; // absent = explicitly absent + unmarked (already merged in buildCalendar)
    }
    const percentage = schoolDays > 0 ? Math.round((present / schoolDays) * 100) : 0;
    return { present, absent, holidays, schoolDays, percentage, totalDays: calendarDays.length };
  }, [calendarDays]);

  const weekGroups = useMemo(
    () => groupByWeek(calendarDays, startDate, endDate),
    [calendarDays, startDate, endDate]
  );

  // Auto-expand latest week only
  useEffect(() => {
    if (weekGroups.length > 0 && expandedWeeks.size === 0) {
      setExpandedWeeks(new Set([weekGroups[0].weekKey]));
    }
  }, [weekGroups.length]);

  const viewState = loadingStudentId || isLoading ? 'loading' : error ? 'error' : !studentId ? 'empty' : 'success';

  if (!studentId && !loadingStudentId) {
    return (
      <ThreeStateView
        state="empty"
        emptyMessage="Student profile not found"
        errorDetails="Unable to load your student profile. Please contact support."
      />
    );
  }

  // ── Status config for rendering day rows ──
  const getStatusConfig = (day: CalendarDay) => {
    switch (day.status) {
      case 'present':
        return {
          label: 'Present',
          detail: 'All periods attended',
          color: colors.success[700],
          bg: isDark ? 'rgba(34,197,94,0.1)' : colors.success[50],
          Icon: CheckCircle,
        };
      case 'absent':
        return {
          label: 'Absent',
          detail: day.record ? 'Marked absent' : 'Not recorded',
          color: colors.error[700],
          bg: isDark ? 'rgba(239,68,68,0.1)' : colors.error[50],
          Icon: XCircle,
        };
      case 'holiday':
        return {
          label: 'Holiday',
          detail: day.holidayName || 'No school',
          color: colors.text.tertiary,
          bg: isDark ? 'rgba(156,163,175,0.08)' : colors.neutral[50],
          Icon: Minus,
        };
    }
  };

  // Percentage-based color helpers
  const pctColor =
    stats.schoolDays === 0
      ? colors.text.tertiary
      : stats.percentage >= 75
        ? colors.success[600]
        : stats.percentage >= 50
          ? colors.warning[600]
          : colors.error[600];

  const pctBarBg =
    stats.schoolDays === 0
      ? colors.neutral[300]
      : stats.percentage >= 75
        ? colors.success[600]
        : stats.percentage >= 50
          ? colors.warning[600]
          : colors.error[600];

  return (
    <ThreeStateView
      state={viewState}
      loadingMessage="Loading attendance..."
      errorMessage="Failed to load attendance"
      errorDetails={error?.message}
      onRetry={handleRefresh}
    >
      <View style={styles.container}>
        <FlatList
          data={weekGroups}
          keyExtractor={(item) => item.weekKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            <>
              {/* ── Date Filter Row ── */}
              <View style={styles.dateFilterRow}>
                <TouchableOpacity
                  style={styles.dateFilterTouchable}
                  onPress={() => setShowStartDatePicker(true)}
                  activeOpacity={0.6}
                >
                  <CalendarIcon size={16} color={colors.primary[600]} />
                  <Text style={styles.dateFilterText}>
                    {format(startDate, 'dd MMM yyyy')}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.dateFilterSep}>–</Text>
                <TouchableOpacity
                  style={styles.dateFilterTouchable}
                  onPress={() => setShowEndDatePicker(true)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.dateFilterText}>
                    {format(endDate, 'dd MMM yyyy')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── Hero Card with ProgressRing ── */}
              <View style={styles.heroCard}>
                <View style={styles.heroRingCenter}>
                  <ProgressRing
                    progress={stats.schoolDays > 0 ? stats.percentage : 0}
                    size={100}
                    strokeWidth={10}
                    color={pctColor}
                    backgroundColor={isDark ? 'rgba(255,255,255,0.06)' : colors.neutral[100]}
                    showPercentage
                  />
                </View>
                <Text style={styles.heroSubtext}>
                  {stats.schoolDays > 0
                    ? `${stats.present} of ${stats.schoolDays} school days`
                    : 'No school days in range'}
                </Text>

                {/* Segmented breakdown bar */}
                {stats.totalDays > 0 && (
                  <View style={styles.breakdownBar}>
                    {stats.present > 0 && (
                      <View style={[styles.breakdownSegment, { flex: stats.present, backgroundColor: colors.success[500], borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: stats.absent === 0 && stats.holidays === 0 ? 4 : 0, borderBottomRightRadius: stats.absent === 0 && stats.holidays === 0 ? 4 : 0 }]} />
                    )}
                    {stats.absent > 0 && (
                      <View style={[styles.breakdownSegment, { flex: stats.absent, backgroundColor: colors.error[500], borderTopLeftRadius: stats.present === 0 ? 4 : 0, borderBottomLeftRadius: stats.present === 0 ? 4 : 0, borderTopRightRadius: stats.holidays === 0 ? 4 : 0, borderBottomRightRadius: stats.holidays === 0 ? 4 : 0 }]} />
                    )}
                    {stats.holidays > 0 && (
                      <View style={[styles.breakdownSegment, { flex: stats.holidays, backgroundColor: '#3b82f6', borderTopRightRadius: 4, borderBottomRightRadius: 4, borderTopLeftRadius: stats.present === 0 && stats.absent === 0 ? 4 : 0, borderBottomLeftRadius: stats.present === 0 && stats.absent === 0 ? 4 : 0 }]} />
                    )}
                  </View>
                )}

                {/* Legend */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.success[500] }]} />
                    <Text style={[styles.legendText, { color: colors.success[700] }]}>{stats.present} Present</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.error[500] }]} />
                    <Text style={[styles.legendText, { color: colors.error[700] }]}>{stats.absent} Absent</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
                    <Text style={[styles.legendText, { color: '#2563eb' }]}>{stats.holidays} Holidays</Text>
                  </View>
                </View>
              </View>

              {weekGroups.length > 0 && (
                <Text style={styles.sectionTitle}>Daily Records</Text>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconBox, { backgroundColor: isDark ? 'rgba(156,163,175,0.08)' : colors.neutral[50] }]}>
                <AlertCircle size={28} color={colors.text.tertiary} />
              </View>
              <Text style={styles.emptyTitle}>No Days in Range</Text>
              <Text style={styles.emptyText}>
                Select a valid date range to view your attendance records.
              </Text>
            </View>
          }
          renderItem={({ item: week }) => {
            const isExpanded = expandedWeeks.has(week.weekKey);
            const weekSchoolDays = week.schoolDays;
            
            // Consistent: present / all school days (absent already includes unmarked)
            const weekPct = weekSchoolDays > 0 ? Math.round((week.present / weekSchoolDays) * 100) : -1;
            
            const weekPctColor =
              weekPct < 0
                ? colors.text.tertiary
                : weekPct >= 75
                  ? colors.success[600]
                  : weekPct >= 50
                    ? colors.warning[600]
                    : colors.error[600];
            const weekBarColor =
              weekPct < 0
                ? colors.neutral[300]
                : weekPct >= 75
                  ? colors.success[500]
                  : weekPct >= 50
                    ? colors.warning[500]
                    : colors.error[500];

            return (
              <View style={styles.weekCard}>
                {/* Week header */}
                <TouchableOpacity
                  style={styles.weekHeader}
                  onPress={() => toggleWeek(week.weekKey)}
                  activeOpacity={0.65}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <View style={styles.weekHeaderLeft}>
                    <Text style={styles.weekLabel}>{week.weekLabel}</Text>
                    <Text style={styles.weekMeta}>
                      {weekPct >= 0
                        ? `${week.present} of ${weekSchoolDays} day${weekSchoolDays !== 1 ? 's' : ''} present`
                        : `${weekSchoolDays} school day${weekSchoolDays !== 1 ? 's' : ''} · not marked yet`}
                    </Text>
                    {/* Mini progress bar */}
                    <View style={styles.weekProgressTrack}>
                      <View
                        style={[
                          styles.weekProgressFill,
                          {
                            width: weekPct >= 0 ? `${weekPct}%` : '0%',
                            backgroundColor: weekBarColor,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.weekHeaderRight}>
                    {weekPct >= 0 && (
                      <Text style={[styles.weekPctText, { color: weekPctColor }]}>{weekPct}%</Text>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={18} color={colors.text.tertiary} />
                    ) : (
                      <ChevronDown size={18} color={colors.text.tertiary} />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Expanded day rows */}
                {isExpanded && (
                  <View style={styles.weekBody}>
                    {week.days.map((day, idx) => {
                      const cfg = getStatusConfig(day);
                      const isLast = idx === week.days.length - 1;
                      const StatusIcon = cfg.Icon;
                      const isHolidayDay = day.status === 'holiday';

                      return (
                        <View
                          key={day.dateString}
                          style={[
                            styles.dayRow,
                            !isLast && styles.dayRowBorder,
                            isHolidayDay && styles.dayRowHoliday,
                          ]}
                        >
                          {/* Icon circle */}
                          <View style={[styles.dayIconCircle, { backgroundColor: cfg.bg }]}>
                            <StatusIcon size={14} color={cfg.color} />
                          </View>

                          {/* Date and detail */}
                          <View style={styles.dayInfo}>
                            <Text style={[styles.dayDate, isHolidayDay && styles.dayDateHoliday]}>
                              {format(day.date, 'EEE, dd MMM')}
                            </Text>
                            <Text style={[styles.dayDetail, { color: cfg.color }]}>
                              {cfg.detail}
                            </Text>
                          </View>

                          {/* Status label */}
                          <View style={[styles.dayBadge, { backgroundColor: cfg.bg }]}>
                            <Text style={[styles.dayBadgeText, { color: cfg.color }]}>
                              {cfg.label}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
        />

        {/* Date Pickers */}
        <DatePickerModal
          visible={showStartDatePicker}
          onDismiss={() => setShowStartDatePicker(false)}
          onConfirm={handleStartDateConfirm}
          initialDate={startDate}
          minimumDate={new Date(2020, 0, 1)}
          maximumDate={new Date()}
          title="Select Start Date"
        />
        <DatePickerModal
          visible={showEndDatePicker}
          onDismiss={() => setShowEndDatePicker(false)}
          onConfirm={handleEndDateConfirm}
          initialDate={endDate}
          minimumDate={startDate}
          maximumDate={new Date()}
          title="Select End Date"
        />
      </View>
    </ThreeStateView>
  );
};

// ────────────────────── Styles ──────────────────────

const createStyles = (
  colors: ThemeColors,
  typography: any,
  spacing: any,
  borderRadius: any,
  shadows: any,
  isDark: boolean
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    listContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
      paddingTop: spacing.sm,
    },

    // ── Date Filter Row ──
    dateFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border.light,
      gap: spacing.sm,
    },
    dateFilterTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
    },
    dateFilterText: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    dateFilterSep: {
      fontSize: typography.fontSize.base,
      color: colors.text.tertiary,
      fontWeight: typography.fontWeight.medium,
    },

    // ── Hero Card ──
    heroCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.xl,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadows.sm,
      borderWidth: 1,
      borderColor: colors.border.light,
      alignItems: 'center',
    },
    heroRingCenter: {
      marginBottom: spacing.sm,
    },
    heroSubtext: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      fontWeight: typography.fontWeight.medium,
      marginBottom: spacing.md,
    },

    // ── Breakdown Bar + Legend ──
    breakdownBar: {
      flexDirection: 'row',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: spacing.sm,
      gap: 2,
      alignSelf: 'stretch',
    },
    breakdownSegment: {
      height: '100%',
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
    },

    // ── Section Title ──
    sectionTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: spacing.xs,
      marginTop: spacing.xs,
    },

    // ── Week Card ──
    weekCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
      ...shadows.xs,
      borderWidth: 1,
      borderColor: colors.border.light,
      overflow: 'hidden',
    },
    weekHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minHeight: 56,
    },
    weekHeaderLeft: {
      flex: 1,
      marginRight: spacing.sm,
    },
    weekLabel: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: 3,
    },
    weekMeta: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      fontWeight: typography.fontWeight.medium,
      marginBottom: 6,
    },
    weekProgressTrack: {
      height: 3,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.neutral[100],
      borderRadius: 2,
      overflow: 'hidden',
    },
    weekProgressFill: {
      height: '100%',
      borderRadius: 2,
    },
    weekHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    weekPctText: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.bold,
    },
    weekBody: {
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },

    // ── Day Row ──
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    dayRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    dayRowHoliday: {
      opacity: 0.5,
    },
    dayIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    dayInfo: {
      flex: 1,
    },
    dayDate: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      lineHeight: 20,
    },
    dayDateHoliday: {
      color: colors.text.tertiary,
    },
    dayDetail: {
      fontSize: typography.fontSize.xs,
      marginTop: 2,
      fontWeight: typography.fontWeight.medium,
    },
    dayBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
    },
    dayBadgeText: {
      fontSize: 10,
      fontWeight: typography.fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },

    // ── Empty State ──
    emptyCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      ...shadows.xs,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    emptyIconBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: 4,
    },
    emptyText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
