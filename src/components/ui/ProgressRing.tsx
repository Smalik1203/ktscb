import React, { useEffect, useRef , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { typography, spacing, colors } from '../../../lib/design-system';
import Svg, { Circle } from 'react-native-svg';

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  label?: string;
  animated?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 8,
  color,
  backgroundColor,
  showPercentage = true,
  label,
  animated = true,
}: ProgressRingProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  
  // Use theme colors as defaults
  const ringColor = color ?? colors.primary[600];
  const ringBackgroundColor = backgroundColor ?? colors.neutral[200];
  const animatedValue = useRef(new Animated.Value(0)).current;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);

  useEffect(() => {
    if (animated) {
      Animated.spring(animatedValue, {
        toValue: normalizedProgress,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }).start();
    } else {
      animatedValue.setValue(normalizedProgress);
    }
  }, [normalizedProgress]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringBackgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      {/* Center content */}
      <View style={styles.centerContent}>
        {showPercentage && (
          <Text style={[styles.percentage, { fontSize: size * 0.25 }]}>
            {Math.round(normalizedProgress)}%
          </Text>
        )}
        {label && (
          <Text style={[styles.label, { fontSize: size * 0.12 }]}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentage: {
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
  },
  label: {
    fontWeight: typography.fontWeight.medium as any,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
