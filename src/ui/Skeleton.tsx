/**
 * Skeleton Component
 * 
 * A placeholder loading component with shimmer animation.
 * Use while content is loading to prevent layout shift.
 * 
 * @example
 * ```tsx
 * // Basic shapes
 * <Skeleton width={200} height={20} />
 * <Skeleton variant="circle" size={40} />
 * <Skeleton variant="rounded" width="100%" height={100} />
 * 
 * // Card skeleton
 * <Skeleton.Card />
 * 
 * // Text skeleton
 * <Skeleton.Text lines={3} />
 * 
 * // Avatar skeleton
 * <Skeleton.Avatar size="lg" />
 * ```
 */

import React, { useEffect, useRef } from 'react';
import { View, ViewStyle, Animated, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type SkeletonVariant = 'rectangular' | 'rounded' | 'circle';

export interface SkeletonProps {
  /** Width (number or percentage string) */
  width?: number | string;
  /** Height (number or percentage string) */
  height?: number | string;
  /** Shape variant */
  variant?: SkeletonVariant;
  /** Size for circle variant */
  size?: number;
  /** Border radius for rounded variant */
  radius?: number;
  /** Disable animation */
  disableAnimation?: boolean;
  /** Custom style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

export function Skeleton({
  width = '100%',
  height = 20,
  variant = 'rectangular',
  size,
  radius,
  disableAnimation = false,
  style,
  testID,
}: SkeletonProps) {
  const { colors, borderRadius, isDark } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Shimmer animation
  useEffect(() => {
    if (!disableAnimation) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [disableAnimation, shimmerAnim]);

  // Get dimensions
  const getDimensions = (): { width: number | string; height: number | string } => {
    if (variant === 'circle' && size) {
      return { width: size, height: size };
    }
    return { width, height };
  };

  // Get border radius
  const getBorderRadius = (): number => {
    if (variant === 'circle') {
      const circleSize = size || (typeof height === 'number' ? height : 20);
      return circleSize / 2;
    }
    if (variant === 'rounded') {
      return radius ?? borderRadius.md;
    }
    return radius ?? borderRadius.sm;
  };

  const dimensions = getDimensions();
  const skeletonRadius = getBorderRadius();

  // Colors
  const baseColor = isDark ? colors.neutral[200] : colors.neutral[200];
  const highlightColor = isDark ? colors.neutral[300] : colors.neutral[100];

  // Animated opacity for shimmer effect
  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.6, 1],
  });

  // Skeleton styles
  const skeletonStyles: ViewStyle = {
    width: dimensions.width as ViewStyle['width'],
    height: dimensions.height as ViewStyle['height'],
    borderRadius: skeletonRadius,
    backgroundColor: baseColor,
    overflow: 'hidden',
  };

  return (
    <Animated.View
      style={[
        skeletonStyles,
        !disableAnimation && { opacity: shimmerOpacity },
        style,
      ]}
      testID={testID}
    />
  );
}

// ============================================================================
// SKELETON PRESETS
// ============================================================================

export interface SkeletonTextProps {
  /** Number of lines */
  lines?: number;
  /** Line height */
  lineHeight?: number;
  /** Gap between lines */
  gap?: number;
  /** Last line width */
  lastLineWidth?: string | number;
  /** Custom style */
  style?: ViewStyle;
}

export function SkeletonText({
  lines = 3,
  lineHeight = 16,
  gap = 8,
  lastLineWidth = '60%',
  style,
}: SkeletonTextProps) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height={lineHeight}
          variant="rounded"
        />
      ))}
    </View>
  );
}

export interface SkeletonAvatarProps {
  /** Size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Custom style */
  style?: ViewStyle;
}

export function SkeletonAvatar({ size = 'md', style }: SkeletonAvatarProps) {
  const sizeMap: Record<string, number> = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 72,
  };

  return (
    <Skeleton
      variant="circle"
      size={sizeMap[size]}
      style={style}
    />
  );
}

export interface SkeletonCardProps {
  /** Show avatar */
  showAvatar?: boolean;
  /** Number of text lines */
  textLines?: number;
  /** Custom style */
  style?: ViewStyle;
}

export function SkeletonCard({
  showAvatar = true,
  textLines = 2,
  style,
}: SkeletonCardProps) {
  const { spacing, borderRadius: br, colors, isDark, shadows } = useTheme();

  const cardStyle: ViewStyle = {
    padding: spacing.lg,
    borderRadius: br.card,
    backgroundColor: colors.surface.primary,
    ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.sm),
  };

  return (
    <View style={[cardStyle, style]}>
      {showAvatar && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <SkeletonAvatar size="md" />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Skeleton width="60%" height={14} variant="rounded" />
            <View style={{ height: spacing.xs }} />
            <Skeleton width="40%" height={12} variant="rounded" />
          </View>
        </View>
      )}
      <SkeletonText lines={textLines} />
    </View>
  );
}

// Attach presets to Skeleton
Skeleton.Text = SkeletonText;
Skeleton.Avatar = SkeletonAvatar;
Skeleton.Card = SkeletonCard;

export default Skeleton;

