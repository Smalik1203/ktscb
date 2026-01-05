import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform, Dimensions } from 'react-native';
import { Text, Card, ActivityIndicator, Avatar } from 'react-native-paper';
import { Users, Shield, Activity, AlertCircle, UserCheck, Clock, TrendingUp, Zap, ChevronRight } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { AccessDenied } from '../../components/common/AccessDenied';
import { typography, spacing, borderRadius } from '../../../lib/design-system';
import { useUserActivityStats } from '../../hooks/useUserActivityStats';
import { LinearGradient } from 'expo-linear-gradient';
import * as analyticsUtils from '../../lib/analytics-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ManageScreen() {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const { can, isLoading: capabilitiesLoading } = useCapabilities();
  const [refreshing, setRefreshing] = useState(false);
  
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Capability-based check (NO role checks in UI)
  const canManage = can('management.view');

  const { 
    data: activityStats, 
    isLoading: activityLoading, 
    error: activityError, 
    refetch: refetchActivity 
  } = useUserActivityStats(profile?.school_code);

  if (!canManage && !capabilitiesLoading) {
    return (
      <AccessDenied 
        capability="management.view"
        title="Access Restricted"
        message="Management features are only available to administrators."
      />
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchActivity();
    } finally {
      setRefreshing(false);
    }
  };

  if (activityLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading activity data...</Text>
        </View>
      </View>
    );
  }

  if (activityError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <AlertCircle size={48} color={colors.error[500]} />
          </View>
          <Text style={styles.errorTitle}>Unable to load data</Text>
          <Text style={styles.errorMessage}>
            {activityError instanceof Error ? activityError.message : 'Something went wrong'}
          </Text>
        </View>
      </View>
    );
  }

  const studentTotal = activityStats?.students.total || 0;
  const studentWithAccount = activityStats?.students.withAccount || 0;
  const studentActive = activityStats?.students.active || 0;
  const studentInactive = activityStats?.students.inactive || 0;
  const studentNeverLoggedIn = activityStats?.students.neverLoggedIn || 0;

  const adminTotal = activityStats?.admins.total || 0;
  const adminWithAccount = activityStats?.admins.withAccount || 0;
  const adminNoAccount = activityStats?.admins.noAccount || 0;
  const adminActive = activityStats?.admins.active || 0;
  const adminInactive = activityStats?.admins.inactive || 0;
  const adminNeverLoggedIn = activityStats?.admins.neverLoggedIn || 0;

  // Calculate login rates as percentages (0-100)
  const studentLoginRate = analyticsUtils.calculatePercentage(
    studentWithAccount - studentNeverLoggedIn,
    studentWithAccount,
    1
  );
  const adminLoginRate = analyticsUtils.calculatePercentage(
    adminWithAccount - adminNeverLoggedIn,
    adminWithAccount,
    1
  );
  
  const totalActive = studentActive + adminActive;
  const totalUsers = studentTotal + adminTotal;
  
  // Calculate overall adoption rate: (students who logged in + admins who logged in) / (total with accounts)
  const totalWithAccounts = studentWithAccount + adminWithAccount;
  const totalLoggedIn = (studentWithAccount - studentNeverLoggedIn) + (adminWithAccount - adminNeverLoggedIn);
  const adoptionRate = analyticsUtils.calculatePercentage(totalLoggedIn, totalWithAccounts, 1);
  const recentLogins = activityStats?.recentLogins || [];

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Hero Stats */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={isDark ? [colors.primary[800], colors.primary[900]] : [colors.primary[500], colors.primary[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroMain}>
                <Text style={styles.heroValue}>{totalUsers}</Text>
                <Text style={styles.heroLabel}>Total Users</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStats}>
                <View style={styles.heroStatItem}>
                  <View style={styles.heroStatDot} />
                  <Text style={styles.heroStatValue}>{totalActive}</Text>
                  <Text style={styles.heroStatLabel}>Active</Text>
                </View>
                <View style={styles.heroStatItem}>
                  <View style={[styles.heroStatDot, { backgroundColor: colors.warning[400] }]} />
                  <Text style={styles.heroStatValue}>{adoptionRate.toFixed(1)}%</Text>
                  <Text style={styles.heroStatLabel}>Adoption</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Student Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: colors.success[100] }]}>
              <Users size={20} color={colors.success[600]} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Students</Text>
              <Text style={styles.cardSubtitle}>{studentTotal} registered</Text>
            </View>
            <View style={[styles.onlineBadge, { backgroundColor: colors.success[50] }]}>
              <View style={[styles.onlineDot, { backgroundColor: colors.success[500] }]} />
              <Text style={[styles.onlineText, { color: colors.success[700] }]}>{studentActive}</Text>
            </View>
          </View>

          {/* Login Rate Display */}
          <View style={styles.loginRateSection}>
            <View style={[styles.loginRateCircle, { borderColor: colors.success[500] }]}>
              <Text style={[styles.loginRateValue, { color: colors.success[600] }]}>
                {studentLoginRate.toFixed(1)}%
              </Text>
            </View>
            <Text style={styles.loginRateLabel}>Login Rate</Text>
            <View style={styles.loginRateBar}>
              <View style={[styles.loginRateBarTrack, { backgroundColor: colors.neutral[200] }]}>
                <View style={[
                  styles.loginRateBarFill, 
                  { 
                    backgroundColor: colors.success[500],
                    width: `${Math.min(100, Math.max(0, studentLoginRate))}%`
                  }
                ]} />
              </View>
            </View>
          </View>

          {/* Status Grid */}
          <View style={styles.statusGrid}>
            <View style={[styles.statusCard, { backgroundColor: colors.success[50] }]}>
              <UserCheck size={16} color={colors.success[600]} />
              <Text style={[styles.statusValue, { color: colors.success[700] }]}>{studentActive}</Text>
              <Text style={styles.statusLabel}>Active</Text>
            </View>
            <View style={[styles.statusCard, { backgroundColor: colors.warning[50] }]}>
              <Clock size={16} color={colors.warning[600]} />
              <Text style={[styles.statusValue, { color: colors.warning[700] }]}>{studentInactive}</Text>
              <Text style={styles.statusLabel}>Idle</Text>
            </View>
            <View style={[styles.statusCard, { backgroundColor: colors.neutral[100] }]}>
              <AlertCircle size={16} color={colors.neutral[500]} />
              <Text style={[styles.statusValue, { color: colors.neutral[700] }]}>{studentNeverLoggedIn}</Text>
              <Text style={styles.statusLabel}>Never</Text>
            </View>
          </View>
        </View>

        {/* Staff Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: colors.primary[100] }]}>
              <Shield size={20} color={colors.primary[600]} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Staff & Teachers</Text>
              <Text style={styles.cardSubtitle}>{adminTotal} members</Text>
            </View>
            <View style={[styles.onlineBadge, { backgroundColor: colors.primary[50] }]}>
              <View style={[styles.onlineDot, { backgroundColor: colors.primary[500] }]} />
              <Text style={[styles.onlineText, { color: colors.primary[700] }]}>{adminActive}</Text>
            </View>
          </View>

          {/* Login Rate Display */}
          <View style={styles.loginRateSection}>
            <View style={[styles.loginRateCircle, { borderColor: colors.primary[500] }]}>
              <Text style={[styles.loginRateValue, { color: colors.primary[600] }]}>
                {adminLoginRate.toFixed(1)}%
              </Text>
            </View>
            <Text style={styles.loginRateLabel}>Login Rate</Text>
            <View style={styles.loginRateBar}>
              <View style={[styles.loginRateBarTrack, { backgroundColor: colors.neutral[200] }]}>
                <View style={[
                  styles.loginRateBarFill, 
                  { 
                    backgroundColor: colors.primary[500],
                    width: `${Math.min(100, Math.max(0, adminLoginRate))}%`
                  }
                ]} />
              </View>
            </View>
          </View>

          {/* Status Grid */}
          <View style={styles.statusGrid}>
            <View style={[styles.statusCard, { backgroundColor: colors.success[50] }]}>
              <UserCheck size={16} color={colors.success[600]} />
              <Text style={[styles.statusValue, { color: colors.success[700] }]}>{adminActive}</Text>
              <Text style={styles.statusLabel}>Active</Text>
            </View>
            <View style={[styles.statusCard, { backgroundColor: colors.warning[50] }]}>
              <Clock size={16} color={colors.warning[600]} />
              <Text style={[styles.statusValue, { color: colors.warning[700] }]}>{adminInactive}</Text>
              <Text style={styles.statusLabel}>Idle</Text>
            </View>
            <View style={[styles.statusCard, { backgroundColor: colors.neutral[100] }]}>
              <AlertCircle size={16} color={colors.neutral[500]} />
              <Text style={[styles.statusValue, { color: colors.neutral[700] }]}>{adminNeverLoggedIn + adminNoAccount}</Text>
              <Text style={styles.statusLabel}>Never</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        {recentLogins.length > 0 && (
          <View style={styles.card}>
            <View style={styles.recentHeader}>
              <View style={styles.recentTitleRow}>
                <Activity size={18} color={colors.primary[500]} />
                <Text style={styles.recentTitle}>Recent Activity</Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>
            
            {recentLogins.slice(0, 5).map((login, index) => (
              <View key={login.id} style={[
                styles.activityItem,
                index < Math.min(recentLogins.length, 5) - 1 && styles.activityItemBorder
              ]}>
                <Avatar.Text 
                  size={36} 
                  label={getInitials(login.name)}
                  style={{ backgroundColor: login.user_type === 'student' ? colors.success[500] : colors.primary[500] }}
                  labelStyle={{ fontSize: 14, fontWeight: '600' }}
                />
                <View style={styles.activityInfo}>
                  <Text style={styles.activityName} numberOfLines={1}>{login.name}</Text>
                  <View style={[
                    styles.typeBadge,
                    { backgroundColor: login.user_type === 'student' ? colors.success[100] : colors.primary[100] }
                  ]}>
                    <Text style={[
                      styles.typeText,
                      { color: login.user_type === 'student' ? colors.success[700] : colors.primary[700] }
                    ]}>
                      {login.user_type === 'student' ? 'Student' : 'Staff'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.activityTime}>{formatRelativeTime(login.last_sign_in)}</Text>
              </View>
            ))}

            {recentLogins.length > 5 && (
              <View style={styles.viewAllRow}>
                <Text style={styles.viewAllText}>View all activity</Text>
                <ChevronRight size={16} color={colors.primary[500]} />
              </View>
            )}
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success[500] }]} />
            <Text style={styles.legendText}>Active (7d)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.warning[500] }]} />
            <Text style={styles.legendText}>Idle (7-30d)</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
  },
  
  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.error[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  restrictedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.error[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  restrictedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  restrictedMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Hero Section
  heroSection: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  heroGradient: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary[900],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMain: {
    flex: 1,
  },
  heroValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  heroLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.lg,
  },
  heroStats: {
    gap: spacing.md,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },

  // Cards
  card: {
    margin: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border.light,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Login Rate Display
  loginRateSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  loginRateCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
  },
  loginRateValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  loginRateLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  loginRateBar: {
    width: '60%',
    marginTop: spacing.xs,
  },
  loginRateBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  loginRateBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Status Grid
  statusGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontWeight: '500',
  },

  // Recent Activity
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  recentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success[500],
  },
  liveText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success[700],
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  activityInfo: {
    flex: 1,
    gap: 4,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary[500],
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
});
