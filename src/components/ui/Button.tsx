import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, Animated, View } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, borderRadius, spacing, typography, shadows, animation } from '../../../lib/design-system';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'floating';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  fullWidth = false,
}: ButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
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
  };

  const handlePressOut = () => {
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
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary[600], // Sapphire Blue
          borderColor: colors.primary[600],
          textColor: colors.text.inverse,
          shadow: shadows.none, // No shadow (ClassBridge)
        };
      case 'secondary':
        return {
          backgroundColor: '#FFFFFF', // White (ClassBridge)
          borderColor: colors.primary[600], // Sapphire border
          textColor: colors.primary[600], // Sapphire text
          shadow: shadows.none, // No shadow (ClassBridge)
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: colors.primary[600],
          textColor: colors.primary[600],
          shadow: shadows.none,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: colors.primary[600],
          shadow: shadows.none,
        };
      case 'floating':
        return {
          backgroundColor: colors.primary[600],
          borderColor: colors.primary[600],
          textColor: colors.text.inverse,
          shadow: shadows.md, // Keep some shadow for floating
        };
      default:
        return {
          backgroundColor: colors.primary[600],
          borderColor: colors.primary[600],
          textColor: colors.text.inverse,
          shadow: shadows.none,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          fontSize: typography.fontSize.sm,
          borderRadius: borderRadius.button, // 6px ClassBridge
        };
      case 'md':
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          fontSize: typography.fontSize.base,
          borderRadius: borderRadius.button, // 6px ClassBridge
        };
      case 'lg':
        return {
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.xl,
          fontSize: typography.fontSize.lg,
          borderRadius: borderRadius.button, // 6px ClassBridge
        };
      case 'xl':
        return {
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing['2xl'],
          fontSize: typography.fontSize.xl,
          borderRadius: borderRadius.button, // 6px ClassBridge
        };
      default:
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          fontSize: typography.fontSize.base,
          borderRadius: borderRadius.button, // 6px ClassBridge
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const buttonStyles = [
    styles.base,
    {
      backgroundColor: variantStyles.backgroundColor,
      borderColor: variantStyles.borderColor,
      borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0, // 1px border for outline and secondary (ClassBridge)
      paddingVertical: sizeStyles.paddingVertical,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      borderRadius: sizeStyles.borderRadius,
      ...variantStyles.shadow,
    },
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    {
      color: variantStyles.textColor,
      fontSize: sizeStyles.fontSize,
      fontWeight: typography.fontWeight.semibold,
    },
    disabled && styles.textDisabled,
    textStyle,
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          color={variantStyles.textColor}
          size="small"
          accessibilityLabel="Loading"
        />
      );
    }

    const iconElement = icon ? (
      <View style={[styles.icon, iconPosition === 'right' && styles.iconRight]}>
        {icon}
      </View>
    ) : null;

    return (
      <>
        {iconPosition === 'left' && iconElement}
        <Text style={textStyles}>{title}</Text>
        {iconPosition === 'right' && iconElement}
      </>
    );
  };

  return (
    <Animated.View 
      style={[
        { 
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        fullWidth && styles.fullWidth
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
        accessibilityLabel={accessibilityLabel || title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading }}
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
    gap: spacing.sm,
    minHeight: 44, // Minimum touch target
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  textDisabled: {
    opacity: 0.8,
  },
  icon: {
    marginRight: spacing.xs,
  },
  iconRight: {
    marginRight: 0,
    marginLeft: spacing.xs,
  },
  fullWidth: {
    width: '100%',
  },
});
