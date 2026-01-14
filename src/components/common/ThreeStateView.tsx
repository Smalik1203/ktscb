/**
 * ThreeStateView Component
 * 
 * A unified loading/error/empty state handler using the UI Kit.
 * Replaces React Native Paper components with custom themed components.
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { RefreshCw, AlertCircle, Inbox, WifiOff } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Body, Heading, Caption, Button, Stack, Center } from '../../ui';

export interface ThreeStateViewProps {
  state: 'loading' | 'error' | 'empty' | 'success';
  loadingMessage?: string;
  errorMessage?: string;
  errorDetails?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: {
    label: string;
    onPress: () => void;
  };
  onRetry?: () => void;
  children?: React.ReactNode;
  timeout?: number; // in seconds
}

// Custom animated loading spinner using theme colors
function LoadingSpinner({ color, size = 48 }: { color: string; size?: number }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Spin animation
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Subtle pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spin.start();
    pulse.start();

    return () => {
      spin.stop();
      pulse.stop();
    };
  }, [spinAnim, pulseAnim]);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        transform: [{ rotate: rotation }, { scale: pulseAnim }],
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: color,
          borderTopColor: 'transparent',
        }}
      />
    </Animated.View>
  );
}

export const ThreeStateView: React.FC<ThreeStateViewProps> = ({
  state,
  loadingMessage = 'Loading...',
  errorMessage = 'Something went wrong',
  errorDetails,
  emptyMessage = 'No data available',
  emptyIcon,
  emptyAction,
  onRetry,
  children,
  timeout = 6,
}) => {
  const { colors, spacing, borderRadius, isDark } = useTheme();

  // Create dynamic styles based on theme
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      backgroundColor: colors.background.app,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.neutral[100],
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    errorIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.error[50],
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary[50],
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
  }), [colors, spacing]);

  if (state === 'success' && children) {
    return <View style={{ flex: 1, backgroundColor: colors.background.app }}>{children}</View>;
  }

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <Center style={{ padding: spacing.xl }}>
            <LoadingSpinner color={colors.primary.main} size={48} />
            <Body
              color="primary"
              weight="medium"
              style={{ marginTop: spacing.lg, textAlign: 'center' }}
            >
              {loadingMessage}
            </Body>
            {timeout > 0 && (
              <Caption
                color="tertiary"
                style={{ marginTop: spacing.sm, textAlign: 'center', maxWidth: 250 }}
              >
                Taking longer than expected? Check your connection.
              </Caption>
            )}
          </Center>
        );

      case 'error':
        return (
          <Center style={{ padding: spacing.xl }}>
            <View style={dynamicStyles.errorIconContainer}>
              <AlertCircle size={40} color={colors.error.main} />
            </View>
            <Heading level={4} align="center" style={{ color: colors.error.main }}>
              {errorMessage}
            </Heading>
            {errorDetails && (
              <Caption
                color="secondary"
                style={{
                  marginTop: spacing.sm,
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  maxWidth: 280,
                }}
              >
                {errorDetails}
              </Caption>
            )}
            {onRetry && (
              <Button
                variant="primary"
                size="md"
                onPress={onRetry}
                icon={<RefreshCw size={16} color={colors.text.inverse} />}
                style={{ marginTop: spacing.lg }}
              >
                Try Again
              </Button>
            )}
          </Center>
        );

      case 'empty':
        return (
          <Center style={{ padding: spacing.xl }}>
            <View style={dynamicStyles.emptyIconContainer}>
              {emptyIcon || <Inbox size={40} color={colors.primary.main} />}
            </View>
            <Heading level={5} align="center" color="secondary">
              {emptyMessage}
            </Heading>
            {emptyAction && (
              <Button
                variant="outline"
                size="md"
                onPress={emptyAction.onPress}
                style={{ marginTop: spacing.lg }}
              >
                {emptyAction.label}
              </Button>
            )}
          </Center>
        );

      default:
        return null;
    }
  };

  return (
    <View style={dynamicStyles.container}>
      {renderContent()}
    </View>
  );
};
