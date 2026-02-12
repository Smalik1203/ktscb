import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Modal, ScrollView, Dimensions, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { DrawerActions , useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRecentActivity } from '../../hooks/useDashboard';

type AppNavbarProps = {
  title: string;
  showBackButton?: boolean;
  onAddPress?: () => void;
  onRefreshPress?: () => void;
};

export const AppNavbar: React.FC<AppNavbarProps> = ({
  title,
  showBackButton = false,
  onAddPress,
  onRefreshPress,
}) => {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [showActivityModal, setShowActivityModal] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity(
    profile?.auth_id || '',
    profile?.class_instance_id || undefined
  );

  // Dynamic styles based on theme
  const dynamicStyles = useMemo(() => StyleSheet.create({
    safeArea: {
      backgroundColor: colors.surface.primary,
    },
    container: {
      height: 56,
      backgroundColor: colors.surface.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      marginLeft: spacing.sm,
      fontWeight: typography.fontWeight.semibold as any,
      fontSize: typography.fontSize.lg,
      color: colors.text.primary,
    },
    notificationBadge: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.error[500],
      borderWidth: 1.5,
      borderColor: colors.surface.primary,
    },
    bottomSheet: {
      backgroundColor: colors.surface.elevated,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      maxHeight: '80%',
      minHeight: 300,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.neutral[isDark ? 500 : 300],
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    sheetTitle: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    activityItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    activityTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: 2,
    },
    activitySubtitle: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginBottom: 4,
    },
    activityTime: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
    },
    emptyStateTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    emptyStateText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      textAlign: 'center',
    },
  }), [colors, isDark]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleMenuPress = () => {
    try {
      navigation.dispatch(DrawerActions.openDrawer());
    } catch (error) {
      router.push('/(tabs)');
    }
  };

  const handleNotificationPress = () => {
    setShowActivityModal(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCloseModal = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowActivityModal(false);
    });
  };

  const getActivityIconName = (type: string): React.ComponentProps<typeof MaterialIcons>['name'] => {
    switch (type) {
      case 'attendance': return 'how-to-reg';
      case 'assignment':
      case 'task': return 'auto-stories';
      case 'test': return 'gps-fixed';
      case 'event': return 'date-range';
      default: return 'show-chart';
    }
  };

  const getActivityColor = (color?: string) => {
    switch (color) {
      case 'success': return { bg: colors.success[50], icon: colors.success[600] };
      case 'error': return { bg: colors.error[50], icon: colors.error[600] };
      case 'warning': return { bg: colors.warning[50], icon: colors.warning[600] };
      case 'info': return { bg: colors.info[50], icon: colors.info[600] };
      case 'secondary': return { bg: colors.secondary[50], icon: colors.secondary[600] };
      default: return { bg: colors.primary[50], icon: colors.primary[600] };
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={[dynamicStyles.safeArea, { paddingTop: insets.top }]}>
      <View style={dynamicStyles.container}>
        <View style={styles.left}>
          {showBackButton ? (
            <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
              <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleMenuPress}
              style={styles.iconBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="menu" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <Text style={dynamicStyles.title}>{title}</Text>
        </View>
        <View style={styles.right}>
          {onRefreshPress ? (
            <TouchableOpacity onPress={onRefreshPress} style={styles.iconBtn}>
              <MaterialIcons name="refresh" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          ) : null}
          {onAddPress ? (
            <TouchableOpacity onPress={onAddPress} style={styles.iconBtn}>
              <MaterialIcons name="add" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={handleNotificationPress}
            style={styles.iconBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.notificationContainer}>
              <MaterialIcons name="notifications" size={20} color={colors.text.primary} />
              {recentActivity && recentActivity.length > 0 && (
                <View style={dynamicStyles.notificationBadge} />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity Modal */}
      <Modal
        visible={showActivityModal}
        transparent
        animationType="none"
        onRequestClose={handleCloseModal}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCloseModal}
          />
          <Animated.View
            style={[
              dynamicStyles.bottomSheet,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [Dimensions.get('window').height, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={dynamicStyles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={dynamicStyles.sheetTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
                <MaterialIcons name="close" size={20} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={true}>
              {activityLoading ? (
                <View style={styles.emptyState}>
                  <Text style={dynamicStyles.emptyStateText}>Loading...</Text>
                </View>
              ) : recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => {
                  const activityIconName = getActivityIconName(activity.type);
                  const activityColor = getActivityColor(activity.color);

                  return (
                    <View
                      key={activity.id}
                      style={[
                        styles.activityItem,
                        index < recentActivity.length - 1 && dynamicStyles.activityItemBorder,
                      ]}
                    >
                      <View style={[styles.activityIcon, { backgroundColor: activityColor.bg }]}>
                        <MaterialIcons name={activityIconName} size={18} color={activityColor.icon} />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={dynamicStyles.activityTitle}>{activity.title}</Text>
                        <Text style={dynamicStyles.activitySubtitle}>{activity.subtitle}</Text>
                        <Text style={dynamicStyles.activityTime}>{formatTimeAgo(activity.timestamp)}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <MaterialIcons name="show-chart" size={40} color={colors.text.secondary} />
                  <Text style={dynamicStyles.emptyStateTitle}>No recent activity</Text>
                  <Text style={dynamicStyles.emptyStateText}>
                    Your recent activity will appear here
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
};

// Static styles that don't depend on theme
const styles = StyleSheet.create({
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
    backgroundColor: 'transparent',
    minWidth: 44,
    minHeight: 44,
  },
  notificationContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'flex-end',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  closeButton: {
    padding: spacing.xs,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    flex: 1,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});

export default AppNavbar;
