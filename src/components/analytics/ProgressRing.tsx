import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../../../lib/design-system';

export interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  label?: string;
}

export const ProgressRing = React.memo<ProgressRingProps>(({
  progress,
  size = 100,
  strokeWidth = 8,
  color = colors.primary[600],
  backgroundColor = colors.surface.tertiary,
  showPercentage = true,
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressValue = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference - (progressValue / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.textContainer}>
        {showPercentage && (
          <Text variant="titleLarge" style={styles.percentage}>
            {Math.round(progressValue)}%
          </Text>
        )}
        {label && (
          <Text variant="bodySmall" style={styles.label}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}));

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentage: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  label: {
    color: colors.text.secondary,
    marginTop: 2,
  },
});
