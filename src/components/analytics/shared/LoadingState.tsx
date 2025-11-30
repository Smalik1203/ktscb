import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { SkeletonCard } from './SkeletonCard';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../theme/types';

/**
 * Loading state component with skeleton cards
 * Memoized to prevent unnecessary re-renders
 */
export const LoadingState = React.memo(() => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  return (
  <View style={styles.container}>
    <Animated.View entering={FadeInUp.delay(0)} style={styles.header}>
      <ActivityIndicator size="large" color={colors.primary[600]} />
      <Text variant="bodyMedium" style={styles.text}>
        Loading analytics...
      </Text>
    </Animated.View>
    <Animated.View entering={FadeInDown.delay(100)}>
      <SkeletonCard />
    </Animated.View>
    <Animated.View entering={FadeInDown.delay(200)}>
      <SkeletonCard />
    </Animated.View>
    <Animated.View entering={FadeInDown.delay(300)}>
      <SkeletonCard />
    </Animated.View>
  </View>
  );
});

LoadingState.displayName = 'LoadingState';

const createStyles = (
  colors: ThemeColors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows
) =>
  StyleSheet.create({
  container: {
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  text: {
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
});
