/**
 * ProgressBar Component
 * 
 * A linear progress indicator for showing completion status.
 * 
 * @example
 * ```tsx
 * <ProgressBar progress={75} />
 * <ProgressBar progress={50} variant="success" showLabel />
 * <ProgressBar progress={30} size="lg" animated />
 * ```
 */

import React, { useEffect, useRef } from 'react';
import { View, ViewStyle, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Caption } from './Text';

export type ProgressBarVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type ProgressBarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ProgressBarProps {
  /** Progress value (0-100) */
  progress: number;
  /** Visual variant */
  variant?: ProgressBarVariant;
  /** Size preset */
  size?: ProgressBarSize;
  /** Show percentage label */
  showLabel?: boolean;
  /** Label position */
  labelPosition?: 'top' | 'right' | 'inside';
  /** Animate progress changes */
  animated?: boolean;
  /** Indeterminate loading state */
  indeterminate?: boolean;
  /** Custom track color */
  trackColor?: string;
  /** Custom fill color */
  fillColor?: string;
  /** Custom style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

export function ProgressBar({
  progress,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  labelPosition = 'right',
  animated = true,
  indeterminate = false,
  trackColor,
  fillColor,
  style,
  testID,
}: ProgressBarProps) {
  const { colors, borderRadius, spacing } = useTheme();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const indeterminateAnim = useRef(new Animated.Value(0)).current;

  // Clamp progress between 0-100
  const clampedProgress = Math.min(100, Math.max(0, progress));

  // Animate progress changes
  useEffect(() => {
    if (!indeterminate) {
      Animated.timing(progressAnim, {
        toValue: clampedProgress,
        duration: animated ? 300 : 0,
        useNativeDriver: false,
      }).start();
    }
  }, [clampedProgress, animated, indeterminate, progressAnim]);

  // Indeterminate animation
  useEffect(() => {
    if (indeterminate) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(indeterminateAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(indeterminateAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [indeterminate, indeterminateAnim]);

  // Get size styles
  const getSizeStyles = (): { height: number } => {
    switch (size) {
      case 'xs':
        return { height: 4 };
      case 'sm':
        return { height: 6 };
      case 'lg':
        return { height: 12 };
      default: // md
        return { height: 8 };
    }
  };

  // Get variant color
  const getVariantColor = (): string => {
    if (fillColor) return fillColor;
    
    switch (variant) {
      case 'secondary':
        return colors.secondary.main;
      case 'success':
        return colors.success.main;
      case 'warning':
        return colors.warning.main;
      case 'error':
        return colors.error.main;
      case 'info':
        return colors.info.main;
      default:
        return colors.primary.main;
    }
  };

  const sizeStyles = getSizeStyles();
  const variantColor = getVariantColor();
  const track = trackColor || colors.neutral[200];

  // Track styles
  const trackStyles: ViewStyle = {
    height: sizeStyles.height,
    backgroundColor: track,
    borderRadius: sizeStyles.height / 2,
    overflow: 'hidden',
    flex: 1,
  };

  // Animated fill width
  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Indeterminate animation styles
  const indeterminateWidth = indeterminateAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0%', '50%', '0%'],
  });

  const indeterminateLeft = indeterminateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Fill styles
  const fillStyles: ViewStyle = {
    height: '100%',
    backgroundColor: variantColor,
    borderRadius: sizeStyles.height / 2,
  };

  // Render label
  const renderLabel = () => {
    if (!showLabel || indeterminate) return null;

    const labelText = `${Math.round(clampedProgress)}%`;

    if (labelPosition === 'inside' && size === 'lg') {
      return null; // Inside label only for large size with different implementation
    }

    return (
      <Caption
        weight="medium"
        style={labelPosition === 'top' ? styles.labelTop : labelPosition === 'right' ? styles.labelRight : undefined}
      >
        {labelText}
      </Caption>
    );
  };

  // Top label layout
  if (showLabel && labelPosition === 'top') {
    return (
      <View style={style} testID={testID}>
        <View style={styles.topLabelContainer}>
          {renderLabel()}
        </View>
        <View style={trackStyles}>
          <Animated.View
            style={[
              fillStyles,
              indeterminate
                ? { width: indeterminateWidth, left: indeterminateLeft, position: 'absolute' }
                : { width: animatedWidth },
            ]}
          />
        </View>
      </View>
    );
  }

  // Right label layout (default)
  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={trackStyles}>
        <Animated.View
          style={[
            fillStyles,
            indeterminate
              ? { width: indeterminateWidth, left: indeterminateLeft, position: 'absolute' }
              : { width: animatedWidth },
          ]}
        />
      </View>
      {renderLabel()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  labelTop: {
    marginBottom: 0,
  },
  labelRight: {
    marginLeft: 8,
    minWidth: 36,
    textAlign: 'right',
  },
});

export default ProgressBar;

