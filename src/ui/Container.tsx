/**
 * Container Component
 * 
 * A layout wrapper that provides consistent padding and max-width constraints.
 * Use this as the root wrapper for screen content.
 * 
 * @example
 * ```tsx
 * <Container>
 *   <Heading>Page Title</Heading>
 *   <Body>Content goes here</Body>
 * </Container>
 * 
 * <Container padding="none" safeArea>
 *   <FullWidthContent />
 * </Container>
 * ```
 */

import React from 'react';
import { View, ViewStyle, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

export interface ContainerProps {
  children: React.ReactNode;
  /** Padding preset */
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Horizontal padding only */
  paddingHorizontal?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Vertical padding only */
  paddingVertical?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Background color preset */
  background?: 'primary' | 'secondary' | 'tertiary' | 'transparent' | 'card';
  /** Enable safe area insets */
  safeArea?: boolean;
  /** Safe area edges to apply */
  safeAreaEdges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Center content horizontally */
  center?: boolean;
  /** Make container scrollable */
  scroll?: boolean;
  /** Show vertical scroll indicator */
  showScrollIndicator?: boolean;
  /** Pull to refresh handler */
  onRefresh?: () => void;
  /** Refresh state */
  refreshing?: boolean;
  /** Fill available space */
  flex?: boolean;
  /** Keyboard should persist taps (for ScrollView) */
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  /** Custom style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

export function Container({
  children,
  padding = 'md',
  paddingHorizontal,
  paddingVertical,
  background = 'primary',
  safeArea = false,
  safeAreaEdges = ['top', 'bottom'],
  center = false,
  scroll = false,
  showScrollIndicator = false,
  onRefresh,
  refreshing = false,
  keyboardShouldPersistTaps,
  flex = true,
  style,
  testID,
}: ContainerProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  // Resolve padding values
  const getPaddingValue = (size: string | undefined): number => {
    if (!size || size === 'none') return 0;
    const paddingMap: Record<string, number> = {
      xs: spacing.xs,
      sm: spacing.sm,
      md: spacing.md,
      lg: spacing.lg,
      xl: spacing.xl,
    };
    return paddingMap[size] || spacing.md;
  };

  // Resolve background color
  const getBackgroundColor = (): string => {
    const colorMap: Record<string, string> = {
      primary: colors.background.primary,
      secondary: colors.background.secondary,
      tertiary: colors.background.tertiary,
      transparent: 'transparent',
      card: colors.background.card,
    };
    return colorMap[background] || colors.background.primary;
  };

  // Calculate safe area padding
  const safeAreaPadding: ViewStyle = {};
  if (safeArea) {
    if (safeAreaEdges.includes('top')) safeAreaPadding.paddingTop = insets.top;
    if (safeAreaEdges.includes('bottom')) safeAreaPadding.paddingBottom = insets.bottom;
    if (safeAreaEdges.includes('left')) safeAreaPadding.paddingLeft = insets.left;
    if (safeAreaEdges.includes('right')) safeAreaPadding.paddingRight = insets.right;
  }

  // Build container styles
  const containerStyles: ViewStyle[] = [
    flex && styles.flex,
    {
      backgroundColor: getBackgroundColor(),
      padding: paddingHorizontal === undefined && paddingVertical === undefined 
        ? getPaddingValue(padding) 
        : undefined,
      paddingHorizontal: paddingHorizontal !== undefined 
        ? getPaddingValue(paddingHorizontal) 
        : undefined,
      paddingVertical: paddingVertical !== undefined 
        ? getPaddingValue(paddingVertical) 
        : undefined,
    },
    safeAreaPadding,
    center && styles.center,
    style,
  ].filter(Boolean) as ViewStyle[];

  // Render scrollable container
  if (scroll) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: getBackgroundColor() }]}
        contentContainerStyle={[
          {
            padding: paddingHorizontal === undefined && paddingVertical === undefined 
              ? getPaddingValue(padding) 
              : undefined,
            paddingHorizontal: paddingHorizontal !== undefined 
              ? getPaddingValue(paddingHorizontal) 
              : undefined,
            paddingVertical: paddingVertical !== undefined 
              ? getPaddingValue(paddingVertical) 
              : undefined,
          },
          safeAreaPadding,
          center && styles.center,
          !flex && styles.contentContainer,
        ]}
        showsVerticalScrollIndicator={showScrollIndicator}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary.main}
              colors={[colors.primary.main]}
            />
          ) : undefined
        }
        testID={testID}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={containerStyles} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flexGrow: 1,
  },
});

export default Container;

