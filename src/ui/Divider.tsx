/**
 * Divider Component
 * 
 * A visual separator for content sections.
 * Supports horizontal and vertical orientations.
 * 
 * @example
 * ```tsx
 * <Divider />
 * <Divider spacing="lg" />
 * <Divider orientation="vertical" />
 * <Divider color="accent" />
 * ```
 */

import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface DividerProps {
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Spacing around divider */
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Color preset */
  color?: 'light' | 'default' | 'dark' | 'accent';
  /** Thickness */
  thickness?: number;
  /** Custom style */
  style?: ViewStyle;
}

export function Divider({
  orientation = 'horizontal',
  spacing = 'md',
  color = 'light',
  thickness = 1,
  style,
}: DividerProps) {
  const { colors, spacing: spacingTokens } = useTheme();

  // Get color
  const getColor = (): string => {
    const colorMap: Record<string, string> = {
      light: colors.border.light,
      default: colors.border.DEFAULT,
      dark: colors.border.dark,
      accent: colors.border.accent,
    };
    return colorMap[color] || colors.border.light;
  };

  // Get spacing value
  const getSpacing = (): number => {
    if (spacing === 'none') return 0;
    const spacingMap: Record<string, number> = {
      xs: spacingTokens.xs,
      sm: spacingTokens.sm,
      md: spacingTokens.md,
      lg: spacingTokens.lg,
      xl: spacingTokens.xl,
    };
    return spacingMap[spacing] || spacingTokens.md;
  };

  const spacingValue = getSpacing();
  const isHorizontal = orientation === 'horizontal';

  const dividerStyle: ViewStyle = {
    backgroundColor: getColor(),
    ...(isHorizontal
      ? {
          height: thickness,
          width: '100%',
          marginVertical: spacingValue,
        }
      : {
          width: thickness,
          height: '100%',
          marginHorizontal: spacingValue,
        }),
  };

  return <View style={[dividerStyle, style]} />;
}

export default Divider;

