/**
 * IconButton Component
 * 
 * A button that displays only an icon.
 * Use for toolbar actions, close buttons, or compact interactions.
 * 
 * @example
 * ```tsx
 * <IconButton icon={<CloseIcon />} onPress={handleClose} />
 * <IconButton icon={<MenuIcon />} variant="ghost" size="lg" onPress={openMenu} />
 * <IconButton icon={<HeartIcon />} variant="primary" onPress={handleLike} />
 * ```
 */

import React, { useRef, useCallback } from 'react';
import { TouchableOpacity, Animated, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type IconButtonVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive';
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconButtonProps {
  /** Icon element */
  icon: React.ReactNode;
  /** Press handler */
  onPress: () => void;
  /** Visual variant */
  variant?: IconButtonVariant;
  /** Size preset */
  size?: IconButtonSize;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Round button (circle) */
  round?: boolean;
  /** Custom style */
  style?: ViewStyle;
  /** Accessibility label */
  accessibilityLabel: string;
  /** Accessibility hint */
  accessibilityHint?: string;
  /** Test ID */
  testID?: string;
}

export function IconButton({
  icon,
  onPress,
  variant = 'default',
  size = 'md',
  disabled = false,
  loading = false,
  round = true,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: IconButtonProps) {
  const { colors, spacing, borderRadius, animation } = useTheme();

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Press animations
  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.7,
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

  // Get size dimensions
  const getSizeStyles = (): { size: number; iconSize: number; radius: number } => {
    switch (size) {
      case 'xs':
        return { size: 28, iconSize: 14, radius: round ? 14 : borderRadius.sm };
      case 'sm':
        return { size: 36, iconSize: 18, radius: round ? 18 : borderRadius.button };
      case 'lg':
        return { size: 52, iconSize: 26, radius: round ? 26 : borderRadius.md };
      case 'xl':
        return { size: 64, iconSize: 32, radius: round ? 32 : borderRadius.lg };
      default: // md
        return { size: 44, iconSize: 22, radius: round ? 22 : borderRadius.button };
    }
  };

  // Get variant styles
  const getVariantStyles = (): { bg: string; iconColor: string } => {
    switch (variant) {
      case 'primary':
        return {
          bg: colors.primary.main,
          iconColor: colors.text.inverse,
        };
      case 'secondary':
        return {
          bg: colors.primary[100],
          iconColor: colors.primary.main,
        };
      case 'ghost':
        return {
          bg: 'transparent',
          iconColor: colors.text.secondary,
        };
      case 'destructive':
        return {
          bg: colors.error[100],
          iconColor: colors.error.main,
        };
      default:
        return {
          bg: colors.neutral[100],
          iconColor: colors.text.primary,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  // Build button styles
  const buttonStyles: ViewStyle = {
    width: sizeStyles.size,
    height: sizeStyles.size,
    borderRadius: sizeStyles.radius,
    backgroundColor: variantStyles.bg,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
  };

  // Clone icon with correct size and color
  const iconWithProps = React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<any>, {
        size: sizeStyles.iconSize,
        color: variantStyles.iconColor,
      })
    : icon;

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      <TouchableOpacity
        style={[buttonStyles, style]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading }}
        testID={testID}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {iconWithProps}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default IconButton;

