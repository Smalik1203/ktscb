import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, Animated } from 'react-native';
import { borderRadius, shadows, spacing, animation } from '../../../lib/design-system';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { colors, isDark } = useTheme();
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

  // Memoize variant styles to avoid recalculation on every render
  const getVariantStyles = useMemo((): any => {
    // In dark mode, use subtle borders instead of shadows for depth
    const darkModeBorder = isDark ? { borderWidth: 1, borderColor: colors.border.light } : {};
    
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surface.elevated,
          ...(isDark ? { ...shadows.none, ...darkModeBorder } : shadows.md),
        };
      case 'glass':
        return {
          backgroundColor: isDark ? colors.surface.secondary : colors.surface.primary,
          ...(isDark ? { ...shadows.none, ...darkModeBorder } : shadows.sm),
        };
      case 'outlined':
        return {
          backgroundColor: colors.surface.primary,
          ...shadows.none,
          borderWidth: 1,
          borderColor: colors.border.DEFAULT,
        };
      default:
        return {
          backgroundColor: colors.surface.primary,
          ...(isDark ? { ...shadows.none, ...darkModeBorder } : shadows.md),
        };
    }
  }, [variant, colors, isDark]);

  const paddingStyles = useMemo(() => {
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
  }, [padding]);

  const variantStyles = getVariantStyles;

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
