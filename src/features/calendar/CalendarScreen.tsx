import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, RefreshControl } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { 
  Plus, 
  ListTodo,
  Calendar as CalendarIcon,
  CalendarDays,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../../lib/design-system';
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
// Date picker not used in calendar filter anymore
import { MonthPickerModal } from '../../components/common';
import { supabase } from '../../lib/supabase';
import { DB } from '../../types/db.constants';
import { EmptyStateIllustration } from '../../components/ui/EmptyStateIllustration';

export default function CalendarScreen() {
  const { profile } = useAuth();
  
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [isEventModalVisible, setIsEventModalVisible] = useState(false);
  const [isHolidayModalVisible, setIsHolidayModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [classes, setClasses] = useState<{ id: string; grade: number; section?: string }[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  // Month picker state
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState<number>(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);

  const role = profile?.role;
  const isStudent = role === 'student';
  const canManageEvents = role === 'admin' || role === 'superadmin' || role === 'cb_admin';
  const schoolCode = profile?.school_code || '';

  // For students, use their class_instance_id automatically
  const studentClassId = isStudent ? profile?.class_instance_id || undefined : undefined;

  // Fetch classes for the school (only for admins, not needed for students)
  const fetchClasses = useCallback(async () => {
    if (!schoolCode || isStudent) return;
    
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
  }, [schoolCode, isStudent]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Calculate date range for current month
  const { startDate, endDate } = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [currentDate]);

  // For students: show only school-wide + their class events
  // For admins: show based on selectedClassId filter
  const effectiveClassId = isStudent ? studentClassId : (selectedClassId || undefined);

  // Fetch calendar events
  const { data: events = [], isLoading, error, refetch } = useCalendarEvents(
    schoolCode,
    startDate,
    endDate,
    effectiveClassId
  );

  // Pull to refresh handler
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

  // Mutations
  const createEventMutation = useCreateCalendarEvent();
  const updateEventMutation = useUpdateCalendarEvent();
  const deleteEventMutation = useDeleteCalendarEvent();

  // Handlers
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

  // Month/list views do not expose date selector

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
    const colors_map: { [key: string]: string } = {
      holiday: '#0369a1',
      assembly: '#1890ff',
      exam: '#faad14',
      ptm: '#52c41a',
      'sports day': '#722ed1',
      'cultural event': '#eb2f96',
    };
    return colors_map[type.toLowerCase()] || '#8c8c8c';
  };

  const renderListView = () => {
    // Group events by date
    const groupedEvents: { [key: string]: CalendarEvent[] } = {};
    events.forEach((event) => {
      const dateKey = event.start_date;
      if (!groupedEvents[dateKey]) {
        groupedEvents[dateKey] = [];
      }
      groupedEvents[dateKey].push(event);
    });

    const sortedDates = Object.keys(groupedEvents).sort();

    return (
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={colors.primary[600]}
            colors={[colors.primary[600]]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centerContainer}>
            <Text>Loading events...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>Failed to load events</Text>
            <Button onPress={() => refetch()}>Retry</Button>
          </View>
        ) : events.length > 0 ? (
          <View style={styles.eventsList}>
            {sortedDates.map((dateKey) => {
              const dateEvents = groupedEvents[dateKey];
              const date = new Date(dateKey);
              
              return (
                <View key={dateKey} style={styles.dateGroup}>
                  {/* Date Header */}
                  <View style={styles.dateGroupHeader}>
                    <View style={styles.dateGroupDateBox}>
                      <Text style={styles.dateGroupDay}>{date.getDate()}</Text>
                      <Text style={styles.dateGroupMonth}>
                        {date.toLocaleDateString('en-US', { month: 'short' })}
                      </Text>
                    </View>
                    <View style={styles.dateGroupInfo}>
                      <Text style={styles.dateGroupWeekday}>
                        {date.toLocaleDateString('en-US', { weekday: 'long' })}
                      </Text>
                      <Text style={styles.dateGroupCount}>
                        {dateEvents.length} {dateEvents.length === 1 ? 'event' : 'events'}
                      </Text>
                    </View>
                  </View>

                  {/* Events for this date */}
                  {dateEvents.map((event) => (
                    <TouchableOpacity key={event.id} onPress={() => handleEventClick(event)}>
                      <View style={styles.eventCardList}>
                        <View
                          style={[
                            styles.eventColorStrip,
                            { backgroundColor: event.color || getEventTypeColor(event.event_type) },
                          ]}
                        />
                        <View style={styles.eventCardContent}>
                          <View style={styles.eventCardHeader}>
                            <Text style={styles.eventCardTitle}>{event.title}</Text>
                            <View
                              style={[
                                styles.eventTypeBadge,
                                { backgroundColor: event.color || getEventTypeColor(event.event_type) },
                              ]}
                            >
                              <Text style={styles.eventTypeBadgeText}>{event.event_type}</Text>
                            </View>
                          </View>

                          {!event.is_all_day && event.start_time && (
                            <Text style={styles.eventCardTime}>
                              🕐 {formatTime(event.start_time)}
                              {event.end_time && ` - ${formatTime(event.end_time)}`}
                            </Text>
                          )}

                          {event.description && (
                            <Text style={styles.eventCardDescription} numberOfLines={2}>
                              {event.description}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
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
        {/* Class Filter - only show for admins, not students */}
        {!isStudent && (
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

        {/* Date Pill - opens month picker */}
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
        <CalendarMonthView
          currentDate={currentDate}
          events={events}
          onDateClick={handleDateClick}
          onEventClick={handleEventClick}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              tintColor={colors.primary[600]}
              colors={[colors.primary[600]]}
            />
          }
        />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.default,
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
    backgroundColor: colors.primary[50],
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
    backgroundColor: '#FAFBFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  errorText: {
    color: colors.error[600],
    marginBottom: spacing.md,
  },
  eventsList: {
    gap: spacing.lg,
  },
  dateGroup: {
    marginBottom: spacing.lg,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  dateGroupDateBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  dateGroupDay: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  dateGroupMonth: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateGroupInfo: {
    flex: 1,
  },
  dateGroupWeekday: {
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  dateGroupCount: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  eventCardList: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E1E4E8',
  },
  eventColorStrip: {
    width: 4,
  },
  eventCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  eventCardTitle: {
    fontSize: 15,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  eventTypeBadgeText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  eventCardTime: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  eventCardDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  addEventButton: {
    marginTop: spacing.md,
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.default,
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
    borderColor: '#E6E8EF',
    minWidth: 0, // Prevents overflow
  },
  filterItemDisabled: {
    opacity: 0.6,
  },
  filterDivider: {
    display: 'none',
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContent: {
    flex: 1,
    minWidth: 0, // Prevents overflow
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.background.default,
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
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});