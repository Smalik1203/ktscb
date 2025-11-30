import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { borderRadius, spacing, typography, shadows } from '../../../lib/design-system';
import { useTheme } from '../../contexts/ThemeContext';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
}: BadgeProps) {
  const { colors, isDark } = useTheme();

  const getVariantStyles = useMemo(() => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary[isDark ? 100 : 100],
          textColor: colors.primary[isDark ? 600 : 700],
          borderColor: colors.primary[isDark ? 200 : 200],
        };
      case 'secondary':
        return {
          backgroundColor: colors.secondary[isDark ? 100 : 100],
          textColor: colors.secondary[isDark ? 600 : 700],
          borderColor: colors.secondary[isDark ? 200 : 200],
        };
      case 'success':
        return {
          backgroundColor: colors.success[isDark ? 100 : 100],
          textColor: colors.success[isDark ? 600 : 700],
          borderColor: colors.success[isDark ? 200 : 200],
        };
      case 'warning':
        return {
          backgroundColor: colors.warning[isDark ? 100 : 100],
          textColor: colors.warning[isDark ? 600 : 700],
          borderColor: colors.warning[isDark ? 200 : 200],
        };
      case 'error':
        return {
          backgroundColor: colors.error[isDark ? 100 : 100],
          textColor: colors.error[isDark ? 600 : 700],
          borderColor: colors.error[isDark ? 200 : 200],
        };
      case 'info':
        return {
          backgroundColor: colors.info[isDark ? 100 : 100],
          textColor: colors.info[isDark ? 600 : 700],
          borderColor: colors.info[isDark ? 200 : 200],
        };
      default:
        return {
          backgroundColor: colors.neutral[isDark ? 100 : 100],
          textColor: colors.neutral[isDark ? 600 : 700],
          borderColor: colors.neutral[isDark ? 200 : 200],
        };
    }
  }, [variant, colors, isDark]);

  const sizeStyles = useMemo(() => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          fontSize: typography.fontSize.xs,
          borderRadius: borderRadius.sm,
        };
      case 'md':
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          fontSize: typography.fontSize.sm,
          borderRadius: borderRadius.md,
        };
      case 'lg':
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          fontSize: typography.fontSize.base,
          borderRadius: borderRadius.lg,
        };
      default:
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          fontSize: typography.fontSize.sm,
          borderRadius: borderRadius.md,
        };
    }
  }, [size]);

  const variantStyles = getVariantStyles;

  const badgeStyles = [
    styles.badge,
    {
      backgroundColor: variantStyles.backgroundColor,
      borderColor: variantStyles.borderColor,
      paddingVertical: sizeStyles.paddingVertical,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      borderRadius: sizeStyles.borderRadius,
    },
    style,
  ];

  const textStyles = [
    styles.text,
    {
      color: variantStyles.textColor,
      fontSize: sizeStyles.fontSize,
      fontWeight: typography.fontWeight.semibold,
    },
    textStyle,
  ];

  return (
    <View style={badgeStyles}>
      <Text style={textStyles}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    ...shadows.xs,
  },
  text: {
    textAlign: 'center',
  },
});
