/**
 * Badge Component
 * 
 * A small status indicator or label component.
 * Use for status, counts, or categorization.
 * 
 * @example
 * ```tsx
 * <Badge>New</Badge>
 * <Badge variant="success">Active</Badge>
 * <Badge variant="error" size="sm">3</Badge>
 * <Badge variant="warning" dot />
 * ```
 */

import React, { useMemo } from 'react';
import { View, ViewStyle, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Text } from './Text';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

export interface BadgeProps {
  /** Badge content */
  children?: React.ReactNode;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Size preset */
  size?: BadgeSize;
  /** Show as dot only (no content) */
  dot?: boolean;
  /** Outlined style instead of filled */
  outlined?: boolean;
  /** Custom style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: TextStyle;
  /** Test ID */
  testID?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  outlined = false,
  style,
  textStyle,
  testID,
}: BadgeProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();

  // Get variant colors
  const getVariantColors = useMemo((): {
    bg: string;
    text: string;
    border: string;
  } => {
    switch (variant) {
      case 'primary':
        return {
          bg: outlined ? 'transparent' : colors.primary[100],
          text: colors.primary[700],
          border: colors.primary[300],
        };
      case 'secondary':
        return {
          bg: outlined ? 'transparent' : colors.secondary[100],
          text: colors.secondary[700],
          border: colors.secondary[300],
        };
      case 'success':
        return {
          bg: outlined ? 'transparent' : colors.success[100],
          text: colors.success[700],
          border: colors.success[300],
        };
      case 'warning':
        return {
          bg: outlined ? 'transparent' : colors.warning[100],
          text: colors.warning[700],
          border: colors.warning[300],
        };
      case 'error':
        return {
          bg: outlined ? 'transparent' : colors.error[100],
          text: colors.error[700],
          border: colors.error[300],
        };
      case 'info':
        return {
          bg: outlined ? 'transparent' : colors.info[100],
          text: colors.info[700],
          border: colors.info[300],
        };
      default:
        return {
          bg: outlined ? 'transparent' : colors.neutral[100],
          text: colors.neutral[700],
          border: colors.neutral[300],
        };
    }
  }, [variant, colors, outlined]);

  // Get size styles
  const getSizeStyles = useMemo((): {
    paddingVertical: number;
    paddingHorizontal: number;
    fontSize: number;
    minWidth: number;
    dotSize: number;
  } => {
    switch (size) {
      case 'xs':
        return {
          paddingVertical: 1,
          paddingHorizontal: spacing.xs,
          fontSize: typography.fontSize.xs - 2,
          minWidth: 16,
          dotSize: 6,
        };
      case 'sm':
        return {
          paddingVertical: 2,
          paddingHorizontal: spacing.sm,
          fontSize: typography.fontSize.xs,
          minWidth: 18,
          dotSize: 8,
        };
      case 'lg':
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          fontSize: typography.fontSize.base,
          minWidth: 28,
          dotSize: 12,
        };
      default: // md
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          fontSize: typography.fontSize.sm,
          minWidth: 22,
          dotSize: 10,
        };
    }
  }, [size, spacing, typography.fontSize]);

  // Dot badge
  if (dot) {
    const dotStyle: ViewStyle = {
      width: getSizeStyles.dotSize,
      height: getSizeStyles.dotSize,
      borderRadius: getSizeStyles.dotSize / 2,
      backgroundColor: getVariantColors.bg === 'transparent' 
        ? getVariantColors.border 
        : getVariantColors.text,
    };

    return <View style={[dotStyle, style]} testID={testID} />;
  }

  // Build badge styles
  const badgeStyles: ViewStyle = {
    backgroundColor: getVariantColors.bg,
    borderColor: getVariantColors.border,
    borderWidth: outlined ? 1 : 0,
    borderRadius: borderRadius.full,
    paddingVertical: getSizeStyles.paddingVertical,
    paddingHorizontal: getSizeStyles.paddingHorizontal,
    minWidth: getSizeStyles.minWidth,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={[badgeStyles, style]} testID={testID}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text
          size={size === 'xs' || size === 'sm' ? 'xs' : 'sm'}
          weight="semibold"
          align="center"
          style={{ color: getVariantColors.text, ...textStyle }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

export default Badge;

