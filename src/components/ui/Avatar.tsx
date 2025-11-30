import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';

interface AvatarProps {
  source?: { uri: string };
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  style?: ViewStyle;
}

export function Avatar({
  source,
  name,
  size = 'md',
  variant = 'default',
  style,
}: AvatarProps) {
  const { colors, typography, borderRadius, shadows } = useTheme();

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          width: 32,
          height: 32,
          fontSize: typography.fontSize.xs,
        };
      case 'md':
        return {
          width: 40,
          height: 40,
          fontSize: typography.fontSize.sm,
        };
      case 'lg':
        return {
          width: 48,
          height: 48,
          fontSize: typography.fontSize.base,
        };
      case 'xl':
        return {
          width: 64,
          height: 64,
          fontSize: typography.fontSize.lg,
        };
      case '2xl':
        return {
          width: 80,
          height: 80,
          fontSize: typography.fontSize.xl,
        };
      default:
        return {
          width: 40,
          height: 40,
          fontSize: typography.fontSize.sm,
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary[100],
          textColor: colors.primary[700],
        };
      case 'secondary':
        return {
          backgroundColor: colors.secondary[100],
          textColor: colors.secondary[700],
        };
      case 'success':
        return {
          backgroundColor: colors.success[100],
          textColor: colors.success[700],
        };
      case 'warning':
        return {
          backgroundColor: colors.warning[100],
          textColor: colors.warning[700],
        };
      case 'error':
        return {
          backgroundColor: colors.error[100],
          textColor: colors.error[700],
        };
      default:
        return {
          backgroundColor: colors.neutral[100],
          textColor: colors.neutral[700],
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  const styles = useMemo(() => createStyles(borderRadius, shadows), [borderRadius, shadows]);

  const avatarStyles = [
    styles.avatar,
    {
      width: sizeStyles.width,
      height: sizeStyles.height,
      backgroundColor: variantStyles.backgroundColor,
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
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View style={avatarStyles}>
      {source ? (
        <Image 
          source={source} 
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : name ? (
        <Text style={textStyles}>{getInitials(name)}</Text>
      ) : (
        <Text style={textStyles}>?</Text>
      )}
    </View>
  );
}

const createStyles = (borderRadius: any, shadows: any) =>
  StyleSheet.create({
    avatar: {
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      ...shadows.sm,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    text: {
      textAlign: 'center',
    },
  });
