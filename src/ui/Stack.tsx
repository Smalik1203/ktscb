/**
 * Stack & Row Components
 * 
 * Layout components for arranging children with consistent spacing.
 * - Stack: Vertical arrangement (column)
 * - Row: Horizontal arrangement (row)
 * 
 * @example
 * ```tsx
 * <Stack spacing="md">
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </Stack>
 * 
 * <Row spacing="sm" align="center" justify="space-between">
 *   <Button>Left</Button>
 *   <Button>Right</Button>
 * </Row>
 * ```
 */

import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

type SpacingSize = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type AlignItems = 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
type JustifyContent = 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';

interface BaseLayoutProps {
  children: React.ReactNode;
  /** Gap between children */
  spacing?: SpacingSize;
  /** Align items on cross axis */
  align?: AlignItems;
  /** Justify content on main axis */
  justify?: JustifyContent;
  /** Wrap children */
  wrap?: boolean;
  /** Flex grow */
  flex?: number | boolean;
  /** Padding */
  padding?: SpacingSize;
  /** Horizontal padding */
  paddingHorizontal?: SpacingSize;
  /** Vertical padding */
  paddingVertical?: SpacingSize;
  /** Custom style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

// ============================================================================
// STACK COMPONENT (Vertical)
// ============================================================================

export interface StackProps extends BaseLayoutProps {}

export function Stack({
  children,
  spacing = 'md',
  align = 'stretch',
  justify = 'flex-start',
  wrap = false,
  flex,
  padding,
  paddingHorizontal,
  paddingVertical,
  style,
  testID,
}: StackProps) {
  const { spacing: spacingTokens } = useTheme();

  const getSpacing = (size: SpacingSize): number => {
    if (size === 'none') return 0;
    const map: Record<string, number> = {
      xs: spacingTokens.xs,
      sm: spacingTokens.sm,
      md: spacingTokens.md,
      lg: spacingTokens.lg,
      xl: spacingTokens.xl,
      '2xl': spacingTokens['2xl'],
    };
    return map[size] || 0;
  };

  const containerStyle: ViewStyle = {
    flexDirection: 'column',
    gap: getSpacing(spacing),
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? 'wrap' : 'nowrap',
    ...(flex !== undefined && flex !== false && { flex: flex === true ? 1 : flex }),
    ...(padding && { padding: getSpacing(padding) }),
    ...(paddingHorizontal && { paddingHorizontal: getSpacing(paddingHorizontal) }),
    ...(paddingVertical && { paddingVertical: getSpacing(paddingVertical) }),
  };

  return (
    <View style={[containerStyle, style]} testID={testID}>
      {children}
    </View>
  );
}

// ============================================================================
// ROW COMPONENT (Horizontal)
// ============================================================================

export interface RowProps extends BaseLayoutProps {}

export function Row({
  children,
  spacing = 'md',
  align = 'center',
  justify = 'flex-start',
  wrap = false,
  flex,
  padding,
  paddingHorizontal,
  paddingVertical,
  style,
  testID,
}: RowProps) {
  const { spacing: spacingTokens } = useTheme();

  const getSpacing = (size: SpacingSize): number => {
    if (size === 'none') return 0;
    const map: Record<string, number> = {
      xs: spacingTokens.xs,
      sm: spacingTokens.sm,
      md: spacingTokens.md,
      lg: spacingTokens.lg,
      xl: spacingTokens.xl,
      '2xl': spacingTokens['2xl'],
    };
    return map[size] || 0;
  };

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    gap: getSpacing(spacing),
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? 'wrap' : 'nowrap',
    ...(flex !== undefined && flex !== false && { flex: flex === true ? 1 : flex }),
    ...(padding && { padding: getSpacing(padding) }),
    ...(paddingHorizontal && { paddingHorizontal: getSpacing(paddingHorizontal) }),
    ...(paddingVertical && { paddingVertical: getSpacing(paddingVertical) }),
  };

  return (
    <View style={[containerStyle, style]} testID={testID}>
      {children}
    </View>
  );
}

// ============================================================================
// SPACER COMPONENT
// ============================================================================

export interface SpacerProps {
  /** Fixed size (overrides flex) */
  size?: SpacingSize | number;
  /** Flex grow to fill available space */
  flex?: number | boolean;
}

export function Spacer({ size, flex = 1 }: SpacerProps) {
  const { spacing: spacingTokens } = useTheme();

  const getSize = (): number | undefined => {
    if (size === undefined) return undefined;
    if (typeof size === 'number') return size;
    if (size === 'none') return 0;
    const map: Record<string, number> = {
      xs: spacingTokens.xs,
      sm: spacingTokens.sm,
      md: spacingTokens.md,
      lg: spacingTokens.lg,
      xl: spacingTokens.xl,
      '2xl': spacingTokens['2xl'],
    };
    return map[size];
  };

  const spacerSize = getSize();

  if (spacerSize !== undefined) {
    return <View style={{ width: spacerSize, height: spacerSize }} />;
  }

  return <View style={{ flex: flex === true ? 1 : (flex || 1) }} />;
}

// ============================================================================
// CENTER COMPONENT
// ============================================================================

export interface CenterProps {
  children: React.ReactNode;
  /** Flex to fill available space */
  flex?: boolean;
  /** Custom style */
  style?: ViewStyle;
}

export function Center({ children, flex = false, style }: CenterProps) {
  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          ...(flex && { flex: 1 }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default { Stack, Row, Spacer, Center };

