/**
 * CalendarScreen
 *
 * Academic calendar workspace. Month view with colored event-type dots,
 * list view with type-tinted cards, event legend, FAB bottom sheet
 * for creating events/holidays, and role-aware visibility.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal,
  RefreshControl, ActivityIndicator, Animated, Pressable, Platform,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { format } from 'date-fns';
import { Button, EmptyStateIllustration, FAB } from '../../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import {
  useCalendarEvents, useCreateCalendarEvent,
  useUpdateCalendarEvent, useDeleteCalendarEvent,
  CalendarEvent,
} from '../../hooks/useCalendarEvents';
import { CalendarEventFormModal, CalendarMonthView } from '../../components/calendar';
import { EVENT_TYPE_COLORS } from '../../components/calendar/CalendarMonthView';
import { MonthPickerModal } from '../../components/common';
import { supabase } from '../../lib/supabase';
import { DB } from '../../types/db.constants';

// ── Event type color helper (for list view) ────────────────────────
function getEventTypeColor(type: string, fallbackColor: string): string {
  return EVENT_TYPE_COLORS[type.toLowerCase()] || fallbackColor;
}

// ── Determine event temporal status ────────────────────────────────
function getEventStatus(event: CalendarEvent): 'upcoming' | 'today' | 'past' {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const end = event.end_date || event.start_date;
  if (event.start_date > todayStr) return 'upcoming';
  if (event.start_date <= todayStr && end >= todayStr) return 'today';
  return 'past';
}

export default function CalendarScreen() {
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
  const { can } = useCapabilities();

  // Capability-based checks
  const canManageEvents = can('calendar.manage');
  const canReadOwnCalendar = can('calendar.read') && can('attendance.read_own') && !can('attendance.read');

  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows, isDark),
    [colors, spacing, borderRadius, typography, shadows, isDark],
  );

  // ── State ───────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [isEventModalVisible, setIsEventModalVisible] = useState(false);
  const [isHolidayModalVisible, setIsHolidayModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [classes, setClasses] = useState<{ id: string; grade: number | null; section?: string | null }[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFabSheet, setShowFabSheet] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null);

  const schoolCode = profile?.school_code || '';
  const studentClassId = canReadOwnCalendar ? profile?.class_instance_id || undefined : undefined;

  // ── Fetch classes ───────────────────────────────────────────
  const fetchClasses = useCallback(async () => {
    if (!schoolCode || canReadOwnCalendar) return;
    setLoadingClasses(true);
    try {
      const { data, error } = await supabase
        .from(DB.tables.classInstances)
        .select('id, grade, section')
        .eq('school_code', schoolCode)
        .order('grade', { ascending: true })
        .order('section', { ascending: true });
      if (error) throw error;
      setClasses(data || []);
    } catch (_e) {
      // silent
    } finally {
      setLoadingClasses(false);
    }
  }, [schoolCode, canReadOwnCalendar]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  // ── Date range for current month ────────────────────────────
  const { startDate, endDate } = useMemo(() => {
    const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return { startDate: format(s, 'yyyy-MM-dd'), endDate: format(e, 'yyyy-MM-dd') };
  }, [currentDate]);

  const effectiveClassId = canReadOwnCalendar ? studentClassId : (selectedClassId || undefined);

  const { data: events = [], isLoading, error, refetch } = useCalendarEvents(
    schoolCode, startDate, endDate, effectiveClassId,
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } catch (_e) { /* */ }
    finally { setRefreshing(false); }
  }, [refetch]);

  // ── Mutations ───────────────────────────────────────────────
  const createEventMutation = useCreateCalendarEvent();
  const updateEventMutation = useUpdateCalendarEvent();
  const deleteEventMutation = useDeleteCalendarEvent();

  // ── Navigation ──────────────────────────────────────────────
  const handleToday = () => setCurrentDate(new Date());

  // ── Event actions ───────────────────────────────────────────
  const handleAddEvent = () => {
    if (!canManageEvents) return;
    setSelectedEvent(null);
    setIsEventModalVisible(true);
    setShowFabSheet(false);
  };

  const handleAddHoliday = () => {
    if (!canManageEvents) return;
    setSelectedEvent(null);
    setIsHolidayModalVisible(true);
    setShowFabSheet(false);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    if (!canManageEvents) return;
    setSelectedEvent(event);
    if (event.event_type === 'holiday') setIsHolidayModalVisible(true);
    else setIsEventModalVisible(true);
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    if (!canManageEvents) return;
    Alert.alert('Delete Event', `Delete "${event.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          deleteEventMutation.mutate(event.id);
          setIsEventModalVisible(false);
          setIsHolidayModalVisible(false);
          setSelectedEvent(null);
        },
      },
    ]);
  };

  const handleSaveEvent = async (eventData: any) => {
    try {
      if (selectedEvent) {
        await updateEventMutation.mutateAsync({ id: selectedEvent.id, ...eventData });
        Alert.alert('Success', 'Event updated');
      } else {
        await createEventMutation.mutateAsync(eventData);
        Alert.alert('Success', 'Event created');
      }
      setIsEventModalVisible(false);
      setIsHolidayModalVisible(false);
      setSelectedEvent(null);
    } catch (_e) {
      Alert.alert('Error', 'Failed to save event');
    }
  };

  const handleDateClick = (date: Date) => {
    setDayDetailDate(date);
  };
  const handleEventClick = (event: CalendarEvent) => {
    // For single-event days, show the day detail sheet (everyone can view)
    const eventDate = new Date(event.start_date + 'T12:00:00');
    setDayDetailDate(eventDate);
  };

  // ── Format helpers ──────────────────────────────────────────
  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  // ── Bottom sheet animation for FAB ──────────────────────────
  const fabSlide = useRef(new Animated.Value(0)).current;
  const fabOverlay = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showFabSheet) {
      fabSlide.setValue(0); fabOverlay.setValue(0);
      Animated.parallel([
        Animated.timing(fabOverlay, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(fabSlide, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    }
  }, [showFabSheet, fabSlide, fabOverlay]);

  const closeFabSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(fabOverlay, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fabSlide, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowFabSheet(false));
  }, [fabOverlay, fabSlide]);

  // ── Bottom sheet animation for class selector ───────────────
  const classSlide = useRef(new Animated.Value(0)).current;
  const classOverlay = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showClassDropdown) {
      classSlide.setValue(0); classOverlay.setValue(0);
      Animated.parallel([
        Animated.timing(classOverlay, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(classSlide, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    }
  }, [showClassDropdown, classSlide, classOverlay]);

  const closeClassSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(classOverlay, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(classSlide, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowClassDropdown(false));
  }, [classOverlay, classSlide]);

  // ── Day detail bottom sheet animation ──────────────────────
  const daySlide = useRef(new Animated.Value(0)).current;
  const dayOverlay = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (dayDetailDate) {
      daySlide.setValue(0); dayOverlay.setValue(0);
      Animated.parallel([
        Animated.timing(dayOverlay, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(daySlide, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    }
  }, [dayDetailDate, daySlide, dayOverlay]);

  const closeDaySheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(dayOverlay, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(daySlide, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setDayDetailDate(null));
  }, [dayOverlay, daySlide]);

  // Events for selected day
  const dayDetailEvents = useMemo(() => {
    if (!dayDetailDate) return [];
    const dateStr = format(dayDetailDate, 'yyyy-MM-dd');
    return events.filter((event) => {
      const eventEnd = event.end_date || event.start_date;
      return dateStr >= event.start_date && dateStr <= eventEnd;
    }).sort((a, b) => {
      if (a.is_all_day && !b.is_all_day) return -1;
      if (!a.is_all_day && b.is_all_day) return 1;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
  }, [dayDetailDate, events]);

  // ── List view ───────────────────────────────────────────────
  const renderListView = () => {
    const grouped: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      if (!grouped[e.start_date]) grouped[e.start_date] = [];
      grouped[e.start_date].push(e);
    });
    const sortedDates = Object.keys(grouped).sort();

    return (
      <ScrollView
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContentPad}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
            tintColor={colors.primary[600]} colors={[colors.primary[600]]} />
        }
      >
        {isLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary[600]} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load events</Text>
            <Button variant="primary" onPress={() => refetch()} style={{ marginTop: spacing.md }}>Retry</Button>
          </View>
        ) : events.length === 0 ? (
          <EmptyStateIllustration
            type="calendar" title="No Events"
            description="No events scheduled for this month."
            action={canManageEvents ? <Button variant="primary" onPress={handleAddEvent}>Add First Event</Button> : undefined}
          />
        ) : (
          <View style={styles.listContent}>
            {sortedDates.map((dateKey) => {
              const dateEvents = grouped[dateKey];
              const [yr, mo, dy] = dateKey.split('-').map(Number);
              const date = new Date(yr, mo - 1, dy, 12, 0, 0);
              const now = new Date();
              const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const isToday = dateKey === todayKey;

              const sorted = [...dateEvents].sort((a, b) => {
                if (a.is_all_day && !b.is_all_day) return -1;
                if (!a.is_all_day && b.is_all_day) return 1;
                return (a.start_time || '').localeCompare(b.start_time || '');
              });

              return (
                <View key={dateKey} style={styles.dateGroup}>
                  {/* Date sidebar */}
                  <View style={[styles.dateSidebar, isToday && styles.dateSidebarToday]}>
                    {isToday && <View style={styles.todayBar} />}
                    <Text style={[styles.dateDay, isToday && styles.dateDayToday]}>{dy}</Text>
                    <Text style={[styles.dateMonth, isToday && styles.dateMonthToday]}>
                      {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                    </Text>
                    <Text style={[styles.dateWeekday, isToday && styles.dateWeekdayToday]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                  </View>

                  {/* Events column */}
                  <View style={styles.eventsColumn}>
                    {sorted.map((event) => {
                      const eColor = event.color || getEventTypeColor(event.event_type, colors.neutral[500]);
                      const status = getEventStatus(event);
                      const selectedClassName = event.class_instance_id
                        ? classes.find(c => c.id === event.class_instance_id)
                        : null;

                      return (
                        <TouchableOpacity
                          key={event.id}
                          onPress={() => handleEventClick(event)}
                          activeOpacity={0.6}
                          style={[styles.eventCard, { borderLeftColor: eColor }]}
                        >
                          <View style={styles.eventHeader}>
                            <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                            {/* Time / All-day badge */}
                            {event.is_all_day ? (
                              <View style={[styles.badge, { backgroundColor: `${eColor}18` }]}>
                                <Text style={[styles.badgeText, { color: eColor }]}>ALL DAY</Text>
                              </View>
                            ) : event.start_time ? (
                              <View style={styles.timeBadge}>
                                <Text style={styles.timeText}>
                                  {formatTime(event.start_time)}
                                  {event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          {/* Meta row: type + class + status */}
                          <View style={styles.metaRow}>
                            <View style={[styles.typeBadge, { backgroundColor: `${eColor}20` }]}>
                              <Text style={[styles.typeText, { color: eColor }]}>
                                {event.event_type.toUpperCase()}
                              </Text>
                            </View>
                            {selectedClassName && (
                              <Text style={styles.classMeta}>
                                Grade {selectedClassName.grade}{selectedClassName.section ? `-${selectedClassName.section}` : ''}
                              </Text>
                            )}
                            {!event.class_instance_id && !canReadOwnCalendar && (
                              <Text style={styles.classMeta}>All Classes</Text>
                            )}
                            <View style={{ flex: 1 }} />
                            <View style={[
                              styles.statusDot,
                              {
                                backgroundColor: status === 'today' ? colors.success[500]
                                  : status === 'upcoming' ? colors.primary[500]
                                  : colors.neutral[300],
                              },
                            ]} />
                            <Text style={styles.statusText}>
                              {status === 'today' ? 'Today' : status === 'upcoming' ? 'Upcoming' : 'Past'}
                            </Text>
                          </View>

                          {event.description ? (
                            <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <View style={styles.filterRow}>
        {!canReadOwnCalendar && (
          <TouchableOpacity style={styles.filterChip} onPress={() => setShowClassDropdown(true)} activeOpacity={0.7}>
            <Text style={[styles.chipText, selectedClassId ? styles.chipTextActive : undefined]} numberOfLines={1}>
              {selectedClassId
                ? `${classes.find(c => c.id === selectedClassId)?.grade}-${classes.find(c => c.id === selectedClassId)?.section || ''}`
                : 'All Classes'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={16} color={selectedClassId ? colors.primary[600] : colors.text.tertiary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => setShowMonthPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.chipTextActive} numberOfLines={1}>
            {currentDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={16} color={colors.primary[600]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.todayChip} onPress={handleToday} activeOpacity={0.7}>
          <Text style={styles.todayChipText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* View mode toggle */}
      <View style={styles.segRow}>
        <View style={styles.segControl}>
          {(['month', 'list'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.segBtn, viewMode === mode && styles.segBtnActive]}
              onPress={() => setViewMode(mode)}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={mode === 'month' ? 'calendar-today' : 'view-agenda'}
                size={15}
                color={viewMode === mode ? colors.primary[700] : colors.text.tertiary}
              />
              <Text style={[styles.segText, viewMode === mode && styles.segTextActive]}>
                {mode === 'month' ? 'Month' : 'List'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {viewMode === 'month' ? (
        isLoading && events.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary[600]} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Failed to load events</Text>
            <Button variant="ghost" onPress={() => refetch()} style={{ marginTop: spacing.md }}>Retry</Button>
          </View>
        ) : (
          <CalendarMonthView
            currentDate={currentDate} events={events}
            onDateClick={handleDateClick} onEventClick={handleEventClick}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
                tintColor={colors.primary[600]} colors={[colors.primary[600]]} />
            }
          />
        )
      ) : renderListView()}

      {/* ── Class Selector Bottom Sheet ──────────────────────── */}
      <Modal visible={showClassDropdown} transparent animationType="none" onRequestClose={closeClassSheet}>
        <Animated.View style={[styles.overlay, { opacity: classOverlay }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeClassSheet} />
          <Animated.View style={[styles.sheet, {
            transform: [{ translateY: classSlide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
          }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Class</Text>
            <ScrollView style={styles.sheetScroll} bounces={false}>
              <TouchableOpacity
                key="all"
                style={[styles.sheetOption, !selectedClassId && styles.sheetOptionActive]}
                onPress={() => { setSelectedClassId(''); closeClassSheet(); }}
              >
                <Text style={[styles.sheetOptionText, !selectedClassId && styles.sheetOptionTextActive]}>All Classes</Text>
                {!selectedClassId && (
                  <View style={styles.sheetCheck}><MaterialIcons name="check" size={16} color={colors.text.inverse} /></View>
                )}
              </TouchableOpacity>
              {classes.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.sheetOption, selectedClassId === c.id && styles.sheetOptionActive]}
                  onPress={() => { setSelectedClassId(c.id); closeClassSheet(); }}
                >
                  <Text style={[styles.sheetOptionText, selectedClassId === c.id && styles.sheetOptionTextActive]}>
                    Grade {c.grade}{c.section ? `-${c.section}` : ''}
                  </Text>
                  {selectedClassId === c.id && (
                    <View style={styles.sheetCheck}><MaterialIcons name="check" size={16} color={colors.text.inverse} /></View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Day Detail Bottom Sheet ─────────────────────────── */}
      <Modal visible={!!dayDetailDate} transparent animationType="none" onRequestClose={closeDaySheet}>
        <Animated.View style={[styles.overlay, { opacity: dayOverlay }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeDaySheet} />
          <Animated.View style={[styles.sheet, {
            transform: [{ translateY: daySlide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
          }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {dayDetailDate
                ? dayDetailDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                : ''}
            </Text>
            <ScrollView style={styles.sheetScroll} bounces={false}>
              {dayDetailEvents.length === 0 ? (
                <View style={styles.dayDetailEmpty}>
                  <MaterialIcons name="event-busy" size={32} color={colors.text.tertiary} />
                  <Text style={styles.dayDetailEmptyText}>No events on this day</Text>
                </View>
              ) : (
                dayDetailEvents.map((event) => {
                  const eColor = event.color || getEventTypeColor(event.event_type, colors.neutral[500]);
                  const selectedClassName = event.class_instance_id
                    ? classes.find(c => c.id === event.class_instance_id)
                    : null;

                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={[styles.dayDetailCard, { borderLeftColor: eColor }]}
                      activeOpacity={canManageEvents ? 0.6 : 1}
                      onPress={() => {
                        if (canManageEvents) {
                          closeDaySheet();
                          setTimeout(() => handleEditEvent(event), 300);
                        }
                      }}
                    >
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                        {event.is_all_day ? (
                          <View style={[styles.badge, { backgroundColor: `${eColor}18` }]}>
                            <Text style={[styles.badgeText, { color: eColor }]}>ALL DAY</Text>
                          </View>
                        ) : event.start_time ? (
                          <View style={styles.timeBadge}>
                            <Text style={styles.timeText}>
                              {formatTime(event.start_time)}
                              {event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.metaRow}>
                        <View style={[styles.typeBadge, { backgroundColor: `${eColor}20` }]}>
                          <Text style={[styles.typeText, { color: eColor }]}>
                            {event.event_type.toUpperCase()}
                          </Text>
                        </View>
                        {selectedClassName && (
                          <Text style={styles.classMeta}>
                            Grade {selectedClassName.grade}{selectedClassName.section ? `-${selectedClassName.section}` : ''}
                          </Text>
                        )}
                        {!event.class_instance_id && !canReadOwnCalendar && (
                          <Text style={styles.classMeta}>All Classes</Text>
                        )}
                      </View>

                      {event.description ? (
                        <Text style={styles.eventDesc} numberOfLines={3}>{event.description}</Text>
                      ) : null}

                      {canManageEvents && (
                        <View style={styles.dayDetailEditHint}>
                          <MaterialIcons name="edit" size={12} color={colors.text.tertiary} />
                          <Text style={styles.dayDetailEditText}>Tap to edit</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Event Form Modals */}
      <CalendarEventFormModal
        visible={isEventModalVisible}
        event={selectedEvent || undefined}
        academicYearId={undefined} schoolCode={schoolCode} classes={classes}
        userId={profile?.auth_id || ''}
        onCancel={() => { setIsEventModalVisible(false); setSelectedEvent(null); }}
        onSuccess={handleSaveEvent}
        onDelete={selectedEvent ? () => handleDeleteEvent(selectedEvent) : undefined}
      />
      <CalendarEventFormModal
        visible={isHolidayModalVisible}
        event={selectedEvent || undefined}
        academicYearId={undefined} schoolCode={schoolCode} classes={classes}
        isHoliday userId={profile?.auth_id || ''}
        onCancel={() => { setIsHolidayModalVisible(false); setSelectedEvent(null); }}
        onSuccess={handleSaveEvent}
        onDelete={selectedEvent ? () => handleDeleteEvent(selectedEvent) : undefined}
      />

      {/* FAB — speed-dial for managers */}
      <FAB.Group
        icon="add"
        visible={canManageEvents}
        actions={[
          { icon: 'event', label: 'Add Event', onPress: handleAddEvent },
          { icon: 'celebration', label: 'Add Holiday', onPress: handleAddHoliday },
        ]}
      />

      {/* Month Picker */}
      <MonthPickerModal
        visible={showMonthPicker}
        initialDate={new Date(currentDate)}
        onDismiss={() => setShowMonthPicker(false)}
        onConfirm={(d) => setCurrentDate(d)}
      />
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════

const createStyles = (
  colors: ThemeColors, spacing: any, borderRadius: any,
  typography: any, shadows: any, isDark: boolean,
) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  errorText: { color: colors.error[600], marginBottom: spacing.sm },

  // ── Filter chips ────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row', paddingHorizontal: spacing.md,
    paddingTop: spacing.sm, paddingBottom: 4, gap: spacing.sm,
  },
  filterChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl, paddingVertical: 9, paddingHorizontal: 14,
    ...shadows.xs,
  },
  chipText: { fontSize: 13, fontWeight: '500' as const, color: colors.text.secondary },
  chipTextActive: { fontSize: 13, fontWeight: '600' as const, color: colors.primary[600] },
  todayChip: {
    backgroundColor: colors.primary[600], borderRadius: borderRadius.xl,
    paddingVertical: 9, paddingHorizontal: 14, justifyContent: 'center',
    ...shadows.sm,
  },
  todayChipText: { fontSize: 13, fontWeight: '600' as const, color: '#fff' },

  // ── Segmented control ───────────────────────────────────────
  segRow: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 2 },
  segControl: {
    flexDirection: 'row', backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.full, overflow: 'hidden', ...shadows.xs,
  },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  segBtnActive: { backgroundColor: isDark ? colors.primary[100] : colors.primary[50] },
  segText: { fontSize: 13, fontWeight: '500' as const, color: colors.text.tertiary },
  segTextActive: { color: colors.primary[700], fontWeight: '600' as const },

  // ── List view ───────────────────────────────────────────────
  listContainer: { flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  listContentPad: { paddingBottom: 120 },
  listContent: { gap: spacing.sm },

  dateGroup: {
    flexDirection: 'row', backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg, overflow: 'hidden', ...shadows.sm,
  },
  dateSidebar: {
    width: 70, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: isDark ? colors.surface.secondary : colors.neutral[50],
    position: 'relative',
  },
  dateSidebarToday: {
    backgroundColor: isDark ? `${colors.primary[600]}18` : colors.primary[50],
  },
  todayBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: colors.primary[600], borderRadius: 2,
  },
  dateDay: { fontSize: 22, fontWeight: '700' as const, color: colors.text.secondary, lineHeight: 26 },
  dateDayToday: { color: colors.primary[600] },
  dateMonth: { fontSize: 10, fontWeight: '700' as const, color: colors.text.tertiary, letterSpacing: 0.8 },
  dateMonthToday: { color: colors.primary[600] },
  dateWeekday: { fontSize: 10, fontWeight: '500' as const, color: colors.text.tertiary, marginTop: 1 },
  dateWeekdayToday: { color: colors.primary[600] },

  eventsColumn: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: spacing.xs },

  eventCard: {
    borderLeftWidth: 4, borderRadius: 8,
    backgroundColor: isDark ? colors.surface.secondary : colors.neutral[50],
    paddingVertical: 10, paddingHorizontal: 12,
  },
  eventHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.xs, marginBottom: 4,
  },
  eventTitle: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: colors.text.primary, letterSpacing: -0.2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.3 },
  timeBadge: { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  timeText: { fontSize: 11, fontWeight: '600' as const, color: colors.text.secondary },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  typeText: { fontSize: 9, fontWeight: '700' as const, textTransform: 'uppercase', letterSpacing: 0.2 },
  classMeta: { fontSize: 11, fontWeight: '500' as const, color: colors.text.tertiary },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '500' as const, color: colors.text.tertiary },
  eventDesc: { fontSize: 12, color: colors.text.secondary, lineHeight: 16, marginTop: 4 },

  // ── Bottom sheets (shared) ──────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: spacing.sm, paddingBottom: spacing.xl + 16, maxHeight: '60%',
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: colors.border.DEFAULT, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '700' as const, color: colors.text.primary, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sheetScroll: { paddingHorizontal: spacing.md, maxHeight: 400 },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md,
    borderRadius: 12, marginBottom: 4,
  },
  sheetOptionActive: { backgroundColor: isDark ? colors.primary[100] : `${colors.primary[600]}0A` },
  sheetOptionText: { flex: 1, fontSize: 15, fontWeight: '500' as const, color: colors.text.primary },
  sheetOptionTextActive: { color: colors.primary[600], fontWeight: '600' as const },
  sheetCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Day detail sheet ────────────────────────────────────────
  dayDetailCard: {
    borderLeftWidth: 4, borderRadius: 10,
    backgroundColor: isDark ? colors.surface.secondary : colors.neutral[50],
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: spacing.sm,
  },
  dayDetailEmpty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.xl, gap: spacing.sm,
  },
  dayDetailEmptyText: {
    fontSize: 14, fontWeight: '500' as const, color: colors.text.tertiary,
  },
  dayDetailEditHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
  },
  dayDetailEditText: {
    fontSize: 11, fontWeight: '500' as const, color: colors.text.tertiary,
  },

  // ── FAB sheet items ─────────────────────────────────────────
  fabSheetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: spacing.lg,
  },
  fabSheetIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  fabSheetLabel: { fontSize: 15, fontWeight: '600' as const, color: colors.text.primary },
  fabSheetHint: { fontSize: 12, fontWeight: '400' as const, color: colors.text.tertiary, marginTop: 1 },
});
