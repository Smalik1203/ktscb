import React, { ComponentProps } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text as RNText,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  useDashboardBundle,
  useManagementDashboard,
  type DashboardStats,
  type ActionItem,
} from '../../hooks/useDashboard';
import { useCapabilities } from '../../hooks/useCapabilities';
import {
  Stack,
  Row,
  Heading,
  Body,
  Caption,
  Card,
  Badge,
  SectionBlock,
  ProgressBar,
  Skeleton,
} from '../../ui';
import { ThreeStateView } from '../../components/common/ThreeStateView';
import { ProgressRing } from '../../ui';
import { log } from '../../lib/logger';
import DriverDashboard from '../transport/DriverDashboard';

interface QuickActionProps {
  title: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  bgColor: string;
  onPress: () => void;
}

function QuickAction({ title, icon, color, bgColor, onPress }: QuickActionProps) {
  const { spacing, colors: themeColors, typography } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ alignItems: 'center', justifyContent: 'flex-start', marginRight: spacing.lg, width: 72 }}
    >
      <View style={{
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center',
        marginBottom: spacing.xs,
      }}>
        <MaterialIcons name={icon} size={24} color={color} />
      </View>
      <RNText
        style={{
          fontSize: 12, fontWeight: typography.fontWeight.medium,
          color: themeColors.text.primary, textAlign: 'center', lineHeight: 16,
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </RNText>
    </TouchableOpacity>
  );
}

function UpcomingEventsSection({ events, loading, error, onViewAll }: {
  events: any[];
  loading: boolean;
  error: any;
  onViewAll: () => void;
}) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <SectionBlock title="Upcoming Events" action={{ label: 'View All', onPress: onViewAll }}>
      <Card variant="elevated" style={{ minHeight: 100 }}>
        {loading ? (
          <Stack spacing="sm" padding="md">
            <Skeleton width="100%" height={20} variant="rounded" />
            <Skeleton width="80%" height={16} variant="rounded" />
            <Skeleton width="100%" height={20} variant="rounded" style={{ marginTop: spacing.sm }} />
          </Stack>
        ) : error ? (
          <Stack align="center" padding="lg">
            <MaterialIcons name="error" size={32} color={colors.error.main} />
            <Body color="error" align="center" style={{ marginTop: spacing.sm }}>
              Failed to load events. Pull down to refresh.
            </Body>
          </Stack>
        ) : Array.isArray(events) && events.length > 0 ? (
          <Stack spacing="none">
            {events.map((event, index) => (
              <Row
                key={event.id || `event-${index}`}
                spacing="sm"
                style={{
                  paddingVertical: spacing.sm,
                  borderBottomWidth: index < events.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border.light,
                }}
              >
                <View style={{
                  width: 3, borderRadius: borderRadius.sm,
                  backgroundColor: event.color || colors.primary.main, alignSelf: 'stretch',
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
          <Stack align="center" padding="lg">
            <MaterialIcons name="event" size={32} color={colors.neutral[300]} />
            <Caption color="tertiary" align="center" style={{ marginTop: spacing.xs }}>
              No upcoming events
            </Caption>
          </Stack>
        )}
      </Card>
    </SectionBlock>
  );
}

function ManagementDashboardView() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const { can } = useCapabilities();
  const [refreshing, setRefreshing] = React.useState(false);

  const {
    data: mgmt,
    isLoading,
    error,
    refetch,
  } = useManagementDashboard(profile?.auth_id || '');

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refetch(); } catch (e) { log.error('Refresh error:', e); } finally { setRefreshing(false); }
  };

  const kpis = mgmt?.kpis;
  const attDelta = (kpis?.todayAttPct ?? 0) - (kpis?.yesterdayAttPct ?? 0);

  // Format currency
  const fmt = (n: number) => {
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString('en-IN');
  };

  // Quick controls for management
  const controlActions = [
    { title: 'Announce', icon: 'campaign' as const, route: '/(tabs)/announcements' as const, visible: can('announcements.create') },
    { title: 'Attendance', icon: 'how-to-reg' as const, route: '/(tabs)/attendance' as const, visible: can('attendance.read') },
    { title: 'Tasks', icon: 'assignment' as const, route: '/(tabs)/tasks' as const, visible: can('tasks.read') },
    { title: 'Timetable', icon: 'event' as const, route: '/(tabs)/timetable' as const, visible: can('timetable.read') },
    { title: 'Calendar', icon: 'calendar-month' as const, route: '/(tabs)/calendar' as const, visible: can('calendar.read') },
    { title: 'Assessments', icon: 'school' as const, route: '/(tabs)/assessments' as const, visible: can('assessments.read') },
    { title: 'Resources', icon: 'folder-open' as const, route: '/(tabs)/resources' as const, visible: can('resources.read') },
    { title: 'Manage', icon: 'business' as const, route: '/(tabs)/manage' as const, visible: can('management.view') },
  ].filter(a => a.visible);

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const viewState = isLoading ? 'loading' : error ? 'error' : 'success';

  return (
    <ThreeStateView
      state={viewState}
      loadingMessage="Loading dashboard..."
      errorMessage="Failed to load dashboard"
      errorDetails={(error as any)?.message || undefined}
      onRetry={handleRefresh}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary.main} colors={[colors.primary.main]} />
        }
      >
        {/* ═══ 1. Header ═══════════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(0).springify()}
          style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs }}
        >
          <RNText style={{
            fontSize: 13, color: colors.text.tertiary,
            fontWeight: typography.fontWeight.medium,
          }}>
            {todayStr}
          </RNText>
          <Heading level={3} style={{ fontWeight: typography.fontWeight.bold, marginTop: 4, color: colors.text.primary, fontSize: 22 }}>
            Dashboard
          </Heading>
        </Animated.View>

        {/* ═══ 2. Quick Access (top) ═══════════════════════ */}
        <Animated.View entering={FadeInDown.delay(40).springify()} style={{ marginBottom: spacing.lg }}>
          <RNText style={{
            fontSize: 11, fontWeight: typography.fontWeight.semibold,
            color: colors.text.tertiary, paddingHorizontal: spacing.md, marginBottom: spacing.sm,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            Quick Access
          </RNText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
          >
            {controlActions.map((action, index) => (
              <QuickAction
                key={index}
                title={action.title}
                icon={action.icon}
                color={colors.primary[600]}
                bgColor={colors.primary[50]}
                onPress={() => router.push(action.route as any)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* ═══ 3. KPI Tiles ═══════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}
        >
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {/* Attendance % */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/attendance' as any)}
              activeOpacity={0.7}
              style={{
                flex: 1, backgroundColor: colors.surface.primary,
                borderRadius: borderRadius.lg, padding: spacing.md + 2,
                borderWidth: 1, borderColor: colors.border.light, ...shadows.sm,
              }}
            >
              <Row spacing="xs" align="center" style={{ marginBottom: spacing.xs }}>
                <MaterialIcons name="groups" size={16} color={colors.primary[500]} />
                <RNText style={{ fontSize: 12, color: colors.text.tertiary, fontWeight: typography.fontWeight.medium }}>Attendance</RNText>
              </Row>
              <RNText style={{
                fontSize: 28, fontWeight: typography.fontWeight.bold,
                color: colors.text.primary, lineHeight: 34,
              }}>
                {kpis?.todayAttPct ?? 0}%
              </RNText>
              {attDelta !== 0 && (
                <Row spacing="xs" align="center" style={{ marginTop: 4 }}>
                  <MaterialIcons
                    name={attDelta > 0 ? 'arrow-upward' : 'arrow-downward'}
                    size={12}
                    color={attDelta > 0 ? colors.success[600] : colors.error[600]}
                  />
                  <RNText style={{
                    fontSize: 11, color: attDelta > 0 ? colors.success[600] : colors.error[600],
                    fontWeight: typography.fontWeight.medium,
                  }}>
                    {Math.abs(attDelta)}% vs yesterday
                  </RNText>
                </Row>
              )}
            </TouchableOpacity>

            {/* Active Classes */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/timetable' as any)}
              activeOpacity={0.7}
              style={{
                flex: 1, backgroundColor: colors.surface.primary,
                borderRadius: borderRadius.lg, padding: spacing.md + 2,
                borderWidth: 1, borderColor: colors.border.light, ...shadows.sm,
              }}
            >
              <Row spacing="xs" align="center" style={{ marginBottom: spacing.xs }}>
                <MaterialIcons name="class" size={16} color={colors.info[500]} />
                <RNText style={{ fontSize: 12, color: colors.text.tertiary, fontWeight: typography.fontWeight.medium }}>Classes Today</RNText>
              </Row>
              <RNText style={{
                fontSize: 26, fontWeight: typography.fontWeight.bold,
                color: colors.text.primary, lineHeight: 32,
              }}>
                {(kpis?.totalClassesScheduled ?? 0) === 0
                  ? '—'
                  : `${kpis?.totalClassesScheduled ?? 0} / ${kpis?.activeClassesMarked ?? 0}`}
              </RNText>
              <RNText style={{ fontSize: 10, color: colors.text.quaternary, marginTop: 2 }}>
                {(kpis?.totalClassesScheduled ?? 0) === 0 ? 'No classes scheduled' : 'scheduled / completed'}
              </RNText>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ═══ 4. Action Items (fee-related excluded) ═══════ */}
        {(() => {
          const items = (mgmt?.actionItems ?? []).filter((i: ActionItem) => i.category !== 'fees');
          return items.length > 0 ? (
            <Animated.View
              entering={FadeInDown.delay(240).springify()}
              style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}
            >
              <RNText style={{
                fontSize: 11, fontWeight: typography.fontWeight.semibold,
                color: colors.text.tertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1,
              }}>
                Action Items
              </RNText>
              <View style={{
                backgroundColor: colors.surface.primary, borderRadius: borderRadius.lg,
                borderWidth: 1, borderColor: colors.border.light, overflow: 'hidden', ...shadows.sm,
              }}>
                {items.map((item: ActionItem, idx: number) => {
                  const catColor = item.category === 'attendance'
                    ? colors.warning[500]
                    : colors.primary[500];
                  return (
                    <TouchableOpacity
                      key={item.type}
                      onPress={() => router.push(item.route as any)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
                        paddingHorizontal: spacing.md,
                        borderBottomWidth: idx < items.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border.light,
                      }}
                    >
                      <View style={{
                        width: 4, height: 28, borderRadius: 2,
                        backgroundColor: catColor, marginRight: spacing.sm,
                      }} />
                      <RNText style={{
                        fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold,
                        color: colors.text.primary, marginRight: spacing.sm, minWidth: 24,
                      }}>
                        {item.count}
                      </RNText>
                      <RNText style={{
                        flex: 1, fontSize: typography.fontSize.sm, color: colors.text.secondary,
                        fontWeight: typography.fontWeight.normal,
                      }}>
                        {item.label}
                      </RNText>
                      <MaterialIcons name="chevron-right" size={20} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          ) : null;
        })()}

        {/* ═══ 6. Academic Snapshot ═════════════════════════ */}
        {(mgmt?.academicSnapshot?.totalTests ?? 0) > 0 && (
          <Animated.View
            entering={FadeInDown.delay(350).springify()}
            style={{ paddingHorizontal: spacing.md, marginBottom: spacing.lg }}
          >
            <RNText style={{
              fontSize: 11, fontWeight: typography.fontWeight.semibold,
              color: colors.text.tertiary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1,
            }}>
              Academic Performance
            </RNText>
            <View style={{
              backgroundColor: colors.surface.primary, borderRadius: borderRadius.lg,
              padding: spacing.md + 2, borderWidth: 1, borderColor: colors.border.light, ...shadows.sm,
            }}>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <RNText style={{
                    fontSize: 22, fontWeight: typography.fontWeight.semibold, color: colors.primary[600],
                  }}>
                    {mgmt!.academicSnapshot.avgPerformancePct}%
                  </RNText>
                  <RNText style={{ fontSize: 10, color: colors.text.tertiary, marginTop: 2 }}>Avg Score</RNText>
                </View>
                <View style={{ width: 1, backgroundColor: colors.border.light }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <RNText style={{
                    fontSize: 22, fontWeight: typography.fontWeight.semibold, color: colors.text.primary,
                  }}>
                    {mgmt!.academicSnapshot.totalTests}
                  </RNText>
                  <RNText style={{ fontSize: 10, color: colors.text.tertiary, marginTop: 2 }}>Total Tests</RNText>
                </View>
              </View>
              {(mgmt!.academicSnapshot.topClass || mgmt!.academicSnapshot.lowestClass) && (
                <View style={{
                  flexDirection: 'row', gap: spacing.sm,
                  backgroundColor: colors.background.secondary, borderRadius: borderRadius.sm,
                  padding: spacing.sm,
                }}>
                  {mgmt!.academicSnapshot.topClass && (
                    <View style={{ flex: 1 }}>
                      <Caption color="tertiary" style={{ marginBottom: 2 }}>Top Performing</Caption>
                      <RNText style={{
                        fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                        color: colors.success[600],
                      }}>
                        {mgmt!.academicSnapshot.topClass.name} ({mgmt!.academicSnapshot.topClass.pct}%)
                      </RNText>
                    </View>
                  )}
                  {mgmt!.academicSnapshot.lowestClass && (
                    <View style={{ flex: 1 }}>
                      <Caption color="tertiary" style={{ marginBottom: 2 }}>Needs Focus</Caption>
                      <RNText style={{
                        fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                        color: colors.warning[600],
                      }}>
                        {mgmt!.academicSnapshot.lowestClass.name} ({mgmt!.academicSnapshot.lowestClass.pct}%)
                      </RNText>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ═══ 8. Upcoming Events ══════════════════════════ */}
        <UpcomingEventsSection
          events={mgmt?.upcomingEvents || []}
          loading={isLoading}
          error={error}
          onViewAll={() => router.push('/calendar')}
        />
      </ScrollView>
    </ThreeStateView>
  );
}

function StudentDashboardView() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows } = useTheme();
  const { can } = useCapabilities();
  const [refreshing, setRefreshing] = React.useState(false);

  const {
    data: bundle,
    isLoading,
    error,
    refetch,
  } = useDashboardBundle(profile?.auth_id || '');

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refetch(); } catch (e) { log.error('Refresh error:', e); } finally { setRefreshing(false); }
  };

  const stats = bundle?.stats as DashboardStats | undefined;
  const taskOverview = bundle?.taskOverview;
  const syllabusOverview = bundle?.syllabusOverview;
  const nextClass = bundle?.nextClass;
  const nextDueTask = bundle?.nextDueTask;
  const upcomingEvents = bundle?.upcomingEvents || [];

  const classData = React.useMemo(() => {
    const ci = bundle?.classInfo;
    if (!ci) return null;
    return { grade: ci.grade?.toString() || '', section: ci.section || '' };
  }, [bundle?.classInfo]);

  const canViewOwnDataOnly = can('attendance.read_own') && !can('attendance.read');
  const canViewSyllabus = can('syllabus.read');

  // Quick actions for students
  const qColor = colors.primary[600];
  const qBg = colors.primary[50];
  const quickActions = [
    { title: 'Timetable', icon: 'event' as const, route: '/(tabs)/timetable', visible: can('timetable.read') },
    { title: 'Calendar', icon: 'calendar-month' as const, route: '/(tabs)/calendar', visible: can('calendar.read') },
    { title: 'Resources', icon: 'folder-open' as const, route: '/(tabs)/resources', visible: can('resources.read') },
    { title: 'Syllabus', icon: 'menu-book' as const, route: '/(tabs)/syllabus-student', visible: canViewSyllabus },
    { title: 'Attendance', icon: 'how-to-reg' as const, route: '/(tabs)/attendance', visible: can('attendance.read_own') },
    { title: 'Assessments', icon: 'school' as const, route: '/(tabs)/assessments', visible: can('assessments.read_own') },
    { title: 'Tasks', icon: 'assignment' as const, route: '/(tabs)/tasks', visible: can('tasks.read_own') },
  ].filter(a => a.visible);

  // Attendance helpers
  const attPct = stats?.attendancePercentage ?? 0;
  const attColor = attPct >= 90 ? colors.success[600] : attPct >= 80 ? colors.info[600] : attPct >= 75 ? colors.warning[600] : colors.error[600];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  // Format time from HH:MM:SS to 12h
  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const viewState = isLoading ? 'loading' : error ? 'error' : !profile ? 'empty' : 'success';
  const hasIncompleteProfile = profile && (!profile.school_code || !profile.class_instance_id);

  return (
    <ThreeStateView
      state={viewState}
      loadingMessage="Loading dashboard..."
      errorMessage="Failed to load dashboard"
      errorDetails={(error as any)?.message || undefined}
      emptyMessage={
        hasIncompleteProfile
          ? "Profile setup required. Please contact your administrator."
          : "No profile data available"
      }
      onRetry={handleRefresh}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary.main} colors={[colors.primary.main]} />
        }
      >
        {/* ═══ 1. Greeting ═════════════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(0).springify()}
          style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs }}
        >
          <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary, fontWeight: typography.fontWeight.medium }}>
            {getGreeting()}
          </RNText>
          <Heading level={2} style={{ fontWeight: typography.fontWeight.bold, color: colors.text.primary, fontSize: 24, marginTop: 2 }}>
            {profile?.full_name || 'User'}
          </Heading>
          {classData && (
            <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary, marginTop: 2 }}>
              Class {classData.grade}-{classData.section} &middot; {todayStr}
            </RNText>
          )}
        </Animated.View>

        {/* ═══ 2. Quick Access (top) ═══════════════════════ */}
        <Animated.View entering={FadeInDown.delay(40).springify()} style={{ marginTop: spacing.xs, marginBottom: spacing.xs }}>
          <RNText style={{
            fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
            color: colors.text.secondary, paddingHorizontal: spacing.md, marginBottom: spacing.sm,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            Quick Access
          </RNText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}
          >
            {quickActions.map((action, index) => (
              <QuickAction
                key={index}
                title={action.title}
                icon={action.icon}
                color={qColor}
                bgColor={qBg}
                onPress={() => router.push(action.route as any)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* ═══ 3. Overdue Tasks (top priority) ═════════════ */}
        {(taskOverview?.overdue ?? 0) > 0 && (
          <Animated.View
            entering={FadeInDown.delay(60).springify()}
            style={{ paddingHorizontal: spacing.md, marginTop: spacing.sm }}
          >
            <TouchableOpacity
              onPress={() => router.push('/tasks')}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                backgroundColor: colors.error[50], borderRadius: borderRadius.md,
                padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.error[200],
              }}
            >
              <View style={{
                width: 32, height: 32, borderRadius: 8,
                backgroundColor: colors.error[100], justifyContent: 'center', alignItems: 'center',
              }}>
                <MaterialIcons name="warning" size={18} color={colors.error[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <RNText style={{
                  fontSize: typography.fontSize.sm, color: colors.error[800],
                  fontWeight: typography.fontWeight.bold,
                }}>
                  {taskOverview!.overdue} overdue task{taskOverview!.overdue > 1 ? 's' : ''}
                </RNText>
                <RNText style={{ fontSize: 11, color: colors.error[600] }}>
                  Tap to view and submit
                </RNText>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.error[400]} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ═══ 4. Next Class Card ══════════════════════════ */}
        {nextClass && (
          <Animated.View
            entering={FadeInDown.delay(120).springify()}
            style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}
          >
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/timetable' as any)}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.primary[50], borderRadius: borderRadius.lg,
                padding: spacing.md, borderWidth: 1, borderColor: colors.primary[200],
              }}
            >
              <Row spacing="xs" align="center" style={{ marginBottom: spacing.xs }}>
                <MaterialIcons name="schedule" size={14} color={colors.primary[600]} />
                <RNText style={{ fontSize: 11, color: colors.primary[600], fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Next Class
                </RNText>
              </Row>
              <RNText style={{
                fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold,
                color: colors.text.primary,
              }}>
                {nextClass.subjectName}
              </RNText>
              <Row spacing="sm" align="center" style={{ marginTop: 4 }}>
                <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary }}>
                  {formatTime(nextClass.startTime)} - {formatTime(nextClass.endTime)}
                </RNText>
                {nextClass.teacherName ? (
                  <>
                    <RNText style={{ color: colors.text.tertiary }}>·</RNText>
                    <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary }}>
                      {nextClass.teacherName}
                    </RNText>
                  </>
                ) : null}
              </Row>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ═══ 5. Next Due Task ════════════════════════════ */}
        {nextDueTask && (
          <Animated.View
            entering={FadeInDown.delay(180).springify()}
            style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}
          >
            <TouchableOpacity
              onPress={() => router.push('/tasks')}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.surface.primary, borderRadius: borderRadius.md,
                padding: spacing.md, borderWidth: 1, borderColor: colors.border.light, ...shadows.sm,
              }}
            >
              <Row spacing="xs" align="center" style={{ marginBottom: spacing.xs }}>
                <MaterialIcons name="assignment" size={14} color={colors.warning[600]} />
                <RNText style={{ fontSize: 11, color: colors.warning[600], fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Next Due
                </RNText>
              </Row>
              <RNText style={{
                fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold,
                color: colors.text.primary,
              }}>
                {nextDueTask.title}
              </RNText>
              <Row spacing="sm" align="center" style={{ marginTop: 4 }}>
                <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary }}>
                  {nextDueTask.subjectName}
                </RNText>
                <RNText style={{ color: colors.text.tertiary }}>·</RNText>
                <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.secondary }}>
                  Due {new Date(nextDueTask.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </RNText>
              </Row>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ═══ 6. Stats Row (Attendance + Tests + Tasks) ═══ */}
        <Animated.View
          entering={FadeInDown.delay(220).springify()}
          style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}
        >
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {/* Attendance */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/attendance' as any)}
              activeOpacity={0.7}
              style={{
                flex: 1, backgroundColor: colors.surface.primary, borderRadius: borderRadius.md,
                padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.border.light, ...shadows.sm,
                alignItems: 'center',
              }}
            >
              <RNText style={{ fontSize: 22, fontWeight: typography.fontWeight.semibold, color: attColor }}>
                {attPct}%
              </RNText>
              <RNText style={{ fontSize: 10, color: colors.text.tertiary, marginTop: 2 }}>Attendance</RNText>
            </TouchableOpacity>

            {/* Tests */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/assessments' as any)}
              activeOpacity={0.7}
              style={{
                flex: 1, backgroundColor: colors.surface.primary, borderRadius: borderRadius.md,
                padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.border.light, ...shadows.sm,
                alignItems: 'center',
              }}
            >
              <RNText style={{ fontSize: 22, fontWeight: typography.fontWeight.semibold, color: colors.text.primary }}>
                {stats?.upcomingTests ?? 0}
              </RNText>
              <RNText style={{ fontSize: 10, color: colors.text.tertiary, marginTop: 2 }}>Tests This Week</RNText>
            </TouchableOpacity>

            {/* Pending Tasks */}
            <TouchableOpacity
              onPress={() => router.push('/tasks')}
              activeOpacity={0.7}
              style={{
                flex: 1, backgroundColor: colors.surface.primary, borderRadius: borderRadius.md,
                padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.border.light, ...shadows.sm,
                alignItems: 'center',
              }}
            >
              <RNText style={{ fontSize: 22, fontWeight: typography.fontWeight.semibold, color: colors.text.primary }}>
                {taskOverview?.pending ?? 0}
              </RNText>
              <RNText style={{ fontSize: 10, color: colors.text.tertiary, marginTop: 2 }}>Pending Tasks</RNText>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ═══ 7. Syllabus progress ═══════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(260).springify()}
          style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}
        >
          <TouchableOpacity
            onPress={() => router.push('/syllabus' as any)}
            activeOpacity={0.7}
            style={{
              backgroundColor: colors.surface.primary, borderRadius: borderRadius.md,
              padding: spacing.md, ...shadows.sm, alignItems: 'center',
              borderWidth: 1, borderColor: colors.border.light,
            }}
          >
            {syllabusOverview && syllabusOverview.totalSubjects > 0 ? (
              <>
                <View style={{ position: 'relative', marginBottom: spacing.xs }}>
                  <ProgressRing
                    progress={syllabusOverview.overallProgress}
                    size={48}
                    strokeWidth={5}
                    color={colors.primary[600]}
                    backgroundColor={colors.neutral[100]}
                    showPercentage={false}
                  />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                    <RNText style={{ fontSize: 12, fontWeight: typography.fontWeight.bold, color: colors.text.primary }}>
                      {syllabusOverview.overallProgress}%
                    </RNText>
                  </View>
                </View>
                <RNText style={{ fontSize: 11, fontWeight: typography.fontWeight.semibold, color: colors.text.primary }}>Syllabus</RNText>
                <RNText style={{ fontSize: 10, color: colors.text.tertiary, marginTop: 1 }}>
                  {syllabusOverview.subjectBreakdown.reduce((s, x) => s + x.completedTopics, 0)}/{syllabusOverview.subjectBreakdown.reduce((s, x) => s + x.totalTopics, 0)} topics
                </RNText>
              </>
            ) : (
              <>
                <MaterialIcons name="menu-book" size={24} color={colors.neutral[300]} style={{ marginBottom: spacing.xs }} />
                <RNText style={{ fontSize: 11, fontWeight: typography.fontWeight.semibold, color: colors.text.secondary }}>Syllabus</RNText>
                <RNText style={{ fontSize: 10, color: colors.text.tertiary, marginTop: 1 }}>Not started</RNText>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ═══ 8. Upcoming Events ══════════════════════════ */}
        <UpcomingEventsSection
          events={upcomingEvents}
          loading={isLoading}
          error={error}
          onViewAll={() => router.push('/calendar')}
        />
      </ScrollView>
    </ThreeStateView>
  );
}

export default function DashboardScreen() {
  const { profile, loading: authLoading } = useAuth();
  const { can, isLoading: capabilitiesLoading } = useCapabilities();

  if (!authLoading && !capabilitiesLoading && profile?.role === 'driver') {
    return <DriverDashboard />;
  }

  const isStudent = can('attendance.read_own') && !can('attendance.read');

  if (!authLoading && !capabilitiesLoading && isStudent) {
    return <StudentDashboardView />;
  }

  // Admin / SuperAdmin path
  return <ManagementDashboardView />;
}
