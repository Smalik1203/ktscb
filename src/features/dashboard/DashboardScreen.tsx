/**
 * DashboardScreen - Refactored with UI Kit
 * 
 * This screen demonstrates the proper use of the UI Kit components.
 * NO hardcoded colors, spacing, or typography - all from theme tokens.
 */

import React from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
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
import { useClass } from '../../hooks/useClasses';
import { 
  useDashboardStats, useRecentActivity, useUpcomingEvents, 
  useFeeOverview, useTaskOverview, useSyllabusOverview 
} from '../../hooks/useDashboard';

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
  const { spacing, borderRadius } = useTheme();
  
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{ alignItems: 'center', marginRight: spacing.lg, minWidth: 70 }}
    >
      <View style={{
        width: 56,
        height: 56,
        borderRadius: borderRadius.lg,
        backgroundColor: bgColor,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs,
      }}>
        <Icon size={24} color={color} strokeWidth={2.5} />
      </View>
      <Caption weight="semibold" align="center" color="primary" numberOfLines={1}>
        {title}
      </Caption>
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
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
  const cardWidth = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        width: cardWidth,
        backgroundColor: colors.surface.elevated,
        padding: spacing.md,
        borderRadius: borderRadius.xl,
        borderWidth: isDark ? 1 : 0,
        borderColor: colors.border.light,
        ...(!isDark && shadows.sm),
      }}
    >
      <Row justify="space-between" align="flex-start" spacing="none">
        <View style={{
          width: 36,
          height: 36,
          borderRadius: borderRadius.lg,
          backgroundColor: bgColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Icon size={18} color={color} strokeWidth={2.5} />
        </View>
        {trend && (
          <View style={{ marginLeft: 'auto', marginRight: spacing.xs, padding: 2 }}>
            {trend === 'up' ? (
              <ArrowUpRight size={12} color={colors.success.main} />
            ) : (
              <ArrowDownRight size={12} color={colors.error.main} />
            )}
          </View>
        )}
        {onPress && (
          <ChevronRight size={14} color={colors.text.tertiary} style={{ marginLeft: 'auto' }} />
        )}
      </Row>
      
      {showProgress && progressValue !== undefined ? (
        <Center style={{ marginVertical: spacing.xs }}>
          <ProgressRing
            progress={progressValue}
            size={60}
            strokeWidth={6}
            color={color}
            backgroundColor={colors.neutral[100]}
            showPercentage={false}
          />
          <Heading level={4} style={{ position: 'absolute' }}>{value}</Heading>
        </Center>
      ) : (
        <Heading level={2} style={{ marginBottom: 2 }}>{value}</Heading>
      )}
      
      <Caption color="secondary" style={{ marginBottom: spacing.xs }}>{title}</Caption>
      
      <View style={{
        backgroundColor: color,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        alignSelf: 'flex-start',
        marginTop: spacing.xs,
      }}>
        <Caption weight="semibold" color="inverse">{change}</Caption>
      </View>
    </TouchableOpacity>
  );
}

function StatCardSkeleton() {
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
  const cardWidth = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

  return (
    <View style={{
      width: cardWidth,
      backgroundColor: colors.surface.elevated,
      padding: spacing.md,
      borderRadius: borderRadius.xl,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border.light,
      ...(!isDark && shadows.sm),
      opacity: 0.6,
    }}>
      <Skeleton width={36} height={36} variant="rounded" style={{ marginBottom: spacing.sm }} />
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
  const { colors, spacing, borderRadius, isDark } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);
  
  const isStudent = profile?.role === 'student';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  
  // Get class data for display
  const { data: classData } = useClass(profile?.class_instance_id || '');
  
  // Real data hooks
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats(
    profile?.auth_id || '', 
    profile?.class_instance_id || undefined,
    profile?.role
  );
  const { data: recentActivity, isLoading: activityLoading, error: activityError, refetch: refetchActivity } = useRecentActivity(
    profile?.auth_id || '', 
    profile?.class_instance_id || undefined
  );
  const { data: upcomingEvents, refetch: refetchEvents } = useUpcomingEvents(
    profile?.school_code || '',
    profile?.class_instance_id || undefined
  );
  const { data: feeOverview, refetch: refetchFee } = useFeeOverview(
    isStudent ? profile?.auth_id || '' : ''
  );
  const { data: taskOverview, refetch: refetchTask } = useTaskOverview(
    isStudent ? profile?.auth_id || '' : '',
    profile?.class_instance_id || undefined
  );
  const { data: syllabusOverview, refetch: refetchSyllabus } = useSyllabusOverview(
    profile?.class_instance_id || ''
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
      if (isStudent && profile?.auth_id) {
        promises.push(refetchFee(), refetchTask());
      }
      if (isStudent && profile?.class_instance_id) {
        promises.push(refetchSyllabus());
      }
      
      await Promise.all(promises);
    } catch (err) {
      log.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Quick actions data - all menu items filtered by role (excluding "Add" features)
  const role = profile?.role;
  const quickActionsMap = [
    { title: 'Timetable', icon: CalendarRange, color: colors.primary.main, bgColor: colors.primary[50], route: '/(tabs)/timetable' },
    { title: 'Calendar', icon: CalendarDays, color: colors.info.main, bgColor: colors.info[50], route: '/(tabs)/calendar' },
    { title: 'Resources', icon: FolderOpen, color: colors.accent.main, bgColor: colors.accent[50], route: '/(tabs)/resources' },
    { title: 'Syllabus', icon: NotebookText, color: colors.secondary.main, bgColor: colors.secondary[50], route: role === 'student' ? '/(tabs)/syllabus-student' : '/(tabs)/syllabus', roles: ['admin', 'superadmin', 'cb_admin', 'teacher', 'student'] },
    { title: 'Attendance', icon: UserCheck, color: colors.success.main, bgColor: colors.success[50], route: '/(tabs)/attendance', roles: ['admin', 'superadmin', 'cb_admin', 'student'] },
    { title: 'Fees', icon: CreditCard, color: colors.warning.main, bgColor: colors.warning[50], route: role === 'student' ? '/(tabs)/fees-student' : '/(tabs)/fees', roles: ['admin', 'superadmin', 'cb_admin', 'student'] },
    { title: 'Assessments', icon: GraduationCap, color: colors.error.main, bgColor: colors.error[50], route: '/(tabs)/assessments' },
    { title: 'Tasks', icon: ClipboardList, color: colors.secondary.main, bgColor: colors.secondary[50], route: '/(tabs)/tasks', roles: ['admin', 'superadmin', 'cb_admin', 'student'] },
    { title: 'Analytics', icon: LineChart, color: colors.info.main, bgColor: colors.info[50], route: '/(tabs)/analytics', roles: ['admin', 'superadmin', 'cb_admin', 'student'] },
    { title: 'Payments', icon: ReceiptText, color: colors.warning.main, bgColor: colors.warning[50], route: '/(tabs)/payments', roles: ['admin', 'superadmin', 'cb_admin'] },
    { title: 'Management', icon: Building2, color: colors.neutral[600], bgColor: colors.neutral[50], route: '/(tabs)/manage', roles: ['admin', 'superadmin', 'cb_admin'] },
  ];

  // Filter quick actions based on user role and exclude "Add" features
  const quickActions = quickActionsMap
    .filter(action => {
      // Exclude features that start with "Add"
      if (action.title.startsWith('Add')) return false;
      // Filter by role
      if (!action.roles) return true; // No role restriction
      return action.roles.includes(role as any);
    })
    .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically A to Z

  // Dashboard stats data
  const dashboardStats = stats ? [
    {
      title: "Today's Classes",
      value: stats.todaysClasses.toString(),
      change: stats.todaysClasses > 0 ? `${stats.todaysClasses} scheduled` : 'No classes',
      icon: CalendarRange,
      color: colors.primary.main,
      bgColor: colors.primary[50],
      route: '/(tabs)/timetable',
    },
    {
      title: isStudent ? 'Month Attendance' : 'Total Students',
      value: isStudent ? `${stats.attendancePercentage}%` : (stats.totalStudents?.toString() || '0'),
      change: isStudent 
        ? (stats.attendancePercentage >= 90 ? 'Excellent' : stats.attendancePercentage >= 80 ? 'Good' : stats.attendancePercentage >= 75 ? 'Fair' : 'Low')
        : 'in class',
      icon: isStudent ? TrendingUp : UsersRound,
      color: isStudent 
        ? (stats.attendancePercentage >= 90 ? colors.success.main : stats.attendancePercentage >= 80 ? colors.info.main : stats.attendancePercentage >= 75 ? colors.warning.main : colors.error.main)
        : colors.info.main,
      bgColor: isStudent 
        ? (stats.attendancePercentage >= 90 ? colors.success[50] : stats.attendancePercentage >= 80 ? colors.info[50] : stats.attendancePercentage >= 75 ? colors.warning[50] : colors.error[50])
        : colors.info[50],
      route: isStudent ? '/(tabs)/attendance' : '/(tabs)/manage',
      showProgress: isStudent,
      progressValue: isStudent ? stats.attendancePercentage : undefined,
      trend: isStudent ? (stats.attendancePercentage >= 75 ? 'up' as const : 'down' as const) : null,
    },
    {
      title: 'Tasks',
      value: stats.pendingAssignments.toString(),
      change: stats.pendingAssignments > 0 ? 'Pending' : 'All done',
      icon: FileText,
      color: stats.pendingAssignments > 0 ? colors.warning.main : colors.success.main,
      bgColor: stats.pendingAssignments > 0 ? colors.warning[50] : colors.success[50],
      route: '/(tabs)/tasks',
    },
    {
      title: 'Upcoming Tests',
      value: stats.upcomingTests.toString(),
      change: stats.upcomingTests > 0 ? 'This week' : 'None',
      icon: Target,
      color: stats.upcomingTests > 0 ? colors.error.main : colors.success.main,
      bgColor: stats.upcomingTests > 0 ? colors.error[50] : colors.success[50],
      route: '/(tabs)/assessments',
    },
  ] : [];

  const viewState = (authLoading || statsLoading || activityLoading) ? 'loading' 
    : (statsError || activityError) ? 'error' 
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
      errorDetails={statsError?.message || activityError?.message}
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
        {/* Profile Header */}
        <Stack spacing="xs" padding="md" style={{ paddingTop: spacing.lg, marginBottom: spacing.sm }}>
          <Body color="secondary" weight="medium">{getGreeting()} 👋</Body>
          <Row spacing="xs" align="center">
            <Heading level={3}>{profile?.full_name || 'User'}</Heading>
              {classData && (
              <Body color="secondary"> • Class {classData.grade}-{classData.section}</Body>
              )}
          </Row>
        </Stack>

        {/* Quick Actions */}
        <View style={{ marginBottom: spacing.md }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
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

        {/* Class Overview (Admin Only) */}
        {isAdmin && stats && (
          <SectionBlock title="Class Overview" action={{ label: 'Manage', onPress: () => router.push('/manage') }}>
            <Card variant="elevated">
              <Row wrap spacing="md" justify="space-between">
                {[
                  { icon: UsersRound, value: stats.totalStudents || 0, label: 'Total Students', color: colors.info },
                  { icon: CalendarRange, value: stats.todaysClasses, label: "Today's Classes", color: colors.primary },
                  { icon: FileText, value: stats.pendingAssignments, label: 'Active Tasks', color: colors.warning },
                  { icon: Target, value: stats.upcomingTests, label: 'Upcoming Tests', color: colors.error },
                ].map((item, index) => (
                  <View key={index} style={{
                    width: (SCREEN_WIDTH - spacing.md * 4) / 2,
                    alignItems: 'center',
                    padding: spacing.md,
                    backgroundColor: colors.background.secondary,
                    borderRadius: borderRadius.lg,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: colors.border.light,
                  }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: borderRadius.lg,
                      backgroundColor: item.color[50],
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: spacing.xs,
                    }}>
                      <item.icon size={20} color={item.color.main} />
            </View>
                    <Heading level={3}>{item.value}</Heading>
                    <Caption color="secondary" align="center">{item.label}</Caption>
                  </View>
                ))}
              </Row>
            </Card>
          </SectionBlock>
        )}

        {/* Quick Stats (Admin Only) */}
        {isAdmin && (
          <SectionBlock title="Quick Stats" action={{ label: 'Analytics', onPress: () => router.push('/analytics') }}>
            <Card variant="elevated">
              <Stack spacing="none">
                {[
                  { icon: UserCheck, label: 'Class Attendance', value: `${stats?.attendancePercentage || 0}% Today`, color: colors.success.main },
                  { icon: FolderOpen, label: 'Resources Shared', value: 'View resources →', color: colors.info.main },
                  { icon: LineChart, label: 'Class Performance', value: 'View analytics →', color: colors.secondary.main },
                ].map((item, index, arr) => (
                  <React.Fragment key={index}>
                    <Row spacing="sm" padding="sm" align="center">
                      <item.icon size={20} color={item.color} />
                      <Stack spacing="none" flex>
                        <Caption color="secondary">{item.label}</Caption>
                        <Body weight="semibold">{item.value}</Body>
                      </Stack>
                    </Row>
                    {index < arr.length - 1 && <Divider spacing="none" />}
                  </React.Fragment>
                ))}
              </Stack>
            </Card>
          </SectionBlock>
        )}

        {/* Task Overview (Students Only) */}
        {isStudent && taskOverview && (
          <SectionBlock title="Task Overview" action={{ label: 'View All', onPress: () => router.push('/tasks') }}>
            <Card variant="elevated">
              {taskOverview.total > 0 ? (
                <Stack spacing="sm">
                  <Row justify="space-around">
                    {[
                      { value: taskOverview.total, label: 'Total', color: colors.text.primary },
                      { value: taskOverview.completed, label: 'Completed', color: colors.success.main },
                      { value: taskOverview.dueThisWeek, label: 'This Week', color: colors.warning.main },
                      { value: taskOverview.overdue, label: 'Overdue', color: colors.error.main },
                    ].map((item, index) => (
                      <Stack key={index} align="center" spacing="xs">
                        <Heading level={2} style={{ color: item.color }}>{item.value}</Heading>
                        <Caption color="secondary" align="center">{item.label}</Caption>
                      </Stack>
                    ))}
                  </Row>
                  {taskOverview.overdue > 0 && (
                    <Row spacing="xs" align="center" style={{
                      backgroundColor: colors.error[50],
                      padding: spacing.sm,
                      borderRadius: borderRadius.sm,
                    }}>
                      <AlertCircle size={16} color={colors.error.main} />
                      <Caption color="error">
                        You have {taskOverview.overdue} overdue task{taskOverview.overdue > 1 ? 's' : ''}
                      </Caption>
                    </Row>
                  )}
                </Stack>
              ) : (
                <DashboardEmptyState
                  icon={CheckCircle2}
                  title="All caught up! 🎉"
                  message="No tasks assigned yet. Check back soon for new homework and assignments."
                  actionLabel="View All Tasks"
                  onAction={() => router.push('/tasks')}
                />
              )}
            </Card>
          </SectionBlock>
        )}

        {/* Syllabus Progress (Students Only) */}
        {isStudent && syllabusOverview && (
          <SectionBlock title="Syllabus Progress" action={{ label: 'View All', onPress: () => router.push('/syllabus') }}>
            <Card variant="elevated">
              {syllabusOverview.totalSubjects > 0 && syllabusOverview.subjectBreakdown.length > 0 ? (
                <Stack spacing="lg">
                  <Row spacing="lg" align="center">
                    <Center style={{ position: 'relative' }}>
                      <ProgressRing
                        progress={syllabusOverview.overallProgress}
                        size={80}
                        strokeWidth={8}
                        color={colors.primary.main}
                        backgroundColor={colors.neutral[100]}
                        showPercentage={false}
                      />
                      <Heading level={4} style={{ position: 'absolute' }}>
                        {syllabusOverview.overallProgress}%
                      </Heading>
                    </Center>
                    <Stack spacing="xs" flex>
                      <Heading level={4}>Overall Progress</Heading>
                      <Body color="secondary">
                        {syllabusOverview.subjectBreakdown.reduce((sum, s) => sum + s.completedTopics, 0)} / {' '}
                        {syllabusOverview.subjectBreakdown.reduce((sum, s) => sum + s.totalTopics, 0)} topics completed
                      </Body>
                    </Stack>
                  </Row>
                  
                  <Stack spacing="md">
                      {syllabusOverview.subjectBreakdown.slice(0, 3).map((subject) => (
                      <Stack key={subject.subjectId} spacing="xs" style={{ 
                        paddingTop: spacing.md, 
                        borderTopWidth: 1, 
                        borderTopColor: colors.border.light 
                      }}>
                        <Row justify="space-between">
                          <Body weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{subject.subjectName}</Body>
                          <Body weight="bold" color="accent">{subject.progress}%</Body>
                        </Row>
                        <ProgressBar 
                          progress={subject.progress} 
                          variant={subject.progress >= 80 ? 'success' : subject.progress >= 50 ? 'info' : 'warning'}
                          size="sm"
                            />
                        <Caption color="secondary">{subject.completedTopics} / {subject.totalTopics} topics</Caption>
                      </Stack>
                      ))}
                      {syllabusOverview.subjectBreakdown.length > 3 && (
                      <TouchableOpacity onPress={() => router.push('/syllabus')} style={{ alignItems: 'center', paddingTop: spacing.sm }}>
                        <Caption color="accent" weight="medium">
                            +{syllabusOverview.subjectBreakdown.length - 3} more subject{syllabusOverview.subjectBreakdown.length - 3 > 1 ? 's' : ''}
                        </Caption>
                        </TouchableOpacity>
                      )}
                  </Stack>
                </Stack>
              ) : (
                <DashboardEmptyState
                  icon={NotebookText}
                  title="No syllabus data yet"
                  message="Syllabus progress will appear here once your teacher starts tracking course completion."
                  actionLabel="View Syllabus"
                  onAction={() => router.push('/syllabus')}
                />
              )}
            </Card>
          </SectionBlock>
        )}

        {/* Fee Overview (Students Only) */}
        {isStudent && feeOverview && (
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
          <Card variant="elevated">
            {upcomingEvents && Array.isArray(upcomingEvents) && upcomingEvents.length > 0 ? (
              <Stack spacing="none">
                {upcomingEvents.map((event, index) => (
                  <Row 
                  key={event.id} 
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
                      backgroundColor: event.color,
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
          <Card variant="elevated">
            {recentActivity && recentActivity.length > 0 ? (
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
                    key={activity.id} 
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
