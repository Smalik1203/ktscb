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
  Circle
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useClassSelection } from '../../contexts/ClassSelectionContext';
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceData[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'mark' | 'history'>(
    profile?.role === 'student' ? 'history' : 'mark'
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
  const canMark = profile?.role === 'admin' || profile?.role === 'superadmin';
  const isStudent = profile?.role === 'student';

  const { data: classes = [] } = useClasses(!isStudent ? (scope.school_code ?? undefined) : undefined);
  const effectiveSchoolCode = scope.school_code ?? profile?.school_code ?? selectedClass?.school_code ?? null;

  const { data: studentsResponse, isLoading: studentsLoading, error: studentsError } = useStudents(
    !isStudent && selectedClass?.id ? selectedClass.id : undefined,
    !isStudent && effectiveSchoolCode ? effectiveSchoolCode : undefined
  );
  const students = useMemo(() => studentsResponse?.data || [], [studentsResponse?.data]);

  const { data: existingAttendanceRaw, isLoading: attendanceLoading, error: attendanceError } = useClassAttendance(
    !isStudent && selectedClass?.id ? selectedClass.id : undefined,
    !isStudent ? dateString : undefined
  );
  const existingAttendance = useMemo(() => existingAttendanceRaw || [], [existingAttendanceRaw]);

  const { data: attendanceSummaryRaw, isLoading: summaryLoading } = useClassAttendanceSummary(
    !isStudent && activeTab === 'history' && selectedClass?.id ? selectedClass.id : undefined,
    !isStudent && activeTab === 'history' ? historyStartDateString : undefined,
    !isStudent && activeTab === 'history' ? historyEndDateString : undefined
  );
  const attendanceSummary = useMemo(() => attendanceSummaryRaw || [], [attendanceSummaryRaw]);

  const markAttendanceMutation = useMarkAttendance();
  const markBulkAttendanceMutation = useMarkBulkAttendance();

  useEffect(() => {
    if (!isStudent && students && students.length > 0) {
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
  }, [students, existingAttendance, dateString, isStudent]);

  const handleDateConfirm = useCallback((date: Date) => {
    if (isStudent) return;
    setSelectedDate(date);
    setHasChanges(true);
    setShowDatePicker(false);
  }, [isStudent]);

  const handleDateCancel = useCallback(() => {
    if (isStudent) return;
    setShowDatePicker(false);
  }, [isStudent]);

  const handleStatusChange = useCallback((studentId: string, status: AttendanceStatus) => {
    if (isStudent) return;
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
  }, [isStudent]);

  const handleSave = async () => {
    if (!selectedClass?.id || !effectiveSchoolCode || !profile?.auth_id) {
      Alert.alert('Error', 'Please select a class and ensure you are logged in');
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

    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;

    Alert.alert(
      'Confirm Attendance',
      `Save attendance for ${selectedDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })}?\n\n📊 ${records.length} students marked\n✅ ${presentCount} Present\n❌ ${absentCount} Absent`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save Attendance',
          style: 'default',
          onPress: async () => {
            try {
              await markAttendanceMutation.mutateAsync(records);
              setHasChanges(false);
              Alert.alert('✅ Success', `Attendance saved successfully for ${records.length} students.`);
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

    Alert.alert(
      `Mark All ${statusText}?`,
      `Are you sure you want to mark all ${studentCount} students as ${statusText.toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Yes, Mark All ${statusText}`,
          style: status === 'present' ? 'default' : 'destructive',
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

  if (!selectedClass) {
    return (
      <View style={styles.emptyContainer}>
        <Users size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>Please select a class to view attendance</Text>
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
      {!isStudent && (
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

      {!isStudent && (
        <View style={styles.filterSection}>
          {activeTab === 'mark' ? (
            <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.filterItem}
              onPress={() => bottomSheetRef.current?.present()}
            >
              <View style={styles.filterIcon}>
                <Users size={16} color={colors.text.inverse} />
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
                <Calendar size={16} color={colors.text.inverse} />
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
                <Users size={16} color={colors.text.inverse} />
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
                <Calendar size={16} color={colors.text.inverse} />
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
                <Calendar size={16} color={colors.text.inverse} />
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
          <View style={styles.studentsHeader}>
            <View>
              <Text style={styles.sectionTitle}>Students</Text>
              <Text style={styles.studentsSubtitle}>
                {attendanceData?.length || 0} total • {attendanceData?.filter(s => s.status === null).length || 0} unmarked
              </Text>
            </View>
            {hasChanges && (
              <View style={styles.changesBadge}>
                <Text style={styles.changesBadgeText}>Unsaved changes</Text>
              </View>
            )}
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
                          {isMarked ? (
                            <View style={[
                              styles.statusBadge,
                              isPresent ? styles.statusBadgePresent : styles.statusBadgeAbsent
                            ]}>
                              {isPresent ? (
                                <CheckCircle size={12} color={colors.text.inverse} />
                              ) : (
                                <XCircle size={12} color={colors.text.inverse} />
                              )}
                              <Text style={styles.statusBadgeText}>
                                {isPresent ? 'Present' : 'Absent'}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.statusBadgeUnmarked}>
                              <Circle size={12} color={colors.text.tertiary} fill={colors.text.tertiary} />
                              <Text style={styles.statusBadgeTextUnmarked}>Unmarked</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.studentCode}>{student.studentCode}</Text>
                      </View>
                      
                      {canMark && (
                        <View style={styles.statusButtons}>
                          <TouchableOpacity
                            style={[styles.statusButton, presentButtonStyle]}
                            onPress={() => handleStatusChange(student.studentId, 'present')}
                            activeOpacity={0.7}
                          >
                            <CheckCircle 
                              size={16} 
                              color={isPresent ? colors.text.inverse : colors.success.main} 
                            />
                            <Text style={[
                              styles.statusButtonText,
                              isPresent && styles.statusButtonTextActive,
                              !isMarked && styles.statusButtonTextUnmarked
                            ]}>
                              Present
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.statusButton, absentButtonStyle]}
                            onPress={() => handleStatusChange(student.studentId, 'absent')}
                            activeOpacity={0.7}
                          >
                            <XCircle 
                              size={16} 
                              color={isAbsent ? colors.text.inverse : colors.error.main} 
                            />
                            <Text style={[
                              styles.statusButtonText,
                              isAbsent && styles.statusButtonTextActive,
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
            {isStudent ? (
              <StudentAttendanceView />
            ) : (
              !selectedClass ? (
                <View style={styles.emptyContainer}>
                  <Users size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyText}>Please select a class to view attendance history</Text>
                </View>
              ) : (
                <>
                  <View style={styles.historyStats}>
                    <View style={styles.statCard}>
                      <Text style={styles.statNumber}>{historyStats.total}</Text>
                      <Text style={styles.statLabel} numberOfLines={1}>Students</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statNumber, { color: colors.success.main }]}>{historyStats.averageAttendance}%</Text>
                      <Text style={styles.statLabel} numberOfLines={1}>Present</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={[styles.statNumber, { color: colors.error.main }]}>{historyStats.averageAbsent}%</Text>
                      <Text style={styles.statLabel} numberOfLines={1}>Absent</Text>
                    </View>
                  </View>

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
                              <Text style={styles.studentCode}>{student.studentCode}</Text>
                            </View>
                            <View style={styles.summaryStats}>
                              <Text style={styles.summaryStatText}>
                                {student.presentDays} / {student.totalDays} ({student.percentage.toFixed(0)}%)
                              </Text>
                              <View style={[
                                styles.summaryStatus,
                                student.percentage >= 75 ? styles.summaryStatusPresent :
                                student.percentage >= 50 ? styles.summaryStatusUnmarked :
                                styles.summaryStatusAbsent
                              ]}>
                                <Text style={[
                                  styles.summaryStatusText,
                                  student.percentage >= 75 ? styles.summaryStatusTextPresent :
                                  student.percentage >= 50 ? styles.summaryStatusTextUnmarked :
                                  styles.summaryStatusTextAbsent
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

      {hasChanges && canMark && (
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              markAttendanceMutation.isPending && styles.saveButtonDisabled
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
                  Save Attendance ({attendanceData.filter(s => s.status !== null).length})
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
    ...shadows.sm,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border.DEFAULT,
  },
  filterItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
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
  studentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
    minHeight: 56,
    borderWidth: 2,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
  },
  studentCardUnmarked: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
  },
  studentCardPresent: {
    borderColor: colors.success.main,
    backgroundColor: colors.success[50],
    borderStyle: 'solid',
  },
  studentCardAbsent: {
    borderColor: colors.error.main,
    backgroundColor: colors.error[50],
    borderStyle: 'solid',
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
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
    flexShrink: 0,
  },
  statusBadgePresent: {
    backgroundColor: colors.success.main,
  },
  statusBadgeAbsent: {
    backgroundColor: colors.error.main,
  },
  statusBadgeUnmarked: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
    backgroundColor: colors.neutral[200],
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  statusBadgeTextUnmarked: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.DEFAULT,
    gap: spacing.xs,
    minWidth: 75,
    justifyContent: 'center',
  },
  statusButtonUnmarked: {
    borderStyle: 'dashed',
    borderColor: colors.border.light,
    opacity: 0.7,
  },
  statusButtonActivePresent: {
    backgroundColor: colors.success.main,
    borderColor: colors.success.main,
    borderStyle: 'solid',
    opacity: 1,
  },
  statusButtonActiveAbsent: {
    backgroundColor: colors.error.main,
    borderColor: colors.error.main,
    borderStyle: 'solid',
    opacity: 1,
  },
  statusButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  statusButtonTextUnmarked: {
    color: colors.text.tertiary,
  },
  statusButtonTextActive: {
    color: colors.text.inverse,
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
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    padding: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minWidth: 0,
    ...shadows.sm,
  },
  statNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.main,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  dateRangeContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  dateRangeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  summaryContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flex: 1,
    ...shadows.sm,
  },
  summaryTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  summaryList: {
    gap: spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
  },
  summaryStudentInfo: {
    flex: 1,
  },
  summaryStudentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  summaryStats: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  summaryStatText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  summaryStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  summaryStatusPresent: {
    backgroundColor: colors.success[50],
  },
  summaryStatusAbsent: {
    backgroundColor: colors.error[50],
  },
  summaryStatusUnmarked: {
    backgroundColor: colors.background.secondary,
  },
  summaryStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  summaryStatusTextPresent: {
    color: colors.success[700],
  },
  summaryStatusTextAbsent: {
    color: colors.error[700],
  },
  summaryStatusTextUnmarked: {
    color: colors.text.secondary,
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
