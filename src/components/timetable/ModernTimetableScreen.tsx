import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, RefreshControl, Animated, Vibration, Modal as RNModal, Text as RNText } from 'react-native';
import { Text, Card, Button, Chip, Portal, Modal, TextInput, SegmentedButtons, Snackbar, ActivityIndicator } from 'react-native-paper';
import { Calendar, Clock, ChevronLeft, ChevronRight, Plus, Edit, Trash2, CheckCircle, Circle, Settings, Users, BookOpen, MapPin, Filter, RotateCcw, User, MoreVertical, Coffee, ListTodo, X, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useEnhancedTimetable } from '../../hooks/useEnhancedTimetable';
import { useSyllabusLoader } from '../../hooks/useSyllabusLoader';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { useAdmins } from '../../hooks/useAdmins';
import { DatePickerModal } from '../common/DatePickerModal';
import { ThreeStateView } from '../common/ThreeStateView';
import { EmptyStateIllustration } from '../ui/EmptyStateIllustration';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { TimelinePreviewModal } from './TimelinePreviewModal';
import { useTheme } from '../../contexts/ThemeContext';
import { typography, spacing, borderRadius, colors } from '../../../lib/design-system';
import type { ThemeColors, Shadows } from '../../theme/types';
import { format, subDays, addDays } from 'date-fns';
import { formatDateFull } from '../../lib/date-utils';
import { router } from 'expo-router';
import { formatTimeForDisplay } from '../../utils/timeParser';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isSmallScreen = screenWidth < 375;
const isVerySmallScreen = screenWidth < 320;

const { width } = Dimensions.get('window');

// Get subtle subject color for visual recognition
function getSubjectColor(subjectName: string, colors: ThemeColors): string {
  if (!subjectName) return colors.neutral[400];

  const colorMap: Record<string, string> = {
    'Mathematics': colors.primary[500],
    'Math': colors.primary[500],
    'English': colors.info[500],
    'Science': colors.success[500],
    'Physics': colors.accent[500],
    'Chemistry': colors.warning[500],
    'Biology': colors.success[600],
    'History': colors.error[500],
    'Geography': colors.info[600],
    'Art': colors.accent[600],
    'Music': colors.warning[600],
    'Physical Education': colors.success[500],
    'PE': colors.success[500],
  };

  const normalizedName = subjectName.trim();
  return colorMap[normalizedName] || colors.primary[500];
}

// Premium Timetable Card - iOS + Material Hybrid
function CleanTimetableCard({
  slot,
  onEdit,
  onDelete,
  onMarkTaught,
  onUnmarkTaught,
  onStatusToggle,
  taughtSlotIds,
  formatTime12Hour,
  isCurrentPeriod,
  isUpcomingPeriod,
  isPastPeriod,
  setSelectedSlotForMenu,
  setShowSlotMenu,
  styles,
  colors,
  getTopicName,
  getChapterName,
}: any) {
  // Early return if slot is missing critical data
  if (!slot || !slot.id) {
    return null;
  }

  const isTaught = taughtSlotIds.has(slot.id);
  const subjectColor = getSubjectColor(slot?.subject_name, colors);

  // Get topic name from slot or syllabus map - ensure we always have a value or null
  const topicName = slot?.topic_name || (slot?.syllabus_topic_id && getTopicName ? getTopicName(slot.syllabus_topic_id) : null) || null;
  const chapterName = slot?.chapter_name || (slot?.syllabus_chapter_id && getChapterName ? getChapterName(slot.syllabus_chapter_id) : null) || null;

  if (slot.slot_type === 'break') {
    return (
      <View style={styles.premiumBreakCard}>
        <View style={styles.premiumBreakContent}>
          <Coffee size={18} color={colors.warning[600]} />
          <View style={styles.premiumBreakText}>
            <RNText style={styles.premiumBreakTitle}>{slot.name || 'Break'}</RNText>
            <RNText style={styles.premiumBreakTime}>
              {formatTime12Hour(slot.start_time)} - {formatTime12Hour(slot.end_time)}
            </RNText>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => onEdit(slot)}
          style={styles.premiumCardEditButton}
          activeOpacity={0.6}
        >
          <Edit size={16} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[
      styles.premiumPeriodCard,
      isCurrentPeriod && styles.premiumCurrentCard,
      isTaught && styles.premiumTaughtCard
    ]}>
      {/* 2-3px Colored Vertical Strip - Green for completed, subject color for pending */}
      <View style={[
        styles.premiumAccentStrip,
        { backgroundColor: isTaught ? colors.success[500] : subjectColor }
      ]} />

      <View style={styles.premiumCardContent}>
        {/* Top Row: Period Badge | Time | Edit Button */}
        <View style={styles.premiumCardTopRow}>
          <View style={styles.premiumCardTopLeft}>
            {slot?.period_number && (
              <View style={styles.periodNumberBadge}>
                <RNText style={styles.periodNumberText}>P{slot.period_number}</RNText>
              </View>
            )}
            <RNText style={[
              styles.premiumTimeText,
              isTaught && styles.premiumTimeTextCompleted
            ]}>
              {formatTime12Hour(slot?.start_time)} - {formatTime12Hour(slot?.end_time)}
            </RNText>
          </View>
          <View style={styles.premiumCardTopRight}>
            {isTaught && (
              <View style={styles.completedIndicator}>
                <CheckCircle size={14} color={colors.success[600]} />
                <RNText style={styles.completedLabel}>Done</RNText>
              </View>
            )}
            <TouchableOpacity
              onPress={() => {
                setSelectedSlotForMenu(slot);
                setShowSlotMenu(true);
              }}
              style={styles.premiumCardEditButton}
              activeOpacity={0.6}
            >
              <Edit size={16} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content: Two Column Layout */}
        <View style={styles.premiumCardMainRow}>
          {/* Left Column: Subject & Teacher */}
          <View style={styles.premiumCardLeftColumn}>
            <RNText
              style={[
                styles.premiumSubjectText,
                isTaught && styles.premiumSubjectTextCompleted
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {slot?.subject_name?.trim?.() || 'Unassigned'}
            </RNText>
            {slot?.teacher_name ? (
              <View style={styles.teacherRow}>
                <User size={12} color={colors.text.secondary} />
                <RNText style={[
                  styles.premiumTeacherText,
                  isTaught && styles.premiumTeacherTextCompleted
                ]} numberOfLines={1}>
                  {slot.teacher_name.trim()}
                </RNText>
              </View>
            ) : null}
          </View>

          {/* Right Column: Topic/Chapter & Plan */}
          {(chapterName || topicName || slot?.plan_text) ? (
            <View style={styles.premiumCardRightColumn}>
              {chapterName ? (
                <View style={styles.topicRow}>
                  <BookOpen size={11} color={colors.text.tertiary} />
                  <RNText style={styles.topicText} numberOfLines={1}>
                    {chapterName}
                  </RNText>
                </View>
              ) : null}
              {topicName ? (
                <View style={styles.topicRow}>
                  <BookOpen size={11} color={colors.text.tertiary} />
                  <RNText style={styles.topicText} numberOfLines={1}>
                    {topicName}
                  </RNText>
                </View>
              ) : null}
              {slot?.plan_text ? (
                <RNText style={styles.planText} numberOfLines={2} ellipsizeMode="tail">
                  {slot.plan_text}
                </RNText>
              ) : null}
            </View>
          ) : (
            <View style={styles.premiumCardRightColumn} />
          )}
        </View>
      </View>
    </View>
  );
}

// Modern Timetable Slot Card Component
function ModernTimetableSlotCard({
  slot,
  onEdit,
  onDelete,
  onMarkTaught,
  onUnmarkTaught,
  taughtSlotIds,
  formatTime12Hour,
  isCurrentPeriod,
  isUpcomingPeriod,
  isPastPeriod,
  styles,
  colors,
}: any) {
  const getSubjectColor = (subjectName: string) => {
    const colorMap: Record<string, string> = {
      'Biology': colors.success[600],
      'Geography': colors.info[700],
      'Math': colors.error[700],
      'Chemistry': colors.warning[700],
      'English': colors.accent[600],
      'Physics': colors.accent[700],
      'History': colors.info[600],
      'Science': colors.success[700],
      'Art': colors.error[600],
      'Music': colors.accent[600],
      'default': colors.info[700]
    };
    return colorMap[subjectName] || colorMap.default;
  };

  const subjectColor = getSubjectColor(slot.subject_name || 'default');
  const isTaught = taughtSlotIds.has(slot.id);

  if (slot.slot_type === 'break') {
    return (
      <View style={styles.modernBreakCard}>
        <View style={styles.modernBreakTime}>
          <Text style={styles.modernBreakTimeText}>
            {formatTime12Hour(slot.start_time)} - {formatTime12Hour(slot.end_time)}
          </Text>
        </View>
        <View style={styles.modernBreakContent}>
          <Text style={styles.modernBreakTitle}>{slot.name || 'Break'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onEdit(slot)}
          style={styles.modernCardMenu}
          activeOpacity={0.7}
        >
          <MoreVertical size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[
      styles.modernPeriodCard,
      { borderLeftColor: subjectColor },
      isCurrentPeriod && styles.modernCurrentPeriodCard,
      isUpcomingPeriod && styles.modernUpcomingPeriodCard,
      isPastPeriod && styles.modernPastPeriodCard
    ]}>
      <View style={styles.modernPeriodTime}>
        <Text style={styles.modernPeriodTimeText}>
          {formatTime12Hour(slot.start_time)}
        </Text>
        <Text style={styles.modernPeriodTimeEnd}>
          {formatTime12Hour(slot.end_time)}
        </Text>
      </View>

      <View style={styles.modernPeriodContent}>
        <View style={styles.modernPeriodHeader}>
          <Text
            style={[styles.modernSubjectName, { color: subjectColor }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {slot.subject_name || 'No Subject'}
          </Text>
          <TouchableOpacity
            onPress={() => onEdit(slot)}
            style={styles.modernCardMenu}
            activeOpacity={0.7}
          >
            <MoreVertical size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.modernTeacherInfo}>
          <View style={styles.modernTeacherAvatar}>
            <User size={16} color={colors.text.secondary} />
          </View>
          <Text style={styles.modernTeacherName}>
            {slot.teacher_name || 'No Teacher'}
          </Text>
        </View>

        {slot.plan_text && (
          <Text style={styles.modernPlanText}>
            {slot.plan_text}
          </Text>
        )}

        <View style={styles.modernPeriodStatus}>
          <TouchableOpacity
            onPress={() => isTaught ? onUnmarkTaught(slot.id) : onMarkTaught(slot.id)}
            style={[
              styles.modernStatusButton,
              isTaught ? styles.modernTaughtButton : styles.modernNotTaughtButton
            ]}
            activeOpacity={0.7}
          >
            {isTaught ? (
              <CheckCircle size={16} color={colors.success[600]} />
            ) : (
              <Circle size={16} color={colors.text.secondary} />
            )}
            <Text style={[
              styles.modernStatusText,
              isTaught ? styles.modernTaughtText : styles.modernNotTaughtText
            ]}>
              {isTaught ? 'Taught' : 'Not Taught'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function ModernTimetableScreen() {
  const { profile } = useAuth();
  const { colors, isDark, shadows, spacing, typography } = useTheme();

  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, isDark, shadows), [colors, isDark, shadows]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [showQuickGenerateModal, setShowQuickGenerateModal] = useState(false);
  const [quickForm, setQuickForm] = useState({
    numPeriods: 6,
    periodDurationMin: 40,
    startTime: '09:00',
    breaks: [] as { afterPeriod: number; durationMin: number; name: string }[],
  });
  const [selectedSlotForMenu, setSelectedSlotForMenu] = useState<any>(null);

  // Bottom sheet animation for Class selector (match Task Management)
  const classSlideAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showClassSelector) {
      classSlideAnim.setValue(0);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(classSlideAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(classSlideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [showClassSelector, classSlideAnim, overlayOpacity]);
  const [showSlotMenu, setShowSlotMenu] = useState(false);
  const [slotForm, setSlotForm] = useState({
    slot_type: 'period',
    name: '',
    start_time_input: '', // Natural language input
    end_time_input: '', // Natural language input
    start_time: '', // Parsed HH:MM:SS (for display)
    end_time: '', // Parsed HH:MM:SS (for display)
    subject_id: '',
    teacher_id: '',
    plan_text: '',
    syllabus_chapter_id: '',
    syllabus_topic_id: '',
  });

  // Conflict resolution state
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{
    conflicts: any[];
    affectedSlots: { slot: any; newStart: string; newEnd: string }[];
    shiftDelta: number;
  } | null>(null);
  const [pendingResolution, setPendingResolution] = useState<{
    action: 'abort' | 'replace' | 'shift';
    replaceSlotId?: string;
    shiftDelta?: number;
  } | null>(null);
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const schoolCode = profile?.school_code || undefined;
  const { data: classes } = useClasses(schoolCode);
  const { data: subjectsResult } = useSubjects(schoolCode);
  const subjects = subjectsResult?.data || [];
  const { data: adminsResult } = useAdmins(schoolCode);
  const adminsList = adminsResult?.data || [];
  const {
    slots,
    displayPeriodNumber,
    loading,
    error,
    refetch,
    deleteSlot,
    quickGenerate,
    markSlotTaught,
    unmarkSlotTaught,
    updateSlotStatus,
    taughtSlotIds,
    parseTimeInput,
    detectSlotConflicts,
    createSlotWithResolution,
    updateSlotWithResolution,
  } = useEnhancedTimetable(
    selectedClassId,
    dateStr,
    schoolCode
  );

  // Normalize slots defensively
  const normalizedSlots = React.useMemo(() => {
    return Array.isArray(slots) ? slots : [];
  }, [slots]);

  const { chaptersById, syllabusContentMap } = useSyllabusLoader(selectedClassId, schoolCode);

  // Set selectedClassId from user profile if available
  useEffect(() => {
    if (profile?.class_instance_id && !selectedClassId) {
      setSelectedClassId(profile.class_instance_id);
    }
  }, [profile?.class_instance_id, selectedClassId]);

  // Helper function to format time in 12-hour format
  const formatTime12Hour = (time24: string | null | undefined) => {
    if (!time24 || typeof time24 !== 'string') {
      return '--:--';
    }
    const parts = time24.split(':');
    if (parts.length < 2) {
      return time24;
    }
    const hours = parts[0];
    const minutes = parts[1];
    const hour = parseInt(hours, 10);
    if (Number.isNaN(hour)) {
      return `${hours}:${minutes}`;
    }
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Helper function to get current time in HH:MM format
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Helper function to determine if a period is currently active
  const isCurrentPeriod = (slot: any) => {
    if (!slot || slot.slot_type !== 'period') return false;
    const currentTime = getCurrentTime();
    return currentTime >= slot.start_time && currentTime <= slot.end_time;
  };

  // Helper function to determine if a period is upcoming today
  const isUpcomingPeriod = (slot: any) => {
    if (!slot || slot.slot_type !== 'period') return false;
    const currentTime = getCurrentTime();
    return slot.start_time > currentTime;
  };

  // Helper function to determine if a period is completed
  const isCompletedPeriod = (slot: any) => {
    if (!slot || slot.slot_type !== 'period') return false;
    const currentTime = getCurrentTime();
    return slot.end_time < currentTime;
  };

  // Helper function to get teacher initials for avatar
  const getTeacherInitials = (teacherName: string) => {
    if (!teacherName) return '?';
    return teacherName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper function to get teacher avatar color
  const getTeacherAvatarColor = (teacherName: string) => {
    if (!teacherName) return colors.text.tertiary;
    const teacherColors = [colors.primary[600], colors.primary[500], colors.accent[500], colors.error[600], colors.warning[600], colors.success[600], colors.info[500]];
    const hash = teacherName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return teacherColors[Math.abs(hash) % teacherColors.length];
  };

  // Haptic feedback functions
  const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      if (type === 'light') {
        Vibration.vibrate(10);
      } else if (type === 'medium') {
        Vibration.vibrate(50);
      } else if (type === 'heavy') {
        Vibration.vibrate(100);
      }
    } catch (error) {
      // Haptic feedback not available on this device
    }
  };

  // Animation functions
  const animateButtonPress = (callback?: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
    });
  };

  // Clean up modal states when class or date changes
  useEffect(() => {
    closeModal();
    setShowClassSelector(false);
    setShowDatePicker(false);
    setShowQuickGenerateModal(false);
  }, [selectedClassId, selectedDate]);

  // Clean up modal states when component unmounts
  useEffect(() => {
    return () => {
      closeModal();
      setShowClassSelector(false);
      setShowDatePicker(false);
      setShowQuickGenerateModal(false);
    };
  }, []);

  // Helper functions for syllabus selection
  const getChaptersForSubject = (subjectId: string) => {
    if (!chaptersById || !subjectId) return [];
    return Array.from(chaptersById.values()).filter(
      chapter => chapter.type === 'chapter' && chapter.subject_id === subjectId
    );
  };

  const getTopicsForSubject = (subjectId: string) => {
    if (!chaptersById || !subjectId) return [];
    return Array.from(chaptersById.values()).filter(
      topic => topic.type === 'topic' && topic.subject_id === subjectId
    );
  };

  const getChapterName = (chapterId: string) => {
    if (!chapterId || !syllabusContentMap) return '';
    const content = syllabusContentMap.get(`chapter_${chapterId}`);
    return content ? `${content.chapter_no}. ${content.title}` : '';
  };

  const getTopicName = (topicId: string) => {
    if (!topicId || !syllabusContentMap) return '';
    const content = syllabusContentMap.get(`topic_${topicId}`);
    return content ? `${content.chapter_no}.${content.topic_no} ${content.title}` : '';
  };

  // Helper function to show error messages
  const showError = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Get selected class info
  const selectedClass = classes?.find(c => c.id === selectedClassId);

  // Navigation functions
  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Handle slot form changes
  const handleSlotFormChange = (field: string, value: any) => {
    setSlotForm(prev => {
      const newForm = { ...prev, [field]: value };

      // Clear chapter and topic when subject changes
      if (field === 'subject_id') {
        newForm.syllabus_chapter_id = '';
        newForm.syllabus_topic_id = '';
      }

      return newForm;
    });
  };

  // Handle add slot with conflict detection
  const handleAddSlot = async () => {
    if (!selectedClassId || !profile?.school_code) {
      Alert.alert('Error', 'Please select a class and ensure school code is available');
      return;
    }

    // Validate required fields
    if (!slotForm.start_time || !slotForm.end_time) {
      showError('Please enter valid start and end times');
      return;
    }

    if (slotForm.slot_type === 'period') {
      if (!slotForm.subject_id || !slotForm.teacher_id) {
        showError('Please select subject and teacher for the period');
        return;
      }
    } else if (slotForm.slot_type === 'break') {
      if (!slotForm.name) {
        showError('Please enter break name');
        return;
      }
    }

    // Check for conflicts
    const conflicts = detectSlotConflicts(
      slotForm.start_time,
      slotForm.end_time
    );

    if (conflicts && (conflicts.conflicts.length > 0 || conflicts.affectedSlots.length > 0)) {
      // Show conflict resolution modal
      setConflictInfo(conflicts);
      setShowConflictModal(true);
      return;
    }

    // No conflicts, proceed with create
    await performAddSlot({ action: 'abort' });
  };

  // Perform the actual create with resolution
  const performAddSlot = async (resolution: { action: 'abort' | 'replace' | 'shift'; replaceSlotId?: string; shiftDelta?: number }) => {
    if (!selectedClassId || !profile?.school_code) return;

    try {
      const result = await createSlotWithResolution({
        class_instance_id: selectedClassId,
        school_code: profile.school_code,
        class_date: dateStr,
        slot_type: slotForm.slot_type as 'period' | 'break',
        start_time_input: slotForm.start_time_input,
        end_time_input: slotForm.end_time_input,
        name: slotForm.slot_type === 'break' ? slotForm.name : null,
        subject_id: slotForm.slot_type === 'period' ? slotForm.subject_id : null,
        teacher_id: slotForm.slot_type === 'period' ? slotForm.teacher_id : null,
        plan_text: slotForm.slot_type === 'period' ? slotForm.plan_text : null,
        syllabus_chapter_id: slotForm.slot_type === 'period' ? slotForm.syllabus_chapter_id : null,
        syllabus_topic_id: slotForm.slot_type === 'period' ? slotForm.syllabus_topic_id : null,
      }, resolution);

      if (result.success) {
        showSuccess(`Slot created successfully${result.slots_shifted ? ` (${result.slots_shifted} slot(s) shifted)` : ''}`);
        closeModal();
        closeAllDropdowns();
      } else {
        showError('Failed to create slot. Please try a different time slot.');
      }
    } catch (error: any) {
      if (error.message?.includes('duplicate period')) {
        showError('A timetable entry already exists for this class, date, and time period. Please choose a different time.');
      } else {
        showError(error.message || 'Failed to create slot. Please try again.');
      }
    }
  };

  // Handle conflict resolution
  const handleConflictResolution = (action: 'abort' | 'replace' | 'shift') => {
    setShowConflictModal(false);

    if (action === 'abort') {
      return; // User cancelled
    }

    if (action === 'shift' && conflictInfo) {
      // Show preview modal before applying shift
      setPendingResolution({ action, shiftDelta: conflictInfo.shiftDelta });
      setShowPreviewModal(true);
    } else {
      // Replace or immediate action
      setPendingResolution({ action });
      if (editingSlot) {
        performEditSlot({ action });
      } else {
        performAddSlot({ action });
      }
    }
  };

  // Handle preview confirmation
  const handlePreviewConfirm = () => {
    setShowPreviewModal(false);
    if (pendingResolution) {
      if (editingSlot) {
        performEditSlot(pendingResolution);
      } else {
        performAddSlot(pendingResolution);
      }
    }
  };

  // Helper to show success message
  const showSuccess = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Handle edit slot with conflict detection
  const handleEditSlot = async () => {
    if (!editingSlot) return;

    // Validate required fields
    if (!slotForm.start_time || !slotForm.end_time) {
      showError('Please enter valid start and end times');
      return;
    }

    if (slotForm.slot_type === 'period') {
      if (!slotForm.subject_id || !slotForm.teacher_id) {
        showError('Please select subject and teacher for the period');
        return;
      }
    } else if (slotForm.slot_type === 'break') {
      if (!slotForm.name) {
        showError('Please enter break name');
        return;
      }
    }

    // Only check for conflicts if the TIME has changed
    const timeChanged =
      slotForm.start_time !== editingSlot.start_time ||
      slotForm.end_time !== editingSlot.end_time;

    if (timeChanged) {
      // Check for conflicts (excluding the slot being edited)
      const conflicts = detectSlotConflicts(
        slotForm.start_time,
        slotForm.end_time,
        editingSlot.id
      );

      if (conflicts && (conflicts.conflicts.length > 0 || conflicts.affectedSlots.length > 0)) {
        // Show conflict resolution modal
        setConflictInfo(conflicts);
        setShowConflictModal(true);
        return;
      }
    }

    // No conflicts or time unchanged, proceed with update
    await performEditSlot({ action: 'abort' });
  };

  // Perform the actual edit with resolution
  const performEditSlot = async (resolution: { action: 'abort' | 'replace' | 'shift'; replaceSlotId?: string; shiftDelta?: number }) => {
    if (!editingSlot) return;

    try {
      // Only pass time inputs if they've actually changed from the original
      const timeChanged =
        slotForm.start_time !== editingSlot.start_time ||
        slotForm.end_time !== editingSlot.end_time;

      const result = await updateSlotWithResolution(editingSlot.id, {
        slot_type: slotForm.slot_type as 'period' | 'break',
        start_time_input: timeChanged ? slotForm.start_time_input : undefined,
        end_time_input: timeChanged ? slotForm.end_time_input : undefined,
        name: slotForm.slot_type === 'break' ? slotForm.name : null,
        subject_id: slotForm.slot_type === 'period' ? slotForm.subject_id : null,
        teacher_id: slotForm.slot_type === 'period' ? slotForm.teacher_id : null,
        plan_text: slotForm.slot_type === 'period' ? slotForm.plan_text : null,
        syllabus_chapter_id: slotForm.slot_type === 'period' ? slotForm.syllabus_chapter_id : null,
        syllabus_topic_id: slotForm.slot_type === 'period' ? slotForm.syllabus_topic_id : null,
      }, resolution);

      if (result.success) {
        showSuccess(`Slot ${editingSlot ? 'updated' : 'created'} successfully${result.slots_shifted ? ` (${result.slots_shifted} slot(s) shifted)` : ''}`);
        closeModal();
        closeAllDropdowns();
      }
    } catch (error: any) {
      showError(error.message || 'Failed to update slot. Please try again.');
    }
  };

  // Handle delete slot
  const handleDeleteSlot = async (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    const slotDescription = slot ?
      `${slot.slot_type === 'period' ? 'Period' : 'Break'}: ${slot.slot_type === 'period' ? slot.subject_name : slot.name} (${slot.start_time} - ${slot.end_time})` :
      'this slot';

    Alert.alert(
      'Delete Slot',
      `Are you sure you want to delete ${slotDescription}?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSlot(slotId);
            } catch (error) {
              showError('Failed to delete slot. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Handle mark taught
  const handleMarkTaught = async (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    const isTaught = taughtSlotIds.has(slotId);
    const action = isTaught ? 'unmark as taught' : 'mark as taught';
    const slotDescription = slot ? `${slot.subject_name || 'Period'} (${slot.start_time} - ${slot.end_time})` : 'this slot';

    Alert.alert(
      `Mark Slot ${isTaught ? 'Not Taught' : 'Taught'}`,
      `Are you sure you want to ${action} ${slotDescription}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isTaught ? 'Unmark' : 'Mark',
          onPress: async () => {
            try {
              if (isTaught) {
                await unmarkSlotTaught(slotId);
              } else {
                await markSlotTaught(slotId);
              }
            } catch (error) {
              showError(`Failed to ${action}. Please try again.`);
            }
          },
        },
      ]
    );
  };

  // Handle status toggle for CleanTimetableCard
  const handleStatusToggle = async (slot: any) => {
    const isTaught = taughtSlotIds.has(slot.id);
    const action = isTaught ? 'unmark' : 'mark';
    const actionText = isTaught ? 'unmark as completed' : 'mark as completed';

    Alert.alert(
      `${isTaught ? 'Unmark' : 'Mark'} as Completed`,
      `Are you sure you want to ${actionText} this period?\n\n${slot.subject_name || 'No Subject'} - ${formatTime12Hour(slot.start_time)} to ${formatTime12Hour(slot.end_time)}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: isTaught ? 'Unmark' : 'Mark',
          onPress: async () => {
            try {
              if (isTaught) {
                await unmarkSlotTaught(slot.id);
                showSuccess('Period unmarked as completed');
              } else {
                await markSlotTaught(slot.id);
                showSuccess('Period marked as completed');
              }
            } catch (error) {
              showError(`Failed to ${action} period. Please try again.`);
            }
          },
        },
      ]
    );
  };

  // Handle status update
  const handleStatusUpdate = async (slotId: string, newStatus: 'planned' | 'done' | 'cancelled') => {
    const slot = slots.find(s => s.id === slotId);
    const slotDescription = slot ? `${slot.subject_name || 'Period'} (${slot.start_time} - ${slot.end_time})` : 'this slot';

    Alert.alert(
      `Update Status`,
      `Are you sure you want to mark ${slotDescription} as ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              await updateSlotStatus(slotId, newStatus);
            } catch (error) {
              showError(`Failed to update status. Please try again.`);
            }
          },
        },
      ]
    );
  };

  // Handle quick generate
  const handleQuickGenerate = async () => {
    if (!selectedClassId || !profile?.school_code) return;
    try {
      await quickGenerate({
        class_instance_id: selectedClassId,
        school_code: profile.school_code,
        class_date: dateStr,
        startTime: quickForm.startTime,
        numPeriods: quickForm.numPeriods,
        periodDurationMin: quickForm.periodDurationMin,
        breaks: quickForm.breaks,
      });
      setShowQuickGenerateModal(false);
    } catch (error: any) {
      showError(`Failed to generate timetable: ${error.message}`);
    }
  };

  // Reset form
  const resetForm = () => {
    setSlotForm({
      slot_type: 'period',
      name: '',
      start_time_input: '',
      end_time_input: '',
      start_time: '',
      end_time: '',
      subject_id: '',
      teacher_id: '',
      plan_text: '',
      syllabus_chapter_id: '',
      syllabus_topic_id: '',
    });
    setConflictInfo(null);
    setPendingResolution(null);
  };

  // Handle time input change with parsing
  const handleTimeInputChange = (field: 'start_time_input' | 'end_time_input', value: string) => {
    setSlotForm(prev => {
      const newForm = { ...prev, [field]: value };

      // Parse the input
      const startParsed = field === 'end_time_input' && newForm.start_time_input
        ? parseTimeInput(newForm.start_time_input)
        : null;
      const referenceHour = startParsed?.isValid ? (startParsed as any).hour : undefined;
      const parsed = parseTimeInput(value, referenceHour);

      if (parsed.isValid) {
        // Update the parsed time field
        if (field === 'start_time_input') {
          newForm.start_time = parsed.formatted;
        } else {
          newForm.end_time = parsed.formatted;
        }
      }

      return newForm;
    });
  };

  // Open edit modal
  const openEditModal = (slot: any) => {
    setEditingSlot(slot);
    // Convert HH:MM:SS to natural language format for editing
    const startDisplay = formatTimeForDisplay(slot.start_time);
    const endDisplay = formatTimeForDisplay(slot.end_time);
    setSlotForm({
      slot_type: slot.slot_type,
      name: slot.name || '',
      start_time_input: startDisplay,
      end_time_input: endDisplay,
      start_time: slot.start_time,
      end_time: slot.end_time,
      subject_id: slot.subject_id || '',
      teacher_id: slot.teacher_id || '',
      plan_text: slot.plan_text || '',
      syllabus_chapter_id: slot.syllabus_chapter_id || '',
      syllabus_topic_id: slot.syllabus_topic_id || '',
    });
    // Close any open dropdowns before opening edit modal
    closeAllDropdowns();
    setShowAddModal(true);
  };

  // Close modal and reset all states
  const closeModal = () => {
    setShowAddModal(false);
    setEditingSlot(null);
    setShowSubjectDropdown(false);
    setShowTeacherDropdown(false);
    setShowChapterDropdown(false);
    setShowTopicDropdown(false);
    resetForm();
  };

  // Close all dropdowns
  const closeAllDropdowns = () => {
    setShowSubjectDropdown(false);
    setShowTeacherDropdown(false);
    setShowChapterDropdown(false);
    setShowTopicDropdown(false);
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      showError('Failed to refresh timetable. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <View style={styles.loadingSpinner} />
            <Text style={styles.loadingText}>Loading timetable...</Text>
          </View>
        </View>
      </View>
    );
  }

  // Handle error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Failed to load timetable</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <Button mode="contained" onPress={refetch} style={styles.retryButton}>
            Retry
          </Button>
        </View>
      </View>
    );
  }

  // Three-state handling
  if (loading && normalizedSlots.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>
          Loading timetable...
        </Text>
      </View>
    );
  }

  // Note: Primary error handling is done above at lines 1108-1121
  // Removed duplicate error block that was causing TypeScript type narrowing issues

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Compact Filter Row - Soft Cards */}
        <View style={styles.modernFilterBar}>
          <TouchableOpacity
            style={[styles.modernFilterCard, !selectedClassId && styles.modernFilterCardDisabled]}
            onPress={() => setShowClassSelector(true)}
            activeOpacity={0.7}
          >
            <Users size={16} color={colors.primary[600]} />
            <View style={styles.modernFilterContent}>
              <Text style={styles.modernFilterLabel}>Class</Text>
              <Text style={styles.modernFilterValue} numberOfLines={1}>
                {selectedClassId && selectedClass
                  ? `${selectedClass.grade || ''} ${selectedClass.section || ''}`.trim() || 'No Class'
                  : 'Select Class'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modernFilterCard}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Calendar size={16} color={colors.primary[600]} />
            <View style={styles.modernFilterContent}>
              <Text style={styles.modernFilterLabel}>Date</Text>
              <Text style={styles.modernFilterValue} numberOfLines={1}>
                {format(selectedDate, 'MMM d, yyyy')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>


        {/* No Class Selected - Responsive Card */}
        {!selectedClassId && (
          <EmptyStateIllustration
            type="general"
            title="Select a Class"
            description="Choose a class from the list above to view and manage its timetable."
          />
        )}

        {/* Clean Timetable Content */}
        {selectedClassId ? (
          <View style={styles.timetableContentContainer}>

            {selectedClassId && slots.length === 0 ? (
              <EmptyStateIllustration
                type="calendar"
                title="No Timetable"
                description={`No timetable for ${formatDateFull(selectedDate, 'MMM d, yyyy')}`}
                action={
                  <TouchableOpacity
                    style={styles.emptyActionButton}
                    onPress={() => setShowActionsModal(true)}
                  >
                    <Plus size={20} color={colors.text.inverse} />
                    <RNText style={styles.emptyActionButtonText}>Add Period</RNText>
                  </TouchableOpacity>
                }
              />
            ) : (
              <View style={styles.cleanTimetableGrid}>
                {slots.map((slot, index) => {
                  // Compact view logic - hide completed periods
                  if (compactView && isCompletedPeriod(slot) && slot.slot_type === 'period') {
                    return null;
                  }

                  return (
                    <CleanTimetableCard
                      key={slot.id}
                      slot={slot}
                      index={index}
                      onEdit={openEditModal}
                      onDelete={handleDeleteSlot}
                      onMarkTaught={markSlotTaught}
                      onUnmarkTaught={unmarkSlotTaught}
                      onStatusToggle={handleStatusToggle}
                      taughtSlotIds={taughtSlotIds}
                      formatTime12Hour={formatTime12Hour}
                      isCurrentPeriod={isCurrentPeriod(slot)}
                      isUpcomingPeriod={isUpcomingPeriod(slot)}
                      isPastPeriod={isCompletedPeriod(slot)}
                      setSelectedSlotForMenu={setSelectedSlotForMenu}
                      setShowSlotMenu={setShowSlotMenu}
                      styles={styles}
                      colors={colors}
                      getTopicName={getTopicName}
                      getChapterName={getChapterName}
                    />
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Class Selector - Bottom Sheet (replaces previous modal) */}
      <RNModal
        visible={showClassSelector}
        transparent
        animationType="none"
        onRequestClose={() => setShowClassSelector(false)}
      >
        <Animated.View style={[styles.bsOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill as any}
            activeOpacity={1}
            onPress={() => setShowClassSelector(false)}
          />
          <Animated.View
            style={[
              styles.bsContainer,
              {
                transform: [
                  {
                    translateY: classSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.bsHandle} />
            <Text style={styles.bsTitle}>Select Class</Text>
            <ScrollView style={styles.bsContent}>
              {classes?.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.bsItem, selectedClassId === cls.id && styles.bsItemActive]}
                  onPress={() => {
                    setSelectedClassId(cls.id);
                    setShowClassSelector(false);
                  }}
                >
                  <Text style={[styles.bsItemText, selectedClassId === cls.id && styles.bsItemTextActive]}>
                    Grade {cls.grade} - Section {cls.section}
                  </Text>
                  {selectedClassId === cls.id && <Text style={styles.bsCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </RNModal>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        initialDate={selectedDate}
        onDismiss={() => setShowDatePicker(false)}
        onConfirm={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
      />

      {/* Add/Edit Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={closeModal}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeaderContainer}>
            <Text style={styles.modalTitle}>
              {editingSlot ? 'Edit Slot' : `Add ${slotForm.slot_type === 'period' ? 'Period' : 'Break'}`}
            </Text>
          </View>

          <ScrollView
            style={styles.modalScrollContent}
            contentContainerStyle={styles.modalScrollContentContainer}
            showsVerticalScrollIndicator={true}
          >
            <SegmentedButtons
              value={slotForm.slot_type}
              onValueChange={(value) => handleSlotFormChange('slot_type', value)}
              buttons={[
                { value: 'period', label: 'Period' },
                { value: 'break', label: 'Break' },
              ]}
              style={styles.segmentedButtons}
            />

            <View>
              <TextInput
                label="Start Time"
                value={slotForm.start_time_input}
                onChangeText={(text) => handleTimeInputChange('start_time_input', text)}
                style={styles.textInput}
                mode="outlined"
                placeholder="e.g., 9am, 530pm, 14:30, noon"
                outlineColor={colors.border.light}
                activeOutlineColor={colors.primary[600]}
                textColor={colors.text.primary}
                placeholderTextColor={colors.text.tertiary}
                right={
                  slotForm.start_time ? (
                    <TextInput.Icon
                      icon={() => <Clock size={18} color={colors.success[600]} />}
                    />
                  ) : undefined
                }
              />
              {slotForm.start_time && (
                <View style={styles.timeHelperContainer}>
                  <Text style={styles.timeHelperText}>
                    Parsed as: {formatTimeForDisplay(slotForm.start_time)}
                  </Text>
                </View>
              )}
            </View>

            <View>
              <TextInput
                label="End Time"
                value={slotForm.end_time_input}
                onChangeText={(text) => handleTimeInputChange('end_time_input', text)}
                style={styles.textInput}
                mode="outlined"
                placeholder="e.g., 10am, 630pm, 15:30"
                outlineColor={colors.border.light}
                activeOutlineColor={colors.primary[600]}
                textColor={colors.text.primary}
                placeholderTextColor={colors.text.tertiary}
                right={
                  slotForm.end_time ? (
                    <TextInput.Icon
                      icon={() => <Clock size={18} color={colors.success[600]} />}
                    />
                  ) : undefined
                }
              />
              {slotForm.end_time && (
                <View style={styles.timeHelperContainer}>
                  <Text style={styles.timeHelperText}>
                    Parsed as: {formatTimeForDisplay(slotForm.end_time)}
                  </Text>
                </View>
              )}
            </View>

            {slotForm.slot_type === 'break' && (
              <TextInput
                label="Break Name"
                value={slotForm.name}
                onChangeText={(text) => handleSlotFormChange('name', text)}
                style={styles.textInput}
                mode="outlined"
                placeholder="e.g., Lunch Break"
                outlineColor={colors.border.light}
                activeOutlineColor={colors.primary[600]}
                textColor={colors.text.primary}
                placeholderTextColor={colors.text.tertiary}
              />
            )}

            {slotForm.slot_type === 'period' && (
              <>
                {/* Subject Selection Button */}
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowSubjectDropdown(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {subjects?.find(s => s.id === slotForm.subject_id)?.subject_name || 'Select Subject'}
                  </Text>
                  <ChevronRight size={20} color={colors.text.secondary} />
                </TouchableOpacity>

                {/* Teacher Selection Button */}
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowTeacherDropdown(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {adminsList?.find(t => t.id === slotForm.teacher_id)?.full_name || 'Select Teacher'}
                  </Text>
                  <ChevronRight size={20} color={colors.text.secondary} />
                </TouchableOpacity>

                {/* Chapter Selection Button */}
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowChapterDropdown(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {getChapterName(slotForm.syllabus_chapter_id) || 'Select Chapter'}
                  </Text>
                  <ChevronRight size={20} color={colors.text.secondary} />
                </TouchableOpacity>

                {/* Topic Selection Button */}
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowTopicDropdown(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {getTopicName(slotForm.syllabus_topic_id) || 'Select Topic'}
                  </Text>
                  <ChevronRight size={20} color={colors.text.secondary} />
                </TouchableOpacity>

                <TextInput
                  label="Plan Text"
                  value={slotForm.plan_text}
                  onChangeText={(text) => handleSlotFormChange('plan_text', text)}
                  style={styles.textInput}
                  mode="outlined"
                  placeholder="Lesson plan..."
                  multiline
                  numberOfLines={3}
                  outlineColor={colors.border.light}
                  activeOutlineColor={colors.primary[600]}
                  textColor={colors.text.primary}
                  placeholderTextColor={colors.text.tertiary}
                />
              </>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={closeModal}
              style={styles.cancelButton}
              buttonColor={colors.surface.primary}
              textColor={colors.text.primary}
              labelStyle={styles.buttonLabel}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={editingSlot ? handleEditSlot : handleAddSlot}
              style={styles.saveButton}
              buttonColor={colors.primary[600]}
              textColor={colors.text.inverse}
              labelStyle={styles.buttonLabel}
            >
              {editingSlot ? 'Update' : 'Add'}
            </Button>
          </View>
        </Modal>
      </Portal>


      {/* Quick Generate Form Modal */}
      <Portal>
        <Modal
          visible={showQuickGenerateModal}
          onDismiss={() => setShowQuickGenerateModal(false)}
          contentContainerStyle={styles.quickGenerateModalContainer}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.quickGenerateModalContent}
          >
            {/* Header */}
            <View style={styles.quickGenerateHeader}>
              <View style={styles.quickGenerateHeaderIcon}>
                <Settings size={24} color={colors.primary[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickGenerateTitle}>Quick Generate</Text>
                <Text style={styles.quickGenerateSubtitle}>Create a timetable template automatically</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowQuickGenerateModal(false)}
                style={styles.quickGenerateCloseBtn}
                activeOpacity={0.7}
              >
                <X size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Basic Settings Section */}
            <View style={styles.quickGenerateSection}>
              <Text style={styles.quickGenerateSectionTitle}>Basic Settings</Text>

              <View style={styles.quickGenerateInputGroup}>
                <View style={styles.quickGenerateInputIcon}>
                  <ListTodo size={18} color={colors.primary[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickGenerateLabel}>Number of Periods</Text>
                  <TextInput
                    value={String(quickForm.numPeriods)}
                    onChangeText={(v) => setQuickForm(f => ({ ...f, numPeriods: Math.max(1, parseInt(v || '0')) }))}
                    style={styles.quickGenerateInput}
                    keyboardType="number-pad"
                    mode="outlined"
                    outlineColor={colors.border.light}
                    activeOutlineColor={colors.primary[600]}
                  />
                </View>
              </View>

              <View style={styles.quickGenerateInputGroup}>
                <View style={styles.quickGenerateInputIcon}>
                  <Clock size={18} color={colors.primary[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickGenerateLabel}>Period Duration (minutes)</Text>
                  <TextInput
                    value={String(quickForm.periodDurationMin)}
                    onChangeText={(v) => setQuickForm(f => ({ ...f, periodDurationMin: Math.max(1, parseInt(v || '0')) }))}
                    style={styles.quickGenerateInput}
                    keyboardType="number-pad"
                    mode="outlined"
                    outlineColor={colors.border.light}
                    activeOutlineColor={colors.primary[600]}
                  />
                </View>
              </View>

              <View style={styles.quickGenerateInputGroup}>
                <View style={styles.quickGenerateInputIcon}>
                  <Clock size={18} color={colors.primary[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickGenerateLabel}>Start Time</Text>
                  <TextInput
                    value={quickForm.startTime}
                    onChangeText={(v) => setQuickForm(f => ({ ...f, startTime: v }))}
                    style={styles.quickGenerateInput}
                    placeholder="09:00"
                    mode="outlined"
                    outlineColor={colors.border.light}
                    activeOutlineColor={colors.primary[600]}
                  />
                  <Text style={styles.quickGenerateHelperText}>Format: HH:MM (24-hour)</Text>
                </View>
              </View>
            </View>

            {/* Break Configuration Section */}
            <View style={styles.quickGenerateSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <Text style={styles.quickGenerateSectionTitle}>Break Configuration</Text>
                <TouchableOpacity
                  onPress={() => setQuickForm(f => ({ ...f, breaks: [...f.breaks, { afterPeriod: 2, durationMin: 15, name: 'Break' }] }))}
                  style={styles.quickGenerateAddBreakBtn}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color={colors.primary[600]} />
                  <Text style={styles.quickGenerateAddBreakText}>Add Break</Text>
                </TouchableOpacity>
              </View>

              {quickForm.breaks.length === 0 ? (
                <View style={styles.quickGenerateEmptyBreaks}>
                  <Coffee size={24} color={colors.text.tertiary} />
                  <Text style={styles.quickGenerateEmptyBreaksText}>No breaks configured</Text>
                  <Text style={styles.quickGenerateEmptyBreaksSubtext}>Add breaks to schedule rest periods</Text>
                </View>
              ) : (
                quickForm.breaks.map((b, idx) => (
                  <View key={idx} style={styles.quickGenerateBreakCard}>
                    <View style={styles.quickGenerateBreakHeader}>
                      <View style={styles.quickGenerateBreakIcon}>
                        <Coffee size={16} color={colors.warning[600]} />
                      </View>
                      <Text style={styles.quickGenerateBreakTitle}>Break {idx + 1}</Text>
                      <TouchableOpacity
                        onPress={() => setQuickForm(f => ({ ...f, breaks: f.breaks.filter((_, i) => i !== idx) }))}
                        style={styles.quickGenerateRemoveBreakBtn}
                        activeOpacity={0.7}
                      >
                        <X size={16} color={colors.error[600]} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.quickGenerateBreakInputs}>
                      <View style={{ flex: 1, marginRight: spacing.xs }}>
                        <Text style={styles.quickGenerateLabel}>After Period</Text>
                        <TextInput
                          value={String(b.afterPeriod)}
                          onChangeText={(v) => setQuickForm(f => ({ ...f, breaks: f.breaks.map((bb, i) => i === idx ? { ...bb, afterPeriod: parseInt(v || '0') } : bb) }))}
                          style={styles.quickGenerateInput}
                          keyboardType="number-pad"
                          mode="outlined"
                          outlineColor={colors.border.light}
                          activeOutlineColor={colors.primary[600]}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: spacing.xs }}>
                        <Text style={styles.quickGenerateLabel}>Duration (min)</Text>
                        <TextInput
                          value={String(b.durationMin)}
                          onChangeText={(v) => setQuickForm(f => ({ ...f, breaks: f.breaks.map((bb, i) => i === idx ? { ...bb, durationMin: parseInt(v || '0') } : bb) }))}
                          style={styles.quickGenerateInput}
                          keyboardType="number-pad"
                          mode="outlined"
                          outlineColor={colors.border.light}
                          activeOutlineColor={colors.primary[600]}
                        />
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Warning */}
            <View style={styles.quickGenerateWarning}>
              <AlertCircle size={18} color={colors.warning[600]} />
              <Text style={styles.quickGenerateWarningText}>
                This will replace any existing slots for {formatDateFull(selectedDate)}
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.quickGenerateActions}>
            <Button
              mode="outlined"
              onPress={() => setShowQuickGenerateModal(false)}
              style={styles.quickGenerateCancelBtn}
              textColor={colors.text.primary}
              labelStyle={styles.quickGenerateButtonLabel}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleQuickGenerate}
              style={styles.quickGenerateConfirmBtn}
              buttonColor={colors.primary[600]}
              textColor={colors.text.inverse}
              labelStyle={styles.quickGenerateButtonLabel}
              icon={() => <Settings size={18} color={colors.text.inverse} />}
            >
              Generate
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Subject Selection Modal */}
      <Portal>
        <Modal
          visible={showSubjectDropdown}
          onDismiss={() => setShowSubjectDropdown(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Subject</Text>
            <TouchableOpacity
              onPress={() => setShowSubjectDropdown(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView}>
            {subjects?.map((subject) => (
              <TouchableOpacity
                key={subject.id}
                onPress={() => {
                  handleSlotFormChange('subject_id', subject.id);
                  setShowSubjectDropdown(false);
                }}
                style={[
                  styles.modalItem,
                  slotForm.subject_id === subject.id && styles.modalItemSelected
                ]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modalItemText,
                  slotForm.subject_id === subject.id && styles.modalItemTextSelected
                ]}>
                  {subject.subject_name}
                </Text>
                {slotForm.subject_id === subject.id && (
                  <CheckCircle size={20} color={colors.primary[600]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Modal>
      </Portal>

      {/* Teacher Selection Modal */}
      <Portal>
        <Modal
          visible={showTeacherDropdown}
          onDismiss={() => setShowTeacherDropdown(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Teacher</Text>
            <TouchableOpacity
              onPress={() => setShowTeacherDropdown(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView}>
            {adminsList?.map((teacher) => (
              <TouchableOpacity
                key={teacher.id}
                onPress={() => {
                  handleSlotFormChange('teacher_id', teacher.id);
                  setShowTeacherDropdown(false);
                }}
                style={[
                  styles.modalItem,
                  slotForm.teacher_id === teacher.id && styles.modalItemSelected
                ]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modalItemText,
                  slotForm.teacher_id === teacher.id && styles.modalItemTextSelected
                ]}>
                  {teacher.full_name}
                </Text>
                {slotForm.teacher_id === teacher.id && (
                  <CheckCircle size={20} color={colors.primary[600]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Modal>
      </Portal>

      {/* Chapter Selection Modal */}
      <Portal>
        <Modal
          visible={showChapterDropdown}
          onDismiss={() => setShowChapterDropdown(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Chapter</Text>
            <TouchableOpacity
              onPress={() => setShowChapterDropdown(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView}>
            {getChaptersForSubject(slotForm.subject_id).map((chapter) => (
              <TouchableOpacity
                key={chapter.chapter_id}
                onPress={() => {
                  handleSlotFormChange('syllabus_chapter_id', chapter.chapter_id);
                  setShowChapterDropdown(false);
                }}
                style={[
                  styles.modalItem,
                  slotForm.syllabus_chapter_id === chapter.chapter_id && styles.modalItemSelected
                ]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modalItemText,
                  slotForm.syllabus_chapter_id === chapter.chapter_id && styles.modalItemTextSelected
                ]}>
                  {getChapterName(chapter.chapter_id)}
                </Text>
                {slotForm.syllabus_chapter_id === chapter.chapter_id && (
                  <CheckCircle size={20} color={colors.primary[600]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Modal>
      </Portal>

      {/* Topic Selection Modal */}
      <Portal>
        <Modal
          visible={showTopicDropdown}
          onDismiss={() => setShowTopicDropdown(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Topic</Text>
            <TouchableOpacity
              onPress={() => setShowTopicDropdown(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView}>
            {getTopicsForSubject(slotForm.subject_id).map((topic) => (
              <TouchableOpacity
                key={topic.topic_id}
                onPress={() => {
                  handleSlotFormChange('syllabus_topic_id', topic.topic_id);
                  setShowTopicDropdown(false);
                }}
                style={[
                  styles.modalItem,
                  slotForm.syllabus_topic_id === topic.topic_id && styles.modalItemSelected
                ]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modalItemText,
                  slotForm.syllabus_topic_id === topic.topic_id && styles.modalItemTextSelected
                ]}>
                  {topic.topic_id ? getTopicName(topic.topic_id) : ''}
                </Text>
                {slotForm.syllabus_topic_id === topic.topic_id && (
                  <CheckCircle size={20} color={colors.primary[600]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Modal>
      </Portal>

      {/* Slot Menu Modal */}
      <Portal>
        <Modal
          visible={showSlotMenu}
          onDismiss={() => setShowSlotMenu(false)}
          contentContainerStyle={styles.slotMenuContainer}
        >
          <View style={styles.slotMenuHeader}>
            <Text style={styles.slotMenuTitle}>Period Options</Text>
            <TouchableOpacity
              onPress={() => setShowSlotMenu(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.slotMenuActions}>
            <TouchableOpacity
              onPress={() => {
                setShowSlotMenu(false);
                openEditModal(selectedSlotForMenu);
              }}
              style={styles.slotMenuAction}
              activeOpacity={0.7}
            >
              <Edit size={20} color={colors.primary[600]} />
              <Text style={styles.slotMenuActionText}>Edit Period</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowSlotMenu(false);
                handleStatusToggle(selectedSlotForMenu);
              }}
              style={[
                styles.slotMenuAction,
                taughtSlotIds.has(selectedSlotForMenu?.id) ? styles.slotMenuUnmarkAction : styles.slotMenuMarkAction
              ]}
              activeOpacity={0.7}
            >
              {taughtSlotIds.has(selectedSlotForMenu?.id) ? (
                <Circle size={20} color={colors.text.secondary} />
              ) : (
                <CheckCircle size={20} color={colors.text.secondary} />
              )}
              <Text style={[
                styles.slotMenuActionText,
                taughtSlotIds.has(selectedSlotForMenu?.id) ? styles.slotMenuUnmarkText : styles.slotMenuMarkText
              ]}>
                {taughtSlotIds.has(selectedSlotForMenu?.id) ? 'Mark Pending' : 'Mark Completed'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowSlotMenu(false);
                handleDeleteSlot(selectedSlotForMenu.id);
              }}
              style={[styles.slotMenuAction, styles.slotMenuDeleteAction]}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color={colors.error[600]} />
              <Text style={[styles.slotMenuActionText, styles.slotMenuDeleteText]}>Delete Period</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>

      {/* Error Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>

      {/* FAB - Bottom-right, Elevated, Circular, Primary Purple */}
      {selectedClassId && (
        <TouchableOpacity
          style={styles.premiumFab}
          onPress={() => {
            setShowActionsModal(true);
          }}
          activeOpacity={0.85}
        >
          <Plus size={24} color={colors.text.inverse} strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* Actions Modal */}
      <Portal>
        <Modal
          visible={showActionsModal}
          onDismiss={() => setShowActionsModal(false)}
          contentContainerStyle={styles.actionsModalContentContainer}
        >
          <View style={styles.actionsModalContainer}>
            <View style={styles.actionsModalHeader}>
              <Text style={styles.actionsModalTitle}>Quick Actions</Text>
              <TouchableOpacity onPress={() => setShowActionsModal(false)} style={styles.actionsModalCloseButton}>
                <X size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.actionsList}>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setShowActionsModal(false);
                  resetForm();
                  setSlotForm(prev => ({ ...prev, slot_type: 'period' }));
                  closeAllDropdowns();
                  setShowAddModal(true);
                }}
                activeOpacity={0.8}
              >
                <Plus size={18} color={colors.primary[700]} />
                <Text style={styles.actionText}>Add Period</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setShowActionsModal(false);
                  resetForm();
                  setSlotForm(prev => ({ ...prev, slot_type: 'break' }));
                  closeAllDropdowns();
                  setShowAddModal(true);
                }}
                activeOpacity={0.8}
              >
                <Coffee size={18} color={colors.warning[800]} />
                <Text style={styles.actionText}>Add Break</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setShowActionsModal(false);
                  setShowQuickGenerateModal(true);
                }}
                activeOpacity={0.8}
              >
                <Settings size={18} color={colors.warning[600]} />
                <Text style={styles.actionText}>Quick Generate</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionsModalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowActionsModal(false)}
                style={styles.actionsModalCancelButton}
                textColor={colors.text.primary}
              >
                Close
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Conflict Resolution Modal */}
      {conflictInfo && (
        <Portal>
          <ConflictResolutionModal
            visible={showConflictModal}
            onDismiss={() => setShowConflictModal(false)}
            conflicts={conflictInfo.conflicts}
            affectedSlots={conflictInfo.affectedSlots}
            shiftDelta={conflictInfo.shiftDelta}
            onResolve={handleConflictResolution}
            newSlotInfo={{
              start_time: slotForm.start_time,
              end_time: slotForm.end_time,
              slot_type: slotForm.slot_type as 'period' | 'break',
              name: slotForm.name || undefined,
              subject_name: slotForm.slot_type === 'period'
                ? subjects?.find(s => s.id === slotForm.subject_id)?.subject_name
                : undefined,
            }}
          />
        </Portal>
      )}

      {/* Timeline Preview Modal */}
      {conflictInfo && pendingResolution && (
        <Portal>
          <TimelinePreviewModal
            visible={showPreviewModal}
            onDismiss={() => setShowPreviewModal(false)}
            onConfirm={handlePreviewConfirm}
            currentSlots={slots}
            newSlot={{
              start_time: slotForm.start_time,
              end_time: slotForm.end_time,
              slot_type: slotForm.slot_type as 'period' | 'break',
              name: slotForm.name || undefined,
              subject_name: slotForm.slot_type === 'period'
                ? subjects?.find(s => s.id === slotForm.subject_id)?.subject_name
                : undefined,
            }}
            shifts={conflictInfo.affectedSlots}
            shiftDelta={conflictInfo.shiftDelta}
          />
        </Portal>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean, shadows: Shadows) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },

  // Modern Header
  header: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    ...shadows.sm,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  refreshHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  refreshHintText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    color: colors.text.tertiary,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[50],
    ...shadows.xs,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  quickActionButtonSecondary: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  quickActionTextSecondary: {
    color: colors.primary[600],
  },
  quickActionButtonTertiary: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  quickActionTextTertiary: {
    color: colors.primary[600],
  },

  // Main Scroll View
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 16,
  },

  // Clean UI Styles
  cleanHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.primary,
  },
  cleanTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cleanSubtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  quickActionsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // Compact Filter Row - Soft Cards (44-50px high)
  modernFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface.primary,
  },
  modernFilterCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: isDark ? colors.primary[900] : '#F8F6FF', // Light tinted surface
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  modernFilterCardDisabled: {
    opacity: 0.6,
  },
  modernFilterContent: {
    flex: 1,
    minWidth: 0,
  },
  modernFilterLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    marginBottom: 1,
    letterSpacing: 0.3,
  },
  modernFilterValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  // Today's Classes Summary
  todaysClassesSummary: {
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing.md,
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

  // Premium FAB - Bottom-right, Elevated, Circular, Primary Purple, ~56px
  premiumFab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.xl,
    elevation: 8,
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  fabSecondary: {
    display: 'none',
  },
  actionsModal: {
    backgroundColor: colors.surface.primary,
    margin: 20,
    borderRadius: 16,
    padding: 16,
    ...shadows.lg,
  },
  // Centered Quick Actions Modal Styles (matching syllabus)
  actionsModalContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    maxWidth: 480,
    width: '100%',
    overflow: 'hidden',
    ...shadows.lg,
  },
  actionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  actionsModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  actionsModalCloseButton: {
    padding: spacing.xs,
  },
  actionsList: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  actionsModalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionsModalCancelButton: {
    flex: 1,
  },
  // Bottom sheet styles (task management style)
  bsOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'flex-end',
  },
  bsContainer: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  bsHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border.DEFAULT,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  bsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  bsContent: {
    paddingHorizontal: spacing.lg,
    maxHeight: 400,
  },
  bsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginVertical: 2,
    backgroundColor: colors.background.secondary,
  },
  bsItemActive: {
    backgroundColor: colors.primary[50],
  },
  bsItemText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  bsItemTextActive: {
    color: colors.primary[700],
  },
  bsCheck: {
    fontSize: 18,
    color: colors.primary[700],
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  actionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  scheduleHeader: {
    marginBottom: 16,
  },
  progressSummary: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border.DEFAULT,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 3,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: '47%',
    padding: 16,
    borderRadius: 14,
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  purpleCard: {
    backgroundColor: colors.primary[500],
  },
  blueCard: {
    backgroundColor: colors.info[600],
  },
  greenCard: {
    backgroundColor: colors.success[600],
  },
  orangeCard: {
    backgroundColor: colors.warning[600],
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface.primary,
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 14,
    color: colors.text.inverse,
    fontWeight: '500',
  },
  timetableContentContainer: {
    flex: 1,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + 24, // Extra space for FAB
  },
  cleanScrollView: {
    flex: 1,
  },
  cleanSlotsContainer: {
    paddingBottom: spacing.md,
  },
  cleanTimetableGrid: {
    gap: spacing.xs + 2,
  },
  // Empty State Action Button
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
  },
  emptyActionButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
  },
  // Premium Period Card - iOS + Material Hybrid
  premiumPeriodCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: 12,
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.sm,
    elevation: 2,
    minHeight: 100,
  },
  premiumCurrentCard: {
    borderWidth: 1.5,
    borderColor: colors.success[500],
    ...shadows.lg,
    elevation: 6,
  },
  premiumTaughtCard: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
    opacity: 0.95,
  },
  completedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  completedLabel: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
    letterSpacing: 0.3,
  },
  premiumTimeTextCompleted: {
    color: colors.text.secondary,
  },
  premiumSubjectTextCompleted: {
    color: colors.text.secondary,
    opacity: 0.85,
  },
  premiumTeacherTextCompleted: {
    color: colors.text.tertiary,
    opacity: 0.8,
  },
  premiumAccentStrip: {
    width: 3,
    backgroundColor: colors.primary[500],
  },
  premiumCardContent: {
    flex: 1,
    padding: spacing.md,
    minWidth: 0,
  },
  premiumCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  premiumCardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  premiumCardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  premiumCardMainRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  premiumCardLeftColumn: {
    flex: 1,
    minWidth: 0,
  },
  premiumCardRightColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  periodNumberBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  periodNumberText: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  premiumTimeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    letterSpacing: 0.2,
  },
  premiumSubjectText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  premiumTeacherText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
    maxWidth: '100%',
  },
  topicText: {
    fontSize: typography.fontSize.xs - 1,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    flex: 1,
    textAlign: 'right',
  },
  planText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.text.tertiary,
    lineHeight: 14,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: 2,
  },
  premiumCardEditButton: {
    padding: spacing.xs,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  cleanPlanText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    color: colors.text.secondary,
    lineHeight: 22,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cleanInfoRow: {
    flexDirection: 'column',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cleanTopicInfo: {
    width: '100%',
  },
  cleanTeacherInfo: {
    width: '100%',
  },
  cleanTopicLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  cleanTopicText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    lineHeight: typography.lineHeight.relaxed,
    marginTop: spacing.xs,
  },
  cleanTeacherLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  cleanTeacherText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  premiumBreakCard: {
    backgroundColor: colors.warning[25],
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: 16,
    borderWidth: 0.5,
    borderColor: colors.warning[200],
    ...shadows.sm,
    elevation: 2,
  },
  premiumBreakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  premiumBreakText: {
    flex: 1,
  },
  premiumBreakTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[800],
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  premiumBreakTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[600],
    letterSpacing: 0.1,
  },

  // Slot Menu Styles
  slotMenuContainer: {
    backgroundColor: colors.surface.primary,
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: 0,
    ...shadows.lg,
  },
  slotMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  slotMenuTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  slotMenuActions: {
    padding: spacing.sm,
  },
  slotMenuAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs,
  },
  slotMenuDeleteAction: {
    backgroundColor: colors.error[50],
  },
  slotMenuActionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  slotMenuDeleteText: {
    color: colors.error[600],
  },
  slotMenuMarkAction: {
    backgroundColor: colors.neutral[50],
  },
  slotMenuUnmarkAction: {
    backgroundColor: colors.neutral[50],
  },
  slotMenuMarkText: {
    color: colors.text.secondary,
  },
  slotMenuUnmarkText: {
    color: colors.text.secondary,
  },

  // Modern Bottom Action Buttons
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.neutral[50],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.md,
  },
  bottomActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[600],
    gap: spacing.sm,
  },
  bottomActionButtonSecondary: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.warning[600],
  },
  bottomActionButtonTertiary: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.secondary[600],
  },
  bottomActionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  bottomActionTextSecondary: {
    color: colors.primary[600],
  },
  bottomActionTextTertiary: {
    color: colors.primary[600],
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    borderWidth: 3,
    borderColor: colors.primary[200],
    borderTopColor: colors.primary[600],
    // Add rotation animation here if needed
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    color: colors.text.primary,
  },

  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[600],
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary[600],
  },

  // Timetable
  scrollView: {
    flex: 1,
  },
  slotsContainer: {
    padding: spacing.lg,
  },

  // Slot Cards
  slotCard: {
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    ...shadows.xs,
  },
  periodCard: {
    backgroundColor: colors.surface.primary,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[600],
  },
  breakCard: {
    backgroundColor: colors.background.secondary,
    borderLeftWidth: 3,
    borderLeftColor: colors.border.DEFAULT,
    minHeight: 50,
  },
  slotContent: {
    padding: spacing.md,
  },
  breakSlotContent: {
    padding: spacing.sm,
    paddingVertical: spacing.xs,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  slotTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  slotTime: {
    fontSize: 14,
    color: colors.text.primary,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  periodBadge: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  periodBadgeText: {
    fontSize: 12,
    color: colors.surface.primary,
    fontWeight: '600',
  },
  slotActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  taughtButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface.primary,
    ...shadows.xs,
    elevation: 1,
  },
  periodContent: {
    gap: spacing.xs,
  },
  subjectTitle: {
    fontSize: 20,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  teacherName: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  unassignedText: {
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgePlanned: {
    backgroundColor: colors.background.tertiary,
  },
  statusBadgeDone: {
    backgroundColor: colors.success[100],
  },
  statusBadgeCancelled: {
    backgroundColor: colors.error[100],
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadgeTextPlanned: {
    color: colors.text.secondary,
  },
  statusBadgeTextDone: {
    color: colors.success[700],
  },
  statusBadgeTextCancelled: {
    color: colors.error[700],
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  statusButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.background.tertiary,
  },
  statusButtonActive: {
    backgroundColor: colors.primary[600],
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  statusButtonTextActive: {
    color: colors.surface.primary,
  },
  syllabusContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  syllabusChip: {
    backgroundColor: colors.background.secondary,
  },
  breakContent: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  breakIconContainer: {
    marginBottom: 0,
  },
  breakTextContainer: {
    alignItems: 'center',
  },
  breakIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.warning[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.warning[600],
  },
  breakIconText: {
    fontSize: 16,
  },
  breakTitle: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 0,
  },
  breakSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  // Modals
  modalContainer: {
    backgroundColor: colors.surface.primary,
    padding: 0,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    maxHeight: '90%',
    overflow: 'hidden',
    ...shadows.lg,
  },
  modalScrollContent: {
    flexGrow: 0,
    maxHeight: 400,
  },
  modalScrollContentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  actionsModalContentContainer: {
    margin: spacing.lg,
    maxHeight: '90%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 24,
    color: colors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 200,
    marginBottom: spacing.md,
  },
  modalItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalItemSelected: {
    backgroundColor: colors.info[50],
  },
  modalItemText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  modalItemTextSelected: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  modalCloseButton: {
    borderColor: colors.border.light,
  },

  // Date Navigation in Modal
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  dateNavButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    ...shadows.sm,
    elevation: 2,
  },
  dateDisplay: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 20,
    color: colors.text.primary,
    fontWeight: '600',
  },
  todayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.info[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.xs,
  },
  todayButtonText: {
    fontSize: 14,
    color: colors.primary[600],
    fontWeight: '600',
  },

  // Form Elements
  segmentedButtons: {
    marginBottom: spacing.md,
  },
  textInput: {
    marginBottom: spacing.xs,
    backgroundColor: colors.surface.primary,
  },
  timeHelperContainer: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
  },
  timeHelperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  // Dropdown Button Styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    minHeight: 56,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
    flex: 1,
  },

  // Modal Header Styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  closeButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.secondary,
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.text.secondary,
    fontWeight: '600',
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.surface.primary,
  },
  cancelButton: {
    flex: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
  },
  saveButton: {
    flex: 1,
    borderRadius: borderRadius.lg,
  },
  confirmButton: {
    flex: 1,
    borderRadius: borderRadius.lg,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Quick Generate Modal - New Design
  quickGenerateModalContainer: {
    backgroundColor: colors.surface.primary,
    margin: spacing.md,
    borderRadius: borderRadius.xl,
    maxHeight: '90%',
    overflow: 'hidden',
    ...shadows.lg,
  },
  quickGenerateModalContent: {
    padding: spacing.lg,
  },
  quickGenerateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  quickGenerateHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  quickGenerateTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  quickGenerateSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  quickGenerateCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickGenerateSection: {
    marginBottom: spacing.xl,
  },
  quickGenerateSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  quickGenerateInputGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  quickGenerateInputIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    marginTop: spacing.xs,
  },
  quickGenerateLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  quickGenerateInput: {
    backgroundColor: colors.surface.primary,
    marginBottom: spacing.xs,
  },
  quickGenerateHelperText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  quickGenerateAddBreakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    gap: spacing.xs,
  },
  quickGenerateAddBreakText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  quickGenerateEmptyBreaks: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.light,
  },
  quickGenerateEmptyBreaksText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  quickGenerateEmptyBreaksSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  quickGenerateBreakCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  quickGenerateBreakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickGenerateBreakIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.warning[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  quickGenerateBreakTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  quickGenerateRemoveBreakBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.error[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickGenerateBreakInputs: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickGenerateWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickGenerateWarningText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  quickGenerateActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.surface.primary,
  },
  quickGenerateCancelBtn: {
    flex: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.lg,
  },
  quickGenerateConfirmBtn: {
    flex: 1,
    borderRadius: borderRadius.lg,
  },
  quickGenerateButtonLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Quick Generate Modal - Old (keeping for reference)
  modalDescription: {
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  generatePreview: {
    backgroundColor: colors.info[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  generatePreviewText: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  warningText: {
    fontSize: 14,
    color: colors.warning[600],
    fontWeight: '600',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addBreakBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.DEFAULT,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  addBreakText: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  removeBreakBtn: {
    marginLeft: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.error[100],
    borderRadius: 8,
  },
  removeBreakText: {
    color: colors.error[700],
    fontWeight: '600',
  },

  // Visual Hierarchy Styles
  currentPeriodCard: {
    backgroundColor: colors.info[100],
    borderLeftColor: colors.info[700],
    borderLeftWidth: 6,
    transform: [{ scale: 1.02 }],
  },
  upcomingPeriodCard: {
    backgroundColor: colors.success[50],
    borderLeftColor: colors.success[700],
    borderLeftWidth: 4,
  },
  currentPeriodTime: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.info[700],
  },
  upcomingPeriodTime: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.success[700],
  },

  // Jump to Current Button
  jumpToCurrentButton: {
    backgroundColor: colors.info[100],
    borderWidth: 1,
    borderColor: colors.primary[600],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jumpToCurrentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[600],
  },

  // Compact View Styles
  compactViewActive: {
    backgroundColor: colors.info[100],
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  compactViewText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
    marginLeft: 4,
  },
  compactViewTextActive: {
    color: colors.primary[600],
  },
  compactSlotCard: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },

  // Mobile Responsive Styles
  smallScreenSlotCard: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },

  // Teacher Avatar Styles
  subjectTeacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  subjectInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  teacherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  teacherAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface.primary,
  },

  // Mobile Responsive Styles
  smallScreenSlotHeader: {
    marginBottom: spacing.sm,
  },
  smallScreenTimeContainer: {
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  smallScreenSlotTime: {
    fontSize: 12,
  },
  smallScreenPeriodBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  smallScreenPeriodBadgeText: {
    fontSize: 10,
  },
  smallScreenStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  smallScreenStatusBadgeText: {
    fontSize: 10,
  },
  smallScreenSubjectTitle: {
    fontSize: 16,
  },
  smallScreenTeacherName: {
    fontSize: 12,
  },
  smallScreenTeacherAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  smallScreenTeacherAvatarText: {
    fontSize: 12,
  },

  // Mobile Break Styles
  smallScreenBreakContent: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  smallScreenBreakIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  smallScreenBreakIconText: {
    fontSize: 12,
  },
  smallScreenBreakTitle: {
    fontSize: 14,
  },
  smallScreenBreakSubtitle: {
    fontSize: 10,
  },

  // Mobile Header Styles
  smallScreenHeaderTitle: {
    fontSize: 16,
  },

  // Status Field Styles
  statusField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
    marginRight: spacing.sm,
  },
  statusFieldButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.background.secondary,
  },
  statusFieldButtonDone: {
    backgroundColor: colors.success[100],
    borderColor: colors.success[700],
  },
  statusFieldButtonCancelled: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[700],
  },
  statusFieldButtonPlanned: {
    backgroundColor: colors.primary[50],
    borderColor: colors.info[600],
  },
  statusFieldText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statusFieldTextDone: {
    color: colors.success[700],
  },
  statusFieldTextCancelled: {
    color: colors.error[700],
  },
  statusFieldTextPlanned: {
    color: colors.info[600],
  },

  // Single Line: Date Strip + Filters
  singleLineContainer: {
    flexDirection: 'row',
    backgroundColor: colors.info[100],
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.info[300],
    alignItems: 'center',
    minHeight: 60,
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dateStripScroll: {
    flex: 2,
    marginRight: 16,
    height: 44,
    backgroundColor: colors.surface.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.info[300],
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  compactFilterCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.info[300],
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    minWidth: 80,
  },
  compactFilterIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.info[700],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  compactFilterContent: {
    flex: 1,
  },
  compactFilterLabel: {
    fontSize: 9,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compactFilterValue: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '700',
  },

  // Modern Design Styles
  modernHeader: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
  },
  modernTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  classInfo: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  // Date Strip (for single line layout)
  dateStripContent: {
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  dateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginRight: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.info[50],
    alignItems: 'center',
    minWidth: 48,
    height: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.info[200],
    ...shadows.xs,
  },
  dateChipSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[700],
  },
  dateChipToday: {
    backgroundColor: colors.primary[200],
    borderColor: colors.primary[600],
  },
  dateChipDay: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  dateChipDaySelected: {
    color: colors.text.inverse,
  },
  dateChipDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: 2,
  },
  dateChipDateSelected: {
    color: colors.text.inverse,
  },

  // Modern Timetable
  modernScrollView: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  modernSlotsContainer: {
    padding: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.xl,
    margin: spacing.sm,
    ...shadows.sm,
  },
  timetableHeaders: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.xs,
  },
  timeHeader: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.info[900],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    flex: 0.3,
  },
  subjectHeader: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.info[900],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    flex: 0.7,
  },

  // Modern Period Cards
  modernPeriodCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg, // Increased from md
    padding: spacing.lg, // Increased from md
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: colors.info[600],
    borderWidth: 1,
    borderColor: colors.info[100],
    ...shadows.DEFAULT,
    minHeight: 120, // Added min height
  },
  modernCurrentPeriodCard: {
    borderLeftColor: colors.success[600],
    borderColor: colors.success[200],
    ...shadows.md,
  },
  modernUpcomingPeriodCard: {
    borderLeftColor: colors.info[600],
  },
  modernPastPeriodCard: {
    opacity: 0.85, // Increased from 0.7 for better readability
  },
  modernPeriodTime: {
    flex: 0.3,
    marginRight: spacing.md,
  },
  modernPeriodTimeText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  modernPeriodTimeEnd: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  modernPeriodContent: {
    flex: 0.7,
  },
  modernPeriodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  modernSubjectName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 32,
    overflow: 'hidden',
    marginBottom: 6,
  },
  modernCardMenu: {
    padding: 4,
    marginLeft: 8,
  },
  modernTeacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flex: 1,
    minWidth: 0,
  },
  modernTeacherAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modernTeacherName: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  modernPlanText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  modernPeriodStatus: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modernStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
  },
  modernTaughtButton: {
    backgroundColor: colors.success[100],
  },
  modernNotTaughtButton: {
    backgroundColor: colors.background.tertiary,
  },
  modernStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modernTaughtText: {
    color: colors.success[700],
  },
  modernNotTaughtText: {
    color: colors.text.secondary,
  },

  // Modern Break Cards
  modernBreakCard: {
    backgroundColor: colors.warning[100],
    borderRadius: 14,
    marginBottom: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning[500],
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modernBreakTime: {
    flex: 0.3,
    marginRight: 16,
  },
  modernBreakTimeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modernBreakContent: {
    flex: 0.7,
  },
  modernBreakTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
});

