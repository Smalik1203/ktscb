/**
 * LoadingView Component
 * 
 * Full-area loading indicator with optional message.
 * 
 * @example
 * ```tsx
 * <LoadingView />
 * <LoadingView message="Fetching students..." />
 * ```
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, ActivityIndicator, Animated, Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface LoadingViewProps {
  message?: string;
  size?: 'small' | 'large';
  showMessage?: boolean;
}

export function LoadingView({
  message = 'Loading...',
  size = 'large',
  showMessage = true,
}: LoadingViewProps) {
  const { colors, typography, spacing } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const styles = useMemo(
    () => createStyles(colors, typography, spacing),
    [colors, typography, spacing],
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ActivityIndicator
        size={size}
        color={colors.primary.main}
        accessibilityLabel="Loading content"
      />
      {showMessage && (
        <Text style={styles.message} accessibilityLabel={`Loading: ${message}`}>
          {message}
        </Text>
      )}
    </Animated.View>
  );
}

const createStyles = (colors: any, typography: any, spacing: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    message: {
      fontSize: typography.fontSize.base,
      color: colors.text.tertiary,
      marginTop: spacing.md,
    },
  });
