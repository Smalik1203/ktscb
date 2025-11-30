import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../theme/types';

interface CardSkeletonProps {
  height?: number;
  width?: number | string;
  style?: any;
}

export function CardSkeleton({ height = 120, width = '100%', style }: CardSkeletonProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[styles.container, { height, width }, style]}>
      <Animated.View style={[styles.skeleton, { opacity }]} />
    </View>
  );
}

export function ListCardSkeleton() {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  return (
    <View style={styles.listCard}>
      <CardSkeleton height={20} width="40%" style={{ marginBottom: spacing[2] }} />
      <CardSkeleton height={16} width="60%" style={{ marginBottom: spacing[2] }} />
      <CardSkeleton height={14} width="80%" />
    </View>
  );
}

export function StatCardSkeleton() {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  return (
    <View style={styles.statCard}>
      <CardSkeleton height={40} width={60} style={{ marginBottom: spacing[2], borderRadius: borderRadius.full }} />
      <CardSkeleton height={16} width="70%" />
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows
) =>
  StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.neutral[200],
  },
  skeleton: {
    flex: 1,
    backgroundColor: colors.neutral[300],
  },
  listCard: {
      padding: spacing[4],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
      marginBottom: spacing[3],
  },
  statCard: {
      padding: spacing[4],
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
