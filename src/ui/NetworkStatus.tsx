/**
 * NetworkStatus Component
 * 
 * Shows a banner when the device is offline.
 * 
 * @example
 * ```tsx
 * <NetworkStatus />
 * ```
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useNetworkStatus } from '../utils/offline';

export function NetworkStatus() {
  const { colors, typography, spacing } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    if (!isConnected || !isInternetReachable) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
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
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.error.main,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.md,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.content, { gap: spacing.xs }]}>
        <MaterialIcons name="wifi-off" size={20} color={colors.text.inverse} />
        <Text
          style={[
            styles.text,
            {
              color: colors.text.inverse,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium as any,
            },
          ]}
        >
          {!isConnected ? 'No internet connection' : 'Connection unstable'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 50,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {},
});
