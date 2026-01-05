import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Text, Modal, Portal, Button, TextInput, Switch, Chip } from 'react-native-paper';
import { Calendar as CalendarIcon, Clock, X } from 'lucide-react-native';
import { DatePickerModal } from '../common/DatePickerModal';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../theme/types';

interface CalendarEventFormModalProps {
  visible: boolean;
  event?: any;
  academicYearId?: string;
  schoolCode: string;
  classes: { id: string; grade: number | null; section?: string | null }[];
  isHoliday?: boolean;
  userId: string;
  onCancel: () => void;
  onSuccess: (eventData: any) => void;
}

const EVENT_TYPES = [
  { label: 'Assembly', value: 'assembly' },
  { label: 'Exam', value: 'exam' },
  { label: 'Holiday', value: 'holiday' },
  { label: 'PTM', value: 'ptm' },
  { label: 'Sports Day', value: 'sports day' },
  { label: 'Cultural Event', value: 'cultural event' },
  { label: 'Other', value: 'other' },
];

const EVENT_COLORS = [
  '#ff4d4f', // Red
  '#2678BE', // Blue
  '#f59e0b', // Orange
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
];

export default function CalendarEventFormModal({
  visible,
  event,
  academicYearId,
  schoolCode,
  classes,
  isHoliday = false,
  userId,
  onCancel,
  onSuccess,
}: CalendarEventFormModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('assembly');
  const [classInstanceId, setClassInstanceId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [color, setColor] = useState('#2678BE');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');

  // Reset form when modal opens/closes or event changes
  useEffect(() => {
    if (visible) {
      if (event) {
        // Edit mode
        setTitle(event.title || '');
        setDescription(event.description || '');
        setEventType(event.event_type || 'assembly');
        setClassInstanceId(event.class_instance_id || null);
        setStartDate(event.start_date ? new Date(event.start_date) : new Date());
        setEndDate(event.end_date ? new Date(event.end_date) : null);
        setIsAllDay(event.is_all_day ?? true);
        setStartTime(event.start_time ? new Date(`2000-01-01T${event.start_time}`) : new Date());
        setEndTime(event.end_time ? new Date(`2000-01-01T${event.end_time}`) : new Date());
        setColor(event.color || '#2678BE');
        setIsActive(event.is_active ?? true);
      } else {
        // Create mode
        resetForm();
        if (isHoliday) {
          setEventType('holiday');
          setColor('#f59e0b');
        }
      }
    }
  }, [visible, event, isHoliday]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventType('assembly');
    setClassInstanceId(null);
    setStartDate(new Date());
    setEndDate(null);
    setIsAllDay(true);
    setStartTime(new Date());
    setEndTime(new Date());
    setColor('#2678BE');
    setIsActive(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('Please enter event title');
      return;
    }

    setLoading(true);
    try {
      // Format dates in local timezone to avoid date shifting
      const formatDateLocal = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const eventData = {
        school_code: schoolCode,
        academic_year_id: academicYearId,
        class_instance_id: classInstanceId,
        title: title.trim(),
        description: description.trim(),
        event_type: eventType,
        start_date: formatDateLocal(startDate),
        end_date: endDate ? formatDateLocal(endDate) : formatDateLocal(startDate),
        is_all_day: isAllDay,
        start_time: isAllDay ? null : startTime.toTimeString().split(' ')[0].substring(0, 5),
        end_time: isAllDay ? null : endTime.toTimeString().split(' ')[0].substring(0, 5),
        color,
        is_active: isActive,
        created_by: userId,
      };

      onSuccess(eventData);
      resetForm();
    } catch (error) {
      console.error('Error submitting event:', error);
      alert('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectedClass = classes.find((c) => c.id === classInstanceId);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onCancel}
        contentContainerStyle={styles.modalContainer}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              {event ? 'Edit Event' : `New ${isHoliday ? 'Holiday' : 'Event'}`}
            </Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.field}>
            <Text variant="labelLarge" style={styles.label}>
              Title *
            </Text>
            <TextInput
              mode="outlined"
              value={title}
              onChangeText={setTitle}
              placeholder="Enter event title"
              style={styles.input}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text variant="labelLarge" style={styles.label}>
              Description
            </Text>
            <TextInput
              mode="outlined"
              value={description}
              onChangeText={setDescription}
              placeholder="Enter event description (optional)"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          </View>

          {/* Event Type */}
          <View style={styles.field}>
            <Text variant="labelLarge" style={styles.label}>
              Event Type *
            </Text>
            <View style={styles.chipContainer}>
              {EVENT_TYPES.map((type) => (
                <Chip
                  key={type.value}
                  selected={eventType === type.value}
                  onPress={() => setEventType(type.value)}
                  style={[
                    styles.chip,
                    eventType === type.value && styles.chipSelected,
                  ]}
                  textStyle={eventType === type.value ? styles.chipTextSelected : undefined}
                >
                  {type.label}
                </Chip>
              ))}
            </View>
          </View>

          {/* Class Selection */}
          <View style={styles.field}>
            <Text variant="labelLarge" style={styles.label}>
              Class (Optional)
            </Text>
            <Text variant="bodySmall" style={styles.helperText}>
              Leave empty for school-wide events
            </Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowClassSelector(true)}
            >
              <Text style={styles.selectorText}>
                {selectedClass
                  ? `Grade ${selectedClass.grade}${selectedClass.section ? `-${selectedClass.section}` : ''}`
                  : 'All Classes (School-wide)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dates */}
          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <Text variant="labelLarge" style={styles.label}>
                Start Date *
              </Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerMode('start');
                  setShowStartDatePicker(true);
                }}
              >
                <CalendarIcon size={20} color={colors.primary[600]} />
                <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.field, styles.halfField]}>
              <Text variant="labelLarge" style={styles.label}>
                End Date
              </Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerMode('end');
                  setShowEndDatePicker(true);
                }}
              >
                <CalendarIcon size={20} color={colors.primary[600]} />
                <Text style={styles.dateButtonText}>
                  {endDate ? formatDate(endDate) : 'Same day'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* All Day Toggle */}
          <View style={styles.switchField}>
            <View>
              <Text variant="labelLarge" style={styles.label}>
                All Day Event
              </Text>
              <Text variant="bodySmall" style={styles.helperText}>
                No specific time required
              </Text>
            </View>
            <Switch value={isAllDay} onValueChange={setIsAllDay} />
          </View>

          {/* Times */}
          {!isAllDay && (
            <View style={styles.row}>
              <View style={[styles.field, styles.halfField]}>
                <Text variant="labelLarge" style={styles.label}>
                  Start Time
                </Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Clock size={20} color={colors.primary[600]} />
                  <Text style={styles.dateButtonText}>{formatTime(startTime)}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.field, styles.halfField]}>
                <Text variant="labelLarge" style={styles.label}>
                  End Time
                </Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Clock size={20} color={colors.primary[600]} />
                  <Text style={styles.dateButtonText}>{formatTime(endTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Color Picker */}
          <View style={styles.field}>
            <Text variant="labelLarge" style={styles.label}>
              Color
            </Text>
            <View style={styles.colorContainer}>
              {EVENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorButton,
                    { backgroundColor: c },
                    color === c && styles.colorButtonSelected,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </View>

          {/* Active Toggle */}
          <View style={styles.switchField}>
            <Text variant="labelLarge" style={styles.label}>
              Active
            </Text>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onCancel}
              style={styles.actionButton}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.actionButton}
              loading={loading}
              disabled={loading}
            >
              {event ? 'Update' : 'Create'} Event
            </Button>
          </View>
        </ScrollView>

        {/* Date Pickers */}
        <DatePickerModal
          visible={showStartDatePicker}
          onDismiss={() => setShowStartDatePicker(false)}
          onConfirm={(date) => {
            setStartDate(date);
            setShowStartDatePicker(false);
          }}
          initialDate={startDate}
          title="Select Start Date"
        />
        
        <DatePickerModal
          visible={showEndDatePicker}
          onDismiss={() => setShowEndDatePicker(false)}
          onConfirm={(date) => {
            setEndDate(date);
            setShowEndDatePicker(false);
          }}
          initialDate={endDate || startDate}
          title="Select End Date"
        />

        {/* Time Pickers */}
        {showStartTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display="default"
            onChange={(event, selectedTime) => {
              setShowStartTimePicker(false);
              if (selectedTime) setStartTime(selectedTime);
            }}
          />
        )}
        {showEndTimePicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display="default"
            onChange={(event, selectedTime) => {
              setShowEndTimePicker(false);
              if (selectedTime) setEndTime(selectedTime);
            }}
          />
        )}
      </Modal>

      {/* Class Selection Modal - Separate modal outside the main form modal */}
      <Modal
        visible={showClassSelector}
        onDismiss={() => setShowClassSelector(false)}
        contentContainerStyle={styles.classModalContainer}
      >
        <View style={styles.classModalHeader}>
          <Text variant="headlineSmall" style={styles.classModalTitle}>
            Select Class
          </Text>
          <TouchableOpacity onPress={() => setShowClassSelector(false)} style={styles.closeButton}>
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.classModalList}>
          <TouchableOpacity
            style={[
              styles.classModalItem,
              !classInstanceId && styles.classModalItemSelected,
            ]}
            onPress={() => {
              setClassInstanceId(null);
              setShowClassSelector(false);
            }}
          >
            <Text
              style={[
                styles.classModalItemText,
                !classInstanceId && styles.classModalItemTextSelected,
              ]}
            >
              All Classes (School-wide)
            </Text>
          </TouchableOpacity>
          {classes.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              style={[
                styles.classModalItem,
                classInstanceId === cls.id && styles.classModalItemSelected,
              ]}
              onPress={() => {
                setClassInstanceId(cls.id);
                setShowClassSelector(false);
              }}
            >
              <Text
                style={[
                  styles.classModalItemText,
                  classInstanceId === cls.id && styles.classModalItemTextSelected,
                ]}
              >
                Grade {cls.grade}
                {cls.section ? `-${cls.section}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Button onPress={() => setShowClassSelector(false)} style={styles.classModalButton}>
          Cancel
        </Button>
      </Modal>
    </Portal>
  );
}

const createStyles = (
  colors: ThemeColors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows
) =>
  StyleSheet.create({
  modalContainer: {
    backgroundColor: colors.background.card,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    maxHeight: '90%',
  },
  scrollView: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  field: {
    marginBottom: spacing.lg,
  },
  halfField: {
    flex: 1,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  helperText: {
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.app,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primary[600],
  },
  chipTextSelected: {
    color: colors.text.inverse,
  },
  selector: {
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.background.app,
  },
  selectorText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  classModalContainer: {
    backgroundColor: colors.background.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    maxHeight: '80%',
    padding: spacing.lg,
  },
  classModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  classModalTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  classModalList: {
    maxHeight: 400,
    marginBottom: spacing.md,
  },
  classModalItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  classModalItemSelected: {
    backgroundColor: colors.primary[50],
    borderBottomColor: colors.primary[200],
  },
  classModalItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  classModalItemTextSelected: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  classModalButton: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.background.app,
  },
  dateButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  switchField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  colorContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: colors.primary[600],
    borderWidth: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
});
