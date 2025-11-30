/**
 * Button Component
 * 
 * A fully themed button component with multiple variants and sizes.
 * All styling comes from theme tokens - no hardcoded values.
 * 
 * @example
 * ```tsx
 * <Button onPress={handleSubmit}>Submit</Button>
 * <Button variant="secondary" onPress={handleCancel}>Cancel</Button>
 * <Button variant="outline" size="sm" onPress={handleAction}>Small Action</Button>
 * <Button variant="ghost" icon={<Icon />}>With Icon</Button>
 * <Button loading>Processing...</Button>
 * <Button disabled>Disabled</Button>
 * ```
 */

import React, { useRef, useCallback } from 'react';
import {
  TouchableOpacity,
  View,
  ActivityIndicator,
  Animated,
  ViewStyle,
  TextStyle,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps {
  /** Button content */
  children: React.ReactNode;
  /** Press handler */
  onPress: () => void;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size preset */
  size?: ButtonSize;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Icon element */
  icon?: React.ReactNode;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  /** Full width button */
  fullWidth?: boolean;
  /** Custom container style (avoid using) */
  style?: ViewStyle;
  /** Custom text style (avoid using) */
  textStyle?: TextStyle;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Accessibility hint */
  accessibilityHint?: string;
  /** Test ID */
  testID?: string;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors, spacing, borderRadius, typography, animation } = useTheme();
  
  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Press animations
  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.8,
        duration: animation.duration.fast,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, animation.duration.fast]);

  const handlePressOut = useCallback(() => {
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
  }, [scaleAnim, opacityAnim, animation.duration.fast]);

  // Get variant styles
  const getVariantStyles = (): { bg: string; border: string; text: string; borderWidth: number } => {
    switch (variant) {
      case 'primary':
        return {
          bg: colors.primary.main,
          border: colors.primary.main,
          text: colors.text.inverse,
          borderWidth: 0,
        };
      case 'secondary':
        return {
          bg: colors.background.primary,
          border: colors.primary.main,
          text: colors.primary.main,
          borderWidth: 1,
        };
      case 'outline':
        return {
          bg: 'transparent',
          border: colors.primary.main,
          text: colors.primary.main,
          borderWidth: 1,
        };
      case 'ghost':
        return {
          bg: 'transparent',
          border: 'transparent',
          text: colors.primary.main,
          borderWidth: 0,
        };
      case 'destructive':
        return {
          bg: colors.error.main,
          border: colors.error.main,
          text: colors.text.inverse,
          borderWidth: 0,
        };
      default:
        return {
          bg: colors.primary.main,
          border: colors.primary.main,
          text: colors.text.inverse,
          borderWidth: 0,
        };
    }
  };

  // Get size styles
  const getSizeStyles = (): { 
    paddingVertical: number; 
    paddingHorizontal: number; 
    fontSize: number; 
    radius: number;
    minHeight: number;
    iconSize: number;
    gap: number;
  } => {
    switch (size) {
      case 'xs':
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          fontSize: typography.fontSize.xs,
          radius: borderRadius.sm,
          minHeight: 28,
          iconSize: 14,
          gap: spacing.xs,
        };
      case 'sm':
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          fontSize: typography.fontSize.sm,
          radius: borderRadius.button,
          minHeight: 36,
          iconSize: 16,
          gap: spacing.xs,
        };
      case 'md':
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          fontSize: typography.fontSize.base,
          radius: borderRadius.button,
          minHeight: 44,
          iconSize: 18,
          gap: spacing.sm,
        };
      case 'lg':
        return {
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.xl,
          fontSize: typography.fontSize.lg,
          radius: borderRadius.button,
          minHeight: 52,
          iconSize: 20,
          gap: spacing.sm,
        };
      case 'xl':
        return {
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing['2xl'],
          fontSize: typography.fontSize.xl,
          radius: borderRadius.md,
          minHeight: 60,
          iconSize: 24,
          gap: spacing.md,
        };
      default:
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          fontSize: typography.fontSize.base,
          radius: borderRadius.button,
          minHeight: 44,
          iconSize: 18,
          gap: spacing.sm,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  // Build button container styles
  const buttonStyles: ViewStyle[] = [
    styles.base,
    {
      backgroundColor: variantStyles.bg,
      borderColor: variantStyles.border,
      borderWidth: variantStyles.borderWidth,
      borderRadius: sizeStyles.radius,
      paddingVertical: sizeStyles.paddingVertical,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      minHeight: sizeStyles.minHeight,
      gap: sizeStyles.gap,
    },
    fullWidth ? styles.fullWidth : {},
    disabled ? { opacity: 0.5 } : {},
    style ?? {},
  ];

  // Build text styles
  const buttonTextStyle: TextStyle = {
    fontSize: sizeStyles.fontSize,
    fontWeight: typography.fontWeight.semibold,
    color: variantStyles.text,
    textAlign: 'center',
  };

  // Render content
  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          color={variantStyles.text}
          size="small"
          accessibilityLabel="Loading"
        />
      );
    }

    const iconElement = icon ? (
      <View style={iconPosition === 'right' ? styles.iconRight : styles.iconLeft}>
        {icon}
      </View>
    ) : null;

    // Handle string children
    const textContent = typeof children === 'string' ? (
      <Animated.Text style={[buttonTextStyle, textStyle]}>
        {children}
      </Animated.Text>
    ) : children;

    return (
      <>
        {iconPosition === 'left' && iconElement}
        {textContent}
        {iconPosition === 'right' && iconElement}
      </>
    );
  };

  // Determine accessibility label
  const label = accessibilityLabel || (typeof children === 'string' ? children : undefined);

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        fullWidth && styles.fullWidth,
      ]}
    >
      <TouchableOpacity
        style={buttonStyles}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading }}
        testID={testID}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  iconLeft: {
    marginRight: 0,
  },
  iconRight: {
    marginLeft: 0,
  },
});

export default Button;

