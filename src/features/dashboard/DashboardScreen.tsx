/**
 * DashboardScreen - Refactored with UI Kit
 * 
 * This screen demonstrates the proper use of the UI Kit components.
 * NO hardcoded colors, spacing, or typography - all from theme tokens.
 */

import React from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, Dimensions, Text as RNText, Platform } from 'react-native';
import {
  CalendarRange, UserCheck, CreditCard, NotebookText, UsersRound,
  LineChart, TrendingUp, Activity, CalendarDays,
  Target, AlertCircle, FolderOpen, ArrowUpRight,
  ArrowDownRight, ChevronRight, UserPlus, List, Layers,
  ReceiptText, ClipboardList, GraduationCap, Building2, School,
  FileText, CheckCircle2
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

// Theme & Context
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

// Hooks
import {
  useDashboardStats, useRecentActivity, useUpcomingEvents,
  useFeeOverview, useTaskOverview, useSyllabusOverview,
  type DashboardStats
} from '../../hooks/useDashboard';
import { useClass } from '../../hooks/useClasses';
import { useCapabilities } from '../../hooks/useCapabilities';

// UI Kit Components
import {
  Container,
  Stack,
  Row,
  Heading,
  Body,
  Caption,
  Text,
  Card,
  Badge,
  Button,
  SectionBlock,
  Divider,
  ProgressBar,
  Skeleton,
  Center,
} from '../../ui';

// Legacy components (to be migrated)
import { ThreeStateView } from '../../components/common/ThreeStateView';
import { ProgressRing } from '../../components/analytics/ProgressRing';
import { log } from '../../lib/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface QuickActionProps {
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  onPress: () => void;
}

function QuickAction({ title, icon: Icon, color, bgColor, onPress }: QuickActionProps) {
  const { spacing, borderRadius, shadows, colors: themeColors, typography } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        width: 80,
        minHeight: 100,
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: themeColors.surface.primary,
        borderRadius: borderRadius.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
        ...shadows.sm,
        borderWidth: 0.5,
        borderColor: themeColors.border.light,
        marginRight: spacing.sm,
      }}
    >
      <View style={{
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: bgColor,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
      }}>
        <Icon size={20} color={color} strokeWidth={2.5} />
      </View>
      <View style={{
        width: '100%',
        minHeight: 28,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <RNText
          style={{
            fontSize: 11,
            fontWeight: typography.fontWeight.semibold,
            color: themeColors.text.primary,
            textAlign: 'center',
            lineHeight: 14,
          }}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </RNText>
      </View>
    </TouchableOpacity>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  onPress?: () => void;
  showProgress?: boolean;
  progressValue?: number;
  trend?: 'up' | 'down' | null;
}

function StatCard({
  title, value, change, icon: Icon, color, bgColor,
  onPress, showProgress, progressValue, trend
}: StatCardProps) {
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const cardWidth = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        width: cardWidth,
        backgroundColor: colors.surface.primary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.light,
        ...shadows.sm,
      }}
    >
      {/* Header: Icon and Actions */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <View style={{
          width: 44,
          height: 44,
          borderRadius: borderRadius.md,
          backgroundColor: bgColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Icon size={22} color={color} strokeWidth={2.5} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {trend && (
            trend === 'up' ? (
              <ArrowUpRight size={16} color={colors.success[600]} />
            ) : (
              <ArrowDownRight size={16} color={colors.error[600]} />
            )
          )}
          {onPress && (
            <ChevronRight size={18} color={colors.text.tertiary} />
          )}
        </View>
      </View>

      {/* Value Display */}
      {showProgress && progressValue !== undefined ? (
        <View style={{ alignItems: 'center', marginVertical: spacing.sm }}>
          <ProgressRing
            progress={progressValue}
            size={64}
            strokeWidth={6}
            color={color}
            backgroundColor={colors.neutral[100]}
            showPercentage={false}
          />
          <RNText style={{
            position: 'absolute',
            fontSize: typography.fontSize.xl,
            fontWeight: typography.fontWeight.bold,
            color: colors.text.primary
          }}>
            {value}
          </RNText>
        </View>
      ) : (
        <RNText style={{
          fontSize: typography.fontSize['2xl'],
          fontWeight: typography.fontWeight.bold,
          color: colors.text.primary,
          marginBottom: spacing.xs
        }}>
          {value}
        </RNText>
      )}

      {/* Title */}
      <RNText style={{
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        fontWeight: typography.fontWeight.medium,
        marginBottom: spacing.sm
      }}>
        {title}
      </RNText>

      {/* Badge */}
      <View style={{
        backgroundColor: color,
        paddingHorizontal: spacing.sm,
        paddingVertical: 5,
        borderRadius: borderRadius.sm,
        alignSelf: 'flex-start',
      }}>
        <RNText style={{
          fontSize: 11,
          fontWeight: typography.fontWeight.semibold,
          color: colors.text.inverse
        }}>
          {change}
        </RNText>
      </View>
    </TouchableOpacity>
  );
}

function StatCardSkeleton() {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const cardWidth = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

  return (
    <View style={{
      width: cardWidth,
      minHeight: 140, // Match StatCard minHeight
      backgroundColor: colors.surface.elevated,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 0.5,
      borderColor: colors.border.light,
      ...shadows.sm,
      opacity: 0.6,
    }}>
      <Skeleton width={40} height={40} variant="rounded" style={{ marginBottom: spacing.sm }} />
      <Skeleton width="60%" height={28} variant="rounded" style={{ marginBottom: spacing.xs }} />
      <Skeleton width="80%" height={14} variant="rounded" style={{ marginBottom: spacing.xs }} />
      <Skeleton width="50%" height={20} variant="rounded" style={{ marginTop: spacing.xs }} />
    </View>
  );
}

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

function DashboardEmptyState({ icon: Icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <Stack align="center" padding="xl">
      <View style={{
        width: 80,
        height: 80,
        borderRadius: borderRadius.full,
        backgroundColor: colors.neutral[100],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
      }}>
        <Icon size={40} color={colors.primary[400]} />
      </View>
      <Heading level={5} align="center">{title}</Heading>
      <Body color="secondary" align="center" style={{ marginVertical: spacing.sm }}>
        {message}
      </Body>
      {actionLabel && onAction && (
        <Button size="sm" onPress={onAction}>{actionLabel}</Button>
      )}
    </Stack>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DashboardScreen() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
  const { can, isLoading: capabilitiesLoading } = useCapabilities();
  const [refreshing, setRefreshing] = React.useState(false);

  // Capability-based checks (NO role checks in UI)
  const canViewOwnDataOnly = can('attendance.read_own') && !can('attendance.read');
  const canViewAdminStats = can('dashboard.admin_stats');
  const canManageStudents = can('students.manage');
  const canViewFees = can('fees.read') || can('fees.read_own');
  const canViewTasks = can('tasks.read') || can('tasks.read_own');
  const canViewSyllabus = can('syllabus.read');
  const canViewAnalytics = can('analytics.read') || can('analytics.read_own');
  const canViewPayments = can('fees.record_payments');
  const canViewManagement = can('management.view');

  // ============================================================================
  // DATA FETCHING WITH HOOKS
  // ============================================================================

  // Fetch class instance details (grade, section)
  const {
    data: classInstance,
    isLoading: classLoading
  } = useClass(profile?.class_instance_id || undefined);

  // Extract class display data from fetched instance
  const classData = React.useMemo(() => {
    if (!classInstance) return null;
    return {
      grade: classInstance.grade?.toString() || '',
      section: classInstance.section || '',
    };
  }, [classInstance]);

  // Dashboard stats
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats
  } = useDashboardStats(
    profile?.auth_id || '',
    profile?.class_instance_id || undefined,
    profile?.role
  );

  // Recent activity
  const {
    data: recentActivityData,
    isLoading: activityLoading,
    error: activityError,
    refetch: refetchActivity
  } = useRecentActivity(
    profile?.auth_id || '',
    profile?.class_instance_id || undefined
  );

  // Upcoming events
  const {
    data: upcomingEventsData,
    isLoading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents
  } = useUpcomingEvents(
    profile?.school_code || '',
    profile?.class_instance_id || undefined
  );

  // Normalize data - ensure arrays are never undefined
  const recentActivity = React.useMemo(() => {
    const data = recentActivityData || [];
    // Removed debug logging for production
    return Array.isArray(data) ? data : [];
  }, [recentActivityData, activityLoading, activityError]);

  const upcomingEvents = React.useMemo(() => {
    const data = upcomingEventsData || [];
    // Removed debug logging for production
    return Array.isArray(data) ? data : [];
  }, [upcomingEventsData, eventsLoading, eventsError]);

  // Fee overview (for users with read_own capability - typically students)
  const {
    data: feeOverview,
    isLoading: feeLoading,
    error: feeError,
    refetch: refetchFee
  } = useFeeOverview(canViewOwnDataOnly ? (profile?.auth_id || '') : '');

  // Task overview (for users with read_own capability - typically students)
  const {
    data: taskOverview,
    isLoading: taskLoading,
    error: taskError,
    refetch: refetchTask
  } = useTaskOverview(
    canViewOwnDataOnly ? (profile?.auth_id || '') : '',
    profile?.class_instance_id || undefined
  );

  // Syllabus overview (for users with read_own capability - typically students)
  const {
    data: syllabusOverview,
    isLoading: syllabusLoading,
    error: syllabusError,
    refetch: refetchSyllabus
  } = useSyllabusOverview(
    canViewOwnDataOnly && profile?.class_instance_id ? profile.class_instance_id : ''
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const promises: Promise<any>[] = [];

      if (profile?.auth_id && profile?.class_instance_id) {
        promises.push(refetchStats(), refetchActivity());
      }
      if (profile?.school_code) {
        promises.push(refetchEvents());
      }
      if (canViewOwnDataOnly && profile?.auth_id) {
        promises.push(refetchFee(), refetchTask());
      }
      if (canViewOwnDataOnly && profile?.class_instance_id) {
        promises.push(refetchSyllabus());
      }

      // Wait for all refetches to complete
      await Promise.allSettled(promises);
    } catch (err) {
      log.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Quick actions data - filtered by capabilities (NOT roles)
  const quickActionsMap = [
    { title: 'Timetable', icon: CalendarRange, color: colors.primary.main, bgColor: colors.primary[50], route: '/(tabs)/timetable', visible: can('timetable.read') },
    { title: 'Calendar', icon: CalendarDays, color: colors.info.main, bgColor: colors.info[50], route: '/(tabs)/calendar', visible: can('calendar.read') },
    { title: 'Resources', icon: FolderOpen, color: colors.accent.main, bgColor: colors.accent[50], route: '/(tabs)/resources', visible: can('resources.read') },
    { title: 'Syllabus', icon: NotebookText, color: colors.secondary.main, bgColor: colors.secondary[50], route: canViewOwnDataOnly ? '/(tabs)/syllabus-student' : '/(tabs)/syllabus', visible: canViewSyllabus },
    { title: 'Attendance', icon: UserCheck, color: colors.success.main, bgColor: colors.success[50], route: '/(tabs)/attendance', visible: can('attendance.read') || can('attendance.read_own') },
    { title: 'Fees', icon: CreditCard, color: colors.warning.main, bgColor: colors.warning[50], route: canViewOwnDataOnly ? '/(tabs)/fees-student' : '/(tabs)/fees', visible: canViewFees },
    { title: 'Assessments', icon: GraduationCap, color: colors.error.main, bgColor: colors.error[50], route: '/(tabs)/assessments', visible: can('assessments.read') || can('assessments.read_own') },
    { title: 'Tasks', icon: ClipboardList, color: colors.secondary.main, bgColor: colors.secondary[50], route: '/(tabs)/tasks', visible: canViewTasks },
    { title: 'Analytics', icon: LineChart, color: colors.info.main, bgColor: colors.info[50], route: '/(tabs)/analytics', visible: canViewAnalytics },
    { title: 'Payments', icon: ReceiptText, color: colors.warning.main, bgColor: colors.warning[50], route: '/(tabs)/payments', visible: canViewPayments },
    { title: 'Management', icon: Building2, color: colors.neutral[600], bgColor: colors.neutral[50], route: '/(tabs)/manage', visible: canViewManagement },
  ];

  // Filter quick actions based on capabilities (NOT roles)
  const quickActions = quickActionsMap
    .filter(action => {
      // Exclude features that start with "Add"
      if (action.title.startsWith('Add')) return false;
      // Filter by capability visibility
      return action.visible;
    })
    .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically A to Z

  // Dashboard stats data - using capability-based display logic
  // Type guard to ensure stats is a valid DashboardStats object
  const typedStats = stats as DashboardStats | undefined;
  const dashboardStats = typedStats ? [
    {
      title: "Today's Classes",
      value: typedStats.todaysClasses.toString(),
      change: typedStats.todaysClasses > 0 ? `${typedStats.todaysClasses} scheduled` : 'No classes',
      icon: CalendarRange,
      color: colors.primary.main,
      bgColor: colors.primary[50],
      route: '/(tabs)/timetable',
    },
    {
      title: canViewOwnDataOnly ? 'Month Attendance' : 'Total Students',
      value: canViewOwnDataOnly ? `${typedStats.attendancePercentage}%` : (typedStats.totalStudents?.toString() || '0'),
      change: canViewOwnDataOnly
        ? (typedStats.attendancePercentage >= 90 ? 'Excellent' : typedStats.attendancePercentage >= 80 ? 'Good' : typedStats.attendancePercentage >= 75 ? 'Fair' : 'Low')
        : 'in class',
      icon: canViewOwnDataOnly ? TrendingUp : UsersRound,
      color: canViewOwnDataOnly
        ? (typedStats.attendancePercentage >= 90 ? colors.success.main : typedStats.attendancePercentage >= 80 ? colors.info.main : typedStats.attendancePercentage >= 75 ? colors.warning.main : colors.error.main)
        : colors.info.main,
      bgColor: canViewOwnDataOnly
        ? (typedStats.attendancePercentage >= 90 ? colors.success[50] : typedStats.attendancePercentage >= 80 ? colors.info[50] : typedStats.attendancePercentage >= 75 ? colors.warning[50] : colors.error[50])
        : colors.info[50],
      route: canViewOwnDataOnly ? '/(tabs)/attendance' : '/(tabs)/manage',
      showProgress: canViewOwnDataOnly,
      progressValue: canViewOwnDataOnly ? typedStats.attendancePercentage : undefined,
      trend: canViewOwnDataOnly ? (typedStats.attendancePercentage >= 75 ? 'up' as const : 'down' as const) : null,
    },
    {
      title: 'Tasks',
      value: typedStats.pendingAssignments.toString(),
      change: typedStats.pendingAssignments > 0 ? 'Pending' : 'All done',
      icon: FileText,
      color: typedStats.pendingAssignments > 0 ? colors.warning.main : colors.success.main,
      bgColor: typedStats.pendingAssignments > 0 ? colors.warning[50] : colors.success[50],
      route: '/(tabs)/tasks',
    },
    {
      title: 'Upcoming Tests',
      value: typedStats.upcomingTests.toString(),
      change: typedStats.upcomingTests > 0 ? 'This week' : 'None',
      icon: Target,
      color: typedStats.upcomingTests > 0 ? colors.error.main : colors.success.main,
      bgColor: typedStats.upcomingTests > 0 ? colors.error[50] : colors.success[50],
      route: '/(tabs)/assessments',
    },
  ] : [];

  // Determine overall view state
  const isLoading = authLoading || capabilitiesLoading || statsLoading || activityLoading || eventsLoading;
  const hasError = statsError || activityError || eventsError;

  const viewState = isLoading ? 'loading'
    : hasError ? 'error'
      : !profile ? 'empty' : 'success';

  const hasIncompleteProfile = profile && (!profile.school_code || !profile.class_instance_id);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <ThreeStateView
      state={viewState}
      loadingMessage="Loading dashboard..."
      errorMessage="Failed to load dashboard"
      errorDetails={(statsError as any)?.message || (activityError as any)?.message || undefined}
      emptyMessage={
        hasIncompleteProfile
          ? "Profile setup required. Please contact your administrator to complete your account setup."
          : "No profile data available"
      }
      onRetry={handleRefresh}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
            colors={[colors.primary.main]}
          />
        }
      >
        {/* Profile Header - Modern Design */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.md, marginBottom: spacing.sm }}>
          <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary, fontWeight: typography.fontWeight.medium, marginBottom: spacing.xs }}>
            {getGreeting()} 👋
          </RNText>
          <Row spacing="xs" align="center">
            <Heading level={2} style={{ fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>
              {profile?.full_name || 'User'}
            </Heading>
            {classData && (
              <RNText style={{ fontSize: typography.fontSize.base, color: colors.text.secondary, marginLeft: spacing.xs }}>
                • Class {classData.grade}-{classData.section}
              </RNText>
            )}
          </Row>
        </View>

        {/* Quick Actions - Horizontal Scrollable */}
        <View style={{ marginBottom: spacing.lg }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}
          >
            {quickActions.map((action, index) => (
              <QuickAction
                key={index}
                title={action.title}
                icon={action.icon}
                color={action.color}
                bgColor={action.bgColor}
                onPress={() => router.push(action.route as any)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Stats Grid */}
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}>
          <Row wrap spacing="sm">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <StatCardSkeleton key={index} />
              ))
            ) : (
              dashboardStats.map((stat, index) => (
                <StatCard
                  key={index}
                  title={stat.title}
                  value={stat.value}
                  change={stat.change}
                  icon={stat.icon}
                  color={stat.color}
                  bgColor={stat.bgColor}
                  onPress={() => stat.route && router.push(stat.route as any)}
                  showProgress={stat.showProgress}
                  progressValue={stat.progressValue}
                  trend={stat.trend}
                />
              ))
            )}
          </Row>
        </View>

        {/* Quick Stats (Admin Only) - Modern Design */}
        {canViewAdminStats && (
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <RNText style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>
                Quick Stats
              </RNText>
              <TouchableOpacity onPress={() => router.push('/analytics')}>
                <RNText style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primary[600] }}>
                  Analytics
                </RNText>
              </TouchableOpacity>
            </View>
            <View style={{
              backgroundColor: colors.surface.primary,
              borderRadius: borderRadius.lg,
              padding: spacing.md,
              ...shadows.sm,
              borderWidth: 0.5,
              borderColor: colors.border.light,
            }}>
              {[
                { icon: UserCheck, label: 'Class Attendance', value: `${typedStats?.attendancePercentage || 0}% Today`, color: colors.success[600] },
                { icon: FolderOpen, label: 'Resources Shared', value: 'View resources →', color: colors.info[600] },
                { icon: LineChart, label: 'Class Performance', value: 'View analytics →', color: colors.secondary[600] },
              ].map((item, index, arr) => (
                <React.Fragment key={index}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: borderRadius.md,
                      backgroundColor: item.color === colors.success[600] ? colors.success[50] :
                        item.color === colors.info[600] ? colors.info[50] :
                          colors.secondary[50],
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: spacing.sm,
                    }}>
                      <item.icon size={18} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <RNText style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.text.secondary,
                        marginBottom: 2
                      }}>
                        {item.label}
                      </RNText>
                      <RNText style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.text.primary
                      }}>
                        {item.value}
                      </RNText>
                    </View>
                  </View>
                  {index < arr.length - 1 && (
                    <View style={{
                      height: 0.5,
                      backgroundColor: colors.border.light,
                      marginLeft: 44
                    }} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

        {/* Task Overview (for users viewing own data) - Modern Design */}
        {canViewOwnDataOnly && taskOverview && (
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <RNText style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>
                Task Overview
              </RNText>
              <TouchableOpacity onPress={() => router.push('/tasks')}>
                <RNText style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primary[600] }}>
                  View All
                </RNText>
              </TouchableOpacity>
            </View>
            <View style={{
              backgroundColor: colors.surface.primary,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              ...shadows.sm,
              borderWidth: 0.5,
              borderColor: colors.border.light,
            }}>
              {taskOverview.total > 0 ? (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md }}>
                    {[
                      { value: taskOverview.total, label: 'Total', color: colors.text.primary },
                      { value: taskOverview.completed, label: 'Completed', color: colors.success[600] },
                      { value: taskOverview.dueThisWeek, label: 'This Week', color: colors.warning[600] },
                      { value: taskOverview.overdue, label: 'Overdue', color: colors.error[600] },
                    ].map((item, index) => (
                      <View key={index} style={{ alignItems: 'center' }}>
                        <RNText style={{
                          fontSize: typography.fontSize.xl,
                          fontWeight: typography.fontWeight.bold,
                          color: item.color,
                          marginBottom: spacing.xs
                        }}>
                          {item.value}
                        </RNText>
                        <RNText style={{
                          fontSize: typography.fontSize.xs,
                          color: colors.text.secondary,
                          fontWeight: typography.fontWeight.medium
                        }}>
                          {item.label}
                        </RNText>
                      </View>
                    ))}
                  </View>
                  {taskOverview.overdue > 0 && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.error[50],
                      padding: spacing.sm,
                      borderRadius: borderRadius.md,
                      gap: spacing.xs,
                    }}>
                      <AlertCircle size={16} color={colors.error[600]} />
                      <RNText style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.error[700],
                        fontWeight: typography.fontWeight.medium
                      }}>
                        You have {taskOverview.overdue} overdue task{taskOverview.overdue > 1 ? 's' : ''}
                      </RNText>
                    </View>
                  )}
                </>
              ) : (
                <DashboardEmptyState
                  icon={CheckCircle2}
                  title="All caught up! 🎉"
                  message="No tasks assigned yet. Check back soon for new homework and assignments."
                  actionLabel="View All Tasks"
                  onAction={() => router.push('/tasks')}
                />
              )}
            </View>
          </View>
        )}

        {/* Syllabus Progress (for users viewing own data) - Modern Design */}
        {canViewOwnDataOnly && syllabusOverview && (
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <RNText style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>
                Syllabus Progress
              </RNText>
              <TouchableOpacity onPress={() => router.push('/syllabus')}>
                <RNText style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primary[600] }}>
                  View All
                </RNText>
              </TouchableOpacity>
            </View>
            <View style={{
              backgroundColor: colors.surface.primary,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              ...shadows.sm,
              borderWidth: 0.5,
              borderColor: colors.border.light,
            }}>
              {syllabusOverview.totalSubjects > 0 && syllabusOverview.subjectBreakdown.length > 0 ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
                    <View style={{ position: 'relative', marginRight: spacing.lg }}>
                      <ProgressRing
                        progress={syllabusOverview.overallProgress}
                        size={80}
                        strokeWidth={8}
                        color={colors.primary[600]}
                        backgroundColor={colors.neutral[100]}
                        showPercentage={false}
                      />
                      <View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <RNText style={{
                          fontSize: typography.fontSize.lg,
                          fontWeight: typography.fontWeight.bold,
                          color: colors.text.primary
                        }}>
                          {syllabusOverview.overallProgress}%
                        </RNText>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <RNText style={{
                        fontSize: typography.fontSize.lg,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.text.primary,
                        marginBottom: spacing.xs
                      }}>
                        Overall Progress
                      </RNText>
                      <RNText style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.text.secondary
                      }}>
                        {syllabusOverview.subjectBreakdown.reduce((sum, s) => sum + s.completedTopics, 0)} / {' '}
                        {syllabusOverview.subjectBreakdown.reduce((sum, s) => sum + s.totalTopics, 0)} topics completed
                      </RNText>
                    </View>
                  </View>

                  <View style={{ gap: spacing.md }}>
                    {syllabusOverview.subjectBreakdown.slice(0, 3).map((subject) => (
                      <View key={subject.subjectId} style={{
                        paddingTop: spacing.md,
                        borderTopWidth: 0.5,
                        borderTopColor: colors.border.light
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                          <RNText style={{
                            fontSize: typography.fontSize.base,
                            fontWeight: typography.fontWeight.semibold,
                            color: colors.text.primary,
                            flex: 1
                          }} numberOfLines={1}>
                            {subject.subjectName}
                          </RNText>
                          <RNText style={{
                            fontSize: typography.fontSize.base,
                            fontWeight: typography.fontWeight.bold,
                            color: colors.primary[600]
                          }}>
                            {subject.progress}%
                          </RNText>
                        </View>
                        <ProgressBar
                          progress={subject.progress}
                          fillColor={colors.primary[600]}
                          size="sm"
                        />
                        <RNText style={{
                          fontSize: typography.fontSize.xs,
                          color: colors.text.secondary
                        }}>
                          {subject.completedTopics} / {subject.totalTopics} topics
                        </RNText>
                      </View>
                    ))}
                    {syllabusOverview.subjectBreakdown.length > 3 && (
                      <TouchableOpacity onPress={() => router.push('/syllabus')} style={{ alignItems: 'center', paddingTop: spacing.sm }}>
                        <RNText style={{
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.primary[600]
                        }}>
                          +{syllabusOverview.subjectBreakdown.length - 3} more subject{syllabusOverview.subjectBreakdown.length - 3 > 1 ? 's' : ''}
                        </RNText>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <DashboardEmptyState
                  icon={NotebookText}
                  title="No syllabus data yet"
                  message="Syllabus progress will appear here once your teacher starts tracking course completion."
                  actionLabel="View Syllabus"
                  onAction={() => router.push('/syllabus')}
                />
              )}
            </View>
          </View>
        )}

        {/* Fee Overview (for users viewing own data) */}
        {canViewOwnDataOnly && feeOverview && (
          <SectionBlock title="Fee Overview" action={{ label: 'Details', onPress: () => router.push('/fees') }}>
            <Card variant="elevated">
              {feeOverview.totalFee > 0 ? (
                <Stack spacing="sm">
                  <Row justify="space-between">
                    {[
                      { label: 'Total Fee', value: `₹${feeOverview.totalFee.toLocaleString('en-IN')}`, color: colors.text.primary },
                      { label: 'Paid', value: `₹${feeOverview.paidAmount.toLocaleString('en-IN')}`, color: colors.success.main },
                      { label: 'Pending', value: `₹${feeOverview.pendingAmount.toLocaleString('en-IN')}`, color: colors.error.main },
                    ].map((item, index) => (
                      <Stack key={index} align="center" flex>
                        <Caption color="secondary">{item.label}</Caption>
                        <Body weight="bold" style={{ color: item.color }}>{item.value}</Body>
                      </Stack>
                    ))}
                  </Row>
                  <Stack spacing="xs">
                    <ProgressBar
                      progress={(feeOverview.paidAmount / feeOverview.totalFee) * 100}
                      variant="success"
                      size="md"
                    />
                    <Caption color="tertiary" align="center">
                      {Math.round((feeOverview.paidAmount / feeOverview.totalFee) * 100)}% paid
                    </Caption>
                  </Stack>
                </Stack>
              ) : (
                <DashboardEmptyState
                  icon={CreditCard}
                  title="Fee plan not set up yet"
                  message="Your school will assign your fee structure soon. You'll be notified once it's ready."
                  actionLabel="Learn More"
                  onAction={() => router.push('/fees')}
                />
              )}
            </Card>
          </SectionBlock>
        )}

        {/* Upcoming Events */}
        <SectionBlock title="Upcoming Events" action={{ label: 'View All', onPress: () => router.push('/calendar') }}>
          <Card variant="elevated" style={{ minHeight: 120 }}>
            {eventsLoading ? (
              <Stack spacing="sm" padding="md">
                <Skeleton width="100%" height={20} variant="rounded" />
                <Skeleton width="80%" height={16} variant="rounded" />
                <Skeleton width="100%" height={20} variant="rounded" style={{ marginTop: spacing.sm }} />
                <Skeleton width="75%" height={16} variant="rounded" />
              </Stack>
            ) : eventsError ? (
              <Stack align="center" padding="lg">
                <AlertCircle size={32} color={colors.error.main} />
                <Body color="error" align="center" style={{ marginTop: spacing.sm }}>
                  Failed to load events. Pull down to refresh.
                </Body>
              </Stack>
            ) : Array.isArray(upcomingEvents) && upcomingEvents.length > 0 ? (
              <Stack spacing="none">
                {upcomingEvents.map((event, index) => (
                  <Row
                    key={event.id || `event-${index}`}
                    spacing="sm"
                    style={{
                      paddingVertical: spacing.sm,
                      borderBottomWidth: index < upcomingEvents.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border.light,
                    }}
                  >
                    <View style={{
                      width: 3,
                      borderRadius: borderRadius.sm,
                      backgroundColor: event.color || colors.primary.main,
                      alignSelf: 'stretch',
                    }} />
                    <Stack spacing="xs" flex>
                      <Body weight="semibold">{event.title}</Body>
                      <Row spacing="xs" align="center">
                        <CalendarDays size={14} color={colors.text.tertiary} />
                        <Caption color="tertiary">
                          {new Date(event.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </Caption>
                        <Badge variant="secondary" size="sm">{event.type}</Badge>
                      </Row>
                    </Stack>
                  </Row>
                ))}
              </Stack>
            ) : (
              <DashboardEmptyState
                icon={CalendarDays}
                title="Nothing planned yet 📅"
                message="No upcoming events in the next 30 days. Enjoy your regular schedule!"
                actionLabel="View Full Calendar"
                onAction={() => router.push('/calendar')}
              />
            )}
          </Card>
        </SectionBlock>

        {/* Recent Activity */}
        <SectionBlock title="Recent Activity">
          <Card variant="elevated" style={{ minHeight: 120 }}>
            {activityLoading ? (
              <Stack spacing="sm" padding="md">
                <Skeleton width="100%" height={24} variant="rounded" />
                <Skeleton width="70%" height={16} variant="rounded" />
                <Skeleton width="100%" height={24} variant="rounded" style={{ marginTop: spacing.sm }} />
                <Skeleton width="65%" height={16} variant="rounded" />
              </Stack>
            ) : activityError ? (
              <Stack align="center" padding="lg">
                <AlertCircle size={32} color={colors.error.main} />
                <Body color="error" align="center" style={{ marginTop: spacing.sm }}>
                  Failed to load activity. Pull down to refresh.
                </Body>
              </Stack>
            ) : Array.isArray(recentActivity) && recentActivity.length > 0 ? (
              <Stack spacing="none">
                {recentActivity.map((activity, index) => {
                  const getActivityIcon = (type: string) => {
                    switch (type) {
                      case 'attendance': return UserCheck;
                      case 'assignment':
                      case 'task': return NotebookText;
                      case 'test': return Target;
                      case 'event': return CalendarDays;
                      default: return Activity;
                    }
                  };

                  const getActivityColor = (color?: string) => {
                    switch (color) {
                      case 'success': return { bg: colors.success[50], icon: colors.success.main };
                      case 'error': return { bg: colors.error[50], icon: colors.error.main };
                      case 'warning': return { bg: colors.warning[50], icon: colors.warning.main };
                      case 'info': return { bg: colors.info[50], icon: colors.info.main };
                      case 'secondary': return { bg: colors.secondary[50], icon: colors.secondary.main };
                      default: return { bg: colors.primary[50], icon: colors.primary.main };
                    }
                  };

                  const ActivityIcon = getActivityIcon(activity.type);
                  const activityColor = getActivityColor(activity.color);

                  return (
                    <Row
                      key={activity.id || `activity-${index}`}
                      spacing="sm"
                      align="center"
                      style={{
                        paddingVertical: spacing.sm,
                        borderBottomWidth: index < recentActivity.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border.light,
                      }}
                    >
                      <View style={{
                        width: 28,
                        height: 28,
                        borderRadius: borderRadius.sm,
                        backgroundColor: activityColor.bg,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <ActivityIcon size={16} color={activityColor.icon} />
                      </View>
                      <Stack spacing="none" flex>
                        <Body weight="semibold">{activity.title}</Body>
                        <Caption color="secondary">{activity.subtitle}</Caption>
                      </Stack>
                    </Row>
                  );
                })}
              </Stack>
            ) : (
              <DashboardEmptyState
                icon={Activity}
                title="👀 Nothing yet"
                message="Your activity feed will light up here soon. Check back after your first class!"
              />
            )}
          </Card>
        </SectionBlock>
      </ScrollView>
    </ThreeStateView>
  );
}
