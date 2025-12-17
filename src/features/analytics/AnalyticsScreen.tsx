import React, { useCallback } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { BarChart3 } from 'lucide-react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAnalyticsScreen } from '../../hooks/useAnalyticsScreen';
import { SuperAdminDashboard, AdminDashboard, StudentDashboard } from '../../components/analytics/dashboards';
import { EmptyState } from '../../components/analytics/shared';
import type { SuperAdminAnalytics, StudentAnalytics, AdminAnalytics } from '../../components/analytics/types';
import { spacing, colors } from '../../../lib/design-system';
import { useTheme } from '../../contexts/ThemeContext';
import { analyticsScreenStyles, createAnalyticsStyles } from './AnalyticsScreen.styles';

/**
 * Main Analytics Screen Component
 * Refactored for scalability with:
 * - Separated business logic in useAnalyticsScreen hook
 * - Extracted dashboard components
 * - Memoized components to prevent re-renders
 * - Clean separation of concerns
 */
export default function AnalyticsScreen() {
  const { colors, isDark } = useTheme();
  const {
    analyticsData,
    isLoading,
    isFetching,
    error,
    timePeriod,
    selectedFeature,
    refreshing,
    canViewAnalytics,
    isSuperAdmin,
    isStudent,
    startDate,
    endDate,
    dateRange,
    setTimePeriod,
    setSelectedFeature,
    setDateRange,
    handleRefresh,
  } = useAnalyticsScreen();
  
  // Create dynamic styles based on theme
  const styles = React.useMemo(() => createAnalyticsStyles(colors, isDark), [colors, isDark]);

  const handleRefreshWithHaptics = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await handleRefresh();
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 300);
  }, [handleRefresh]);

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
            onRefresh={handleRefreshWithHaptics}
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
              <Text variant="titleLarge" style={styles.errorText}>
                Analytics Under Maintenance
              </Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(300)}>
              <Text variant="bodyMedium" style={styles.errorSubtext}>
                The analytics feature is being upgraded with improved performance and new insights.
                {'\n\n'}
                Please check back later or contact your administrator for more information.
              </Text>
            </Animated.View>
            {error && typeof error === 'object' && 'message' in error && (
              <Animated.View entering={FadeInDown.delay(400)}>
                <Text
                  variant="bodySmall"
                  style={[styles.errorSubtext, { marginTop: 8, fontSize: 12, color: colors.text.tertiary }]}
                >
                  Error: {(error as Error).message || 'Analytics RPC functions not available'}
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        ) : isSuperAdmin ? (
          analyticsData ? (
            <SuperAdminDashboard
              data={analyticsData as SuperAdminAnalytics}
              isLoading={isLoading}
              isFetching={isFetching}
              timePeriod={timePeriod}
              setTimePeriod={setTimePeriod}
              startDate={startDate}
              endDate={endDate}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              selectedFeature={selectedFeature}
              setSelectedFeature={setSelectedFeature}
            />
          ) : null
        ) : isStudent ? (
          analyticsData ? (
            <StudentDashboard 
              data={analyticsData as StudentAnalytics} 
              isLoading={isLoading}
              isFetching={isFetching}
              timePeriod={timePeriod}
              setTimePeriod={setTimePeriod}
              startDate={startDate}
              endDate={endDate}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          ) : null
        ) : analyticsData ? (
          // Admin uses SuperAdminAnalytics filtered to their class
          <AdminDashboard 
            data={analyticsData as SuperAdminAnalytics} 
            isLoading={isLoading}
            isFetching={isFetching}
            timePeriod={timePeriod}
            setTimePeriod={setTimePeriod}
            startDate={startDate}
            endDate={endDate}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
