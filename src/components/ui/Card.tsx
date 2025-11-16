import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, Animated } from 'react-native';
import { colors, borderRadius, shadows, spacing, animation } from '../../../lib/design-system';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: 'default' | 'elevated' | 'glass' | 'outlined';
  onPress?: () => void;
  disabled?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export function Card({ 
  children, 
  style, 
  variant = 'default',
  onPress,
  disabled = false,
  padding = 'lg'
}: CardProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
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
  };

  const handlePressOut = () => {
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
  };

  const getVariantStyles = (): any => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surface.elevated,
          ...shadows.md, // Softer shadow (ClassBridge)
          borderWidth: 0,
        };
      case 'glass':
        return {
          backgroundColor: colors.surface.glass,
          ...shadows.sm,
          borderWidth: 0, // No border for clean look
        };
      case 'outlined':
        return {
          backgroundColor: colors.surface.primary,
          ...shadows.none,
          borderWidth: 1, // 1px border (ClassBridge)
          borderColor: colors.border.DEFAULT,
        };
      default:
        return {
          backgroundColor: colors.surface.primary,
          ...shadows.md,
          borderWidth: 0, // No border for clean look (ClassBridge)
        };
    }
  };

  const getPaddingStyles = () => {
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'sm':
        return { padding: spacing.sm };
      case 'md':
        return { padding: spacing.md };
      case 'lg':
        return { padding: spacing.lg };
      case 'xl':
        return { padding: spacing.xl };
      default:
        return { padding: spacing.lg };
    }
  };

  const variantStyles = getVariantStyles();
  const paddingStyles = getPaddingStyles();

  const cardStyles: any[] = [
    styles.card,
    {
      backgroundColor: variantStyles.backgroundColor,
      borderWidth: variantStyles.borderWidth,
      ...(variantStyles.borderColor && { borderColor: variantStyles.borderColor }),
      ...variantStyles,
      ...paddingStyles,
    },
    disabled && styles.disabled,
    style,
  ].filter(Boolean);

  if (onPress && !disabled) {
    return (
      <Animated.View 
        style={[
          { 
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }
        ]}
      >
        <TouchableOpacity
          style={cardStyles}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={cardStyles}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card, // 12px ClassBridge
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.6,
  },
});
