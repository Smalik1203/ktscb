import { log } from '../../lib/logger';

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, Surface } from 'react-native-paper';
import { BarChart3, Users, DollarSign, Calendar, Target, BookOpen, TrendingUp } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography, spacing, borderRadius, shadows } from '../../../lib/design-system';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
// RPC functions deprecated - using new hook-based architecture
// import { getSuperAdminAnalytics, getStudentAnalytics } from '../../lib/analytics-rpc';
import { KPICard, TrendChart, ProgressRing } from '../../components/analytics';
import type { DataPoint } from '../../components/analytics';
import {
  SuperAdminAnalytics,
  AdminAnalytics,
  StudentAnalytics,
  TimePeriod,
  AnalyticsFeature,
  getDateRangeForPeriod,
} from '../../components/analytics/types';
import { AttendanceDetailView, FeesDetailView, LearningDetailView, SyllabusProgressDetailView } from '../../components/analytics/features';
import { SummaryCard, CategoryCards } from '../../components/analytics/shared';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

// Types are imported from '../../components/analytics/types' - see imports above

// Utility function to format date range
const formatDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' })} - ${end.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' })}`;
  }

  return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
};

// Empty State Component
const EmptyState: React.FC<{ icon: any; title: string; message: string }> = ({ icon: Icon, title, message }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconContainer}>
      <Icon size={48} color={colors.text.tertiary} strokeWidth={1.5} />
    </View>
    <Text variant="titleMedium" style={styles.emptyTitle}>{title}</Text>
    <Text variant="bodyMedium" style={styles.emptyMessage}>{message}</Text>
  </View>
);

// Skeleton Loader Component
const SkeletonCard: React.FC = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonTitle} />
    <View style={styles.skeletonLine} />
    <View style={[styles.skeletonLine, { width: '60%' }]} />
  </View>
);

// Super Admin Dashboard Component
const SuperAdminDashboard: React.FC<{
  data: SuperAdminAnalytics;
  isLoading: boolean;
  isFetching: boolean;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  startDate: string;
  endDate: string;
}> = ({ data, isLoading, isFetching, timePeriod, setTimePeriod, startDate, endDate }) => {
  const [selectedFeature, setSelectedFeature] = useState<AnalyticsFeature>('overview');

  // Don't reset selectedFeature when data changes - let user stay on their selected view

  if (isLoading) {
    return (
      <View style={styles.tabContent}>
        <Animated.View entering={FadeInUp.delay(0)} style={styles.loadingHeader}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text variant="bodyMedium" style={styles.loadingText}>Loading analytics...</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100)}>
          <SkeletonCard />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200)}>
          <SkeletonCard />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(300)}>
          <SkeletonCard />
        </Animated.View>
      </View>
    );
  }

  const hasData = data?.summary?.totalStudents > 0;

  if (!hasData) {
    return (
      <View style={styles.tabContent}>
        <EmptyState
          icon={BarChart3}
          title="No Analytics Data Yet"
          message="Analytics will appear here once students start using the system. Data refreshes automatically each day."
        />
      </View>
    );
  }

  const attendanceRate = data?.attendance?.avgRate || 0;
  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return colors.success[600];
    if (rate >= 80) return colors.warning[600];
    return colors.error[600];
  };

  // Render feature-specific view
  const renderFeatureView = () => {
    const content = (() => {
      switch (selectedFeature) {
        case 'attendance':
          return <AttendanceDetailView data={data} timePeriod={timePeriod} setTimePeriod={setTimePeriod} />;
        case 'fees':
          return <FeesDetailView data={data} timePeriod={timePeriod} setTimePeriod={setTimePeriod} />;
        case 'learning':
          return <LearningDetailView data={data} timePeriod={timePeriod} setTimePeriod={setTimePeriod} />;
        case 'operations':
          return <SyllabusProgressDetailView data={data} timePeriod={timePeriod} setTimePeriod={setTimePeriod} />;
        default:
          return null;
      }
    })();

    return (
      <>
        {isFetching && !isLoading && (
          <View style={styles.fetchingIndicator}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.fetchingText}>Updating data...</Text>
          </View>
        )}
        {content}
      </>
    );
  };

  // Overview Feature Cards - Always show overview with category cards list
  if (selectedFeature === 'overview') {
    const categoryCards = [
      {
        id: 'attendance' as AnalyticsFeature,
        title: 'Attendance',
        metric: `${Math.round(attendanceRate)}%`,
        subtext: 'Avg attendance rate',
        icon: Users,
        iconColor: colors.success[600],
        iconBackgroundColor: colors.success[50],
        metricColor: getAttendanceColor(attendanceRate),
        onPress: () => setSelectedFeature('attendance'),
      },
      {
        id: 'fees' as AnalyticsFeature,
        title: 'Fee Collection',
        metric: `${Math.round(data?.fees?.realizationRate || 0)}%`,
        subtext: 'Realization rate',
        icon: DollarSign,
        iconColor: colors.primary[600],
        iconBackgroundColor: colors.primary[50],
        metricColor: colors.primary[600],
        onPress: () => setSelectedFeature('fees'),
      },
      {
        id: 'learning' as AnalyticsFeature,
        title: 'Learning',
        metric: `${Math.round(data?.academics?.participationRate || 0)}%`,
        subtext: 'Test participation',
        icon: Target,
        iconColor: colors.info[600],
        iconBackgroundColor: colors.info[50],
        metricColor: colors.info[600],
        onPress: () => setSelectedFeature('learning'),
      },
      {
        id: 'operations' as AnalyticsFeature,
        title: 'Syllabus Progress',
        metric: `${Math.round(data?.syllabus?.overallProgress || 0)}%`,
        subtext: 'Overall completion',
        icon: Calendar,
        iconColor: colors.warning[600],
        iconBackgroundColor: colors.warning[50],
        metricColor: colors.warning[600],
        onPress: () => setSelectedFeature('operations'),
      },
    ];

    return (
      <View style={styles.tabContent}>
        {/* Summary Card */}
        <Animated.View entering={FadeInDown.delay(0)}>
          <SummaryCard
            academicYear={data?.summary?.activeAcademicYear || '2025–2026'}
            totalStudents={data?.summary?.totalStudents || 0}
            totalClasses={data?.summary?.totalClasses || 0}
            totalTeachers={data?.summary?.totalTeachers || 0}
          />
        </Animated.View>

        {/* Date Range Display */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.dateRangeContainer}>
          <View style={styles.dateRangeBadge}>
            <Calendar size={14} color={colors.primary[600]} />
            <Text variant="bodySmall" style={styles.dateRangeText}>
              {formatDateRange(startDate, endDate)}
            </Text>
          </View>
        </Animated.View>

        {/* All Analytics Categories - List of Category Cards */}
        {categoryCards && categoryCards.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(200)}>
            <CategoryCards
              cards={categoryCards.map((card, index) => ({
                ...card,
                onPress: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  card.onPress();
                },
              }))}
            />
          </Animated.View>
        ) : (
          <View style={styles.emptyState}>
            <Text variant="bodyMedium" style={styles.emptyMessage}>
              No analytics categories available
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {/* Back Button with better UX */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setSelectedFeature('overview');
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.backButtonIcon}>←</Text>
        <Text variant="labelLarge" style={styles.backButtonText}>Back to Overview</Text>
      </TouchableOpacity>

      {/* Feature Title */}
      <View style={styles.featureHeader}>
        <Text variant="headlineSmall" style={styles.featureTitle}>
          {selectedFeature === 'attendance' && 'Attendance Analytics'}
          {selectedFeature === 'fees' && 'Fee Collection Analytics'}
          {selectedFeature === 'learning' && 'Learning Analytics'}
          {selectedFeature === 'operations' && 'Syllabus Progress Analytics'}
        </Text>
      </View>

      {/* Render selected feature view */}
      {renderFeatureView()}
    </View>
  );
};

// Feature Detail Views are now imported from features folder

// Admin/Teacher Dashboard Component
const AdminDashboard: React.FC<{ data: AdminAnalytics; isLoading: boolean }> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const weeklyTrendData: DataPoint[] =
    data?.presence?.weeklyTrend?.map(t => ({
      label: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: t.rate,
    })) || [];

  return (
    <View style={styles.tabContent}>
      {/* Class Summary */}
      <Card style={styles.summaryCard}>
        <Text variant="titleLarge" style={styles.className}>
          {data?.summary?.className}
        </Text>
        <Text variant="bodyMedium" style={styles.classInfo}>
          {data?.summary?.totalStudents} students • {data?.summary?.classTeacher}
        </Text>
      </Card>

      {/* Weekly Attendance */}
      <Card style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Weekly Attendance Trend
        </Text>
        <TrendChart data={weeklyTrendData} showLabels showDots />
        <Text variant="bodyMedium" style={styles.metricHighlight}>
          {Math.round(data?.presence?.steadyParticipation || 0)}% students with steady
          participation
        </Text>
      </Card>

      {/* Learning Progress */}
      <View style={styles.statsRow}>
        <KPICard
          title="Assignment On-Time"
          value={`${Math.round(data?.learning?.assignmentOnTimeRate || 0)}%`}
          icon={BookOpen}
          iconColor={colors.success[600]}
          iconBackgroundColor={colors.success[50]}
        />
        <KPICard
          title="Timetable Coverage"
          value={`${Math.round(data?.operations?.coveragePercent || 0)}%`}
          icon={Calendar}
          iconColor={colors.primary[600]}
          iconBackgroundColor={colors.primary[50]}
        />
      </View>

      {/* Syllabus Progress */}
      <Card style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Syllabus Progress by Subject
        </Text>
        {data?.syllabus?.progressBySubject?.map(subject => (
          <View key={subject.subjectId} style={styles.progressItem}>
            <Text variant="bodyMedium" style={styles.subjectName}>
              {subject.subjectName}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${subject.progress}%`, backgroundColor: colors.primary[600] },
                ]}
              />
            </View>
            <Text variant="bodySmall" style={styles.progressText}>
              {subject.completedTopics}/{subject.totalTopics} topics ({Math.round(subject.progress)}
              %)
            </Text>
          </View>
        ))}
      </Card>

      {/* Engagement */}
      <View style={styles.statsRow}>
        <KPICard
          title="Quiz Participation"
          value={`${Math.round(data?.engagement?.quizParticipation || 0)}%`}
          icon={TrendingUp}
          iconColor={colors.info[600]}
          iconBackgroundColor={colors.info[50]}
        />
        <KPICard
          title="Assignment Participation"
          value={`${Math.round(data?.engagement?.assignmentParticipation || 0)}%`}
          icon={BookOpen}
          iconColor={colors.warning[600]}
          iconBackgroundColor={colors.warning[50]}
        />
      </View>
    </View>
  );
};

// Student Dashboard Component
const StudentDashboard: React.FC<{ data: StudentAnalytics; isLoading: boolean }> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const fourWeekTrendData: DataPoint[] =
    data?.attendanceRhythm?.fourWeekTrend?.map(t => ({
      label: `Week ${t.week}`,
      value: t.rate,
    })) || [];

  return (
    <View style={styles.tabContent}>
      {/* Student Summary */}
      <Card style={styles.summaryCard}>
        <Text variant="titleLarge" style={styles.className}>
          {data?.summary?.studentName}
        </Text>
        <Text variant="bodyMedium" style={styles.classInfo}>
          {data?.summary?.className}
        </Text>
      </Card>

      {/* Attendance This Month */}
      <Card style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Attendance This Month
        </Text>
        <View style={styles.attendanceContainer}>
          <ProgressRing
            progress={
              (data?.attendanceRhythm?.daysAttendedThisMonth /
                Math.max(data?.attendanceRhythm?.totalDaysThisMonth, 1)) *
                100 || 0
            }
            size={120}
            label="Days Present"
          />
          <View style={styles.attendanceStats}>
            <Text variant="headlineMedium" style={styles.attendanceValue}>
              {data?.attendanceRhythm?.daysAttendedThisMonth || 0}/
              {data?.attendanceRhythm?.totalDaysThisMonth || 0}
            </Text>
            <Text variant="bodySmall" style={styles.attendanceLabel}>
              days attended
            </Text>
          </View>
        </View>
        {fourWeekTrendData.length > 0 && (
          <>
            <Text variant="titleSmall" style={styles.subSectionTitle}>
              4-Week Trend
            </Text>
            <TrendChart data={fourWeekTrendData} height={150} showLabels showDots />
          </>
        )}
      </Card>

      {/* Learning Progress */}
      {data?.progressHighlights?.closestToPersonalBest && (
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Personal Best
          </Text>
          <View style={styles.personalBest}>
            <Text variant="bodyLarge" style={styles.subjectName}>
              {data.progressHighlights.closestToPersonalBest.subjectName}
            </Text>
            <Text variant="headlineSmall" style={styles.bestScore}>
              {Math.round(data.progressHighlights.closestToPersonalBest.bestScore)}%
            </Text>
            <Text variant="bodySmall" style={styles.scoreLabel}>
              Your highest score
            </Text>
          </View>
        </Card>
      )}

      {/* Assignment Streak */}
      <View style={styles.statsRow}>
        <KPICard
          title="Assignments On-Time"
          value={data?.learning?.assignmentOnTimeStreak || 0}
          subtitle={`out of ${data?.learning?.totalAssignments || 0} total`}
          icon={BookOpen}
          iconColor={colors.success[600]}
          iconBackgroundColor={colors.success[50]}
        />
        <KPICard
          title="Overall Attendance"
          value={`${Math.round(data?.attendanceRhythm?.currentRate || 0)}%`}
          icon={TrendingUp}
          iconColor={colors.primary[600]}
          iconBackgroundColor={colors.primary[50]}
        />
      </View>

      {/* Fees Status */}
      {data?.fees && data.fees.status !== 'no_billing' && (
        <Card style={styles.sectionCard}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Fee Status
          </Text>
          <View style={styles.feesOverview}>
            <View style={styles.feeRow}>
              <Text variant="bodyMedium" style={styles.feeLabel}>
                Total Billed
              </Text>
              <Text variant="bodyMedium" style={styles.feeValue}>
                ₹{((data.fees.totalBilled || 0) / 100).toLocaleString()}
              </Text>
            </View>
            <View style={styles.feeRow}>
              <Text variant="bodyMedium" style={styles.feeLabel}>
                Paid
              </Text>
              <Text variant="bodyMedium" style={[styles.feeValue, { color: colors.success[600] }]}>
                ₹{((data.fees.totalPaid || 0) / 100).toLocaleString()}
              </Text>
            </View>
            {data.fees.totalDue > 0 && (
              <View style={styles.feeRow}>
                <Text variant="bodyMedium" style={styles.feeLabel}>
                  Due
                </Text>
                <Text variant="bodyMedium" style={[styles.feeValue, { color: colors.error[600] }]}>
                  ₹{((data.fees.totalDue || 0) / 100).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Subject Progress */}
      <Card style={styles.sectionCard}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Syllabus Progress
        </Text>
        {data?.progressHighlights?.syllabusProgress?.slice(0, 5).map(subject => (
          <View key={subject.subjectId} style={styles.progressItem}>
            <Text variant="bodyMedium" style={styles.subjectName}>
              {subject.subjectName}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${subject.progress}%`, backgroundColor: colors.primary[600] },
                ]}
              />
            </View>
            <Text variant="bodySmall" style={styles.progressText}>
              {Math.round(subject.progress)}% complete
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
};

export default function AnalyticsScreen() {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('weekly');

  const role = profile?.role;
  const canViewAnalytics = role === 'admin' || role === 'superadmin' || role === 'cb_admin' || role === 'student';

  // Calculate date range based on time period
  const { startDate, endDate } = getDateRangeForPeriod(timePeriod);

  // New hook-based analytics - RPC deprecated
  // Using direct component-level data fetching via useAttendanceAnalytics, useFeesAnalytics, etc.
  // Overview data is now aggregated from individual feature hooks in the detail views
  const analyticsData = null; // Deprecated RPC data removed
  const isLoading = false;
  const isFetching = false;
  const error = null;
  const refetch = async () => {
    // Refresh handled by individual feature hooks
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await refetch();
      // Show success feedback
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 300);
    } catch (_error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRefreshing(false);
    }
  };

  if (!canViewAnalytics) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <BarChart3 size={32} color={colors.text.inverse} />
              </View>
              <View>
                <Text variant="headlineSmall" style={styles.headerTitle}>
                  Analytics
                </Text>
                <Text variant="bodyLarge" style={styles.headerSubtitle}>
                  Access restricted
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.restrictedContainer}>
          <BarChart3 size={64} color={colors.text.tertiary} />
          <Text variant="titleLarge" style={styles.restrictedTitle}>
            Access Restricted
          </Text>
          <Text variant="bodyMedium" style={styles.restrictedMessage}>
            Analytics dashboard is not available for your role.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
            title="Updating analytics..."
            titleColor={colors.text.secondary}
            colors={[colors.primary[600]]}
          />
        }
      >
        {error ? (
          <Animated.View entering={FadeInUp.delay(0)} style={styles.errorContainer}>
            <Animated.View entering={FadeInDown.delay(100)} style={styles.errorIconContainer}>
              <BarChart3 size={48} color={colors.warning[600]} strokeWidth={1.5} />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200)}>
              <Text variant="titleLarge" style={styles.errorText}>Analytics Under Maintenance</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(300)}>
              <Text variant="bodyMedium" style={styles.errorSubtext}>
                The analytics feature is being upgraded with improved performance and new insights.
                {'\n\n'}
                Please check back later or contact your administrator for more information.
              </Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(400)}>
              <Text variant="bodySmall" style={[styles.errorSubtext, { marginTop: 8, fontSize: 12, color: colors.text.tertiary }]}>
                Error: {error.message || 'Analytics RPC functions not available'}
              </Text>
            </Animated.View>
          </Animated.View>
        ) : role === 'superadmin' || role === 'cb_admin' ? (
          <SuperAdminDashboard
            data={analyticsData as SuperAdminAnalytics}
            isLoading={isLoading}
            isFetching={isFetching}
            timePeriod={timePeriod}
            setTimePeriod={setTimePeriod}
            startDate={startDate}
            endDate={endDate}
          />
        ) : role === 'student' ? (
          <StudentDashboard data={analyticsData as StudentAnalytics} isLoading={isLoading} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  // Modern Header Styles
  headerModern: {
    backgroundColor: colors.background.app,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerContentModern: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitleModern: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  headerSubtitleModern: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  // Old header styles (keeping for restricted view)
  header: {
    backgroundColor: colors.primary[600],
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.bold,
  },
  headerSubtitle: {
    color: colors.text.inverse,
    opacity: 0.9,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  restrictedTitle: {
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  restrictedMessage: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  tabContent: {
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  loadingHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorSubtext: {
    color: colors.text.secondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  errorRetryButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRetryText: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyMessage: {
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Skeleton Loader
  skeletonCard: {
    backgroundColor: colors.surface.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  skeletonTitle: {
    height: 24,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    width: '60%',
  },
  skeletonLine: {
    height: 16,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    width: '100%',
  },
  // Fetching Indicator
  fetchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  fetchingText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  // Hero Card
  heroCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  heroStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.app,
    borderRadius: borderRadius.lg,
  },
  heroStatValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  heroStatLabel: {
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  // Insight Card
  insightCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  insightIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  insightContent: {
    flex: 1,
  },
  insightLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  insightValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  insightBadge: {
    marginLeft: spacing.sm,
  },
  chartLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  // Fee Metrics
  feeMetricsGrid: {
    flexDirection: 'row',
    gap: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  feeMetric: {
    flex: 1,
    alignItems: 'center',
  },
  feeMetricLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  feeMetricValue: {
    fontWeight: typography.fontWeight.bold,
  },
  feeMetricDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  // Card Header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  // Modern Subject Item
  subjectItemModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectNameModern: {
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subjectMetrics: {
    color: colors.text.tertiary,
  },
  subjectScore: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontWeight: typography.fontWeight.bold,
  },
  // Metrics Row
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  metricIconCircle: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  metricValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  metricLabel: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  // Detailed Analytics Sections
  sectionContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  metricCardLarge: {
    backgroundColor: colors.background.app,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metricCardLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  metricCardValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: typography.fontSize['3xl'],
  },
  metricCardSubtext: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
  },
  chartContainer: {
    marginBottom: spacing.lg,
  },
  chartTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  breakdownSection: {
    marginTop: spacing.lg,
  },
  breakdownTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  breakdownItemLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  breakdownItemName: {
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  breakdownItemProgress: {
    height: 6,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  progressFillSmall: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  breakdownItemRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  breakdownItemValue: {
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  feeGridContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  feeGridItem: {
    flex: 1,
    backgroundColor: colors.background.app,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  feeGridLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: typography.fontWeight.semibold,
  },
  feeGridValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  agingContainer: {
    gap: spacing.md,
  },
  agingItem: {
    backgroundColor: colors.background.app,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  agingItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  agingDot: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
  },
  agingLabel: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  agingValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  performanceItem: {
    backgroundColor: colors.background.app,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  performanceName: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  performanceMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.lg,
  },
  performanceMetric: {
    flex: 1,
    alignItems: 'center',
  },
  performanceValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  performanceLabel: {
    color: colors.text.secondary,
    fontSize: 11,
  },
  performanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  performanceBar: {
    height: 6,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  performanceBarFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  // Modern Summary Card Styles (Mobile Optimized)
  summaryCardModern: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  summaryCardHeader: {
    marginBottom: spacing.md,
  },
  summaryCardLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryCardTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
  },
  summaryMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  summaryMetric: {
    alignItems: 'center',
    flex: 1,
  },
  summaryMetricValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    fontSize: typography.fontSize['2xl'],
    marginBottom: spacing.xs,
  },
  summaryMetricLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  summaryMetricDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.light,
  },
  // Admin Dashboard Styles
  summaryCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  className: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  classInfo: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    fontSize: typography.fontSize.base,
  },
  metricHighlight: {
    color: colors.text.secondary,
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  progressItem: {
    marginBottom: spacing.md,
  },
  subjectName: {
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: typography.fontSize.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  progressText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
  },
  // Student Dashboard Styles
  attendanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
    gap: spacing.lg,
  },
  attendanceStats: {
    alignItems: 'center',
  },
  attendanceValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  attendanceLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  subSectionTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  personalBest: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  bestScore: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    marginVertical: spacing.sm,
  },
  scoreLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  feesOverview: {
    gap: spacing.md,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    color: colors.text.secondary,
  },
  feeValue: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  // Modern Category Cards (Mobile Optimized)
  categoriesContainer: {
    // gap handled by marginBottom on categoryCard
  },
  categoryCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
    minHeight: 72, // Minimum touch target for mobile (44px + padding)
  },
  categoryCardPressed: {
    opacity: 0.8,
    backgroundColor: colors.surface.secondary,
  },
  categoryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    minHeight: 72,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryCardText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  categoryCardTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  categoryCardMetric: {
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.xl,
    marginBottom: spacing.xs,
  },
  categoryCardSubtext: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
  },
  categoryCardChevron: {
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
  // Legacy Feature Selection Styles (keeping for compatibility)
  summaryHeader: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  summaryTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  summaryStatValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.light,
  },
  sectionLabel: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  featureCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  featureIconBg: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  featureCardTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  featureCardValue: {
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  featureCardSubtitle: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  backButtonIcon: {
    fontSize: 20,
    color: colors.primary[600],
    marginRight: spacing.xs,
    fontWeight: typography.fontWeight.bold as any,
  },
  backButtonText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  featureHeader: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  featureTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    fontSize: typography.fontSize['2xl'],
  },
  // Filter Chips (Mobile Optimized)
  filterChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  filterChip: {
    marginRight: 0,
    marginBottom: spacing.xs,
    minHeight: 36, // Minimum touch target
  },
  // Chart Styles (Mobile Optimized)
  chartCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chartSubtitle: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
    fontSize: typography.fontSize.xs,
  },
  // Comparison Bar Styles (Mobile Optimized)
  comparisonItem: {
    marginBottom: spacing.md,
  },
  comparisonLabel: {
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: typography.fontSize.sm,
  },
  comparisonBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonBar: {
    height: 24,
    borderRadius: borderRadius.sm,
    minWidth: 2,
  },
  comparisonValue: {
    fontWeight: typography.fontWeight.bold,
    minWidth: 45,
    textAlign: 'right',
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
  comparisonSubtext: {
    color: colors.text.tertiary,
    fontSize: 11,
  },
  // Fee Comparison (Double Bar Chart Style - Mobile Optimized)
  feeComparisonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 160,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  feeComparisonItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  feeComparisonBar: {
    width: '100%',
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
    minHeight: 20,
    marginBottom: spacing.md,
  },
  feeComparisonLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  feeComparisonValue: {
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
  // Filter Section Styles (matching syllabus)
  filterSection: { 
    paddingHorizontal: spacing.lg, 
    paddingTop: 12, 
    paddingBottom: spacing.md 
  },
  filterRow: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl || 16,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200] || '#93c5fd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  filterItem: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  filterIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: colors.primary[600], 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: spacing.sm 
  },
  filterContent: { flex: 1 },
  filterValue: { 
    fontSize: typography.fontSize.sm, 
    fontWeight: typography.fontWeight.semibold, 
    color: colors.text.primary 
  },
  // Bottom Sheet Styles (matching syllabus)
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  bottomSheet: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetTitle: { 
    fontSize: typography.fontSize.lg, 
    fontWeight: typography.fontWeight.bold as any, 
    color: colors.text.primary, 
    marginBottom: spacing.md, 
    paddingHorizontal: spacing.lg 
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    maxHeight: 400,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: 2,
    backgroundColor: '#F9FAFB',
  },
  sheetItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium as any,
    flex: 1,
  },
  sheetItemActive: {
    backgroundColor: '#EEF2FF',
  },
  sheetItemTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold as any,
  },
  checkmark: {
    fontSize: typography.fontSize.lg,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold as any,
  },
  // Overview Section Headers
  overviewHeader: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
  },
  overviewTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    marginBottom: spacing.xs,
  },
  overviewSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
  },
  categoriesHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
  },
  categoriesTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    marginBottom: spacing.xs,
  },
  categoriesSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
  },
  // Date Range Display
  dateRangeContainer: {
    marginVertical: spacing.md,
    alignItems: 'center',
  },
  dateRangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  dateRangeText: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
});
