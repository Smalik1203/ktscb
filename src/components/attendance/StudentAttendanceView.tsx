import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  TrendingUp,
  CalendarDays,
  ChevronDown,
  AlertCircle,
  Users
} from 'lucide-react-native';
import { useStudentAttendance } from '../../hooks/useAttendance';
import { useAuth } from '../../contexts/AuthContext';
import { typography, spacing, borderRadius, shadows, colors } from '../../../lib/design-system';
import { ThreeStateView } from '../common/ThreeStateView';
import { DatePickerModal } from '../common/DatePickerModal';
import { supabase } from '../../data/supabaseClient';
import { format, subDays, addDays } from 'date-fns';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent';
  created_at?: string;
}

export const StudentAttendanceView: React.FC = () => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loadingStudentId, setLoadingStudentId] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [historyStartDate, setHistoryStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default to last 30 days
    return date;
  });
  const [historyEndDate, setHistoryEndDate] = useState<Date>(new Date());
  const [showHistoryStartDatePicker, setShowHistoryStartDatePicker] = useState(false);
  const [showHistoryEndDatePicker, setShowHistoryEndDatePicker] = useState(false);

  // Get student ID from profile (matching V1 pattern with fallback logic)
  useEffect(() => {
    const fetchStudent = async () => {
      if (!profile?.auth_id || profile?.role !== 'student') {
        setLoadingStudentId(false);
        return;
      }

      setLoadingStudentId(true);
      try {
        const schoolCode = profile.school_code;
        
        if (!schoolCode) {
          throw new Error('School information not found in your profile. Please contact support.');
        }

        // Try to find student by auth_user_id first (most reliable)
        let { data, error: queryError } = await supabase
          .from('student')
          .select('id')
          .eq('auth_user_id', profile.auth_id)
          .eq('school_code', schoolCode)
          .maybeSingle();

        // If not found by auth_user_id, try by email (fallback)
        if (!data && !queryError && profile.email) {
          const result = await supabase
            .from('student')
            .select('id')
            .eq('email', profile.email)
            .eq('school_code', schoolCode)
            .maybeSingle();
          data = result.data;
          queryError = result.error;
        }

        if (queryError) {
          console.error('Student lookup error:', queryError);
          throw new Error(`Failed to find student profile: ${queryError.message || 'Please contact support if this issue persists.'}`);
        }
        
        if (!data) {
          throw new Error('Student profile not found. Please contact your administrator to ensure your account is properly linked.');
        }
        
        setStudentId(data.id);
      } catch (err: any) {
        console.error('Error fetching student:', err);
        // Error will be caught and loading set to false
        // Don't set studentId, so viewState will be 'empty'
      } finally {
        setLoadingStudentId(false);
      }
    };

    fetchStudent();
  }, [profile?.auth_id, profile?.role, profile?.school_code, profile?.email]);

  // Fetch student attendance data
  const { data: attendanceRecords = [], isLoading, error, refetch } = useStudentAttendance(studentId || undefined);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Calculate date range stats for history view
  const historyStartDateString = historyStartDate.toISOString().split('T')[0];
  const historyEndDateString = historyEndDate.toISOString().split('T')[0];

  const historyStats = useMemo(() => {
    const rangeRecords = attendanceRecords.filter(record => {
      return record.date >= historyStartDateString && record.date <= historyEndDateString;
    });

    const present = rangeRecords.filter(r => r.status === 'present').length;
    const absent = rangeRecords.filter(r => r.status === 'absent').length;
    const total = rangeRecords.length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, absent, total, percentage, records: rangeRecords };
  }, [attendanceRecords, historyStartDateString, historyEndDateString]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const present = attendanceRecords.filter(r => r.status === 'present').length;
    const absent = attendanceRecords.filter(r => r.status === 'absent').length;
    const total = attendanceRecords.length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, absent, total, percentage };
  }, [attendanceRecords]);

  const viewState = loadingStudentId || isLoading ? 'loading' : error ? 'error' : !studentId ? 'empty' : 'success';

  if (!studentId && !loadingStudentId) {
    return (
      <ThreeStateView
        state="empty"
        emptyMessage="Student profile not found"
        errorDetails="Unable to load your student profile. Please contact support."
      />
    );
  }

  return (
    <ThreeStateView
      state={viewState}
      loadingMessage="Loading attendance..."
      errorMessage="Failed to load attendance"
      errorDetails={error?.message}
      onRetry={handleRefresh}
    >
      <View style={styles.container}>
        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'overview' | 'history')}
            buttons={[
              { value: 'overview', label: 'Overview' },
              { value: 'history', label: 'View History' },
            ]}
            style={styles.tabSwitcher}
          />
        </View>

        {/* Filter Section - Only for History Tab */}
        {activeTab === 'history' && (
          <View style={styles.filterSection}>
            <View style={styles.filterRow}>
              {/* Start Date Filter */}
              <TouchableOpacity
                style={styles.filterItem}
                onPress={() => setShowHistoryStartDatePicker(true)}
              >
                <View style={styles.filterIcon}>
                  <CalendarIcon size={14} color={colors.primary[600]} />
                </View>
                <View style={styles.filterContent}>
                  <Text style={styles.filterLabel}>Start</Text>
                  <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                    {historyStartDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.filterDivider} />

              {/* End Date Filter */}
              <TouchableOpacity
                style={styles.filterItem}
                onPress={() => setShowHistoryEndDatePicker(true)}
              >
                <View style={styles.filterIcon}>
                  <CalendarIcon size={14} color={colors.primary[600]} />
                </View>
                <View style={styles.filterContent}>
                  <Text style={styles.filterLabel}>End</Text>
                  <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                    {historyEndDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {activeTab === 'overview' ? (
            <>
              {/* Overall Stats Cards */}
              <View style={styles.statsSection}>
                <View style={styles.statsGrid}>
                  <Card mode="elevated" style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: colors.primary[600] }]}>
                      {overallStats.percentage}%
                    </Text>
                    <Text style={styles.statLabel}>Overall Attendance</Text>
                  </Card>

                  <Card mode="elevated" style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: colors.success[600] }]}>
                      {overallStats.present}
                    </Text>
                    <Text style={styles.statLabel}>Present Days</Text>
                  </Card>

                  <Card mode="elevated" style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: colors.error[600] }]}>
                      {overallStats.absent}
                    </Text>
                    <Text style={styles.statLabel}>Absent Days</Text>
                  </Card>
                </View>
              </View>

              {/* Recent Attendance List */}
              <View style={styles.recentSection}>
                <Text style={styles.sectionTitle}>Recent Attendance</Text>

                {attendanceRecords.length === 0 ? (
                  <Card mode="elevated" style={styles.emptyCard}>
                    <View style={styles.emptyContainer}>
                      <AlertCircle size={48} color={colors.text.tertiary} />
                      <Text style={styles.emptyTitle}>No Records Yet</Text>
                      <Text style={styles.emptyText}>
                        Your attendance records will appear here once marked by your teacher.
                      </Text>
                    </View>
                  </Card>
                ) : (
                  <View style={styles.recordsList}>
                    {[...attendanceRecords]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 10)
                      .map((record) => {
                        const isPresent = record.status === 'present';
                        const recordDate = new Date(record.date);

                        return (
                          <Card key={record.id} mode="elevated" style={styles.recordCard}>
                            <View style={styles.recordContent}>
                              <View
                                style={[
                                  styles.recordIcon,
                                  {
                                    backgroundColor: isPresent
                                      ? colors.success[50]
                                      : colors.error[50],
                                  },
                                ]}
                              >
                                {isPresent ? (
                                  <CheckCircle size={20} color={colors.success[600]} />
                                ) : (
                                  <XCircle size={20} color={colors.error[600]} />
                                )}
                              </View>
                              <View style={styles.recordDetails}>
                                <Text style={styles.recordDate}>
                                  {format(recordDate, 'MMM d, yyyy')}
                                </Text>
                                <Text style={styles.recordDay}>
                                  {format(recordDate, 'EEEE')}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.recordStatus,
                                  {
                                    backgroundColor: isPresent
                                      ? colors.success[100]
                                      : colors.error[100],
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.recordStatusText,
                                    {
                                      color: isPresent
                                        ? colors.success[700]
                                        : colors.error[700],
                                    },
                                  ]}
                                >
                                  {isPresent ? 'Present' : 'Absent'}
                                </Text>
                              </View>
                            </View>
                          </Card>
                        );
                      })}
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {/* History Tab */}
              <View style={styles.historySection}>
                {/* Summary Stats */}
                <View style={styles.historyStats}>
                  <Card mode="elevated" style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: colors.primary[600] }]}>
                      {historyStats.total}
                    </Text>
                    <Text style={styles.statLabel}>Total Days</Text>
                  </Card>
                  <Card mode="elevated" style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: colors.success[600] }]}>
                      {historyStats.percentage}%
                    </Text>
                    <Text style={styles.statLabel}>Attendance</Text>
                  </Card>
                  <Card mode="elevated" style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: colors.error[600] }]}>
                      {historyStats.absent}
                    </Text>
                    <Text style={styles.statLabel}>Absent</Text>
                  </Card>
                </View>

                {/* Date Range Display */}
                <View style={styles.dateRangeContainer}>
                  <Text style={styles.dateRangeText}>
                    {historyStartDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    -{' '}
                    {historyEndDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>

                {/* History Records List */}
                <View style={styles.historyList}>
                  <Text style={styles.sectionTitle}>Attendance Records</Text>

                  {historyStats.records.length === 0 ? (
                    <Card mode="elevated" style={styles.emptyCard}>
                      <View style={styles.emptyContainer}>
                        <AlertCircle size={48} color={colors.text.tertiary} />
                        <Text style={styles.emptyTitle}>No Records</Text>
                        <Text style={styles.emptyText}>
                          No attendance records found for this period.
                        </Text>
                      </View>
                    </Card>
                  ) : (
                    historyStats.records
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((record) => {
                        const isPresent = record.status === 'present';
                        const recordDate = new Date(record.date);

                        return (
                          <Card key={record.id} mode="elevated" style={styles.historyRecordCard}>
                            <View style={styles.historyRecordContent}>
                              <View
                                style={[
                                  styles.historyRecordIcon,
                                  {
                                    backgroundColor: isPresent
                                      ? colors.success[50]
                                      : colors.error[50],
                                  },
                                ]}
                              >
                                {isPresent ? (
                                  <CheckCircle size={16} color={colors.success[600]} />
                                ) : (
                                  <XCircle size={16} color={colors.error[600]} />
                                )}
                              </View>
                              <View style={styles.historyRecordDetails}>
                                <Text style={styles.historyRecordDate}>
                                  {format(recordDate, 'MMM d, yyyy')}
                                </Text>
                                <Text style={styles.historyRecordDay}>
                                  {format(recordDate, 'EEEE')}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.historyRecordStatus,
                                  {
                                    backgroundColor: isPresent
                                      ? colors.success[100]
                                      : colors.error[100],
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.historyRecordStatusText,
                                    {
                                      color: isPresent
                                        ? colors.success[700]
                                        : colors.error[700],
                                    },
                                  ]}
                                >
                                  {isPresent ? 'Present' : 'Absent'}
                                </Text>
                              </View>
                            </View>
                          </Card>
                        );
                      })
                  )}
                </View>
              </View>
            </>
          )}

        </ScrollView>

        {/* Date Picker Modals */}
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
      </View>
    </ThreeStateView>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  statsSection: {
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  recentSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  recordsList: {
    gap: spacing.sm,
  },
  recordCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  recordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  recordDetails: {
    flex: 1,
  },
  recordDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  recordDay: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  recordStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 1,
    borderRadius: borderRadius.sm,
  },
  recordStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  historySection: {
    marginBottom: spacing.lg,
  },
  historyStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dateRangeContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
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
  historyList: {
    marginBottom: spacing.lg,
  },
  historyRecordCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  historyRecordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  historyRecordIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  historyRecordDetails: {
    flex: 1,
  },
  historyRecordDate: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  historyRecordDay: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  historyRecordStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  historyRecordStatusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  emptyContainer: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
