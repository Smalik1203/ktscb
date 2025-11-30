import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { Wifi, WifiOff } from 'lucide-react-native';
import { spacing, typography, colors } from '../../../lib/design-system';
import { useNetworkStatus } from '../../utils/offline';

export function NetworkStatus() {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const { isConnected, isInternetReachable } = useNetworkStatus();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    if (!isConnected || !isInternetReachable) {
      // Slide in when offline
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide out when online
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isConnected, isInternetReachable, slideAnim]);

  if (isConnected && isInternetReachable) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <WifiOff size={20} color={colors.text.inverse} />
        <Text style={styles.text}>
          {!isConnected ? 'No internet connection' : 'Connection unstable'}
        </Text>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.error[500],
    zIndex: 1000,
    paddingTop: 50, // Account for status bar
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  text: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});
