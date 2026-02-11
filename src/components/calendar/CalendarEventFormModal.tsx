import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Text, Modal, Portal, Button, TextInput, Switch } from 'react-native-paper';
import { Calendar as CalendarIcon, Clock, X, ChevronRight } from 'lucide-react-native';
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
  onDelete?: () => void;
}

// Removed EVENT_TYPES constant

const PRESET_COLORS = [
  { color: '#4f46e5', label: 'Indigo' },
  { color: '#0ea5e9', label: 'Sky' },
  { color: '#10b981', label: 'Emerald' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#ef4444', label: 'Red' },
  { color: '#8b5cf6', label: 'Violet' },
  { color: '#ec4899', label: 'Pink' },
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
  onDelete,
}: CalendarEventFormModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState(''); // Changed default to empty
  const [classInstanceId, setClassInstanceId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [color, setColor] = useState(PRESET_COLORS[0].color);
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
        setEventType(event.event_type || ''); // Direct assignment
        setClassInstanceId(event.class_instance_id || null);
        setStartDate(event.start_date ? new Date(event.start_date) : new Date());
        setEndDate(event.end_date ? new Date(event.end_date) : null);
        setIsAllDay(event.is_all_day ?? true);
        setStartTime(event.start_time ? new Date(`2000-01-01T${event.start_time}`) : new Date());
        setEndTime(event.end_time ? new Date(`2000-01-01T${event.end_time}`) : new Date());
        setColor(event.color || PRESET_COLORS[0].color);
        setIsActive(event.is_active ?? true);
      } else {
        // Create mode
        resetForm();
        if (isHoliday) {
          setEventType('holiday');
          setColor(PRESET_COLORS.find(c => c.label === 'Orange')?.color || '#f59e0b');
          setTitle(''); // Clear title for new holiday
        }
      }
    }
  }, [visible, event, isHoliday]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventType(''); // Reset to empty string
    setClassInstanceId(null);
    setStartDate(new Date());
    setEndDate(null);
    setIsAllDay(true);
    setStartTime(new Date());
    setEndTime(new Date());
    setColor(PRESET_COLORS[0].color);
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
        event_type: eventType.trim() || 'General', // Use direct text input
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
      // Event submission failed
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
            <TextInput
              mode="outlined"
              label="Title *"
              value={title}
              onChangeText={setTitle}
              placeholder="Enter event title"
              style={styles.input}
              outlineColor={colors.border.DEFAULT}
              activeOutlineColor={colors.primary.main}
              textColor={colors.text.primary}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <TextInput
              mode="outlined"
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Enter details (optional)"
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea]}
              outlineColor={colors.border.DEFAULT}
              activeOutlineColor={colors.primary.main}
              textColor={colors.text.primary}
            />
          </View>

          {/* Event Type & Class Selection Row */}
          <View style={styles.row}>
            {/* Event Type */}
            <View style={[styles.field, styles.halfField]}>
              <TextInput
                mode="outlined"
                label="Event Type *"
                value={eventType}
                onChangeText={setEventType}
                placeholder="e.g. Exam"
                style={styles.input}
                outlineColor={colors.border.DEFAULT}
                activeOutlineColor={colors.primary.main}
                textColor={colors.text.primary}
                dense
              />
            </View>

            {/* Class Selection */}
            <View style={[styles.field, styles.halfField]}>
              <TouchableOpacity
                onPress={() => setShowClassSelector(true)}
                activeOpacity={0.7}
              >
                <View pointerEvents="none">
                  <TextInput
                    mode="outlined"
                    label="Class"
                    value={selectedClass
                      ? `Grade ${selectedClass.grade}${selectedClass.section ? `-${selectedClass.section}` : ''}`
                      : 'School-wide'}
                    editable={false}
                    style={styles.input}
                    outlineColor={colors.border.DEFAULT}
                    textColor={colors.text.primary}
                    dense
                    right={<TextInput.Icon icon="chevron-right" color={colors.text.tertiary} />}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dates */}
          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <TouchableOpacity
                onPress={() => {
                  setDatePickerMode('start');
                  setShowStartDatePicker(true);
                }}
                activeOpacity={0.7}
              >
                <View pointerEvents="none">
                  <TextInput
                    mode="outlined"
                    label="Start Date *"
                    value={formatDate(startDate)}
                    editable={false}
                    style={styles.input}
                    outlineColor={colors.border.DEFAULT}
                    textColor={colors.text.primary}
                    dense
                    left={<TextInput.Icon icon="calendar" color={colors.text.tertiary} />}
                  />
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.field, styles.halfField]}>
              <TouchableOpacity
                onPress={() => {
                  setDatePickerMode('end');
                  setShowEndDatePicker(true);
                }}
                activeOpacity={0.7}
              >
                <View pointerEvents="none">
                  <TextInput
                    mode="outlined"
                    label="End Date"
                    value={endDate ? formatDate(endDate) : 'Same day'}
                    editable={false}
                    style={styles.input}
                    outlineColor={colors.border.DEFAULT}
                    textColor={colors.text.primary}
                    dense
                    left={<TextInput.Icon icon="calendar-end" color={colors.text.tertiary} />}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* All Day Toggle - Compact */}
          <View style={styles.compactToggleRow}>
            <View style={styles.toggleLabelContainer}>
              <Text style={styles.compactLabel}>All Day Event</Text>
            </View>
            <Switch value={isAllDay} onValueChange={setIsAllDay} color={colors.primary.main} style={{ transform: [{ scale: 0.8 }] }} />
          </View>

          {/* Times */}
          {!isAllDay && (
            <View style={styles.row}>
              <View style={[styles.field, styles.halfField]}>
                <TouchableOpacity
                  onPress={() => setShowStartTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <View pointerEvents="none">
                    <TextInput
                      mode="outlined"
                      label="Start Time"
                      value={formatTime(startTime)}
                      editable={false}
                      style={styles.input}
                      outlineColor={colors.border.DEFAULT}
                      textColor={colors.text.primary}
                      dense
                      left={<TextInput.Icon icon="clock-outline" color={colors.text.tertiary} size={20} />}
                    />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={[styles.field, styles.halfField]}>
                <TouchableOpacity
                  onPress={() => setShowEndTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <View pointerEvents="none">
                    <TextInput
                      mode="outlined"
                      label="End Time"
                      value={formatTime(endTime)}
                      editable={false}
                      style={styles.input}
                      outlineColor={colors.border.DEFAULT}
                      textColor={colors.text.primary}
                      dense
                      left={<TextInput.Icon icon="clock-outline" color={colors.text.tertiary} size={20} />}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Color Picker - Compact */}
          <View style={styles.compactField}>
            <Text style={styles.compactLabel}>Color Code</Text>
            <View style={styles.compactColorRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.color}
                  style={[
                    styles.compactColorDot,
                    { backgroundColor: c.color },
                    color === c.color && styles.compactColorSelected,
                  ]}
                  onPress={() => setColor(c.color)}
                  activeOpacity={0.8}
                />
              ))}
            </View>
          </View>

          {/* Active Toggle - Compact */}
          <View style={styles.compactToggleRow}>
            <View style={styles.toggleLabelContainer}>
              <Text style={styles.compactLabel}>Active Status</Text>
            </View>
            <Switch value={isActive} onValueChange={setIsActive} color={colors.success.main} style={{ transform: [{ scale: 0.8 }] }} />
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {event && onDelete && (
              <Button
                mode="outlined"
                onPress={onDelete}
                style={[styles.actionButton, { borderColor: colors.error.main }]}
                textColor={colors.error.main}
                disabled={loading}
              >
                Delete
              </Button>
            )}
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
              {event ? 'Update' : 'Create'}
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
      marginBottom: spacing.sm,
    },
    halfField: {
      flex: 1,
    },
    input: {
      backgroundColor: colors.surface.primary,
      fontSize: typography.fontSize.sm,
      height: 48, // Enforce compact height
    },
    textArea: {
      minHeight: 60,
      height: 60,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    compactToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
      minHeight: 32,
    },
    toggleLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs
    },
    compactLabel: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.secondary,
    },
    compactField: {
      marginBottom: spacing.md,
    },
    compactColorRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.xs,
      alignItems: 'center',
    },
    compactColorDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    compactColorSelected: {
      borderWidth: 2,
      borderColor: colors.text.primary,
      transform: [{ scale: 1.2 }],
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
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    actionButton: {
      flex: 1,
    },
    customTypeInput: {
      marginTop: spacing.sm,
    },
    chip: {
      marginRight: spacing.xs,
      marginBottom: spacing.xs,
      backgroundColor: colors.surface.secondary,
      borderColor: colors.border.light,
    },
    chipSelected: {
      backgroundColor: colors.primary[100],
      borderColor: colors.primary[600],
    },
    chipText: {
      color: colors.text.secondary,
    },
    chipTextSelected: {
      color: colors.primary[700],
      fontWeight: '600',
    },
  });
