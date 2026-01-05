/**
 * AttendanceScreen
 * 
 * Refactored to use centralized design system with dynamic theming.
 * All styling now uses theme tokens via useTheme hook.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Text, SegmentedButtons, ActivityIndicator } from 'react-native-paper';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Save, 
  ChevronDown,
  Circle,
  AlertCircle
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useClassSelection } from '../../contexts/ClassSelectionContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { DatePickerModal } from '../common/DatePickerModal';
import { useStudents } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { useClassAttendance, useMarkAttendance, useMarkBulkAttendance, useClassAttendanceSummary } from '../../hooks/useAttendance';
import { AttendanceInput } from '../../services/api';
import { StudentAttendanceView } from './StudentAttendanceView';

type AttendanceStatus = 'present' | 'absent' | null;

interface StudentAttendanceData {
  studentId: string;
  studentName: string;
  studentCode: string;
  status: AttendanceStatus;
}

export const AttendanceScreen: React.FC = () => {
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
  const { selectedClass, scope, setSelectedClass } = useClassSelection();
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

  const { data: classes = [] } = useClasses(canReadAllAttendance ? (scope.school_code ?? undefined) : undefined);
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
    } else {
      setAttendanceData([]);
    }
  }, [students, existingAttendance, dateString, canReadAllAttendance]);

  const handleDateConfirm = useCallback((date: Date) => {
    if (!canMarkAttendance) return;
    setSelectedDate(date);
    setHasChanges(true);
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
        marked_by_role_code: profile.role || 'unknown',
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
              await markAttendanceMutation.mutateAsync(records);
              setHasChanges(false);
              Alert.alert('✅ Success', `Attendance saved successfully for all ${records.length} students.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to save attendance. Please check your connection and try again.');
            }
          }
        }
      ]
    );
  };

  const handleBulkMark = async (status: 'present' | 'absent') => {
    if (!selectedClass?.id || !effectiveSchoolCode || !profile?.auth_id) {
      Alert.alert('Error', 'Please select a class and ensure you are logged in');
      return;
    }

    const statusText = status === 'present' ? 'Present' : 'Absent';
    const studentCount = students.length;

    // Check for existing attendance conflicts
    const existingRecords = existingAttendance || [];
    const hasExistingAttendance = existingRecords.length > 0;
    const existingMarkedBy = existingRecords.length > 0 ? existingRecords[0].marked_by : null;
    const existingRole = existingRecords.length > 0 ? existingRecords[0].marked_by_role_code : null;
    const existingCreatedAt = existingRecords.length > 0 && existingRecords[0].created_at 
      ? new Date(existingRecords[0].created_at) 
      : null;
    const isMarkedByDifferentUser = hasExistingAttendance && existingMarkedBy !== profile.auth_id;

    let confirmMessage = `Are you sure you want to mark all ${studentCount} students as ${statusText.toLowerCase()}?`;

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
        confirmMessage += `\n\n⚠️ WARNING: Attendance was already marked by ${existingRole || 'another user'} on ${dateStr}.\n\nThis will overwrite the existing attendance for all students.`;
      } else {
        confirmMessage += `\n\nℹ️ Attendance was previously marked on ${dateStr}.\n\nThis will update all existing records.`;
      }
    }

    Alert.alert(
      hasExistingAttendance ? (isMarkedByDifferentUser ? `Overwrite All as ${statusText}?` : `Update All as ${statusText}?`) : `Mark All ${statusText}?`,
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasExistingAttendance ? (isMarkedByDifferentUser ? `Overwrite All ${statusText}` : `Update All ${statusText}`) : `Yes, Mark All ${statusText}`,
          style: isMarkedByDifferentUser ? 'destructive' : (status === 'present' ? 'default' : 'destructive'),
          onPress: async () => {
            try {
              setAttendanceData(prev => prev.map(student => ({ ...student, status })));
              setHasChanges(true);

              await markBulkAttendanceMutation.mutateAsync({
                classId: selectedClass.id,
                date: dateString,
                status,
                markedBy: profile.auth_id,
                markedByRoleCode: profile.role || 'unknown',
                schoolCode: effectiveSchoolCode,
              });
              
              Alert.alert('✅ Success', `All ${studentCount} students have been marked as ${statusText.toLowerCase()}.`);
            } catch (error) {
              setAttendanceData(prev => {
                return prev.map(student => {
                  const existing = existingAttendance.find(a => a.student_id === student.studentId);
                  const normalizedStatus: AttendanceStatus = existing?.status === 'present' || existing?.status === 'absent' 
                    ? existing.status 
                    : null;
                  return { ...student, status: normalizedStatus };
                });
              });
              setHasChanges(false);
              Alert.alert('Error', 'Failed to mark bulk attendance. Please try again.');
            }
          }
        }
      ]
    );
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
        <AlertCircle size={48} color={colors.error[600]} />
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
      <View style={styles.emptyContainer}>
        <Users size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>Please select a class to view attendance</Text>
      </View>
    );
  }

  if (!hasData && !isLoading && !hasError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.lg }]}>
        <Users size={48} color={colors.text.tertiary} />
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
      {canReadAllAttendance && (
        <View style={styles.tabContainer}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'mark' | 'history')}
            buttons={[
              { value: 'mark', label: 'Mark Attendance' },
              { value: 'history', label: 'View History' },
            ]}
            style={styles.tabSwitcher}
          />
        </View>
      )}

      {canReadAllAttendance && (
        <View style={styles.filterSection}>
          {activeTab === 'mark' ? (
            <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.filterItem}
              onPress={() => bottomSheetRef.current?.present()}
            >
              <View style={styles.filterIcon}>
                <Users size={14} color={colors.primary[600]} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterLabel}>Class</Text>
                <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                  {selectedClass ? `${selectedClass.grade} ${selectedClass.section}` : 'Select'}
                </Text>
              </View>
              <ChevronDown size={14} color={colors.text.secondary} style={{ marginLeft: spacing.xs, flexShrink: 0 }} />
            </TouchableOpacity>

            <View style={styles.filterDivider} />

            <TouchableOpacity 
              style={styles.filterItem}
                onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.filterIcon}>
              <Calendar size={14} color={colors.primary[600]} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterLabel}>Date</Text>
                <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                    {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.filterItem}
              onPress={() => bottomSheetRef.current?.present()}
            >
              <View style={styles.filterIcon}>
                <Users size={14} color={colors.primary[600]} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterLabel}>Class</Text>
                <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                  {selectedClass ? `${selectedClass.grade} ${selectedClass.section}` : 'Select'}
                </Text>
              </View>
              <ChevronDown size={14} color={colors.text.secondary} style={{ marginLeft: spacing.xs, flexShrink: 0 }} />
            </TouchableOpacity>

            <View style={styles.filterDivider} />

            <TouchableOpacity 
              style={styles.filterItem}
              onPress={() => setShowHistoryStartDatePicker(true)}
            >
              <View style={styles.filterIcon}>
              <Calendar size={14} color={colors.primary[600]} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterLabel}>Start</Text>
                <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                    {historyStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.filterDivider} />

            <TouchableOpacity 
              style={styles.filterItem}
              onPress={() => setShowHistoryEndDatePicker(true)}
            >
              <View style={styles.filterIcon}>
              <Calendar size={14} color={colors.primary[600]} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterLabel}>End</Text>
                <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                    {historyEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          )}
        </View>
      )}

      {activeTab === 'mark' ? (
        <View style={styles.studentsSection}>
          {/* Statistics Cards */}
          <View style={styles.markStatsContainer}>
            <View style={styles.markStatCard}>
              <Text style={styles.markStatNumber}>{attendanceData?.length || 0}</Text>
              <Text style={styles.markStatLabel}>Students</Text>
            </View>
            <View style={[styles.markStatCard, styles.markStatCardPresent]}>
              <Text style={[styles.markStatNumber, { color: colors.success[600] }]}>
                {attendanceData?.length > 0 
                  ? Math.round((attendanceData.filter(s => s.status === 'present').length / attendanceData.length) * 100)
                  : 0}%
              </Text>
              <Text style={styles.markStatLabel}>Present</Text>
            </View>
            <View style={[styles.markStatCard, styles.markStatCardAbsent]}>
              <Text style={[styles.markStatNumber, { color: colors.error[600] }]}>
                {attendanceData?.length > 0 
                  ? Math.round((attendanceData.filter(s => s.status === 'absent').length / attendanceData.length) * 100)
                  : 0}%
              </Text>
              <Text style={styles.markStatLabel}>Absent</Text>
            </View>
          </View>

          <View style={styles.studentsHeader}>
            <View>
              <Text style={styles.sectionTitle}>Students</Text>
              <Text style={styles.studentsSubtitle}>
                {attendanceData?.filter(s => s.status === null).length || 0} unmarked
              </Text>
            </View>
            <View style={styles.headerActions}>
              {hasChanges && (
                <View style={styles.changesBadge}>
                  <Text style={styles.changesBadgeText}>Unsaved</Text>
                </View>
              )}
              {canBulkMark && attendanceData.length > 0 && (
                <View style={styles.bulkActions}>
                  <TouchableOpacity
                    style={[styles.bulkButton, styles.bulkButtonPresent]}
                    onPress={() => handleBulkMark('present')}
                    activeOpacity={0.7}
                  >
                    <CheckCircle size={16} color={colors.success[700]} />
                    <Text style={[styles.bulkButtonText, styles.bulkButtonTextPresent]}>
                      All Present
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bulkButton, styles.bulkButtonAbsent]}
                    onPress={() => handleBulkMark('absent')}
                    activeOpacity={0.7}
                  >
                    <XCircle size={16} color={colors.error[700]} />
                    <Text style={[styles.bulkButtonText, styles.bulkButtonTextAbsent]}>
                      All Absent
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

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
                <Users size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No students found in this class</Text>
              </View>
            ) : (
              <FlatList
                data={attendanceData}
                renderItem={({ item: student }) => {
                  const status = student.status;
                  const isPresent = status === 'present';
                  const isAbsent = status === 'absent';
                  const isMarked = status !== null;
                  
                  const cardStyle = isPresent 
                    ? styles.studentCardPresent 
                    : isAbsent 
                    ? styles.studentCardAbsent 
                    : styles.studentCardUnmarked;
                  
                  const presentButtonStyle = isPresent 
                    ? styles.statusButtonActivePresent 
                    : !isMarked 
                    ? styles.statusButtonUnmarked 
                    : null;
                  
                  const absentButtonStyle = isAbsent 
                    ? styles.statusButtonActiveAbsent 
                    : !isMarked 
                    ? styles.statusButtonUnmarked 
                    : null;
                  
                  return (
                    <View style={[styles.studentCard, cardStyle]}>
                      <View style={styles.studentInfo}>
                        <View style={styles.studentNameRow}>
                          <Text style={styles.studentName}>{student.studentName}</Text>
                          {isMarked && (
                            <View style={[
                              styles.statusBadge,
                              isPresent ? styles.statusBadgePresent : styles.statusBadgeAbsent
                            ]}>
                              {isPresent ? (
                                <CheckCircle size={12} color={colors.success[600]} />
                              ) : (
                                <XCircle size={12} color={colors.error[600]} />
                              )}
                              <Text style={[
                                styles.statusBadgeText,
                                isPresent ? styles.statusBadgeTextPresent : styles.statusBadgeTextAbsent
                              ]}>
                                {isPresent ? 'Present' : 'Absent'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.studentCode}>{student.studentCode}</Text>
                      </View>
                      
                      {canMarkAttendance && (
                        <View style={styles.statusButtons}>
                          <TouchableOpacity
                            style={[styles.statusButton, presentButtonStyle]}
                            onPress={() => handleStatusChange(student.studentId, 'present')}
                            activeOpacity={0.6}
                          >
                            <CheckCircle 
                              size={18} 
                              color={isPresent ? colors.success[600] : colors.text.tertiary} 
                            />
                            <Text style={[
                              styles.statusButtonText,
                              isPresent && styles.statusButtonTextActivePresent,
                              !isMarked && styles.statusButtonTextUnmarked
                            ]}>
                              Present
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.statusButton, absentButtonStyle]}
                            onPress={() => handleStatusChange(student.studentId, 'absent')}
                            activeOpacity={0.6}
                          >
                            <XCircle 
                              size={18} 
                              color={isAbsent ? colors.error[600] : colors.text.tertiary} 
                            />
                            <Text style={[
                              styles.statusButtonText,
                              isAbsent && styles.statusButtonTextActiveAbsent,
                              !isMarked && styles.statusButtonTextUnmarked
                            ]}>
                              Absent
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                }}
                keyExtractor={(item) => item.studentId}
                removeClippedSubviews={true}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={10}
                contentContainerStyle={styles.flatListContent}
                showsVerticalScrollIndicator={false}
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
                  <Users size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyText}>Please select a class to view attendance history</Text>
                </View>
              ) : (
                <>
                  {/* Statistics Cards */}
                  <View style={styles.historyStats}>
                    <View style={styles.historyStatCard}>
                      <Text style={styles.historyStatNumber}>{historyStats.total}</Text>
                      <Text style={styles.historyStatLabel}>Students</Text>
                    </View>
                    <View style={[styles.historyStatCard, styles.historyStatCardPresent]}>
                      <Text style={[styles.historyStatNumber, { color: colors.success[600] }]}>
                        {historyStats.averageAttendance}%
                      </Text>
                      <Text style={styles.historyStatLabel}>Present</Text>
                    </View>
                    <View style={[styles.historyStatCard, styles.historyStatCardAbsent]}>
                      <Text style={[styles.historyStatNumber, { color: colors.error[600] }]}>
                        {historyStats.averageAbsent}%
                      </Text>
                      <Text style={styles.historyStatLabel}>Absent</Text>
                    </View>
                  </View>

                  {/* Date Range Display */}
                  <View style={styles.dateRangeContainer}>
                    <Text style={styles.dateRangeText}>
                      {historyStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {historyEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>

                  <View style={styles.summaryContainer}>
                    <Text style={styles.summaryTitle}>Student Summary</Text>
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
                        renderItem={({ item: student }) => (
                          <View style={styles.summaryItem}>
                            <View style={styles.summaryStudentInfo}>
                              <Text style={styles.summaryStudentName}>{student.studentName}</Text>
                              <Text style={styles.summaryStudentCode}>{student.studentCode}</Text>
                            </View>
                            <View style={styles.summaryStats}>
                              <Text style={styles.summaryStatText}>
                                {student.presentDays} / {student.totalDays} ({student.percentage.toFixed(0)}%)
                              </Text>
                              <View style={[
                                styles.summaryStatus,
                                student.percentage >= 75 ? styles.summaryStatusGood :
                                student.percentage >= 50 ? styles.summaryStatusFair :
                                styles.summaryStatusLow
                              ]}>
                                <Text style={[
                                  styles.summaryStatusText,
                                  student.percentage >= 75 ? styles.summaryStatusTextGood :
                                  student.percentage >= 50 ? styles.summaryStatusTextFair :
                                  styles.summaryStatusTextLow
                                ]}>
                                  {student.percentage >= 75 ? 'Good' : student.percentage >= 50 ? 'Fair' : 'Low'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}
                        keyExtractor={(item) => item.studentId}
                        removeClippedSubviews={true}
                        initialNumToRender={15}
                        maxToRenderPerBatch={10}
                        windowSize={10}
                        contentContainerStyle={styles.summaryList}
                        showsVerticalScrollIndicator={false}
                      />
                    )}
                  </View>
                </>
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

      {hasChanges && canMarkAttendance && (
        <View style={styles.saveButtonContainer}>
          {attendanceData.length > 0 && attendanceData.filter(s => s.status === null).length > 0 && (
            <View style={styles.warningBanner}>
              <AlertCircle size={16} color={colors.warning[700]} />
              <Text style={styles.warningText}>
                {attendanceData.filter(s => s.status === null).length} student{attendanceData.filter(s => s.status === null).length > 1 ? 's' : ''} unmarked
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.saveButton,
              markAttendanceMutation.isPending && styles.saveButtonDisabled,
              attendanceData.length > 0 && attendanceData.filter(s => s.status === null).length > 0 && styles.saveButtonWarning
            ]}
            onPress={handleSave}
            disabled={markAttendanceMutation.isPending}
            activeOpacity={0.8}
          >
            {markAttendanceMutation.isPending ? (
              <>
                <ActivityIndicator size="small" color={colors.text.inverse} />
                <Text style={styles.saveButtonText}>Saving...</Text>
              </>
            ) : (
              <>
                <Save size={20} color={colors.text.inverse} />
                <Text style={styles.saveButtonText}>
                  Save Attendance ({attendanceData.filter(s => s.status !== null).length}/{attendanceData.length})
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface.primary,
  },
  tabSwitcher: {
    backgroundColor: colors.background.secondary,
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  filterRow: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.xs,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  filterItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
  },
  filterIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  filterContent: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  filterLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  filterValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  filterDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.DEFAULT,
    marginHorizontal: spacing.sm,
    flexShrink: 0,
  },
  studentsSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flex: 1,
  },
  markStatsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  markStatCard: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  markStatCardPresent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success[500],
  },
  markStatCardAbsent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error[500],
  },
  markStatNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  markStatLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  studentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  studentsSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  changesBadge: {
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.warning.main,
  },
  changesBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  bulkActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
  },
  bulkButtonPresent: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[300],
  },
  bulkButtonAbsent: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[300],
  },
  bulkButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  bulkButtonTextPresent: {
    color: colors.success[700],
  },
  bulkButtonTextAbsent: {
    color: colors.error[700],
  },
  flatListContent: {
    paddingBottom: spacing.xl,
  },
  studentsList: {
    flex: 1,
  },
  studentCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
    minHeight: 72,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  studentCardUnmarked: {
    backgroundColor: colors.surface.primary,
    borderColor: colors.border.light,
  },
  studentCardPresent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success[500],
    backgroundColor: colors.surface.primary,
  },
  studentCardAbsent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error[500],
    backgroundColor: colors.surface.primary,
  },
  studentInfo: {
    flex: 1,
    marginRight: spacing.md,
    minWidth: 0,
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
    flexWrap: 'wrap',
    flex: 1,
  },
  studentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
    flexShrink: 0,
  },
  statusBadgePresent: {
    backgroundColor: colors.success[50],
  },
  statusBadgeAbsent: {
    backgroundColor: colors.error[50],
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  statusBadgeTextPresent: {
    color: colors.success[700],
  },
  statusBadgeTextAbsent: {
    color: colors.error[700],
  },
  studentCode: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flexShrink: 1,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexShrink: 0,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.primary,
    gap: spacing.xs,
    minWidth: 80,
    justifyContent: 'center',
  },
  statusButtonUnmarked: {
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  statusButtonActivePresent: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[300],
  },
  statusButtonActiveAbsent: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[300],
  },
  statusButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  statusButtonTextUnmarked: {
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  statusButtonTextActivePresent: {
    color: colors.success[700],
  },
  statusButtonTextActiveAbsent: {
    color: colors.error[700],
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.lg,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.warning[300],
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
    ...shadows.md,
  },
  saveButtonWarning: {
    backgroundColor: colors.warning.main,
  },
  saveButtonDisabled: {
    opacity: 0.6,
    backgroundColor: colors.neutral[400],
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
  },
  bottomSheetBackground: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  bottomSheetIndicator: {
    backgroundColor: colors.border.DEFAULT,
    width: 40,
    height: 4,
  },
  bottomSheetContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  bottomSheetTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  bottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
  },
  bottomSheetItemSelected: {
    backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs,
  },
  bottomSheetItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    flex: 1,
  },
  bottomSheetItemTextSelected: {
    color: colors.primary.main,
    fontWeight: typography.fontWeight.semibold,
  },
  bottomSheetItemCheck: {
    fontSize: typography.fontSize.lg,
    color: colors.primary.main,
    fontWeight: typography.fontWeight.bold,
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  historyContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flex: 1,
  },
  historyStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  historyStatCard: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  historyStatCardPresent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success[500],
  },
  historyStatCardAbsent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error[500],
  },
  historyStatNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  historyStatLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  dateRangeContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadows.xs,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  dateRangeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  summaryContainer: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  summaryList: {
    gap: spacing.xs,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    ...shadows.xs,
    borderWidth: 0.5,
    borderColor: colors.border.light,
  },
  summaryStudentInfo: {
    flex: 1,
    minWidth: 0,
  },
  summaryStudentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  summaryStudentCode: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  summaryStats: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  summaryStatText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  summaryStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 1,
    borderRadius: borderRadius.sm,
  },
  summaryStatusGood: {
    backgroundColor: colors.success[50],
  },
  summaryStatusFair: {
    backgroundColor: colors.warning[50],
  },
  summaryStatusLow: {
    backgroundColor: colors.error[50],
  },
  summaryStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  summaryStatusTextGood: {
    color: colors.success[700],
  },
  summaryStatusTextFair: {
    color: colors.warning[700],
  },
  summaryStatusTextLow: {
    color: colors.error[700],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
});
