/**
 * AttendanceScreen
 * 
 * Refactored to use centralized design system with dynamic theming.
 * All styling now uses theme tokens via useTheme hook.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Dimensions, Text, ActivityIndicator, TextInput } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useClassSelection } from '../../contexts/ClassSelectionContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { DatePickerModal } from '../common/DatePickerModal';
import { useStudents } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { useClassAttendance, useMarkAttendance, useMarkBulkAttendance, useClassAttendanceSummary } from '../../hooks/useAttendance';
import { useHolidayCheck, useCreateCalendarEvent } from '../../hooks/useCalendarEvents';
import { AttendanceInput } from '../../services/api';
import { StudentAttendanceView } from './StudentAttendanceView';
import { Menu } from '../../ui';

type AttendanceStatus = 'present' | 'absent' | null;

interface StudentAttendanceData {
  studentId: string;
  studentName: string;
  studentCode: string;
  status: AttendanceStatus;
}

// Helper to generate initials from name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Helper to generate consistent color from string
const getAvatarColor = (name: string, isDark: boolean) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  return isDark
    ? `hsl(${hue}, 70%, 30%)`
    : `hsl(${hue}, 70%, 90%)`;
};

// Helper for avatar text color
const getAvatarTextColor = (name: string, isDark: boolean) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  return isDark
    ? `hsl(${hue}, 80%, 90%)`
    : `hsl(${hue}, 80%, 30%)`;
};

export const AttendanceScreen: React.FC = () => {
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
  const { selectedClass, scope, setSelectedClass, classes: contextClasses } = useClassSelection();
  const { can, isLoading: capabilitiesLoading } = useCapabilities();

  // Capability-based checks (NO role checks in UI)
  const canMarkAttendance = can('attendance.mark');
  const canBulkMark = can('attendance.bulk_mark');
  const canReadAllAttendance = can('attendance.read');
  const canReadOwnAttendance = can('attendance.read_own') && !canReadAllAttendance;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceData[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'mark' | 'history'>(
    canReadOwnAttendance ? 'history' : 'mark'
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'absent' | 'unmarked'>('all');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [historyEndDate, setHistoryEndDate] = useState<Date>(new Date());
  const [showHistoryStartDatePicker, setShowHistoryStartDatePicker] = useState(false);
  const [showHistoryEndDatePicker, setShowHistoryEndDatePicker] = useState(false);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['75%'], []);

  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, spacing, borderRadius, typography, shadows, isDark),
    [colors, spacing, borderRadius, typography, shadows, isDark]);

  const dateString = selectedDate.toISOString().split('T')[0];
  const historyStartDateString = historyStartDate.toISOString().split('T')[0];
  const historyEndDateString = historyEndDate.toISOString().split('T')[0];

  const { data: localClasses = [] } = useClasses(canReadAllAttendance ? (scope.school_code ?? undefined) : undefined);
  // Use context classes (always fetched via profile.school_code) as fallback for the class picker
  const classes = localClasses.length > 0 ? localClasses : contextClasses;
  const effectiveSchoolCode = scope.school_code ?? profile?.school_code ?? selectedClass?.school_code ?? null;

  const { data: studentsResponse, isLoading: studentsLoading, error: studentsError } = useStudents(
    canReadAllAttendance && selectedClass?.id ? selectedClass.id : undefined,
    canReadAllAttendance && effectiveSchoolCode ? effectiveSchoolCode : undefined
  );
  const students = useMemo(() => studentsResponse?.data || [], [studentsResponse?.data]);

  const { data: existingAttendanceRaw, isLoading: attendanceLoading, error: attendanceError } = useClassAttendance(
    canReadAllAttendance && selectedClass?.id ? selectedClass.id : undefined,
    canReadAllAttendance ? dateString : undefined
  );
  const existingAttendance = useMemo(() => existingAttendanceRaw || [], [existingAttendanceRaw]);

  const { data: attendanceSummaryRaw, isLoading: summaryLoading } = useClassAttendanceSummary(
    canReadAllAttendance && activeTab === 'history' && selectedClass?.id ? selectedClass.id : undefined,
    canReadAllAttendance && activeTab === 'history' ? historyStartDateString : undefined,
    canReadAllAttendance && activeTab === 'history' ? historyEndDateString : undefined
  );
  const attendanceSummary = useMemo(() => attendanceSummaryRaw || [], [attendanceSummaryRaw]);

  const markAttendanceMutation = useMarkAttendance();
  const markBulkAttendanceMutation = useMarkBulkAttendance();

  // ── Completion stats ──
  const completionStats = useMemo(() => {
    const total = attendanceData.length;
    const marked = attendanceData.filter(s => s.status !== null).length;
    const present = attendanceData.filter(s => s.status === 'present').length;
    const absent = attendanceData.filter(s => s.status === 'absent').length;
    const unmarked = total - marked;
    const percentage = total > 0 ? Math.round((marked / total) * 100) : 0;
    return { total, marked, present, absent, unmarked, percentage };
  }, [attendanceData]);

  // ── Filtered + searched data ──
  const filteredAttendanceData = useMemo(() => {
    let data = attendanceData;

    // Apply filter mode
    if (filterMode === 'absent') {
      data = data.filter(s => s.status === 'absent');
    } else if (filterMode === 'unmarked') {
      data = data.filter(s => s.status === null);
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      data = data.filter(s =>
        s.studentName.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q)
      );
    }

    return data;
  }, [attendanceData, searchQuery, filterMode]);

  // ── Holiday integration ──
  const { data: holidayInfo, isLoading: holidayLoading } = useHolidayCheck(
    effectiveSchoolCode || '',
    dateString,
    selectedClass?.id
  );
  const isHoliday = !!holidayInfo;
  const createCalendarEvent = useCreateCalendarEvent();

  const handleMarkHoliday = useCallback(() => {
    if (!effectiveSchoolCode || !profile?.auth_id) return;

    Alert.alert(
      'Mark as Holiday',
      `Mark ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} as a school holiday?\n\nNo attendance will be required for this day.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Holiday',
          onPress: async () => {
            try {
              await createCalendarEvent.mutateAsync({
                school_code: effectiveSchoolCode,
                title: 'School Holiday',
                event_type: 'holiday',
                start_date: dateString,
                end_date: dateString,
                is_all_day: true,
                is_active: true,
                color: '#faad14',
                created_by: profile.auth_id,
              });
              Alert.alert('Done', 'Day has been marked as a holiday.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to mark holiday.');
            }
          },
        },
      ]
    );
  }, [effectiveSchoolCode, profile?.auth_id, selectedDate, dateString, createCalendarEvent]);

  useEffect(() => {
    if (canReadAllAttendance && students && students.length > 0) {
      const studentAttendanceData: StudentAttendanceData[] = students
        .filter(student => student && student.id && student.full_name && student.student_code)
        .map(student => {
          const existing = existingAttendance?.find(a => a && a.student_id === student.id);
          const normalizedStatus: AttendanceStatus = existing?.status === 'present' || existing?.status === 'absent'
            ? existing.status
            : null;
          return {
            studentId: student.id,
            studentName: student.full_name,
            studentCode: student.student_code,
            status: normalizedStatus,
          };
        });
      setAttendanceData(studentAttendanceData);
      setHasChanges(false);

      // If existing attendance was loaded, show "previously saved" state
      if (existingAttendance && existingAttendance.length > 0 && existingAttendance[0]?.created_at) {
        setLastSavedAt(new Date(existingAttendance[0].created_at));
      } else {
        setLastSavedAt(null);
      }
    } else {
      setAttendanceData([]);
      setLastSavedAt(null);
    }
  }, [students, existingAttendance, dateString, canReadAllAttendance]);

  const handleDateConfirm = useCallback((date: Date) => {
    if (!canMarkAttendance) return;
    setSelectedDate(date);
    setHasChanges(false);
    setLastSavedAt(null);
    setSearchQuery('');
    setFilterMode('all');
    setShowDatePicker(false);
  }, [canMarkAttendance]);

  const handleDateCancel = useCallback(() => {
    if (!canMarkAttendance) return;
    setShowDatePicker(false);
  }, [canMarkAttendance]);

  const handleStatusChange = useCallback((studentId: string, status: AttendanceStatus) => {
    if (!canMarkAttendance) return;
    setAttendanceData(prev => {
      const updated = prev.map(s => {
        if (s.studentId === studentId) {
          const newStatus = s.status === status ? null : status;
          return { ...s, status: newStatus };
        }
        return s;
      });
      return updated;
    });
    setHasChanges(true);
  }, [canMarkAttendance]);

  const handleSave = async () => {
    if (!selectedClass?.id || !effectiveSchoolCode || !profile?.auth_id) {
      Alert.alert('Error', 'Please select a class and ensure you are logged in');
      return;
    }

    // Validate that all students are marked
    const unmarkedStudents = attendanceData.filter(student => student.status === null);
    if (unmarkedStudents.length > 0) {
      Alert.alert(
        'Incomplete Attendance',
        `Please mark attendance for all students before saving.\n\n${unmarkedStudents.length} student${unmarkedStudents.length > 1 ? 's' : ''} still unmarked.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const records: AttendanceInput[] = attendanceData
      .filter(student => student.status !== null && (student.status === 'present' || student.status === 'absent'))
      .map(student => ({
        student_id: student.studentId,
        class_instance_id: selectedClass.id,
        date: dateString,
        status: student.status as 'present' | 'absent',
        marked_by: profile.auth_id,
        marked_by_role_code: profile.role || 'admin',
        school_code: effectiveSchoolCode,
      }));

    if (records.length === 0) {
      Alert.alert('No Changes', 'Please mark attendance for at least one student before saving.');
      return;
    }

    // Double-check: all students should be marked at this point
    if (records.length !== attendanceData.length) {
      Alert.alert(
        'Validation Error',
        `Expected ${attendanceData.length} attendance records but only ${records.length} are valid. Please mark all students.`
      );
      return;
    }

    // Check for existing attendance conflicts
    const existingRecords = existingAttendance || [];
    const hasExistingAttendance = existingRecords.length > 0;
    const existingMarkedBy = existingRecords.length > 0 ? existingRecords[0].marked_by : null;
    const existingRole = existingRecords.length > 0 ? existingRecords[0].marked_by_role_code : null;
    const existingCreatedAt = existingRecords.length > 0 && existingRecords[0].created_at
      ? new Date(existingRecords[0].created_at)
      : null;
    const isMarkedByDifferentUser = hasExistingAttendance && existingMarkedBy !== profile.auth_id;

    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;

    // Build confirmation message
    let confirmMessage = `Save attendance for ${selectedDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })}?\n\n📊 All ${records.length} students marked\n✅ ${presentCount} Present\n❌ ${absentCount} Absent`;

    if (hasExistingAttendance) {
      const dateStr = existingCreatedAt
        ? existingCreatedAt.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
        : 'previously';

      if (isMarkedByDifferentUser) {
        confirmMessage += `\n\n⚠️ WARNING: Attendance was already marked by ${existingRole || 'another user'} on ${dateStr}.\n\nThis will overwrite the existing attendance.`;
      } else {
        confirmMessage += `\n\nℹ️ Attendance was previously marked on ${dateStr}.\n\nThis will update the existing records.`;
      }
    }

    Alert.alert(
      hasExistingAttendance ? (isMarkedByDifferentUser ? 'Overwrite Attendance?' : 'Update Attendance?') : 'Confirm Attendance',
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasExistingAttendance ? (isMarkedByDifferentUser ? 'Overwrite' : 'Update') : 'Save Attendance',
          style: isMarkedByDifferentUser ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const result = await markAttendanceMutation.mutateAsync(records);
              setHasChanges(false);
              setLastSavedAt(new Date());
              
              // Build success message with notification status
              let message = `Attendance saved for ${records.length} students.`;
              
              if (result?.notifications) {
                if (result.notifications.sent) {
                  const total = result.notifications.presentCount + result.notifications.absentCount;
                  if (total > 0) {
                    message += `\n\n📱 Notifications sent to ${total} student${total !== 1 ? 's' : ''}.`;
                  }
                } else if (result.notifications.error) {
                  message += `\n\n⚠️ Notifications failed: ${result.notifications.error}`;
                }
              }
              
              Alert.alert('✅ Success', message);
            } catch (error) {
              Alert.alert('Error', 'Failed to save attendance. Please check your connection and try again.');
            }
          }
        }
      ]
    );
  };

  const handleResetAll = useCallback(() => {
    Alert.alert(
      'Reset Attendance',
      'Are you sure you want to clear all attendance marks for this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const newAttendance = attendanceData.map(s => ({
              ...s,
              status: null as AttendanceStatus
            }));
            setAttendanceData(newAttendance);
            setHasChanges(true);
          }
        }
      ]
    );
  }, [attendanceData]);

  const handleBulkMark = (status: 'present' | 'absent') => {
    if (!selectedClass?.id || !effectiveSchoolCode || !profile?.auth_id) {
      Alert.alert('Error', 'Please select a class and ensure you are logged in');
      return;
    }

    // Update local state - user will submit via Save button
    setAttendanceData(prev => prev.map(student => ({ ...student, status })));
    setHasChanges(true);
  };

  // Users who can only view their own attendance see the student view
  if (canReadOwnAttendance) {
    return <StudentAttendanceView />;
  }

  // Three-state handling for admin/teacher view
  const isLoading = studentsLoading || attendanceLoading;
  const hasError = studentsError || attendanceError;
  const hasData = students && students.length > 0;

  if (isLoading && !hasData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>
          Loading attendance data...
        </Text>
      </View>
    );
  }

  if (hasError && !isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.lg }]}>
        <MaterialIcons name="error" size={48} color={colors.error[600]} />
        <Text style={{ marginTop: spacing.md, color: colors.error.main, textAlign: 'center' }}>
          Failed to load attendance data
        </Text>
        <Text style={{ marginTop: spacing.sm, color: colors.text.secondary, textAlign: 'center', fontSize: typography.fontSize.sm }}>
          {studentsError?.message || attendanceError?.message || 'Please check your connection and try again'}
        </Text>
      </View>
    );
  }

  if (!selectedClass) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="group" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>Please select a class to view attendance</Text>
          <TouchableOpacity
            onPress={() => bottomSheetRef.current?.present()}
            activeOpacity={0.7}
            style={{
              marginTop: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.primary[50],
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: borderRadius.lg,
              borderWidth: 1,
              borderColor: colors.primary[200],
            }}
          >
            <MaterialIcons name="class" size={20} color={colors.primary[600]} />
            <Text style={{ fontSize: 15, fontWeight: typography.fontWeight.semibold, color: colors.primary[600] }}>
              Select Class
            </Text>
          </TouchableOpacity>
        </View>

        <BottomSheetModal
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
        >
          <BottomSheetScrollView
            contentContainerStyle={styles.bottomSheetContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.bottomSheetTitle}>Select Class ({classes?.length || 0} available)</Text>
            {classes && classes.length > 0 ? classes.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                onPress={() => {
                  setSelectedClass(cls as any);
                  setHasChanges(true);
                  bottomSheetRef.current?.dismiss();
                }}
                style={styles.bottomSheetItem}
                activeOpacity={0.7}
              >
                <Text style={styles.bottomSheetItemText}>
                  Grade {cls.grade} - Section {cls.section}
                </Text>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No classes available</Text>
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheetModal>
      </View>
    );
  }

  if (!hasData && !isLoading && !hasError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.lg }]}>
        <MaterialIcons name="group" size={48} color={colors.text.tertiary} />
        <Text style={{ marginTop: spacing.md, color: colors.text.secondary, textAlign: 'center' }}>
          No students found
        </Text>
        <Text style={{ marginTop: spacing.sm, color: colors.text.tertiary, textAlign: 'center', fontSize: typography.fontSize.sm }}>
          Please select a class to mark attendance
        </Text>
      </View>
    );
  }

  const totalPresentDays = attendanceSummary.reduce((sum, s) => sum + s.presentDays, 0);
  const totalAbsentDays = attendanceSummary.reduce((sum, s) => sum + s.absentDays, 0);
  const totalDays = attendanceSummary.reduce((sum, s) => sum + s.totalDays, 0);

  const historyStats = {
    total: attendanceSummary.length,
    averageAttendance: totalDays > 0 ? Math.round((totalPresentDays / totalDays) * 100) : 0,
    averageAbsent: totalDays > 0 ? Math.round((totalAbsentDays / totalDays) * 100) : 0,
  };

  return (
    <View style={styles.container}>
      {canReadAllAttendance ? (
        <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm, gap: 8 }}>
          {/* Row 1: Class + Date selectors */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => bottomSheetRef.current?.present()}
              activeOpacity={0.7}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.surface.primary,
                borderRadius: borderRadius.lg,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: colors.border.light,
              }}
            >
              <MaterialIcons name="school" size={18} color={colors.primary.main} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: typography.fontWeight.semibold, color: colors.text.primary }} numberOfLines={1}>
                {selectedClass ? `Grade ${selectedClass.grade} - ${selectedClass.section}` : 'Select Class'}
              </Text>
              <MaterialIcons name="unfold-more" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>

            {activeTab === 'mark' ? (
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: colors.surface.primary,
                  borderRadius: borderRadius.lg,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: colors.border.light,
                }}
              >
                <MaterialIcons name="calendar-today" size={16} color={colors.primary.main} />
                <Text style={{ fontSize: 14, fontWeight: typography.fontWeight.medium, color: colors.text.primary }}>
                  {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.surface.primary,
                borderRadius: borderRadius.lg,
                paddingHorizontal: 10,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: colors.border.light,
              }}>
                <TouchableOpacity onPress={() => setShowHistoryStartDatePicker(true)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 13, fontWeight: typography.fontWeight.medium, color: colors.text.primary }}>
                    {historyStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: colors.text.tertiary, fontSize: 11 }}>-</Text>
                <TouchableOpacity onPress={() => setShowHistoryEndDatePicker(true)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 13, fontWeight: typography.fontWeight.medium, color: colors.text.primary }}>
                    {historyEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setActiveTab(activeTab === 'mark' ? 'history' : 'mark')}
              activeOpacity={0.7}
              style={{
                width: 42,
                height: 42,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: activeTab === 'history' ? colors.primary[50] : colors.surface.primary,
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: activeTab === 'history' ? colors.primary[200] : colors.border.light,
              }}
            >
              <MaterialIcons
                name={activeTab === 'mark' ? 'history' : 'edit-note'}
                size={20}
                color={activeTab === 'history' ? colors.primary.main : colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* Row 2: Progress (mark tab) or History stats */}
          {activeTab === 'mark' && attendanceData.length > 0 && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface.primary,
              borderRadius: borderRadius.lg,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: colors.border.light,
              gap: 12,
            }}>
              {/* Progress bar */}
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100], overflow: 'hidden', flexDirection: 'row' }}>
                {completionStats.present > 0 && <View style={{ width: `${(completionStats.present / completionStats.total) * 100}%`, height: '100%', backgroundColor: colors.success[500], borderRadius: 3 }} />}
                {completionStats.absent > 0 && <View style={{ width: `${(completionStats.absent / completionStats.total) * 100}%`, height: '100%', backgroundColor: colors.error[500] }} />}
              </View>
              {/* Compact stats */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>
                  {completionStats.marked}<Text style={{ color: colors.text.tertiary, fontWeight: typography.fontWeight.medium }}>/{completionStats.total}</Text>
                </Text>
                {completionStats.present > 0 && <Text style={{ fontSize: 12, color: colors.success[600], fontWeight: typography.fontWeight.bold }}>{completionStats.present}P</Text>}
                {completionStats.absent > 0 && <Text style={{ fontSize: 12, color: colors.error[600], fontWeight: typography.fontWeight.bold }}>{completionStats.absent}A</Text>}
              </View>
            </View>
          )}

          {activeTab === 'history' && (
            <View style={{
              flexDirection: 'row',
              backgroundColor: colors.surface.primary,
              borderRadius: borderRadius.lg,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border.light,
              gap: 16,
            }}>
              <View style={{ alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border.light, paddingRight: 16 }}>
                <Text style={{ fontSize: 24, fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>{historyStats.total}</Text>
                <Text style={{ fontSize: 10, fontWeight: typography.fontWeight.bold, color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Students</Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: typography.fontWeight.bold, color: colors.success[600] }}>{historyStats.averageAttendance}%</Text>
                  <Text style={{ fontSize: 10, color: colors.text.tertiary, fontWeight: typography.fontWeight.medium }}>Present</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: typography.fontWeight.bold, color: colors.error[600] }}>{historyStats.averageAbsent}%</Text>
                  <Text style={{ fontSize: 10, color: colors.text.tertiary, fontWeight: typography.fontWeight.medium }}>Absent</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.dashboardCard}>
          <View style={styles.headerRow}>
            {/* Unified Filter Bar (Read Only) */}
            <View style={styles.filterBar}>
              {/* Class Selector */}
              <View style={styles.classSelector}>
                <MaterialIcons name="group" size={16} color={colors.text.secondary} />
                <Text style={styles.classTitle} numberOfLines={1} ellipsizeMode="tail">
                  {selectedClass ? `${selectedClass.grade} - ${selectedClass.section}` : 'Select Class'}
                </Text>
              </View>

              <View style={styles.headerDivider} />

              {/* Date Range Selector */}
              {/* Date Range Selector */}
              <View style={styles.dateSelector}>
                <TouchableOpacity
                  onPress={() => setShowHistoryStartDatePicker(true)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <MaterialIcons name="event" size={16} color={colors.text.secondary} />
                  <Text style={styles.dateText}>
                    {historyStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>

                <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>→</Text>

                <TouchableOpacity
                  onPress={() => setShowHistoryStartDatePicker(true)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  {/* Note: In read-only mode, maybe we only allow changing start? Or maybe both? 
                       The previous code only called setShowHistoryStartDatePicker. 
                       I will stick to the previous behavior but split the UI, 
                       OR enable end date picking if appropriate. 
                       Actually, the read-only block had `setShowHistoryStartDatePicker` for the whole range.
                       I will enable both for consistency since the modals exist.
                   */}
                  <Text style={styles.dateText}>
                    {historyEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.headerSeparator} />
        </View>
      )}

      {activeTab === 'mark' ? (
        <View style={styles.studentsSection}>
          {/* Holiday state — replaces entire student list when date is a holiday */}
          {isHoliday && (
            <View style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.xl * 2,
            }}>
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: isDark ? 'rgba(250,173,20,0.15)' : '#fffbe6',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: spacing.lg,
              }}>
                <MaterialIcons name="celebration" size={36} color="#d48806" />
              </View>
              <Text style={{
                fontSize: typography.fontSize.xl,
                fontWeight: typography.fontWeight.bold,
                color: colors.text.primary,
                textAlign: 'center',
                marginBottom: spacing.xs,
              }}>
                {holidayInfo?.title || 'School Holiday'}
              </Text>
              <Text style={{
                fontSize: typography.fontSize.sm,
                color: colors.text.secondary,
                textAlign: 'center',
                marginBottom: spacing.sm,
              }}>
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: isDark ? 'rgba(250,173,20,0.1)' : '#fffbe6',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.full,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(250,173,20,0.2)' : '#ffe58f',
              }}>
                <MaterialIcons name="event-busy" size={16} color="#d48806" />
                <Text style={{ fontSize: 13, fontWeight: typography.fontWeight.semibold, color: '#d48806' }}>
                  No attendance required
                </Text>
              </View>

              {selectedClass && (
                <Text style={{
                  fontSize: typography.fontSize.xs,
                  color: colors.text.tertiary,
                  textAlign: 'center',
                  marginTop: spacing.lg,
                }}>
                  {selectedClass.grade} - {selectedClass.section} · {attendanceData.length} students
                </Text>
              )}
            </View>
          )}

          {/* ── Toolbar: Search + filters + quick actions ── */}
          {attendanceData.length > 0 && !isHoliday && (
            <View style={{ paddingHorizontal: spacing.sm, paddingTop: 6, paddingBottom: 4, gap: 8 }}>
              {/* Search row */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
                borderRadius: borderRadius.full,
                paddingHorizontal: 12, height: 40,
              }}>
                <MaterialIcons name="search" size={18} color={colors.text.tertiary} />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: colors.text.primary, marginLeft: 8, paddingVertical: 0 }}
                  placeholder="Search students..."
                  placeholderTextColor={colors.text.tertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                    <MaterialIcons name="close" size={16} color={colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter tabs - inline segmented style */}
              <View style={{
                flexDirection: 'row',
                backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
                borderRadius: borderRadius.full,
                padding: 3,
              }}>
                {(['all', 'absent', 'unmarked'] as const).map((mode) => {
                  const isActive = filterMode === mode;
                  const count = mode === 'all' ? attendanceData.length : mode === 'absent' ? completionStats.absent : completionStats.unmarked;
                  const label = mode === 'all' ? 'All' : mode === 'absent' ? 'Absent' : 'Unmarked';
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setFilterMode(isActive ? 'all' : mode)}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        paddingVertical: 6,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        backgroundColor: isActive ? colors.surface.primary : 'transparent',
                        ...(isActive ? shadows.xs : {}),
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
                        color: isActive ? colors.text.primary : colors.text.tertiary,
                      }}>
                        {label} {count > 0 ? count : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.studentsList}>
            {studentsLoading || attendanceLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.main} />
                <Text style={styles.loadingText}>Loading students...</Text>
              </View>
            ) : studentsError || attendanceError ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Error loading data. Please try again.</Text>
              </View>
            ) : attendanceData.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="group" size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No students found in this class</Text>
              </View>
            ) : filteredAttendanceData.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="filter-list-off" size={36} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No students match current filter</Text>
                <TouchableOpacity
                  onPress={() => { setSearchQuery(''); setFilterMode('all'); }}
                  activeOpacity={0.7}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ fontSize: 13, color: colors.primary.main, fontWeight: typography.fontWeight.semibold }}>
                    Clear filters
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={filteredAttendanceData}
                renderItem={({ item: student }) => {
                  const status = student.status;
                  const isPresent = status === 'present';
                  const isAbsent = status === 'absent';
                  const isMarked = status !== null;

                  return (
                    <View style={[
                      styles.cardContainer,
                      isPresent && { backgroundColor: isDark ? 'rgba(34,197,94,0.06)' : '#f0fdf4' },
                      isAbsent && { backgroundColor: isDark ? 'rgba(239,68,68,0.06)' : '#fef2f2', borderLeftWidth: 3, borderLeftColor: colors.error[500] },
                    ]}>
                      {/* Student Info */}
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {student.studentName}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.text.tertiary, marginTop: 1 }}>
                          {student.studentCode}
                        </Text>
                      </View>

                      {/* Actions */}
                      {canMarkAttendance ? (
                        <View style={styles.cardActions}>
                          <TouchableOpacity
                            style={[
                              styles.actionButton,
                              styles.actionButtonPresent,
                              isPresent && styles.actionButtonPresentActive
                            ]}
                            onPress={() => handleStatusChange(student.studentId, 'present')}
                            activeOpacity={0.7}
                          >
                            {isPresent ? (
                              <MaterialIcons name="check" size={18} color="#fff" />
                            ) : (
                              <Text style={[styles.actionText, { color: colors.success[600] }]}>P</Text>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.actionButton,
                              styles.actionButtonAbsent,
                              isAbsent && styles.actionButtonAbsentActive
                            ]}
                            onPress={() => handleStatusChange(student.studentId, 'absent')}
                            activeOpacity={0.7}
                          >
                            {isAbsent ? (
                              <MaterialIcons name="close" size={18} color="#fff" />
                            ) : (
                              <Text style={[styles.actionText, { color: colors.error[600] }]}>A</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.cardStatusContainer}>
                          {isPresent && (
                            <View style={[styles.statusBadge, styles.statusBadgePresent]}>
                              <MaterialIcons name="check-circle" size={14} color={colors.success[700]} />
                              <Text style={[styles.statusBadgeText, { color: colors.success[700] }]}>Present</Text>
                            </View>
                          )}
                          {isAbsent && (
                            <View style={[styles.statusBadge, styles.statusBadgeAbsent]}>
                              <MaterialIcons name="cancel" size={14} color={colors.error[700]} />
                              <Text style={[styles.statusBadgeText, { color: colors.error[700] }]}>Absent</Text>
                            </View>
                          )}
                          {!isMarked && (
                            <View style={[styles.statusBadge, styles.statusBadgePending]}>
                              <Text style={[styles.statusBadgeText, { color: colors.text.tertiary }]}>--</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                }}
                keyExtractor={(item) => item.studentId}
                removeClippedSubviews={true}
                initialNumToRender={20}
                maxToRenderPerBatch={15}
                windowSize={12}
                contentContainerStyle={styles.flatListContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border.light, marginHorizontal: 4 }} />}
              />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.historyContainer}>
          {canReadOwnAttendance ? (
            <StudentAttendanceView />
          ) : (
            !selectedClass ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="group" size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>Please select a class to view attendance history</Text>
              </View>
            ) : (
              <View style={styles.summaryContainer}>
                {summaryLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary.main} />
                    <Text style={styles.loadingText}>Loading history...</Text>
                  </View>
                ) : attendanceSummary.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No attendance records found for this period</Text>
                  </View>
                ) : (
                  <FlatList
                    data={attendanceSummary}
                    renderItem={({ item: student }) => {
                      const percentage = student.percentage;
                      let statusColor = colors.success[600];
                      let statusBg = isDark ? 'rgba(34, 197, 94, 0.1)' : colors.success[50];

                      if (percentage < 50) {
                        statusColor = colors.error[600];
                        statusBg = isDark ? 'rgba(239, 68, 68, 0.1)' : colors.error[50];
                      } else if (percentage < 75) {
                        statusColor = colors.warning[600];
                        statusBg = isDark ? 'rgba(234, 179, 8, 0.1)' : colors.warning[50];
                      }

                      return (
                        <View style={styles.historyCard}>
                          <View style={styles.historyInfo}>
                            <Text style={styles.historyName}>{student.studentName}</Text>
                            <Text style={styles.historyCode}>{student.studentCode}</Text>
                          </View>

                          <View style={styles.historyStatsRight}>
                            <View style={[styles.historyBadge, { backgroundColor: statusBg }]}>
                              <Text style={[styles.historyPercentage, { color: statusColor }]}>
                                {percentage.toFixed(0)}%
                              </Text>
                            </View>
                            <Text style={styles.historyCountText}>
                              {student.presentDays}/{student.totalDays} Days
                            </Text>
                          </View>
                        </View>
                      );
                    }}
                    keyExtractor={(item) => item.studentId}
                    contentContainerStyle={styles.historyListContent}
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </View>
            )
          )}
        </View>
      )}


      <BottomSheetModal
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.bottomSheetContent}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.bottomSheetTitle}>Select Class ({classes?.length || 0} available)</Text>
          {classes && classes.length > 0 ? classes.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              onPress={() => {
                setSelectedClass(cls as any);
                setHasChanges(true);
                bottomSheetRef.current?.dismiss();
              }}
              style={[
                styles.bottomSheetItem,
                selectedClass?.id === cls.id && styles.bottomSheetItemSelected
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.bottomSheetItemText,
                selectedClass?.id === cls.id && styles.bottomSheetItemTextSelected
              ]}>
                Grade {cls.grade} - Section {cls.section}
              </Text>
              {selectedClass?.id === cls.id && (
                <Text style={styles.bottomSheetItemCheck}>✓</Text>
              )}
            </TouchableOpacity>
          )) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No classes available</Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      <DatePickerModal
        visible={showDatePicker}
        onDismiss={handleDateCancel}
        onConfirm={handleDateConfirm}
        initialDate={selectedDate}
        minimumDate={new Date(2020, 0, 1)}
        maximumDate={new Date(2030, 11, 31)}
      />

      <DatePickerModal
        visible={showHistoryStartDatePicker}
        onDismiss={() => setShowHistoryStartDatePicker(false)}
        onConfirm={(date) => {
          setHistoryStartDate(date);
          setShowHistoryStartDatePicker(false);
        }}
        initialDate={historyStartDate}
        minimumDate={new Date(2020, 0, 1)}
        maximumDate={new Date(2030, 11, 31)}
        title="Select Start Date"
      />

      <DatePickerModal
        visible={showHistoryEndDatePicker}
        onDismiss={() => setShowHistoryEndDatePicker(false)}
        onConfirm={(date) => {
          setHistoryEndDate(date);
          setShowHistoryEndDatePicker(false);
        }}
        initialDate={historyEndDate}
        minimumDate={new Date(2020, 0, 1)}
        maximumDate={new Date(2030, 11, 31)}
        title="Select End Date"
      />

      {/* ── Sticky bottom bar ── */}
      {canMarkAttendance && activeTab === 'mark' && !isHoliday && attendanceData.length > 0 && (
        <View style={styles.saveButtonContainer}>
          {/* Unmarked warning */}
          {hasChanges && completionStats.unmarked > 0 && (
            <View style={styles.warningBanner}>
              <MaterialIcons name="info-outline" size={12} color={colors.warning[700]} />
              <Text style={styles.warningText}>
                {completionStats.unmarked} student{completionStats.unmarked !== 1 ? 's' : ''} unmarked
              </Text>
            </View>
          )}

          {/* Saved confirmation */}
          {!hasChanges && lastSavedAt && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 8,
            }}>
              <MaterialIcons name="cloud-done" size={14} color={colors.success[600]} />
              <Text style={{ fontSize: 12, fontWeight: typography.fontWeight.semibold, color: colors.success[700] }}>
                Saved {lastSavedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                · {completionStats.present}P / {completionStats.absent}A
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Quick Actions */}
            {canBulkMark && (
              <View style={{ flex: 1 }}>
                <Menu
                  visible={quickActionsVisible}
                  onDismiss={() => setQuickActionsVisible(false)}
                  anchor={
                    <TouchableOpacity
                      onPress={() => setQuickActionsVisible(true)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 12,
                        borderRadius: borderRadius.lg,
                        borderWidth: 1,
                        borderColor: colors.border.DEFAULT,
                        backgroundColor: colors.surface.primary,
                      }}
                    >
                      <MaterialIcons name="bolt" size={18} color={colors.text.primary} />
                      <Text style={{ fontSize: 14, fontWeight: typography.fontWeight.semibold, color: colors.text.primary }}>Quick Actions</Text>
                    </TouchableOpacity>
                  }
                >
                  <Menu.Item title="Mark All Present" icon="check-circle" onPress={() => { setQuickActionsVisible(false); handleBulkMark('present'); }} />
                  <Menu.Item title="Mark All Absent" icon="cancel" destructive onPress={() => { setQuickActionsVisible(false); Alert.alert('Mark All Absent', `Mark all ${attendanceData.length} students as absent?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: 'destructive', onPress: () => handleBulkMark('absent') }]); }} />
                  <Menu.Item title="Reset All" icon="replay" onPress={() => { setQuickActionsVisible(false); handleResetAll(); }} />
                  {!holidayLoading && (<><Menu.Divider /><Menu.Item title="Mark Holiday" icon="celebration" onPress={() => { setQuickActionsVisible(false); handleMarkHoliday(); }} /></>)}
                </Menu>
              </View>
            )}

            {/* Save */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                { flex: 1 },
                !hasChanges && { opacity: 0.4 },
                markAttendanceMutation.isPending && styles.saveButtonDisabled,
                hasChanges && completionStats.percentage === 100 && { backgroundColor: colors.success[600] },
              ]}
              onPress={handleSave}
              disabled={markAttendanceMutation.isPending || !hasChanges}
              activeOpacity={0.8}
            >
              {markAttendanceMutation.isPending ? (
                <>
                  <ActivityIndicator size="small" color={colors.text.inverse} />
                  <Text style={styles.saveButtonText}>Saving...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name={hasChanges ? 'save' : 'check-circle'} size={16} color={colors.text.inverse} />
                  <Text style={styles.saveButtonText}>
                    {hasChanges ? `Save (${completionStats.marked}/${completionStats.total})` : 'Saved'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View >
  );
};

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
    backgroundColor: colors.background.secondary,
  },
  tabContainer: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface.primary,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    padding: 2,
    height: 32,
  },
  tabButton: {
    flex: 1,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.surface.primary,
    ...shadows.xs,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  tabButtonTextActive: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  // Filter Styles
  filterSection: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  filterIcon: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContent: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 9,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    fontWeight: typography.fontWeight.medium,
    marginBottom: 1,
  },
  filterValue: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.light,
  },

  // Students Header & List
  studentsSection: {
    flex: 1,
  },
  studentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(234, 179, 8, 0.1)' : colors.warning[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(234, 179, 8, 0.2)' : colors.warning[200],
  },
  changesBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    gap: 4,
  },
  bulkButtonPresent: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#ecfdf5',
    borderColor: colors.success[200],
  },
  bulkButtonAbsent: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
    borderColor: colors.error[200],
  },
  bulkButtonReset: {
    backgroundColor: isDark ? 'rgba(156, 163, 175, 0.1)' : colors.neutral[100],
    borderColor: colors.neutral[200],
  },
  bulkButtonText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
  },
  bulkButtonTextPresent: {
    color: colors.success[700],
  },
  bulkButtonTextAbsent: {
    color: colors.error[700],
  },
  bulkButtonTextReset: {
    color: colors.text.secondary,
  },

  // Dashboard Header Styles
  dashboardCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: 0,
    marginHorizontal: spacing.sm,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  // New Header Styles (Unified Filter Bar)
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  filterBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    height: 40,
    paddingHorizontal: 12,
  },
  classSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: '100%',
  },
  classTitle: {
    fontSize: 14,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flexShrink: 1,
  },

  headerDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.light,
    marginHorizontal: 12,
  },

  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: '100%',
  },
  dateText: {
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },

  historyToggleButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.full, // Circle button
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  // History Card Styles
  historyListContent: {
    paddingBottom: 80,
    paddingTop: 8,
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 8,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  historyInfo: {
    flex: 1,
    marginRight: 16,
  },
  historyName: {
    fontSize: 16,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  historyCode: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  historyStatsRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginBottom: 2,
  },
  historyPercentage: {
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
  },
  historyCountText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },

  headerSeparator: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: 8,
    marginHorizontal: -16,
  },

  // Dashboard Stats
  dashboardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statBigContainer: {
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border.light,
    paddingRight: 16,
  },
  statBigNumber: {
    fontSize: 32,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 36,
  },
  statBigLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statCircle: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },

  // Student Card Styles
  studentsList: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  cardContainer: {
    backgroundColor: colors.surface.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPresent: {
    backgroundColor: 'transparent',
    borderColor: isDark ? colors.success[700] : colors.success[300],
  },
  actionButtonPresentActive: {
    backgroundColor: colors.success[500],
    borderColor: colors.success[500],
  },
  actionButtonAbsent: {
    backgroundColor: 'transparent',
    borderColor: isDark ? colors.error[700] : colors.error[300],
  },
  actionButtonAbsentActive: {
    backgroundColor: colors.error[500],
    borderColor: colors.error[500],
  },
  actionText: {
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
  },

  // Keep original styles needed for bottom sheet, etc.
  flatListContent: {
    paddingBottom: 100,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 24, // Safety padding for bottom notch
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.sm,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning[50],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
    marginBottom: 6,
    gap: 4,
  },
  warningText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  saveButtonWarning: {
    backgroundColor: colors.warning.main,
  },
  saveButtonDisabled: {
    opacity: 0.6,
    backgroundColor: colors.neutral[400],
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  bottomSheetBackground: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.border.DEFAULT,
    width: 36,
    height: 4,
  },
  bottomSheetContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    marginBottom: 4, // Spacing between items
    // Removed bottom border for cleaner look
  },
  bottomSheetItemSelected: {
    backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
  },
  bottomSheetItemText: {
    fontSize: 16, // Larger text
    color: colors.text.primary,
    flex: 1,
    fontWeight: typography.fontWeight.medium,
  },
  bottomSheetItemTextSelected: {
    color: colors.primary.main,
    fontWeight: typography.fontWeight.bold,
  },
  bottomSheetItemCheck: {
    fontSize: 18,
    color: colors.primary.main,
    fontWeight: typography.fontWeight.bold,
  },
  emptyState: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  historyContainer: {
    paddingHorizontal: spacing.sm,
    flex: 1,
  },
  historyStats: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.xs,
  },
  historyStatCard: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  historyStatCardPresent: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.08)' : '#F0FDF4',
    borderColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#BBF7D0',
  },
  historyStatCardAbsent: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
    borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FECACA',
  },
  historyStatNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  historyStatLabel: {
    fontSize: 9,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  dateRangeContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dateRangeText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  summaryContainer: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  summaryList: {
    paddingBottom: 20,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  summaryStudentInfo: {
    flex: 1,
    minWidth: 0,
  },
  summaryStudentName: {
    fontSize: 13,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  summaryStudentCode: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  summaryStats: {
    alignItems: 'flex-end',
    gap: 3,
    marginLeft: 8,
  },
  summaryStatText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  summaryStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  summaryStatusGood: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : colors.success[100],
  },
  summaryStatusFair: {
    backgroundColor: isDark ? 'rgba(234, 179, 8, 0.15)' : colors.warning[100],
  },
  summaryStatusLow: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : colors.error[100],
  },
  summaryStatusText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  summaryStatusTextGood: {
    color: colors.success[700],
  },
  summaryStatusTextFair: {
    color: colors.warning[800],
  },
  summaryStatusTextLow: {
    color: colors.error[700],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  cardStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
    borderWidth: 1,
  },
  statusBadgePresent: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#ecfdf5',
    borderColor: isDark ? 'rgba(34, 197, 94, 0.2)' : colors.success[200],
  },
  statusBadgeAbsent: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
    borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : colors.error[200],
  },
  statusBadgePending: {
    backgroundColor: colors.background.tertiary,
    borderColor: colors.border.light,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.medium,
  },
});
