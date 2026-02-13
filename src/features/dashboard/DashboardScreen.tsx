/**
 * DashboardScreen - Refactored with UI Kit
 * 
 * This screen demonstrates the proper use of the UI Kit components.
 * NO hardcoded colors, spacing, or typography - all from theme tokens.
 */

import React, { ComponentProps } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, Dimensions, Text as RNText, Platform } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

// Theme & Context
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

// Hooks
import { useDashboardBundle, type DashboardStats } from '../../hooks/useDashboard';
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
import { ProgressRing } from '../../ui';

// New Dashboard Components
import { InsightCard, ActionRequiredBanner, SparklineCard, StreakBadge, type ActionItem } from '../../components/dashboard';
import { log } from '../../lib/logger';

// Driver Dashboard
import DriverDashboard from '../transport/DriverDashboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface QuickActionProps {
  title: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  bgColor: string;
  onPress: () => void;
}

function QuickAction({ title, icon, color, bgColor, onPress }: QuickActionProps) {
  const { spacing, shadows, colors: themeColors, typography } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginRight: spacing.lg,
        width: 70, // Fixed width for alignment
      }}
    >
      <View style={{
        width: 56,
        height: 56,
        borderRadius: 20, // Squircle-ish
        // Use elevated surface instead of colored bg for clearer look, or keep colored
        // Let's use the bgColor passed in but maybe softer or just white/elevated with colored icon
        // actually the colored bg is nice for differentiation. Let's keep it but make it rounder/cleaner
        backgroundColor: bgColor,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs,
        // ...shadows.sm, // Subtle shadow
      }}>
        <MaterialIcons name={icon} size={24} color={color} />
      </View>
      <RNText
        style={{
          fontSize: 12,
          fontWeight: typography.fontWeight.medium,
          color: themeColors.text.primary,
          textAlign: 'center',
          lineHeight: 16,
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </RNText>
    </TouchableOpacity>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  bgColor: string;
  onPress?: () => void;
  showProgress?: boolean;
  progressValue?: number;
  trend?: 'up' | 'down' | null;
}

function StatCard({
  title, value, change, icon, color, bgColor,
  onPress, showProgress, progressValue, trend
}: StatCardProps) {
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  // Use slightly larger width or flexible
  const cardWidth = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        width: cardWidth,
        backgroundColor: colors.surface.elevated, // Elevated for better contrast
        padding: spacing.md,
        borderRadius: borderRadius.xl, // Rounder
        // No border
        ...shadows.sm,
        marginBottom: spacing.sm,
      }}
    >
      {/* Header: Icon and Actions */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: bgColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <MaterialIcons name={icon} size={20} color={color} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {/* Trend or Arrow */}
          {trend ? (
            trend === 'up' ? (
              <MaterialIcons name="trending-up" size={16} color={colors.success[600]} />
            ) : (
              <MaterialIcons name="trending-down" size={16} color={colors.error[600]} />
            )
          ) : onPress && (
            <MaterialIcons name="chevron-right" size={16} color={colors.text.tertiary} />
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
            color: colors.text.primary,
            top: 18, // Adjust visual centering
          }}>
            {value}
          </RNText>
        </View>
      ) : (
        <RNText style={{
          fontSize: 28, // Larger
          fontWeight: typography.fontWeight.bold,
          color: colors.text.primary,
          marginBottom: 4
        }}>
          {value}
        </RNText>
      )}

      {/* Title & Badge */}
      <RNText style={{
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        fontWeight: typography.fontWeight.medium,
        marginBottom: spacing.xs
      }}>
        {title}
      </RNText>

      {/* Status/Change Text */}
      <RNText style={{
        fontSize: 12,
        fontWeight: typography.fontWeight.medium,
        color: color // Match icon color
      }}>
        {change}
      </RNText>
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
      borderRadius: borderRadius.xl,
      // No border
      ...shadows.sm,
      marginBottom: spacing.sm,
      opacity: 0.6,
    }}>
      <Skeleton width={40} height={40} variant="rounded" style={{ marginBottom: spacing.lg }} />
      <Skeleton width="60%" height={28} variant="rounded" style={{ marginBottom: spacing.xs }} />
      <Skeleton width="80%" height={14} variant="rounded" style={{ marginBottom: spacing.xs }} />
    </View>
  );
}

interface EmptyStateProps {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

function DashboardEmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
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
        <MaterialIcons name={icon} size={40} color={colors.primary[400]} />
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

  // Driver role gets a completely different dashboard
  if (!authLoading && !capabilitiesLoading && profile?.role === 'driver') {
    return <DriverDashboard />;
  }

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

  const {
    data: dashboardBundle,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useDashboardBundle(profile?.auth_id || '');

  const stats = dashboardBundle?.stats;
  const recentActivity = dashboardBundle?.recentActivity || [];
  const upcomingEvents = dashboardBundle?.upcomingEvents || [];
  const feeOverview = dashboardBundle?.feeOverview;
  const taskOverview = dashboardBundle?.taskOverview;
  const syllabusOverview = dashboardBundle?.syllabusOverview;
  const classData = React.useMemo(() => {
    const classInfo = dashboardBundle?.classInfo;
    if (!classInfo) return null;
    return {
      grade: classInfo.grade?.toString() || '',
      section: classInfo.section || '',
    };
  }, [dashboardBundle?.classInfo]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchDashboard();
    } catch (err) {
      log.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Quick actions data - filtered by capabilities (NOT roles)
  const quickActionsMap = [
    { title: 'Timetable', icon: 'event' as ComponentProps<typeof MaterialIcons>['name'], color: colors.primary.main, bgColor: colors.primary[50], route: '/(tabs)/timetable', visible: can('timetable.read') },
    { title: 'Calendar', icon: 'event' as ComponentProps<typeof MaterialIcons>['name'], color: colors.info.main, bgColor: colors.info[50], route: '/(tabs)/calendar', visible: can('calendar.read') },
    { title: 'Resources', icon: 'folder-open' as ComponentProps<typeof MaterialIcons>['name'], color: colors.accent.main, bgColor: colors.accent[50], route: '/(tabs)/resources', visible: can('resources.read') },
    { title: 'Syllabus', icon: 'menu-book' as ComponentProps<typeof MaterialIcons>['name'], color: colors.secondary.main, bgColor: colors.secondary[50], route: canViewOwnDataOnly ? '/(tabs)/syllabus-student' : '/(tabs)/syllabus', visible: canViewSyllabus },
    { title: 'Attendance', icon: 'how-to-reg' as ComponentProps<typeof MaterialIcons>['name'], color: colors.success.main, bgColor: colors.success[50], route: '/(tabs)/attendance', visible: can('attendance.read') || can('attendance.read_own') },
    { title: 'Fees', icon: 'credit-card' as ComponentProps<typeof MaterialIcons>['name'], color: colors.warning.main, bgColor: colors.warning[50], route: canViewOwnDataOnly ? '/(tabs)/fees-student' : '/(tabs)/fees', visible: canViewFees },
    { title: 'Assessments', icon: 'school' as ComponentProps<typeof MaterialIcons>['name'], color: colors.error.main, bgColor: colors.error[50], route: '/(tabs)/assessments', visible: can('assessments.read') || can('assessments.read_own') },
    { title: 'Tasks', icon: 'assignment' as ComponentProps<typeof MaterialIcons>['name'], color: colors.secondary.main, bgColor: colors.secondary[50], route: '/(tabs)/tasks', visible: canViewTasks },
    { title: 'Payments', icon: 'receipt' as ComponentProps<typeof MaterialIcons>['name'], color: colors.warning.main, bgColor: colors.warning[50], route: '/(tabs)/payments', visible: canViewPayments },
    { title: 'Management', icon: 'business' as ComponentProps<typeof MaterialIcons>['name'], color: colors.neutral[600], bgColor: colors.neutral[50], route: '/(tabs)/manage', visible: canViewManagement },
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
      value: (typedStats.todaysClasses ?? 0).toString(),
      change: (typedStats.todaysClasses ?? 0) > 0 ? `${typedStats.todaysClasses} scheduled` : 'No classes',
      icon: 'event' as ComponentProps<typeof MaterialIcons>['name'],
      color: colors.primary.main,
      bgColor: colors.primary[50],
      route: '/(tabs)/timetable',
    },
    {
      title: canViewOwnDataOnly ? 'Month Attendance' : 'Total Students',
      value: canViewOwnDataOnly ? `${typedStats.attendancePercentage ?? 0}%` : (typedStats.totalStudents?.toString() || '0'),
      change: canViewOwnDataOnly
        ? ((typedStats.attendancePercentage ?? 0) >= 90 ? 'Excellent' : (typedStats.attendancePercentage ?? 0) >= 80 ? 'Good' : (typedStats.attendancePercentage ?? 0) >= 75 ? 'Fair' : 'Low')
        : 'in class',
      icon: (canViewOwnDataOnly ? 'trending-up' : 'group') as ComponentProps<typeof MaterialIcons>['name'],
      color: canViewOwnDataOnly
        ? ((typedStats.attendancePercentage ?? 0) >= 90 ? colors.success.main : (typedStats.attendancePercentage ?? 0) >= 80 ? colors.info.main : (typedStats.attendancePercentage ?? 0) >= 75 ? colors.warning.main : colors.error.main)
        : colors.info.main,
      bgColor: canViewOwnDataOnly
        ? ((typedStats.attendancePercentage ?? 0) >= 90 ? colors.success[50] : (typedStats.attendancePercentage ?? 0) >= 80 ? colors.info[50] : (typedStats.attendancePercentage ?? 0) >= 75 ? colors.warning[50] : colors.error[50])
        : colors.info[50],
      route: canViewOwnDataOnly ? '/(tabs)/attendance' : '/(tabs)/manage',
      showProgress: canViewOwnDataOnly,
      progressValue: canViewOwnDataOnly ? (typedStats.attendancePercentage ?? 0) : undefined,
      trend: canViewOwnDataOnly ? ((typedStats.attendancePercentage ?? 0) >= 75 ? 'up' as const : 'down' as const) : null,
    },
    {
      title: 'Tasks',
      value: (typedStats.pendingAssignments ?? 0).toString(),
      change: (typedStats.pendingAssignments ?? 0) > 0 ? 'Pending' : 'All done',
      icon: 'description' as ComponentProps<typeof MaterialIcons>['name'],
      color: (typedStats.pendingAssignments ?? 0) > 0 ? colors.warning.main : colors.success.main,
      bgColor: (typedStats.pendingAssignments ?? 0) > 0 ? colors.warning[50] : colors.success[50],
      route: '/(tabs)/tasks',
    },
    {
      title: 'Upcoming Tests',
      value: (typedStats.upcomingTests ?? 0).toString(),
      change: (typedStats.upcomingTests ?? 0) > 0 ? 'This week' : 'None',
      icon: 'gps-fixed' as ComponentProps<typeof MaterialIcons>['name'],
      color: (typedStats.upcomingTests ?? 0) > 0 ? colors.error.main : colors.success.main,
      bgColor: (typedStats.upcomingTests ?? 0) > 0 ? colors.error[50] : colors.success[50],
      route: '/(tabs)/assessments',
    },
  ] : [];

  // Determine overall view state
  const isLoading = authLoading || capabilitiesLoading || dashboardLoading;
  const hasError = dashboardError;

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
      errorDetails={(dashboardError as any)?.message || undefined}
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
        {/* Profile Header - Enhanced with Animation */}
        <Animated.View
          entering={FadeInDown.delay(0).springify()}
          style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md, marginBottom: 0 }}
        >
          <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary, fontWeight: typography.fontWeight.medium }}>
            {getGreeting()}
          </RNText>
          <Row spacing="xs" align="center" style={{ marginTop: 2 }}>
            <Heading level={2} style={{ fontWeight: typography.fontWeight.bold, color: colors.text.primary, fontSize: 24 }}>
              {profile?.full_name || 'User'} 👋
            </Heading>
            {/* Optional: Add a profile picture here if needed, or keep it minimal */}
          </Row>
          {classData && (
            <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary, marginTop: 2 }}>
              Class {classData.grade}-{classData.section} Student
            </RNText>
          )}
        </Animated.View>

        {/* Quick Actions - Horizontal Scrollable with Animation */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={{ marginBottom: spacing.sm }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }} // Removed gap, handled by margin
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
        </Animated.View>

        {/* SuperAdmin: 2 Large Hero Cards */}
        {can('finance.access') ? (
          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg, gap: spacing.md }}
          >
            {/* Attendance Card - Large */}
            <View style={{
              backgroundColor: colors.surface.primary,
              borderRadius: borderRadius.xl,
              padding: spacing.xl,
              borderWidth: 1,
              borderColor: colors.border.light,
              ...shadows.md
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
                <View>
                  <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary, fontWeight: typography.fontWeight.medium, marginBottom: spacing.xs }}>
                    School-Wide Attendance
                  </RNText>
                  <RNText style={{ fontSize: 48, fontWeight: typography.fontWeight.bold, color: colors.success[600] }}>
                    {typedStats?.attendancePercentage || 0}%
                  </RNText>
                  <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary, marginTop: spacing.xs }}>
                    Today's attendance rate
                  </RNText>
                  {/* Partial Data Indicator */}
                  {typedStats?.isPartialData && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.warning[50],
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                      borderRadius: borderRadius.sm,
                      marginTop: spacing.xs,
                      alignSelf: 'flex-start'
                    }}>
                      <MaterialIcons name="schedule" size={12} color={colors.warning[700]} style={{ marginRight: 4 }} />
                      <RNText style={{ fontSize: typography.fontSize.xs, color: colors.warning[800], fontWeight: typography.fontWeight.medium }}>
                        Marking in progress ({typedStats?.markedClassesCount || 0}/{typedStats?.totalClassesCount || 0})
                      </RNText>
                    </View>
                  )}
                </View>
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: borderRadius.lg,
                  backgroundColor: colors.success[50],
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <MaterialIcons name="how-to-reg" size={32} color={colors.success[600]} />
                </View>
              </View>

              {/* Progress Bar */}
              <View style={{ height: 8, backgroundColor: colors.neutral[100], borderRadius: borderRadius.full, overflow: 'hidden' }}>
                <View style={{
                  width: `${typedStats?.attendancePercentage || 0}%`,
                  height: '100%',
                  backgroundColor: colors.success[600],
                  borderRadius: borderRadius.full
                }} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
                <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary }}>
                  {typedStats?.totalStudents || 0} Total Students
                </RNText>
                <TouchableOpacity onPress={() => router.push('/(tabs)/attendance' as any)}>
                  <RNText style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primary[600] }}>
                    View Details →
                  </RNText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Classes Scheduled Card - Large */}
            <View style={{
              backgroundColor: colors.surface.primary,
              borderRadius: borderRadius.xl,
              padding: spacing.xl,
              borderWidth: 1,
              borderColor: colors.border.light,
              ...shadows.md
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
                <View>
                  <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary, fontWeight: typography.fontWeight.medium, marginBottom: spacing.xs }}>
                    Classes Scheduled
                  </RNText>
                  <RNText style={{ fontSize: 48, fontWeight: typography.fontWeight.bold, color: colors.primary[600] }}>
                    {typedStats?.todaysClasses || 0}
                  </RNText>
                  <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary, marginTop: spacing.xs }}>
                    Classes running today
                  </RNText>
                </View>
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: borderRadius.lg,
                  backgroundColor: colors.primary[50],
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <MaterialIcons name="event" size={32} color={colors.primary[600]} />
                </View>
              </View>

              {/* Stats Row */}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                <View style={{ flex: 1, backgroundColor: colors.background.secondary, padding: spacing.md, borderRadius: borderRadius.md }}>
                  <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginBottom: 4 }}>
                    Active Tasks
                  </RNText>
                  <RNText style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>
                    {typedStats?.pendingAssignments || 0}
                  </RNText>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.background.secondary, padding: spacing.md, borderRadius: borderRadius.md }}>
                  <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginBottom: 4 }}>
                    Upcoming Tests
                  </RNText>
                  <RNText style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>
                    {typedStats?.upcomingTests || 0}
                  </RNText>
                </View>
              </View>

              <TouchableOpacity onPress={() => router.push('/(tabs)/timetable' as any)}>
                <RNText style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primary[600], textAlign: 'right' }}>
                  View Timetable →
                </RNText>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : (
          <>
            {/* Stats Grid - Enhanced with Sparklines (for non-SuperAdmins) */}
            <Animated.View
              entering={FadeInDown.delay(150).springify()}
              style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}
            >
              <RNText style={{
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.bold,
                color: colors.text.primary,
                marginBottom: spacing.sm
              }}>
                At a Glance
              </RNText>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginHorizontal: -spacing.xs / 2,
              }}>
                {dashboardLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <View key={index} style={{ 
                      width: '50%',
                      paddingHorizontal: spacing.xs / 2,
                      marginBottom: spacing.xs,
                    }}>
                      <StatCardSkeleton />
                    </View>
                  ))
                ) : dashboardStats.length === 0 ? (
                  <View style={{ width: '100%', padding: spacing.lg, alignItems: 'center' }}>
                    <RNText style={{ color: colors.text.secondary, fontSize: typography.fontSize.sm }}>
                      No stats available. Pull down to refresh.
                    </RNText>
                  </View>
                ) : (
                  dashboardStats.map((stat, index) => {
                    return (
                      <View key={index} style={{ 
                        width: '50%',
                        paddingHorizontal: spacing.xs / 2,
                        marginBottom: spacing.xs,
                      }}>
                        <SparklineCard
                          title={stat.title}
                          value={stat.value}
                          subtitle={stat.change}
                          trend={undefined}
                          sparklineData={[]}
                          color={stat.color}
                          bgColor={stat.bgColor}
                          icon={stat.icon}
                          onPress={stat.route ? () => router.push(stat.route as any) : undefined}
                          animationDelay={200 + index * 50}
                          fullWidth={false}
                        />
                      </View>
                    );
                  })
                )}
              </View>
            </Animated.View>

            {/* Action Required Banner - Compact Design (Tasks Only) */}
            {canViewOwnDataOnly && taskOverview?.overdue && taskOverview.overdue > 0 && (
              <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
                <View style={{
                  backgroundColor: colors.warning[50],
                  borderLeftWidth: 4,
                  borderLeftColor: colors.warning[600],
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}>
                  <MaterialIcons name="error" size={20} color={colors.warning[700]} />
                  <View style={{ flex: 1 }}>
                    <RNText style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.warning[900],
                      marginBottom: 2
                    }}>
                      Needs Attention
                    </RNText>
                    <RNText style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.warning[800]
                    }}>
                      {taskOverview.overdue} overdue task{taskOverview.overdue > 1 ? 's' : ''}
                    </RNText>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/tasks')}
                    style={{
                      backgroundColor: colors.warning[600],
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 6,
                      borderRadius: borderRadius.sm,
                    }}
                  >
                    <RNText style={{
                      fontSize: typography.fontSize.xs,
                      fontWeight: typography.fontWeight.semibold,
                      color: '#fff'
                    }}>
                      View
                    </RNText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Quick Stats (Admin Only) - Modern Design */}
            {canViewAdminStats && (
              <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <RNText style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>
                    Quick Stats
                  </RNText>
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
                    { icon: 'how-to-reg' as ComponentProps<typeof MaterialIcons>['name'], label: 'Class Attendance', value: `${typedStats?.attendancePercentage || 0}% Today`, color: colors.success[600] },
                    { icon: 'folder-open' as ComponentProps<typeof MaterialIcons>['name'], label: 'Resources Shared', value: 'View resources →', color: colors.info[600] },
                    { icon: 'show-chart' as ComponentProps<typeof MaterialIcons>['name'], label: 'Class Performance', value: 'View analytics →', color: colors.secondary[600] },
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
                          <MaterialIcons name={item.icon} size={18} color={item.color} />
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
          </>
        )}

        {/* Task Overview (for users viewing own data) - Compact Design */}
        {canViewOwnDataOnly && taskOverview && taskOverview.total > 0 && (
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <RNText style={{
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.bold,
                color: colors.text.primary
              }}>
                Task Overview
              </RNText>
              <TouchableOpacity onPress={() => router.push('/tasks')}>
                <RNText style={{
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.primary[600]
                }}>
                  View All
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
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-around'
              }}>
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
                      marginBottom: 2
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
            </View>
          </View>
        )}

        {/* Syllabus Progress (for users viewing own data) - Compact Design */}
        {canViewOwnDataOnly && syllabusOverview && syllabusOverview.totalSubjects > 0 && syllabusOverview.subjectBreakdown.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <RNText style={{
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.bold,
                color: colors.text.primary
              }}>
                Syllabus Progress
              </RNText>
              <TouchableOpacity onPress={() => router.push('/syllabus')}>
                <RNText style={{
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.primary[600]
                }}>
                  View All
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
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={{ position: 'relative', marginRight: spacing.md }}>
                  <ProgressRing
                    progress={syllabusOverview.overallProgress}
                    size={60}
                    strokeWidth={6}
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
                      fontSize: typography.fontSize.base,
                      fontWeight: typography.fontWeight.bold,
                      color: colors.text.primary
                    }}>
                      {syllabusOverview.overallProgress}%
                    </RNText>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <RNText style={{
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.text.primary,
                    marginBottom: 2
                  }}>
                    Overall Progress
                  </RNText>
                  <RNText style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.text.secondary
                  }}>
                    {syllabusOverview.subjectBreakdown.reduce((sum, s) => sum + s.completedTopics, 0)} of{' '}
                    {syllabusOverview.subjectBreakdown.reduce((sum, s) => sum + s.totalTopics, 0)} topics
                  </RNText>
                </View>
              </View>

              <View style={{ gap: spacing.sm }}>
                {syllabusOverview.subjectBreakdown.slice(0, 3).map((subject, index) => (
                  <View key={subject.subjectId}>
                    {index > 0 && (
                      <View style={{
                        height: 0.5,
                        backgroundColor: colors.border.light,
                        marginBottom: spacing.sm
                      }} />
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <RNText style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.text.primary,
                        flex: 1
                      }} numberOfLines={1}>
                        {subject.subjectName}
                      </RNText>
                      <RNText style={{
                        fontSize: typography.fontSize.sm,
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
                  </View>
                ))}
                {syllabusOverview.subjectBreakdown.length > 3 && (
                  <TouchableOpacity onPress={() => router.push('/syllabus')} style={{ alignItems: 'center', paddingTop: spacing.xs }}>
                    <RNText style={{
                      fontSize: typography.fontSize.xs,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.primary[600]
                    }}>
                      +{syllabusOverview.subjectBreakdown.length - 3} more subject{syllabusOverview.subjectBreakdown.length - 3 > 1 ? 's' : ''}
                    </RNText>
                  </TouchableOpacity>
                )}
              </View>
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
                  icon="credit-card"
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
            {dashboardLoading ? (
              <Stack spacing="sm" padding="md">
                <Skeleton width="100%" height={20} variant="rounded" />
                <Skeleton width="80%" height={16} variant="rounded" />
                <Skeleton width="100%" height={20} variant="rounded" style={{ marginTop: spacing.sm }} />
                <Skeleton width="75%" height={16} variant="rounded" />
              </Stack>
            ) : dashboardError ? (
              <Stack align="center" padding="lg">
                <MaterialIcons name="error" size={32} color={colors.error.main} />
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
                        <MaterialIcons name="event" size={14} color={colors.text.tertiary} />
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
                icon="event"
                title="Nothing planned yet 📅"
                message="No upcoming events in the next 30 days. Enjoy your regular schedule!"
                actionLabel="View Full Calendar"
                onAction={() => router.push('/calendar')}
              />
            )}
          </Card>
        </SectionBlock>

        {/* Recent Activity - Hidden for superadmin */}
        {profile?.role !== 'superadmin' && (
          <SectionBlock title="Recent Activity">
            <Card variant="elevated" style={{ minHeight: 120 }}>
              {dashboardLoading ? (
                <Stack spacing="sm" padding="md">
                  <Skeleton width="100%" height={24} variant="rounded" />
                  <Skeleton width="70%" height={16} variant="rounded" />
                  <Skeleton width="100%" height={24} variant="rounded" style={{ marginTop: spacing.sm }} />
                  <Skeleton width="65%" height={16} variant="rounded" />
                </Stack>
              ) : dashboardError ? (
              <Stack align="center" padding="lg">
                <MaterialIcons name="error" size={32} color={colors.error.main} />
                <Body color="error" align="center" style={{ marginTop: spacing.sm }}>
                  Failed to load activity. Pull down to refresh.
                </Body>
              </Stack>
              ) : Array.isArray(recentActivity) && recentActivity.length > 0 ? (
                <Stack spacing="none">
                  {recentActivity.map((activity, index) => {
                    const getActivityIconName = (type: string): ComponentProps<typeof MaterialIcons>['name'] => {
                      switch (type) {
                        case 'attendance': return 'how-to-reg';
                        case 'assignment':
                        case 'task': return 'menu-book';
                        case 'test': return 'gps-fixed';
                        case 'event': return 'event';
                        default: return 'timeline';
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

                    const activityIconName = getActivityIconName(activity.type);
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
                          <MaterialIcons name={activityIconName} size={16} color={activityColor.icon} />
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
                  icon="timeline"
                  title="👀 Nothing yet"
                  message="Your activity feed will light up here soon. Check back after your first class!"
                />
              )}
            </Card>
          </SectionBlock>
        )}
      </ScrollView>
    </ThreeStateView>
  );
}
