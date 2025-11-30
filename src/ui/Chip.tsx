/**
 * Chip Component
 * 
 * A compact element for selections, filters, or displaying attributes.
 * Supports selectable, deletable, and display-only modes.
 * 
 * @example
 * ```tsx
 * // Filter chip
 * <Chip selected={isSelected} onPress={() => setSelected(!isSelected)}>
 *   Mathematics
 * </Chip>
 * 
 * // Deletable chip
 * <Chip onDelete={() => handleRemove(item)}>
 *   Tag Name
 * </Chip>
 * 
 * // With icon
 * <Chip icon={<CheckIcon />} variant="success">
 *   Completed
 * </Chip>
 * ```
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, ViewStyle, TextStyle, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Text } from './Text';

export type ChipVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type ChipSize = 'sm' | 'md' | 'lg';

export interface ChipProps {
  children: React.ReactNode;
  /** Visual variant */
  variant?: ChipVariant;
  /** Size preset */
  size?: ChipSize;
  /** Selected state */
  selected?: boolean;
  /** Press handler */
  onPress?: () => void;
  /** Delete handler (shows X button) */
  onDelete?: () => void;
  /** Leading icon */
  icon?: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Custom style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

export function Chip({
  children,
  variant = 'default',
  size = 'md',
  selected = false,
  onPress,
  onDelete,
  icon,
  disabled = false,
  style,
  testID,
}: ChipProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();

  // Get size styles
  const getSizeStyles = useCallback((): {
    paddingVertical: number;
    paddingHorizontal: number;
    fontSize: number;
    iconSize: number;
    gap: number;
  } => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          fontSize: typography.fontSize.xs,
          iconSize: 12,
          gap: spacing.xs,
        };
      case 'lg':
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          fontSize: typography.fontSize.base,
          iconSize: 18,
          gap: spacing.sm,
        };
      default: // md
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          fontSize: typography.fontSize.sm,
          iconSize: 14,
          gap: spacing.xs,
        };
    }
  }, [size, spacing, typography.fontSize]);

  // Get variant colors
  const getVariantColors = useCallback((): {
    bg: string;
    bgSelected: string;
    text: string;
    textSelected: string;
    border: string;
    borderSelected: string;
  } => {
    switch (variant) {
      case 'primary':
        return {
          bg: colors.primary[100],
          bgSelected: colors.primary.main,
          text: colors.primary[700],
          textSelected: colors.text.inverse,
          border: colors.primary[200],
          borderSelected: colors.primary.main,
        };
      case 'secondary':
        return {
          bg: colors.secondary[100],
          bgSelected: colors.secondary.main,
          text: colors.secondary[700],
          textSelected: colors.text.inverse,
          border: colors.secondary[200],
          borderSelected: colors.secondary.main,
        };
      case 'success':
        return {
          bg: colors.success[100],
          bgSelected: colors.success.main,
          text: colors.success[700],
          textSelected: colors.text.inverse,
          border: colors.success[200],
          borderSelected: colors.success.main,
        };
      case 'warning':
        return {
          bg: colors.warning[100],
          bgSelected: colors.warning.main,
          text: colors.warning[700],
          textSelected: colors.text.inverse,
          border: colors.warning[200],
          borderSelected: colors.warning.main,
        };
      case 'error':
        return {
          bg: colors.error[100],
          bgSelected: colors.error.main,
          text: colors.error[700],
          textSelected: colors.text.inverse,
          border: colors.error[200],
          borderSelected: colors.error.main,
        };
      case 'info':
        return {
          bg: colors.info[100],
          bgSelected: colors.info.main,
          text: colors.info[700],
          textSelected: colors.text.inverse,
          border: colors.info[200],
          borderSelected: colors.info.main,
        };
      default:
        return {
          bg: colors.neutral[100],
          bgSelected: colors.neutral[700],
          text: colors.text.secondary,
          textSelected: colors.text.inverse,
          border: colors.border.light,
          borderSelected: colors.neutral[700],
        };
    }
  }, [variant, colors]);

  const sizeStyles = getSizeStyles();
  const variantColors = getVariantColors();

  // Build chip styles
  const chipStyles: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: selected ? variantColors.bgSelected : variantColors.bg,
    borderColor: selected ? variantColors.borderSelected : variantColors.border,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingVertical: sizeStyles.paddingVertical,
    paddingHorizontal: sizeStyles.paddingHorizontal,
    gap: sizeStyles.gap,
    opacity: disabled ? 0.5 : 1,
  };

  // Build text styles
  const textColor = selected ? variantColors.textSelected : variantColors.text;

  // Render content
  const content = (
    <>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        size={size === 'sm' ? 'xs' : size === 'lg' ? 'base' : 'sm'}
        weight="medium"
        style={{ color: textColor }}
      >
        {children}
      </Text>
      {onDelete && (
        <TouchableOpacity
          onPress={onDelete}
          disabled={disabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Remove"
        >
          <X size={sizeStyles.iconSize} color={textColor} />
        </TouchableOpacity>
      )}
    </>
  );

  // Render pressable or static chip
  if (onPress) {
    return (
      <TouchableOpacity
        style={[chipStyles, style]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        testID={testID}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[chipStyles, style]} testID={testID}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    marginRight: 0,
  },
});

export default Chip;

