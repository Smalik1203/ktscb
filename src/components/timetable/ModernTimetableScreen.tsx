import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, RefreshControl, Animated, Vibration, Modal as RNModal, Text as RNText } from 'react-native';
import { Text, Card, Button, Chip, Portal, Modal, TextInput, SegmentedButtons, Snackbar } from 'react-native-paper';
import { Calendar, Clock, ChevronLeft, ChevronRight, Plus, Edit, Trash2, CheckCircle, Circle, Settings, Users, BookOpen, MapPin, Filter, RotateCcw, User, MoreVertical, Coffee, ListTodo, X } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useUnifiedTimetable } from '../../hooks/useUnifiedTimetable';
import { useSyllabusLoader } from '../../hooks/useSyllabusLoader';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { useAdmins } from '../../hooks/useAdmins';
import { DatePickerModal } from '../common/DatePickerModal';
import { ThreeStateView } from '../common/ThreeStateView';
import { EmptyStateIllustration } from '../ui/EmptyStateIllustration';
import { colors, typography, spacing, borderRadius, shadows } from '../../../lib/design-system';
import dayjs from 'dayjs';
import { router } from 'expo-router';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isSmallScreen = screenWidth < 375;
const isVerySmallScreen = screenWidth < 320;

const { width } = Dimensions.get('window');

// Clean Timetable Card Component
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
  setShowSlotMenu
}: any) {
  const isTaught = taughtSlotIds.has(slot.id);

  if (slot.slot_type === 'break') {
    return (
      <View style={styles.cleanBreakCard}>
        <View style={styles.cleanBreakContent}>
          <View style={styles.cleanBreakIcon}>
            <Coffee size={18} color="#a16207" />
          </View>
          <View style={styles.cleanBreakText}>
            <Text style={styles.cleanBreakTitle}>{slot.name || 'Break'}</Text>
            <Text style={styles.cleanBreakTime}>
              {formatTime12Hour(slot.start_time)} - {formatTime12Hour(slot.end_time)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => onEdit(slot)}
          style={styles.cleanCardMenu}
          activeOpacity={0.6}
        >
          <View style={styles.menuIconContainer}>
            <Edit size={18} color="#0ea5e9" />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[
      styles.cleanPeriodCard,
      isCurrentPeriod && styles.cleanCurrentCard,
      isUpcomingPeriod && styles.cleanUpcomingCard,
      isPastPeriod && styles.cleanPastCard,
      isTaught ? styles.cleanCompletedCard : styles.cleanPendingCard
    ]}>
      <View style={styles.cleanPeriodLeftBorder} />
      
      <View style={styles.cleanPeriodContent}>
        {/* Line 1: Time + Subject */}
        <View style={styles.cleanPeriodHeader}>
          <View style={styles.cleanContentColumn}>
            <RNText style={styles.cleanTimeText}>
              {`${formatTime12Hour(slot?.start_time)} - ${formatTime12Hour(slot?.end_time)}`}
            </RNText>
            <RNText style={styles.cleanSubjectName} numberOfLines={2} ellipsizeMode="tail">
              {slot?.subject_name?.trim?.() || 'Unassigned'}
            </RNText>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedSlotForMenu(slot);
              setShowSlotMenu(true);
            }}
            style={styles.cleanCardMenu}
            activeOpacity={0.6}
          >
            <Edit size={20} color={colors.info[500]} />
          </TouchableOpacity>
        </View>

        {/* Lines 2 & 3: Topic and Teacher */}
        <View style={styles.cleanLines}>
          <RNText style={styles.cleanLineText} numberOfLines={1}>
            <RNText style={styles.cleanLabel}>Topic: </RNText>
            {slot?.topic_name?.trim?.() || '—'}
          </RNText>
          <RNText style={styles.cleanLineText} numberOfLines={1}>
            <RNText style={styles.cleanLabel}>Teacher: </RNText>
            {slot?.teacher_name?.trim?.() || '—'}
          </RNText>
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
  isPastPeriod
}: any) {
  const getSubjectColor = (subjectName: string) => {
    const colors = {
      'Biology': '#059669', // Vibrant Green
      'Geography': '#1d4ed8', // Deep Blue
      'Math': '#dc2626', // Vibrant Red
      'Chemistry': '#ea580c', // Vibrant Orange
      'English': '#7c3aed', // Vibrant Purple
      'Physics': '#be185d', // Vibrant Pink
      'History': '#0891b2', // Vibrant Cyan
      'Science': '#16a34a', // Vibrant Green
      'Art': '#e11d48', // Vibrant Rose
      'Music': '#9333ea', // Vibrant Violet
      'default': '#1d4ed8' // Deep Blue
    };
    return colors[subjectName as keyof typeof colors] || colors.default;
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
            <User size={16} color="#6b7280" />
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
    start_time: '',
    end_time: '',
    subject_id: '',
    teacher_id: '',
    plan_text: '',
    syllabus_chapter_id: '',
    syllabus_topic_id: '',
  });
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

  const dateStr = dayjs(selectedDate).format('YYYY-MM-DD');
  const { data: classes } = useClasses(profile?.school_code);
  const { data: subjectsResult } = useSubjects(profile?.school_code);
  const subjects = subjectsResult?.data || [];
  const { data: adminsResult } = useAdmins(profile?.school_code);
  const adminsList = adminsResult?.data || [];
  const { slots, displayPeriodNumber, loading, error, refetch, createSlot, updateSlot, deleteSlot, quickGenerate, markSlotTaught, unmarkSlotTaught, updateSlotStatus, taughtSlotIds } = useUnifiedTimetable(
    selectedClassId,
    dateStr,
    profile?.school_code
  );

  const { chaptersById, syllabusContentMap } = useSyllabusLoader(selectedClassId, profile?.school_code);

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
    if (!teacherName) return '#9ca3af';
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4'];
    const hash = teacherName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
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

  const showSuccess = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };


  // Get selected class info
  const selectedClass = classes?.find(c => c.id === selectedClassId);

  // Navigation functions
  const goToPreviousDay = () => {
    setSelectedDate(prev => dayjs(prev).subtract(1, 'day').toDate());
  };

  const goToNextDay = () => {
    setSelectedDate(prev => dayjs(prev).add(1, 'day').toDate());
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

  // Handle add slot
  const handleAddSlot = async () => {
    if (!selectedClassId || !profile?.school_code) {
      showError('Please select a class and ensure you have a school code');
      return;
    }

    // Validate required fields
    if (!slotForm.start_time || !slotForm.end_time) {
      showError('Please enter start and end times');
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

    // Show confirmation dialog
    Alert.alert(
      'Confirm Add Slot',
      `Are you sure you want to add this ${slotForm.slot_type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            try {
              const payload = {
                class_instance_id: selectedClassId,
                school_code: profile.school_code,
                class_date: dateStr,
                period_number: 999, // Temporary value, will be renumbered by the hook
                slot_type: slotForm.slot_type as 'period' | 'break',
                name: slotForm.slot_type === 'break' ? slotForm.name : null,
                start_time: slotForm.start_time,
                end_time: slotForm.end_time,
                subject_id: slotForm.slot_type === 'period' ? slotForm.subject_id : null,
                teacher_id: slotForm.slot_type === 'period' ? slotForm.teacher_id : null,
                plan_text: slotForm.slot_type === 'period' ? slotForm.plan_text : null,
                syllabus_chapter_id: slotForm.slot_type === 'period' ? slotForm.syllabus_chapter_id : null,
                syllabus_topic_id: slotForm.slot_type === 'period' ? slotForm.syllabus_topic_id : null,
              };

              await createSlot(payload);
              closeModal();
              closeAllDropdowns();
            } catch (error) {
              showError('Failed to create slot. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Handle edit slot
  const handleEditSlot = async () => {
    if (!editingSlot) return;

    // Validate required fields
    if (!slotForm.start_time || !slotForm.end_time) {
      showError('Please enter start and end times');
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

    // Show confirmation dialog
    Alert.alert(
      'Confirm Update Slot',
      `Are you sure you want to update this ${slotForm.slot_type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              await updateSlot(editingSlot.id, {
                slot_type: slotForm.slot_type as 'period' | 'break',
                name: slotForm.slot_type === 'break' ? slotForm.name : null,
                start_time: slotForm.start_time,
                end_time: slotForm.end_time,
                subject_id: slotForm.slot_type === 'period' ? slotForm.subject_id : null,
                teacher_id: slotForm.slot_type === 'period' ? slotForm.teacher_id : null,
                plan_text: slotForm.slot_type === 'period' ? slotForm.plan_text : null,
                syllabus_chapter_id: slotForm.slot_type === 'period' ? slotForm.syllabus_chapter_id : null,
                syllabus_topic_id: slotForm.slot_type === 'period' ? slotForm.syllabus_topic_id : null,
              });
              
              closeModal();
              closeAllDropdowns();
            } catch (error) {
              showError('Failed to update slot. Please try again.');
            }
          },
        },
      ]
    );
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
      start_time: '',
      end_time: '',
      subject_id: '',
      teacher_id: '',
      plan_text: '',
      syllabus_chapter_id: '',
      syllabus_topic_id: '',
    });
  };

  // Open edit modal
  const openEditModal = (slot: any) => {
    setEditingSlot(slot);
    setSlotForm({
      slot_type: slot.slot_type,
      name: slot.name || '',
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

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#8b5cf6']}
            tintColor="#8b5cf6"
          />
        }
      >
        {/* Quick Actions Cards */}
        <View style={styles.filterBar}>
          <TouchableOpacity style={[styles.filterItem, !selectedClassId && styles.filterItemDisabled]} onPress={() => setShowClassSelector(true)}>
            <View style={styles.filterIcon}>
              <Users size={16} color="#ffffff" />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterLabel}>Class</Text>
              <Text style={styles.filterValue}>
                {selectedClassId && selectedClass
                  ? `${selectedClass.grade || ''} ${selectedClass.section || ''}`.trim() || 'No Class'
                  : 'Select Class'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterItem} onPress={() => setShowDatePicker(true)}>
            <View style={styles.filterIcon}>
              <ListTodo size={16} color="#ffffff" />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterLabel}>Date</Text>
              <Text style={styles.filterValue}>{dayjs(selectedDate).format('MMM YYYY')}</Text>
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
              description={`No timetable for ${dayjs(selectedDate).format('MMM D, YYYY')}`}
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
          <Text style={styles.modalTitle}>
            {editingSlot ? 'Edit Slot' : `Add ${slotForm.slot_type === 'period' ? 'Period' : 'Break'}`}
          </Text>

          <SegmentedButtons
            value={slotForm.slot_type}
            onValueChange={(value) => handleSlotFormChange('slot_type', value)}
            buttons={[
              { value: 'period', label: 'Period' },
              { value: 'break', label: 'Break' },
            ]}
            style={styles.segmentedButtons}
          />

          <TextInput
            label="Start Time"
            value={slotForm.start_time}
            onChangeText={(text) => handleSlotFormChange('start_time', text)}
            style={styles.textInput}
            mode="outlined"
            placeholder="HH:MM:SS"
            outlineColor="#e2e8f0"
            activeOutlineColor="#6366f1"
            textColor="#000000"
            placeholderTextColor="#9ca3af"
          />

          <TextInput
            label="End Time"
            value={slotForm.end_time}
            onChangeText={(text) => handleSlotFormChange('end_time', text)}
            style={styles.textInput}
            mode="outlined"
            placeholder="HH:MM:SS"
            outlineColor="#e2e8f0"
            activeOutlineColor="#6366f1"
            textColor="#000000"
            placeholderTextColor="#9ca3af"
          />

          {slotForm.slot_type === 'break' && (
            <TextInput
              label="Break Name"
              value={slotForm.name}
              onChangeText={(text) => handleSlotFormChange('name', text)}
              style={styles.textInput}
              mode="outlined"
              placeholder="e.g., Lunch Break"
              outlineColor="#e2e8f0"
              activeOutlineColor="#6366f1"
              textColor="#000000"
              placeholderTextColor="#9ca3af"
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
                <ChevronRight size={20} color="#6b7280" />
              </TouchableOpacity>

              {/* Teacher Selection Button */}
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowTeacherDropdown(true)}
              >
                <Text style={styles.dropdownButtonText}>
                  {adminsList?.find(t => t.id === slotForm.teacher_id)?.full_name || 'Select Teacher'}
                </Text>
                <ChevronRight size={20} color="#6b7280" />
              </TouchableOpacity>

              {/* Chapter Selection Button */}
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowChapterDropdown(true)}
              >
                <Text style={styles.dropdownButtonText}>
                  {getChapterName(slotForm.syllabus_chapter_id) || 'Select Chapter'}
                </Text>
                <ChevronRight size={20} color="#6b7280" />
              </TouchableOpacity>

              {/* Topic Selection Button */}
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowTopicDropdown(true)}
              >
                <Text style={styles.dropdownButtonText}>
                  {getTopicName(slotForm.syllabus_topic_id) || 'Select Topic'}
                </Text>
                <ChevronRight size={20} color="#6b7280" />
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
                outlineColor="#e2e8f0"
                activeOutlineColor="#6366f1"
                textColor="#000000"
                placeholderTextColor="#9ca3af"
              />
            </>
          )}

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
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Quick Generate Timetable</Text>

          <TextInput
            label="Number of Periods"
            value={String(quickForm.numPeriods)}
            onChangeText={(v) => setQuickForm(f => ({ ...f, numPeriods: Math.max(1, parseInt(v || '0')) }))}
            style={styles.textInput}
            keyboardType="number-pad"
            mode="outlined"
          />

          <TextInput
            label="Period Duration (minutes)"
            value={String(quickForm.periodDurationMin)}
            onChangeText={(v) => setQuickForm(f => ({ ...f, periodDurationMin: Math.max(1, parseInt(v || '0')) }))}
            style={styles.textInput}
            keyboardType="number-pad"
            mode="outlined"
          />

          <TextInput
            label="Start Time"
            value={quickForm.startTime}
            onChangeText={(v) => setQuickForm(f => ({ ...f, startTime: v }))}
            style={styles.textInput}
            placeholder="HH:MM"
            mode="outlined"
          />

          <Text style={{ marginTop: 8, marginBottom: 4, color: '#374151', fontWeight: '600' }}>Break Configuration</Text>
          {quickForm.breaks.map((b, idx) => (
            <View key={idx} style={styles.breakRow}>
              <TextInput
                label="After Period"
                value={String(b.afterPeriod)}
                onChangeText={(v) => setQuickForm(f => ({ ...f, breaks: f.breaks.map((bb, i) => i===idx ? { ...bb, afterPeriod: parseInt(v || '0') } : bb) }))}
                style={[styles.textInput, { flex: 1 }]}
                keyboardType="number-pad"
                mode="outlined"
              />
              <TextInput
                label="Duration (min)"
                value={String(b.durationMin)}
                onChangeText={(v) => setQuickForm(f => ({ ...f, breaks: f.breaks.map((bb, i) => i===idx ? { ...bb, durationMin: parseInt(v || '0') } : bb) }))}
                style={[styles.textInput, { flex: 1, marginLeft: 8 }]}
                keyboardType="number-pad"
                mode="outlined"
              />
              <TouchableOpacity
                onPress={() => setQuickForm(f => ({ ...f, breaks: f.breaks.filter((_, i) => i!==idx) }))}
                style={styles.removeBreakBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.removeBreakText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setQuickForm(f => ({ ...f, breaks: [...f.breaks, { afterPeriod: 2, durationMin: 15, name: 'Break' }] }))}
            style={styles.addBreakBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.addBreakText}>Add Break</Text>
          </TouchableOpacity>

          <Text style={styles.warningText}>⚠️ This will replace any existing slots for this date.</Text>

          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setShowQuickGenerateModal(false)} style={styles.cancelButton} textColor={colors.text.primary} labelStyle={styles.buttonLabel}>Cancel</Button>
            <Button mode="contained" onPress={handleQuickGenerate} style={styles.confirmButton} buttonColor={colors.primary[600]} textColor={colors.text.inverse} labelStyle={styles.buttonLabel}>OK</Button>
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
                  {getTopicName(topic.topic_id)}
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
              <Edit size={20} color="#6366f1" />
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
                <Circle size={20} color="#6b7280" />
              ) : (
                <CheckCircle size={20} color="#6b7280" />
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
              <Trash2 size={20} color="#ef4444" />
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

      {/* Floating Actions Button */}
      {selectedClassId && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setShowActionsModal(true);
          }}
          activeOpacity={0.85}
        >
          <Plus size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      )}

      {/* Actions Modal */}
      <Portal>
        <Modal
          visible={showActionsModal}
          onDismiss={() => setShowActionsModal(false)}
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
                <Plus size={18} color="#4F46E5" />
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
                <Coffee size={18} color="#a16207" />
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  // Filter bar styles (match calendar)
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
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
    borderColor: colors.border.light,
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterItemDisabled: {
    opacity: 0.6,
  },
  filterContent: { flex: 1 },
  filterLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  filterValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  // Floating button
  fab: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  fabSecondary: {
    display: 'none',
  },
  actionsModal: {
    backgroundColor: '#ffffff',
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
    width: '90%',
    maxHeight: '80%',
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bsContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  bsHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  bsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
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
    backgroundColor: '#F9FAFB',
  },
  bsItemActive: {
    backgroundColor: '#EEF2FF',
  },
  bsItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  bsItemTextActive: {
    color: '#4F46E5',
  },
  bsCheck: {
    fontSize: 18,
    color: '#4F46E5',
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
    color: '#1f2937',
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
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8b5cf6',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  purpleCard: {
    backgroundColor: '#8b5cf6',
  },
  blueCard: {
    backgroundColor: '#3b82f6',
  },
  greenCard: {
    backgroundColor: '#10b981',
  },
  orangeCard: {
    backgroundColor: '#f59e0b',
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  timetableContentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cleanScrollView: {
    flex: 1,
  },
  cleanSlotsContainer: {
    paddingBottom: 16,
  },
  cleanTimetableGrid: {
    gap: 8,
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
  cleanPeriodCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    flexDirection: 'row',
    minHeight: 96,
    borderLeftWidth: 4,
    borderLeftColor: colors.neutral[300],
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  cleanCurrentCard: {
    borderWidth: 2,
    borderColor: colors.success[600],
    ...shadows.md,
  },
  cleanUpcomingCard: {
    borderWidth: 1,
    borderColor: colors.info[600],
  },
  cleanPastCard: {
    opacity: 0.85, // Increased from 0.7 for better readability
  },
  cleanCompletedCard: {
    borderLeftColor: colors.success[600], // ✅ GREEN for completed (taught)
    backgroundColor: colors.success[50], // ✅ Light green background
    borderLeftWidth: 4,
  },
  cleanPendingCard: {
    borderLeftColor: colors.primary[600], // Primary orange for pending
    backgroundColor: colors.surface.primary, // White background
    borderLeftWidth: 4,
  },
  cleanPeriodLeftBorder: {
    width: 4,
    backgroundColor: 'transparent', // Will be overridden by card status colors
  },
  cleanPeriodContent: {
    flex: 1,
    padding: spacing.sm,
    paddingBottom: spacing.sm,
    minWidth: 0,
  },
  cleanPeriodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    width: '100%',
  },
  cleanContentColumn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginRight: spacing.sm,
    minWidth: 0,
  },
  cleanTimeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
    width: '100%',
  },
  cleanCardMenu: {
    padding: 6,
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.info[50],
    borderWidth: 1,
    borderColor: colors.info[200],
    ...shadows.xs,
  },
  menuIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  cleanSubjectName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 24,
    width: '100%',
    flexWrap: 'wrap',
    paddingRight: 40, // ensure room for menu button
    overflow: 'hidden',
    marginBottom: 6,
  },
  cleanInfoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  cleanLines: {
    marginTop: spacing.sm,
    gap: 4,
  },
  cleanLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  cleanLineText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 20,
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
  cleanBreakCard: {
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.xs,
    minHeight: 96,
    opacity: 0.9,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[700],
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  cleanBreakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cleanBreakIcon: {
    marginRight: 12,
  },
  cleanBreakText: {
    flex: 1,
  },
  cleanBreakTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
    marginBottom: 2,
  },
  cleanBreakTime: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    ...shadows.xs,
  },
  periodCard: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  breakCard: {
    backgroundColor: '#f9fafb',
    borderLeftWidth: 3,
    borderLeftColor: '#d1d5db',
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
    color: '#374151',
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  periodBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  periodBadgeText: {
    fontSize: 12,
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
    ...shadows.xs,
    elevation: 1,
  },
  periodContent: {
    gap: spacing.xs,
  },
  subjectTitle: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  teacherName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  unassignedText: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgePlanned: {
    backgroundColor: '#f3f4f6',
  },
  statusBadgeDone: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadgeTextPlanned: {
    color: '#6b7280',
  },
  statusBadgeTextDone: {
    color: '#16a34a',
  },
  statusBadgeTextCancelled: {
    color: '#dc2626',
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
    backgroundColor: '#f3f4f6',
  },
  statusButtonActive: {
    backgroundColor: '#6366f1',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  statusButtonTextActive: {
    color: '#ffffff',
  },
  planText: {
    fontSize: 14,
    color: '#000000',
    fontStyle: 'italic',
  },
  syllabusContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  syllabusChip: {
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  breakIconText: {
    fontSize: 16,
  },
  breakTitle: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 0,
  },
  breakSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Modals
  modalContainer: {
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: 24,
    color: '#000000',
    fontWeight: '600',
    marginBottom: spacing.lg,
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
    borderBottomColor: '#e2e8f0',
  },
  modalItemSelected: {
    backgroundColor: '#f0f4ff',
  },
  modalItemText: {
    fontSize: 16,
    color: '#000000',
  },
  modalItemTextSelected: {
    color: '#6366f1',
    fontWeight: '600',
  },
  modalCloseButton: {
    borderColor: '#e2e8f0',
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
    backgroundColor: '#f8fafc',
    ...shadows.sm,
    elevation: 2,
  },
  dateDisplay: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '600',
  },
  todayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: '#f0f4ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.xs,
  },
  todayButtonText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },

  // Form Elements
  segmentedButtons: {
    marginBottom: spacing.md,
  },
  textInput: {
    marginBottom: spacing.md,
    backgroundColor: '#ffffff',
  },
  
  // Dropdown Button Styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    minHeight: 56,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#374151',
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
    backgroundColor: '#f8fafc',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    borderColor: '#e2e8f0',
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

  // Quick Generate Modal
  modalDescription: {
    fontSize: 16,
    color: '#374151',
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  generatePreview: {
    backgroundColor: '#f0f4ff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  generatePreviewText: {
    fontSize: 14,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  warningText: {
    fontSize: 14,
    color: '#f59e0b',
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
    borderColor: '#CBD5E1',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  addBreakText: {
    color: '#374151',
    fontWeight: '600',
  },
  removeBreakBtn: {
    marginLeft: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  removeBreakText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  
  // Visual Hierarchy Styles
  currentPeriodCard: {
    backgroundColor: '#e0f2fe',
    borderLeftColor: '#0284c7',
    borderLeftWidth: 6,
    transform: [{ scale: 1.02 }],
  },
  upcomingPeriodCard: {
    backgroundColor: '#f0fdf4',
    borderLeftColor: '#16a34a',
    borderLeftWidth: 4,
  },
  currentPeriodTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0284c7',
  },
  upcomingPeriodTime: {
    fontSize: 15,
    fontWeight: '600',
    color: '#16a34a',
  },
  
  // Jump to Current Button
  jumpToCurrentButton: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jumpToCurrentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  
  // Compact View Styles
  compactViewActive: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  compactViewText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 4,
  },
  compactViewTextActive: {
    color: '#6366f1',
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
    color: '#ffffff',
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
    color: '#6b7280',
    fontWeight: '500',
    marginRight: spacing.sm,
  },
  statusFieldButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  statusFieldButtonDone: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  statusFieldButtonCancelled: {
    backgroundColor: '#fef2f2',
    borderColor: '#dc2626',
  },
  statusFieldButtonPlanned: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  statusFieldText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statusFieldTextDone: {
    color: '#16a34a',
  },
  statusFieldTextCancelled: {
    color: '#dc2626',
  },
  statusFieldTextPlanned: {
    color: '#2563eb',
  },
  
  // Single Line: Date Strip + Filters
  singleLineContainer: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#93c5fd',
    alignItems: 'center',
    minHeight: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dateStripScroll: {
    flex: 2,
    marginRight: 16,
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#93c5fd',
    shadowColor: '#000',
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
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    shadowColor: '#000',
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
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  compactFilterContent: {
    flex: 1,
  },
  compactFilterLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compactFilterValue: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '700',
  },
  
  // Modern Design Styles
  modernHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modernTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  classInfo: {
    fontSize: 16,
    color: '#6b7280',
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
    color: '#111827',
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
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modernTeacherName: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  modernPlanText: {
    fontSize: 14,
    color: '#6b7280',
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
    backgroundColor: '#f3f4f6',
  },
  modernTaughtButton: {
    backgroundColor: '#dcfce7',
  },
  modernNotTaughtButton: {
    backgroundColor: '#f3f4f6',
  },
  modernStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  modernTaughtText: {
    color: '#16a34a',
  },
  modernNotTaughtText: {
    color: '#6b7280',
  },
  
  // Modern Break Cards
  modernBreakCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 14,
    marginBottom: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fbbf24',
    shadowColor: '#000',
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
    color: '#111827',
  },
  modernBreakContent: {
    flex: 0.7,
  },
  modernBreakTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
});
