/**
 * ErrorView Component
 * 
 * Error display with animated entrance and retry button.
 * 
 * @example
 * ```tsx
 * <ErrorView message="Failed to load data" onRetry={refetch} />
 * ```
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './Button';

export interface ErrorViewProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorView({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
}: ErrorViewProps) {
  const { colors, typography, spacing } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const styles = useMemo(
    () => createStyles(colors, typography, spacing),
    [colors, typography, spacing],
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <MaterialIcons
          name="error"
          size={64}
          color={colors.error.main}
          accessibilityLabel="Error icon"
        />
      </Animated.View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button onPress={onRetry} style={styles.button}>
          {retryLabel}
        </Button>
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
    title: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold as any,
      color: colors.text.primary,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    message: {
      fontSize: typography.fontSize.base,
      color: colors.text.tertiary,
      marginTop: spacing.xs,
      textAlign: 'center',
      maxWidth: 300,
    },
    button: {
      marginTop: spacing.lg,
    },
  });
