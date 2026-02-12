/**
 * ProgressRing Component
 * 
 * Circular progress indicator using SVG.
 * 
 * @example
 * ```tsx
 * <ProgressRing progress={75} />
 * <ProgressRing progress={50} size={60} color={colors.success.main} />
 * ```
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  label?: string;
  animated?: boolean;
}

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
  const { colors, typography } = useTheme();

  const ringColor = color ?? colors.primary.main;
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
  }, [normalizedProgress, animated, animatedValue]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringBackgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
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
      <View style={styles.centerContent}>
        {showPercentage && (
          <Text
            style={[
              styles.percentage,
              {
                fontSize: size * 0.25,
                fontWeight: typography.fontWeight.bold as any,
                color: colors.text.primary,
              },
            ]}
          >
            {Math.round(normalizedProgress)}%
          </Text>
        )}
        {label && (
          <Text
            style={[
              styles.label,
              {
                fontSize: size * 0.12,
                fontWeight: typography.fontWeight.medium as any,
                color: colors.text.tertiary,
              },
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  percentage: {},
  label: {
    marginTop: 2,
  },
});
