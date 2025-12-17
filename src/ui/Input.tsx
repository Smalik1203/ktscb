/**
 * Input Component
 * 
 * A fully themed text input with variants, icons, and validation states.
 * All styling comes from theme tokens.
 * 
 * @example
 * ```tsx
 * <Input 
 *   label="Email"
 *   placeholder="Enter your email"
 *   value={email}
 *   onChangeText={setEmail}
 * />
 * 
 * <Input
 *   label="Password"
 *   secureTextEntry
 *   leftIcon={<LockIcon />}
 *   error="Password is required"
 * />
 * 
 * <Input
 *   label="Search"
 *   variant="filled"
 *   leftIcon={<SearchIcon />}
 *   rightIcon={<ClearIcon />}
 * />
 * ```
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  ViewStyle,
  TextStyle,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Label , Caption } from './Text';

export type InputVariant = 'default' | 'filled' | 'outlined';
export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Input label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Visual variant */
  variant?: InputVariant;
  /** Size preset */
  size?: InputSize;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Right icon press handler */
  onRightIconPress?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Required indicator */
  required?: boolean;
  /** Container style */
  containerStyle?: ViewStyle;
  /** Input container style */
  inputContainerStyle?: ViewStyle;
  /** Input style */
  inputStyle?: TextStyle;
  /** Label style */
  labelStyle?: TextStyle;
  /** Test ID */
  testID?: string;
}

export function Input({
  label,
  error,
  helperText,
  variant = 'default',
  size = 'md',
  leftIcon,
  rightIcon,
  onRightIconPress,
  disabled = false,
  required = false,
  containerStyle,
  inputContainerStyle,
  inputStyle,
  labelStyle,
  onFocus,
  onBlur,
  testID,
  ...textInputProps
}: InputProps) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  // Handle focus
  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  }, [onFocus, borderAnim]);

  // Handle blur
  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  }, [onBlur, borderAnim]);

  // Get size styles
  const getSizeStyles = (): {
    paddingVertical: number;
    paddingHorizontal: number;
    fontSize: number;
    minHeight: number;
    iconSize: number;
  } => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          fontSize: typography.fontSize.sm,
          minHeight: 40,
          iconSize: 16,
        };
      case 'lg':
        return {
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.xl,
          fontSize: typography.fontSize.lg,
          minHeight: 56,
          iconSize: 22,
        };
      default: // md
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          fontSize: typography.fontSize.base,
          minHeight: 48,
          iconSize: 18,
        };
    }
  };

  // Get variant styles
  const getVariantStyles = (): {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    focusBorderColor: string;
    focusBorderWidth: number;
  } => {
    const hasError = !!error;
    
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: colors.neutral[100],
          borderColor: hasError ? colors.error.main : colors.neutral[200],
          borderWidth: isFocused || hasError ? 2 : 0,
          focusBorderColor: hasError ? colors.error.main : colors.primary.main,
          focusBorderWidth: 2,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderColor: hasError ? colors.error.main : colors.border.DEFAULT,
          borderWidth: 1,
          focusBorderColor: hasError ? colors.error.main : colors.primary.main,
          focusBorderWidth: 2,
        };
      default:
        return {
          backgroundColor: colors.surface.primary,
          borderColor: hasError ? colors.error.main : colors.border.DEFAULT,
          borderWidth: 1,
          focusBorderColor: hasError ? colors.error.main : colors.primary.main,
          focusBorderWidth: 2,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  // Animated border color
  const animatedBorderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [variantStyles.borderColor, variantStyles.focusBorderColor],
  });

  // Animated border width
  const animatedBorderWidth = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [variantStyles.borderWidth, variantStyles.focusBorderWidth],
  });

  // Container styles
  const inputContainerStyles: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: variantStyles.backgroundColor,
    borderRadius: borderRadius.input,
    minHeight: sizeStyles.minHeight,
    paddingHorizontal: sizeStyles.paddingHorizontal,
    opacity: disabled ? 0.5 : 1,
  };

  // Input styles
  const textInputStyles: TextStyle = {
    flex: 1,
    fontSize: sizeStyles.fontSize,
    color: colors.text.primary,
    paddingVertical: sizeStyles.paddingVertical,
    fontWeight: typography.fontWeight.normal,
  };

  // Clone icons with correct size and color
  const renderIcon = (icon: React.ReactNode, position: 'left' | 'right') => {
    if (!icon) return null;
    
    const iconColor = error ? colors.error.main : colors.text.tertiary;
    const iconElement = React.isValidElement(icon)
      ? React.cloneElement(icon as React.ReactElement<any>, {
          size: sizeStyles.iconSize,
          color: iconColor,
        })
      : icon;

    if (position === 'right' && onRightIconPress) {
      return (
        <TouchableOpacity
          onPress={onRightIconPress}
          disabled={disabled}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginLeft: spacing.sm }}
        >
          {iconElement}
        </TouchableOpacity>
      );
    }

    return (
      <View style={{ marginRight: position === 'left' ? spacing.sm : 0, marginLeft: position === 'right' ? spacing.sm : 0 }}>
        {iconElement}
      </View>
    );
  };

  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      {label && (
        <Label
          required={required}
          color={error ? 'error' : 'secondary'}
          style={{ ...styles.label, ...labelStyle }}
        >
          {label}
        </Label>
      )}

      <Animated.View
        style={[
          inputContainerStyles,
          {
            borderColor: animatedBorderColor,
            borderWidth: animatedBorderWidth,
          },
          inputContainerStyle,
        ]}
      >
        {renderIcon(leftIcon, 'left')}
        
        <TextInput
          style={[textInputStyles, inputStyle]}
          placeholderTextColor={colors.text.quaternary}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          {...textInputProps}
        />
        
        {renderIcon(rightIcon, 'right')}
      </Animated.View>

      {(error || helperText) && (
        <Caption
          color={error ? 'error' : 'tertiary'}
          style={styles.helperText}
        >
          {error || helperText}
        </Caption>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
  },
  helperText: {
    marginTop: 4,
  },
});

export default Input;

