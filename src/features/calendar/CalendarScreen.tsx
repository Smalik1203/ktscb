/**
 * CalendarScreen
 * 
 * Refactored to use centralized design system with dynamic theming.
 * All styling uses theme tokens via useTheme hook.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, RefreshControl, ActivityIndicator } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { 
  Plus, 
  ListTodo,
  Calendar as CalendarIcon,
  Users,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  CalendarEvent,
} from '../../hooks/useCalendarEvents';
import {
  CalendarEventFormModal,
  CalendarMonthView,
} from '../../components/calendar';
import { MonthPickerModal } from '../../components/common';
import { supabase } from '../../lib/supabase';
import { DB } from '../../types/db.constants';
import { EmptyStateIllustration } from '../../components/ui/EmptyStateIllustration';

export default function CalendarScreen() {
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
  const { can, isLoading: capabilitiesLoading } = useCapabilities();
  
  // Capability-based checks (NO role checks in UI)
  const canManageEvents = can('calendar.manage');
  const canReadAllCalendar = can('calendar.read') && !can('attendance.read_own');
  const canReadOwnCalendar = can('calendar.read') && can('attendance.read_own') && !can('attendance.read');
  
  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, spacing, borderRadius, typography, shadows, isDark), 
    [colors, spacing, borderRadius, typography, shadows, isDark]);
  
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [isEventModalVisible, setIsEventModalVisible] = useState(false);
  const [isHolidayModalVisible, setIsHolidayModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [classes, setClasses] = useState<{ id: string; grade: number | null; section?: string | null }[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState<number>(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);

  const schoolCode = profile?.school_code || '';
  const studentClassId = canReadOwnCalendar ? profile?.class_instance_id || undefined : undefined;

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
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoadingClasses(false);
    }
  }, [schoolCode, canReadOwnCalendar]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const { startDate, endDate } = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [currentDate]);

  const effectiveClassId = canReadOwnCalendar ? studentClassId : (selectedClassId || undefined);

  const { data: events = [], isLoading, error, refetch } = useCalendarEvents(
    schoolCode,
    startDate,
    endDate,
    effectiveClassId
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error('Error refreshing calendar:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const createEventMutation = useCreateCalendarEvent();
  const updateEventMutation = useUpdateCalendarEvent();
  const deleteEventMutation = useDeleteCalendarEvent();

  const handlePreviousMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleAddEvent = () => {
    if (!canManageEvents) {
      Alert.alert('Access Denied', 'Only administrators can add events.');
      return;
    }
    setSelectedEvent(null);
    setIsEventModalVisible(true);
  };

  const handleAddHoliday = () => {
    if (!canManageEvents) {
      Alert.alert('Access Denied', 'Only administrators can add holidays.');
      return;
    }
    setSelectedEvent(null);
    setIsHolidayModalVisible(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    if (!canManageEvents) {
      Alert.alert('Access Denied', 'Only administrators can edit events.');
      return;
    }
    setSelectedEvent(event);
    if (event.event_type === 'holiday') {
      setIsHolidayModalVisible(true);
    } else {
      setIsEventModalVisible(true);
    }
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    if (!canManageEvents) {
      Alert.alert('Access Denied', 'Only administrators can delete events.');
      return;
    }

    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteEventMutation.mutate(event.id),
        },
      ]
    );
  };

  const handleSaveEvent = async (eventData: any) => {
    try {
      if (selectedEvent) {
        await updateEventMutation.mutateAsync({ id: selectedEvent.id, ...eventData });
        Alert.alert('Success', 'Event updated successfully');
      } else {
        await createEventMutation.mutateAsync(eventData);
        Alert.alert('Success', 'Event created successfully');
      }
      setIsEventModalVisible(false);
      setIsHolidayModalVisible(false);
      setSelectedEvent(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save event');
      console.error('Error saving event:', error);
    }
  };

  const handleDateClick = (_date: Date) => {
    // No view switching; month view remains active
  };

  const handleEventClick = (event: CalendarEvent) => {
    handleEditEvent(event);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getEventTypeColor = (type: string) => {
    const colorsMap: { [key: string]: string } = {
      holiday: colors.info.main,
      assembly: colors.primary.main,
      exam: colors.warning.main,
      ptm: colors.success.main,
      'sports day': colors.secondary?.main || colors.primary[700],
      'cultural event': colors.error[100],
    };
    return colorsMap[type.toLowerCase()] || colors.neutral[500];
  };

  const renderListView = () => {
    // Group events by date - fix timezone issues by parsing date correctly
    const groupedEvents: { [key: string]: CalendarEvent[] } = {};
    events.forEach((event) => {
      // Parse date string correctly (YYYY-MM-DD format)
      const dateKey = event.start_date;
      if (!groupedEvents[dateKey]) {
        groupedEvents[dateKey] = [];
      }
      groupedEvents[dateKey].push(event);
    });

    // Sort dates ascending (oldest first) for Outlook-like view
    const sortedDates = Object.keys(groupedEvents).sort((a, b) => a.localeCompare(b));

    return (
      <ScrollView 
        style={styles.outlookContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContentContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
            colors={[colors.primary.main]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={styles.loadingText}>Loading events...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>Failed to load events</Text>
            <Button mode="contained" onPress={() => refetch()} style={{ marginTop: spacing.md }}>
              Retry
            </Button>
          </View>
        ) : events.length > 0 ? (
          <View style={styles.outlookList}>
            {sortedDates.map((dateKey, dateIndex) => {
              const dateEvents = groupedEvents[dateKey];
              // Parse date correctly - use UTC to avoid timezone shifts
              const [year, month, day] = dateKey.split('-').map(Number);
              const date = new Date(Date.UTC(year, month - 1, day));
              const today = new Date();
              const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const isToday = dateKey === todayKey;
              const isLastDate = dateIndex === sortedDates.length - 1;
              
              // Sort events by time (all-day first, then by start time)
              const sortedEvents = [...dateEvents].sort((a, b) => {
                if (a.is_all_day && !b.is_all_day) return -1;
                if (!a.is_all_day && b.is_all_day) return 1;
                if (a.is_all_day && b.is_all_day) return 0;
                return (a.start_time || '').localeCompare(b.start_time || '');
              });
              
              return (
                <View key={dateKey} style={styles.outlookDateGroup}>
                  {/* Outlook-style Date Sidebar */}
                  <View style={styles.outlookDateColumn}>
                    {isToday && (
                      <View style={styles.outlookTodayIndicator} />
                    )}
                    <Text style={[
                      styles.outlookDateDay,
                      isToday && styles.outlookDateDayToday
                    ]}>
                      {day}
                    </Text>
                    <Text style={[
                      styles.outlookDateMonth,
                      isToday && styles.outlookDateMonthToday
                    ]}>
                      {date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                    </Text>
                    <Text style={[
                      styles.outlookDateWeekday,
                      isToday && styles.outlookDateWeekdayToday
                    ]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                  </View>

                  {/* Events Column */}
                  <View style={styles.outlookEventsColumn}>
                    {sortedEvents.map((event, eventIndex) => {
                      const eventColor = event.color || getEventTypeColor(event.event_type);
                      
                      return (
                        <TouchableOpacity 
                          key={event.id} 
                          onPress={() => handleEventClick(event)}
                          activeOpacity={0.6}
                          style={[
                            styles.outlookEventRow, 
                            { 
                              borderLeftColor: eventColor,
                              backgroundColor: isDark ? colors.surface.secondary : colors.neutral[50],
                            }
                          ]}
                        >
                          <View style={styles.outlookEventContent}>
                            {/* Event Details */}
                            <View style={styles.outlookEventDetails}>
                              <View style={styles.outlookEventHeader}>
                                <View style={[styles.outlookEventDot, { backgroundColor: eventColor }]} />
                                <View style={styles.outlookEventTitleContainer}>
                                  <View style={styles.outlookEventTitleRow}>
                                    <Text style={styles.outlookEventTitle} numberOfLines={1}>
                                      {event.title}
                                    </Text>
                                    {event.is_all_day ? (
                                      <View style={styles.outlookAllDayBadge}>
                                        <Text style={styles.outlookAllDayText}>All day</Text>
                                      </View>
                                    ) : event.start_time ? (
                                      <View style={styles.outlookTimeBadge}>
                                        <Text style={styles.outlookEventTime}>
                                          {formatTime(event.start_time)}
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <View style={styles.outlookEventTypeBadgeContainer}>
                                    <View style={[styles.outlookEventTypeBadge, { backgroundColor: `${eventColor}20` }]}>
                                      <Text style={[styles.outlookEventTypeText, { color: eventColor }]}>
                                        {event.event_type}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              </View>
                              {event.description && (
                                <Text style={styles.outlookEventDescription} numberOfLines={2}>
                                  {event.description}
                                </Text>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyStateIllustration
            type="calendar"
            title="No Events"
            description="No events scheduled for this month."
            action={
              canManageEvents ? (
                <Button mode="contained" onPress={handleAddEvent} style={styles.addEventButton}>
                  Add First Event
                </Button>
              ) : undefined
            }
          />
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter Bar */}
      <View style={styles.filterBar}>
        {!canReadOwnCalendar && (
          <TouchableOpacity style={styles.filterItem} onPress={() => setShowClassDropdown(true)}>
            <View style={styles.filterIcon}>
              <Users size={16} color={colors.text.inverse} />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterLabel}>Class</Text>
              <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                {selectedClassId
                  ? `${classes.find((c) => c.id === selectedClassId)?.grade}-${
                      classes.find((c) => c.id === selectedClassId)?.section || ''
                    }`
                  : 'All Classes'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.filterItem}
          onPress={() => {
            setMonthPickerYear(new Date(currentDate).getFullYear());
            setShowMonthPicker(true);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.filterIcon}>
            <ListTodo size={16} color={colors.text.inverse} />
          </View>
          <View style={styles.filterContent}>
            <Text style={styles.filterLabel}>Date</Text>
            <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
              {new Date(currentDate).toLocaleDateString('en-GB', {
                month: 'short', year: 'numeric'
              })}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* View Mode Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.pillTabs}>
          <TouchableOpacity
            style={[styles.pillTab, viewMode === 'month' && styles.pillTabActive]}
            activeOpacity={0.9}
            onPress={() => setViewMode('month')}
          >
            <View style={styles.pillTabContent}>
              <CalendarIcon size={16} color={viewMode === 'month' ? colors.primary[700] : colors.text.secondary} />
              <Text style={[styles.pillTabText, viewMode === 'month' && styles.pillTabTextActive]}>Month</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pillTab, viewMode === 'list' && styles.pillTabActive]}
            activeOpacity={0.9}
            onPress={() => setViewMode('list')}
          >
            <View style={styles.pillTabContent}>
              <ListTodo size={16} color={viewMode === 'list' ? colors.primary[700] : colors.text.secondary} />
              <Text style={[styles.pillTabText, viewMode === 'list' && styles.pillTabTextActive]}>List</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {viewMode === 'month' && (
        <>
          {isLoading && events.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={styles.loadingText}>Loading events...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>Failed to load events</Text>
              <Button onPress={() => refetch()} style={{ marginTop: spacing.md }}>
                Retry
              </Button>
            </View>
          ) : (
            <CalendarMonthView
              currentDate={currentDate}
              events={events}
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={handleRefresh}
                  tintColor={colors.primary.main}
                  colors={[colors.primary.main]}
                />
              }
            />
          )}
        </>
      )}

      {viewMode === 'list' && renderListView()}

      {/* Class Selector Modal */}
      <Modal
        visible={showClassDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClassDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Class</Text>
            <ScrollView style={styles.sheetList}>
              <TouchableOpacity
                style={styles.sheetItem}
                onPress={() => {
                  setSelectedClassId('');
                  setShowClassDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.sheetItemText,
                    !selectedClassId && styles.sheetItemTextSelected,
                  ]}
                >
                  All Classes (School-wide)
                </Text>
              </TouchableOpacity>
              {classes.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.sheetItem}
                  onPress={() => {
                    setSelectedClassId(c.id);
                    setShowClassDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sheetItemText,
                      selectedClassId === c.id && styles.sheetItemTextSelected,
                    ]}
                  >
                    Grade {c.grade}
                    {c.section ? `-${c.section}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button onPress={() => setShowClassDropdown(false)}>Close</Button>
          </View>
        </View>
      </Modal>

      {/* Event Form Modal */}
      <CalendarEventFormModal
        visible={isEventModalVisible}
        event={selectedEvent || undefined}
        academicYearId={undefined}
        schoolCode={schoolCode}
        classes={classes}
        userId={profile?.auth_id || ''}
        onCancel={() => {
          setIsEventModalVisible(false);
          setSelectedEvent(null);
        }}
        onSuccess={handleSaveEvent}
      />

      {/* Holiday Form Modal */}
      <CalendarEventFormModal
        visible={isHolidayModalVisible}
        event={selectedEvent || undefined}
        academicYearId={undefined}
        schoolCode={schoolCode}
        classes={classes}
        isHoliday
        userId={profile?.auth_id || ''}
        onCancel={() => {
          setIsHolidayModalVisible(false);
          setSelectedEvent(null);
        }}
        onSuccess={handleSaveEvent}
      />

      {/* Floating Add Button */}
      {canManageEvents && (
        <TouchableOpacity onPress={handleAddEvent} style={styles.floatingButton}>
          <Plus size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      )}

      {/* Month Picker */}
      <MonthPickerModal
        visible={showMonthPicker}
        initialDate={new Date(currentDate)}
        onDismiss={() => setShowMonthPicker(false)}
        onConfirm={(date) => setCurrentDate(date)}
      />
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  spacing: any,
  borderRadius: any,
  typography: any,
  shadows: any,
  isDark: boolean
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.app,
  },
  pillTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    overflow: 'hidden',
  },
  pillTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  pillTabActive: {
    backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
  },
  pillTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillTabText: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  pillTabTextActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.bold,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.app,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  errorText: {
    color: colors.error.main,
    marginBottom: spacing.md,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  listContentContainer: {
    paddingBottom: spacing.xl * 2,
  },
  // Outlook-style calendar list
  outlookContainer: {
    flex: 1,
    backgroundColor: colors.background.app,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  outlookList: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  outlookDateGroup: {
    flexDirection: 'row',
    minHeight: 80,
    backgroundColor: colors.surface.primary,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  outlookDateColumn: {
    minWidth: 70,
    maxWidth: 90,
    width: 70,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border.light,
    position: 'relative',
    backgroundColor: isDark ? colors.surface.secondary : colors.neutral[50],
    flexShrink: 0,
  },
  outlookTodayIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary.main,
  },
  outlookDateDay: {
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  outlookDateDayToday: {
    color: colors.primary.main,
  },
  outlookDateMonth: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    letterSpacing: 1,
    marginTop: -4,
    textTransform: 'uppercase',
  },
  outlookDateMonthToday: {
    color: colors.primary.main,
  },
  outlookDateWeekday: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  outlookDateWeekdayToday: {
    color: colors.primary.main,
    fontWeight: typography.fontWeight.semibold,
  },
  outlookEventsColumn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    paddingLeft: spacing.xs,
    minWidth: 0,
  },
  outlookEventRow: {
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.sm,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  outlookEventContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    flexShrink: 1,
  },
  outlookTimeBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.neutral[100],
    flexShrink: 0,
  },
  outlookEventTime: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    letterSpacing: 0.2,
  },
  outlookEventDetails: {
    flex: 1,
    minWidth: 0,
  },
  outlookEventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
  },
  outlookEventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
    borderWidth: 2,
    borderColor: isDark ? colors.surface.primary : colors.background.app,
    marginTop: 6,
    flexShrink: 0,
  },
  outlookEventTitleContainer: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  outlookEventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs / 2,
  },
  outlookEventTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 20,
    letterSpacing: -0.2,
    minWidth: 0,
  },
  outlookEventTypeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outlookEventTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  outlookEventTypeText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  outlookAllDayBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.primary[100],
    flexShrink: 0,
  },
  outlookAllDayText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.main,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  outlookEventDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
    marginTop: spacing.xs,
    letterSpacing: 0.1,
  },
  outlookEventEndTime: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  outlookDateSeparator: {
    height: 1,
    backgroundColor: colors.border.light,
    marginLeft: spacing.md,
    marginRight: spacing.md,
    marginVertical: spacing.sm,
  },
  addEventButton: {
    marginTop: spacing.md,
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.app,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    minWidth: 0,
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContent: {
    flex: 1,
    minWidth: 0,
  },
  filterLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  filterValue: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  sheetList: {
    maxHeight: 400,
    marginBottom: spacing.md,
  },
  sheetItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sheetItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  sheetItemTextSelected: {
    color: colors.primary.main,
    fontWeight: typography.fontWeight.bold,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});
