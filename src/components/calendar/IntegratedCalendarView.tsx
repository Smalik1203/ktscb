import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text, Card, Button, Chip } from 'react-native-paper';
import {
  Clock,
  BookOpen,
  Trophy,
  Calendar as CalendarIcon,
  Eye,
  PlayCircle,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../../lib/design-system';
import { useDayData } from '../../hooks/useCalendarEvents';

interface IntegratedCalendarViewProps {
  date: string;
  schoolCode: string;
  classInstanceId?: string;
  onNavigateToTimetable?: (date: string, classId: string) => void;
  onNavigateToTest?: (testId: string) => void;
}

export default function IntegratedCalendarView({
  date,
  schoolCode,
  classInstanceId,
  onNavigateToTimetable,
  onNavigateToTest,
}: IntegratedCalendarViewProps) {
  const { data: dayData, isLoading, error } = useDayData(date, schoolCode, classInstanceId);
  const [activeTab, setActiveTab] = useState<'all' | 'timetable' | 'tests' | 'events'>('all');

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading day data...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="bodyLarge" style={styles.errorText}>
          Failed to load data
        </Text>
      </View>
    );
  }

  if (!dayData?.hasData) {
    return (
      <View style={styles.centerContainer}>
        <CalendarIcon size={64} color={colors.text.tertiary} />
        <Text variant="titleLarge" style={styles.emptyTitle}>
          No Activities
        </Text>
        <Text variant="bodyMedium" style={styles.emptyMessage}>
          No activities scheduled for this date
        </Text>
      </View>
    );
  }

  const getEventTypeColor = (type: string): string => {
    const colorMap: { [key: string]: string } = {
      holiday: colors.info[600],
      assembly: colors.primary[500],
      exam: colors.warning[500],
      ptm: colors.success[500],
    };
    return colorMap[type.toLowerCase()] || colors.neutral[500];
  };

  const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const renderTimetableItem = (slot: any) => (
    <Card key={slot.id} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemIcon}>
          <Clock size={20} color={colors.text.inverse} />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemTitleRow}>
            <Text variant="titleMedium" style={styles.itemTitle}>
              Period {slot.period_number}
            </Text>
            <Chip
              mode="outlined"
              style={styles.chip}
              textStyle={styles.chipText}
            >
              {slot.slot_type === 'break' ? 'Break' : 'Period'}
            </Chip>
          </View>
          <Text variant="bodySmall" style={styles.itemTime}>
            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
          </Text>
          {slot.slot_type === 'period' && slot.subject_name && (
            <Text variant="bodyMedium" style={styles.itemSubtitle}>
              {slot.subject_name}
            </Text>
          )}
          {slot.slot_type === 'break' && slot.name && (
            <Text variant="bodyMedium" style={styles.itemSubtitle}>
              {slot.name}
            </Text>
          )}
          {slot.plan_text && (
            <Text variant="bodySmall" style={styles.itemDescription}>
              {slot.plan_text}
            </Text>
          )}
        </View>
      </View>
      {onNavigateToTimetable && (
        <Button
          mode="text"
          icon={() => <Eye size={16} color={colors.primary[600]} />}
          onPress={() => onNavigateToTimetable(date, slot.class_instance_id)}
          style={styles.itemAction}
        >
          View Details
        </Button>
      )}
    </Card>
  );

  const renderTestItem = (test: any) => (
    <Card key={test.id} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={[styles.itemIcon, { backgroundColor: colors.warning[500] }]}>
          <Trophy size={20} color={colors.text.inverse} />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemTitleRow}>
            <Text variant="titleMedium" style={styles.itemTitle}>
              {test.title}
            </Text>
            <Chip
              mode="outlined"
              style={styles.chip}
              textStyle={styles.chipText}
            >
              {test.test_type}
            </Chip>
          </View>
          <Chip
            mode="flat"
            style={[
              styles.chip,
              { backgroundColor: test.test_mode === 'online' ? '#f6ffed' : '#e6f7ff' },
            ]}
            textStyle={{ color: test.test_mode === 'online' ? colors.success[500] : colors.primary[500] }}
          >
            {test.test_mode === 'online' ? 'Online' : 'Offline'}
          </Chip>
          {test.description && (
            <Text variant="bodySmall" style={styles.itemDescription}>
              {test.description}
            </Text>
          )}
          {test.time_limit_seconds && (
            <Text variant="bodySmall" style={styles.itemTime}>
              Duration: {Math.floor(test.time_limit_seconds / 60)} minutes
            </Text>
          )}
        </View>
      </View>
      {onNavigateToTest && (
        <Button
          mode="text"
          icon={() => <PlayCircle size={16} color={colors.primary[600]} />}
          onPress={() => onNavigateToTest(test.id)}
          style={styles.itemAction}
        >
          {test.test_mode === 'online' ? 'Take Test' : 'View Details'}
        </Button>
      )}
    </Card>
  );

  const renderEventItem = (event: any) => (
    <Card key={event.id} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View
          style={[
            styles.itemIcon,
            { backgroundColor: getEventTypeColor(event.event_type) },
          ]}
        >
          <CalendarIcon size={20} color={colors.text.inverse} />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemTitleRow}>
            <Text variant="titleMedium" style={styles.itemTitle}>
              {event.title}
            </Text>
            <Chip
              mode="outlined"
              style={[
                styles.chip,
                { borderColor: getEventTypeColor(event.event_type) },
              ]}
              textStyle={{ color: getEventTypeColor(event.event_type) }}
            >
              {event.event_type}
            </Chip>
          </View>
          {event.description && (
            <Text variant="bodySmall" style={styles.itemDescription}>
              {event.description}
            </Text>
          )}
          {event.start_time && (
            <Text variant="bodySmall" style={styles.itemTime}>
              {formatTime(event.start_time)} - {formatTime(event.end_time)}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );

  const allItems = [
    ...(dayData?.timetable || []).map((item) => ({ ...item, type: 'timetable' })),
    ...(dayData?.tests || []).map((item) => ({ ...item, type: 'test' })),
    ...(dayData?.events || []).map((item) => ({ ...item, type: 'event' })),
  ].sort((a, b) => {
    const timeA = ('start_time' in a ? a.start_time : null) || '00:00';
    const timeB = ('start_time' in b ? b.start_time : null) || '00:00';
    return timeA.localeCompare(timeB);
  });

  const filteredItems =
    activeTab === 'all'
      ? allItems
      : activeTab === 'timetable'
      ? dayData?.timetable || []
      : activeTab === 'tests'
      ? dayData?.tests || []
      : dayData?.events || [];

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Clock size={20} color={colors.primary[600]} />
          <Text variant="titleMedium" style={styles.statValue}>
            {dayData?.timetable.length || 0}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Periods
          </Text>
        </View>
        <View style={styles.statCard}>
          <Trophy size={20} color={colors.warning[600]} />
          <Text variant="titleMedium" style={styles.statValue}>
            {dayData?.tests.length || 0}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Tests
          </Text>
        </View>
        <View style={styles.statCard}>
          <CalendarIcon size={20} color={colors.success[600]} />
          <Text variant="titleMedium" style={styles.statValue}>
            {dayData?.events.length || 0}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Events
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            variant="labelLarge"
            style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}
          >
            All ({allItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'timetable' && styles.activeTab]}
          onPress={() => setActiveTab('timetable')}
        >
          <Text
            variant="labelLarge"
            style={[
              styles.tabText,
              activeTab === 'timetable' && styles.activeTabText,
            ]}
          >
            Timetable ({dayData?.timetable.length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tests' && styles.activeTab]}
          onPress={() => setActiveTab('tests')}
        >
          <Text
            variant="labelLarge"
            style={[styles.tabText, activeTab === 'tests' && styles.activeTabText]}
          >
            Tests ({dayData?.tests.length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.activeTab]}
          onPress={() => setActiveTab('events')}
        >
          <Text
            variant="labelLarge"
            style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}
          >
            Events ({dayData?.events.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'all' &&
          allItems.map((item) => {
            if (item.type === 'timetable') return renderTimetableItem(item);
            if (item.type === 'test') return renderTestItem(item);
            return renderEventItem(item);
          })}
        {activeTab === 'timetable' && dayData?.timetable.map(renderTimetableItem)}
        {activeTab === 'tests' && dayData?.tests.map(renderTestItem)}
        {activeTab === 'events' && dayData?.events.map(renderEventItem)}

        {filteredItems.length === 0 && (
          <View style={styles.centerContainer}>
            <Text variant="bodyMedium" style={styles.emptyMessage}>
              No {activeTab === 'all' ? 'activities' : activeTab} for this date
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: colors.text.secondary,
  },
  errorText: {
    color: colors.error[600],
  },
  emptyTitle: {
    marginTop: spacing.md,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  emptyMessage: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    color: colors.text.secondary,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary[600],
  },
  tabText: {
    color: colors.text.secondary,
  },
  activeTabText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  itemCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  itemTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  itemSubtitle: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  itemTime: {
    color: colors.text.secondary,
  },
  itemDescription: {
    color: colors.text.secondary,
    lineHeight: 18,
  },
  chip: {
    height: 24,
  },
  chipText: {
    fontSize: typography.fontSize.xs,
    marginVertical: 0,
  },
  itemAction: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
});

