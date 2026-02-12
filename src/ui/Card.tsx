/**
 * Card Component
 * 
 * A versatile container for grouping related content.
 * Supports multiple variants, press interactions, and consistent theming.
 * 
 * @example
 * ```tsx
 * <Card>
 *   <Heading level={4}>Card Title</Heading>
 *   <Body>Card content goes here</Body>
 * </Card>
 * 
 * <Card variant="elevated" onPress={handlePress}>
 *   <Body>Pressable elevated card</Body>
 * </Card>
 * 
 * <Card variant="outlined" padding="lg">
 *   <Body>Outlined card with large padding</Body>
 * </Card>
 * ```
 */

import React, { useRef, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, Animated, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'ghost';
export type CardPadding = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardProps {
  children: React.ReactNode;
  /** Visual variant */
  variant?: CardVariant;
  /** Padding preset */
  padding?: CardPadding;
  /** Press handler (makes card interactive) */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom border radius */
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'none';
  /** Custom style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
  /** Accessibility label */
  accessibilityLabel?: string;
}

export function Card({
  children,
  variant = 'default',
  padding = 'lg',
  onPress,
  onLongPress,
  disabled = false,
  radius = 'md',
  style,
  testID,
  accessibilityLabel,
}: CardProps) {
  const { colors, spacing, borderRadius, shadows, isDark, animation } = useTheme();

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Press animations
  const handlePressIn = useCallback(() => {
    if (onPress && !disabled) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.98,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.95,
          duration: animation.duration.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [onPress, disabled, scaleAnim, opacityAnim, animation.duration.fast]);

  const handlePressOut = useCallback(() => {
    if (onPress && !disabled) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: animation.duration.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [onPress, disabled, scaleAnim, opacityAnim, animation.duration.fast]);

  // Get padding value
  const getPadding = (): number => {
    const paddingMap: Record<CardPadding, number> = {
      none: 0,
      xs: spacing.xs,
      sm: spacing.sm,
      md: spacing.md,
      lg: spacing.lg,
      xl: spacing.xl,
    };
    return paddingMap[padding];
  };

  // Get border radius value
  const getRadius = (): number => {
    const radiusMap: Record<string, number> = {
      none: 0,
      sm: borderRadius.sm,
      md: borderRadius.card,
      lg: borderRadius.lg,
      xl: borderRadius.xl,
    };
    return radiusMap[radius];
  };

  // Get variant styles
  const getVariantStyles = useMemo((): ViewStyle => {
    // Dark mode uses borders instead of shadows for depth
    const darkModeBorder = isDark ? { borderWidth: 1, borderColor: colors.border.light } : {};

    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surface.elevated,
          ...(isDark ? darkModeBorder : shadows.md),
        };
      case 'outlined':
        return {
          backgroundColor: colors.surface.primary,
          borderWidth: 1,
          borderColor: colors.border.DEFAULT,
        };
      case 'filled':
        return {
          backgroundColor: colors.background.secondary,
          ...(isDark ? darkModeBorder : {}),
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      default:
        return {
          backgroundColor: colors.background.primary,
          ...(isDark ? darkModeBorder : shadows.DEFAULT),
        };
    }
  }, [variant, colors, shadows, isDark]);

  // Build card styles
  const cardStyles: ViewStyle[] = [
    styles.card,
    {
      padding: getPadding(),
      borderRadius: getRadius(),
    },
    getVariantStyles,
    disabled ? styles.disabled : {},
    style ?? {},
  ];

  // Render pressable card
  if (onPress || onLongPress) {
    return (
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      >
        <TouchableOpacity
          style={cardStyles}
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          testID={testID}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Render static card
  return (
    <View style={cardStyles} testID={testID} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // Note: overflow 'hidden' removed to prevent shadow clipping on Surface components
    // If content overflow clipping is needed, wrap inner content in a View with overflow: 'hidden'
  },
  disabled: {
    opacity: 0.6,
  },
});

export default Card;

