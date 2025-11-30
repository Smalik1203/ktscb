/**
 * Avatar Component
 * 
 * Displays user profile images with initials fallback.
 * Supports multiple sizes and status indicators.
 * 
 * @example
 * ```tsx
 * <Avatar name="John Doe" />
 * <Avatar name="Jane Smith" source={{ uri: 'https://...' }} />
 * <Avatar name="Bob" size="lg" status="online" />
 * <Avatar name="Alice" variant="square" />
 * ```
 */

import React, { useState, useMemo } from 'react';
import { View, Image, ImageSourcePropType, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Text } from './Text';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type AvatarVariant = 'circle' | 'rounded' | 'square';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps {
  /** User name (used for initials) */
  name: string;
  /** Image source */
  source?: ImageSourcePropType;
  /** Size preset */
  size?: AvatarSize;
  /** Shape variant */
  variant?: AvatarVariant;
  /** Online status indicator */
  status?: AvatarStatus;
  /** Custom background color */
  backgroundColor?: string;
  /** Custom style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

export function Avatar({
  name,
  source,
  size = 'md',
  variant = 'circle',
  status,
  backgroundColor,
  style,
  testID,
}: AvatarProps) {
  const { colors, borderRadius } = useTheme();
  const [imageError, setImageError] = useState(false);

  // Get size dimensions
  const getSizeStyles = (): {
    size: number;
    fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
    statusSize: number;
    statusBorder: number;
  } => {
    switch (size) {
      case 'xs':
        return { size: 24, fontSize: 'xs', statusSize: 8, statusBorder: 1 };
      case 'sm':
        return { size: 32, fontSize: 'xs', statusSize: 10, statusBorder: 2 };
      case 'lg':
        return { size: 56, fontSize: 'lg', statusSize: 14, statusBorder: 2 };
      case 'xl':
        return { size: 72, fontSize: 'xl', statusSize: 16, statusBorder: 3 };
      case '2xl':
        return { size: 96, fontSize: '2xl', statusSize: 20, statusBorder: 3 };
      default: // md
        return { size: 40, fontSize: 'sm', statusSize: 12, statusBorder: 2 };
    }
  };

  // Get border radius
  const getRadius = (avatarSize: number): number => {
    switch (variant) {
      case 'circle':
        return avatarSize / 2;
      case 'rounded':
        return borderRadius.md;
      case 'square':
        return borderRadius.sm;
      default:
        return avatarSize / 2;
    }
  };

  // Get initials from name
  const getInitials = (): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Get background color based on name (consistent color per name)
  const getBackgroundColor = (): string => {
    if (backgroundColor) return backgroundColor;
    
    const colorOptions = [
      colors.primary[100],
      colors.secondary[100],
      colors.success[100],
      colors.warning[100],
      colors.info[100],
      colors.error[100],
    ];
    
    // Simple hash based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colorOptions[Math.abs(hash) % colorOptions.length];
  };

  // Get text color based on background
  const getTextColor = (): string => {
    if (backgroundColor) return colors.text.primary;
    
    const colorOptions = [
      colors.primary[700],
      colors.secondary[700],
      colors.success[700],
      colors.warning[700],
      colors.info[700],
      colors.error[700],
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colorOptions[Math.abs(hash) % colorOptions.length];
  };

  // Get status color
  const getStatusColor = (): string => {
    switch (status) {
      case 'online':
        return colors.success.main;
      case 'offline':
        return colors.neutral[400];
      case 'busy':
        return colors.error.main;
      case 'away':
        return colors.warning.main;
      default:
        return colors.success.main;
    }
  };

  const sizeStyles = getSizeStyles();
  const radius = getRadius(sizeStyles.size);
  const showImage = source && !imageError;

  // Avatar container styles
  const avatarStyles: ViewStyle = {
    width: sizeStyles.size,
    height: sizeStyles.size,
    borderRadius: radius,
    backgroundColor: getBackgroundColor(),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  // Status indicator styles
  const statusStyles: ViewStyle = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: sizeStyles.statusSize,
    height: sizeStyles.statusSize,
    borderRadius: sizeStyles.statusSize / 2,
    backgroundColor: getStatusColor(),
    borderWidth: sizeStyles.statusBorder,
    borderColor: colors.background.primary,
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={avatarStyles}>
        {showImage ? (
          <Image
            source={source}
            style={styles.image}
            onError={() => setImageError(true)}
            accessibilityLabel={`${name}'s avatar`}
          />
        ) : (
          <Text
            size={sizeStyles.fontSize}
            weight="semibold"
            style={{ color: getTextColor() }}
          >
            {getInitials()}
          </Text>
        )}
      </View>
      
      {status && <View style={statusStyles} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default Avatar;

