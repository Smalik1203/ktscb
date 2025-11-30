/**
 * Text Components
 * 
 * A comprehensive set of typography components that use theme tokens.
 * Never use raw <Text> - always use these semantic components.
 * 
 * @example
 * ```tsx
 * <Heading>Page Title</Heading>
 * <Heading level={2}>Section Title</Heading>
 * <Body>Regular paragraph text</Body>
 * <Body variant="secondary">Secondary text</Body>
 * <Caption>Small helper text</Caption>
 * <Label>Form Label</Label>
 * ```
 */

import React from 'react';
import { Text as RNText, TextStyle, StyleSheet, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

// ============================================================================
// SHARED TYPES
// ============================================================================

type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'accent' | 'error' | 'success' | 'warning';
type TextAlign = 'left' | 'center' | 'right';

interface BaseTextProps extends Omit<RNTextProps, 'style'> {
  children: React.ReactNode;
  /** Text color variant */
  color?: TextColor;
  /** Text alignment */
  align?: TextAlign;
  /** Custom style (avoid using - prefer props) */
  style?: TextStyle;
}

// ============================================================================
// HEADING COMPONENT
// ============================================================================

export interface HeadingProps extends BaseTextProps {
  /** Heading level (1-6) */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function Heading({
  children,
  level = 1,
  color = 'primary',
  align = 'left',
  style,
  ...props
}: HeadingProps) {
  const { colors, typography } = useTheme();

  const getVariant = () => {
    const variantMap = {
      1: typography.variants.h1,
      2: typography.variants.h2,
      3: typography.variants.h3,
      4: typography.variants.h4,
      5: typography.variants.h5,
      6: typography.variants.h6,
    };
    return variantMap[level];
  };

  const getColor = (): string => {
    const colorMap: Record<TextColor, string> = {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      tertiary: colors.text.tertiary,
      inverse: colors.text.inverse,
      accent: colors.text.accent,
      error: colors.error.main,
      success: colors.success.main,
      warning: colors.warning.main,
    };
    return colorMap[color];
  };

  const variant = getVariant();

  const textStyle: TextStyle = {
    fontSize: variant.fontSize,
    fontWeight: variant.fontWeight,
    lineHeight: variant.fontSize * variant.lineHeight,
    letterSpacing: variant.letterSpacing,
    color: getColor(),
    textAlign: align,
  };

  return (
    <RNText
      style={[textStyle, style]}
      accessibilityRole="header"
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// BODY COMPONENT
// ============================================================================

export interface BodyProps extends BaseTextProps {
  /** Body variant */
  variant?: 'default' | 'secondary';
  /** Font weight override */
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

export function Body({
  children,
  variant = 'default',
  color = 'primary',
  weight,
  align = 'left',
  style,
  ...props
}: BodyProps) {
  const { colors, typography } = useTheme();

  const getVariant = () => {
    return variant === 'secondary' ? typography.variants.body2 : typography.variants.body1;
  };

  const getColor = (): string => {
    const colorMap: Record<TextColor, string> = {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      tertiary: colors.text.tertiary,
      inverse: colors.text.inverse,
      accent: colors.text.accent,
      error: colors.error.main,
      success: colors.success.main,
      warning: colors.warning.main,
    };
    return colorMap[color];
  };

  const getWeight = (): TextStyle['fontWeight'] => {
    if (!weight) return typographyVariant.fontWeight;
    const weightMap: Record<string, TextStyle['fontWeight']> = {
      normal: typography.fontWeight.normal,
      medium: typography.fontWeight.medium,
      semibold: typography.fontWeight.semibold,
      bold: typography.fontWeight.bold,
    };
    return weightMap[weight];
  };

  const typographyVariant = getVariant();

  const textStyle: TextStyle = {
    fontSize: typographyVariant.fontSize,
    fontWeight: getWeight(),
    lineHeight: typographyVariant.fontSize * typographyVariant.lineHeight,
    color: getColor(),
    textAlign: align,
  };

  return (
    <RNText style={[textStyle, style]} {...props}>
      {children}
    </RNText>
  );
}

// ============================================================================
// CAPTION COMPONENT
// ============================================================================

export interface CaptionProps extends BaseTextProps {
  /** Font weight override */
  weight?: 'normal' | 'medium' | 'semibold';
}

export function Caption({
  children,
  color = 'tertiary',
  weight,
  align = 'left',
  style,
  ...props
}: CaptionProps) {
  const { colors, typography } = useTheme();

  const getColor = (): string => {
    const colorMap: Record<TextColor, string> = {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      tertiary: colors.text.tertiary,
      inverse: colors.text.inverse,
      accent: colors.text.accent,
      error: colors.error.main,
      success: colors.success.main,
      warning: colors.warning.main,
    };
    return colorMap[color];
  };

  const getWeight = (): TextStyle['fontWeight'] => {
    if (!weight) return typography.variants.caption.fontWeight;
    const weightMap: Record<string, TextStyle['fontWeight']> = {
      normal: typography.fontWeight.normal,
      medium: typography.fontWeight.medium,
      semibold: typography.fontWeight.semibold,
    };
    return weightMap[weight];
  };

  const variant = typography.variants.caption;

  const textStyle: TextStyle = {
    fontSize: variant.fontSize,
    fontWeight: getWeight(),
    lineHeight: variant.fontSize * variant.lineHeight,
    color: getColor(),
    textAlign: align,
  };

  return (
    <RNText style={[textStyle, style]} {...props}>
      {children}
    </RNText>
  );
}

// ============================================================================
// LABEL COMPONENT
// ============================================================================

export interface LabelProps extends BaseTextProps {
  /** Required indicator */
  required?: boolean;
}

export function Label({
  children,
  color = 'secondary',
  required = false,
  align = 'left',
  style,
  ...props
}: LabelProps) {
  const { colors, typography } = useTheme();

  const getColor = (): string => {
    const colorMap: Record<TextColor, string> = {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      tertiary: colors.text.tertiary,
      inverse: colors.text.inverse,
      accent: colors.text.accent,
      error: colors.error.main,
      success: colors.success.main,
      warning: colors.warning.main,
    };
    return colorMap[color];
  };

  const variant = typography.variants.label;

  const textStyle: TextStyle = {
    fontSize: variant.fontSize,
    fontWeight: variant.fontWeight,
    lineHeight: variant.fontSize * variant.lineHeight,
    color: getColor(),
    textAlign: align,
  };

  return (
    <RNText style={[textStyle, style]} {...props}>
      {children}
      {required && (
        <RNText style={{ color: colors.error.main }}> *</RNText>
      )}
    </RNText>
  );
}

// ============================================================================
// OVERLINE COMPONENT
// ============================================================================

export interface OverlineProps extends BaseTextProps {}

export function Overline({
  children,
  color = 'tertiary',
  align = 'left',
  style,
  ...props
}: OverlineProps) {
  const { colors, typography } = useTheme();

  const getColor = (): string => {
    const colorMap: Record<TextColor, string> = {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      tertiary: colors.text.tertiary,
      inverse: colors.text.inverse,
      accent: colors.text.accent,
      error: colors.error.main,
      success: colors.success.main,
      warning: colors.warning.main,
    };
    return colorMap[color];
  };

  const variant = typography.variants.overline;

  const textStyle: TextStyle = {
    fontSize: variant.fontSize,
    fontWeight: variant.fontWeight,
    lineHeight: variant.fontSize * variant.lineHeight,
    letterSpacing: variant.letterSpacing,
    color: getColor(),
    textAlign: align,
    textTransform: 'uppercase',
  };

  return (
    <RNText style={[textStyle, style]} {...props}>
      {children}
    </RNText>
  );
}

// ============================================================================
// LINK COMPONENT
// ============================================================================

export interface LinkProps extends BaseTextProps {
  /** Press handler */
  onPress?: () => void;
  /** Underline style */
  underline?: boolean;
}

export function Link({
  children,
  color = 'accent',
  align = 'left',
  onPress,
  underline = true,
  style,
  ...props
}: LinkProps) {
  const { colors, typography } = useTheme();

  const getColor = (): string => {
    const colorMap: Record<TextColor, string> = {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      tertiary: colors.text.tertiary,
      inverse: colors.text.inverse,
      accent: colors.text.accent,
      error: colors.error.main,
      success: colors.success.main,
      warning: colors.warning.main,
    };
    return colorMap[color];
  };

  const variant = typography.variants.body1;

  const textStyle: TextStyle = {
    fontSize: variant.fontSize,
    fontWeight: typography.fontWeight.medium,
    lineHeight: variant.fontSize * variant.lineHeight,
    color: getColor(),
    textAlign: align,
    textDecorationLine: underline ? 'underline' : 'none',
  };

  return (
    <RNText
      style={[textStyle, style]}
      onPress={onPress}
      accessibilityRole="link"
      {...props}
    >
      {children}
    </RNText>
  );
}

// ============================================================================
// GENERIC TEXT COMPONENT (for edge cases)
// ============================================================================

export interface TextProps extends BaseTextProps {
  /** Font size preset */
  size?: 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl';
  /** Font weight */
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
}

export function Text({
  children,
  size = 'base',
  weight = 'normal',
  color = 'primary',
  align = 'left',
  style,
  ...props
}: TextProps) {
  const { colors, typography } = useTheme();

  const getSize = (): number => {
    const sizeMap: Record<string, number> = {
      xs: typography.fontSize.xs,
      sm: typography.fontSize.sm,
      base: typography.fontSize.base,
      md: typography.fontSize.md,
      lg: typography.fontSize.lg,
      xl: typography.fontSize.xl,
      '2xl': typography.fontSize['2xl'],
    };
    return sizeMap[size];
  };

  const getWeight = (): TextStyle['fontWeight'] => {
    const weightMap: Record<string, TextStyle['fontWeight']> = {
      light: typography.fontWeight.light,
      normal: typography.fontWeight.normal,
      medium: typography.fontWeight.medium,
      semibold: typography.fontWeight.semibold,
      bold: typography.fontWeight.bold,
    };
    return weightMap[weight];
  };

  const getColor = (): string => {
    const colorMap: Record<TextColor, string> = {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      tertiary: colors.text.tertiary,
      inverse: colors.text.inverse,
      accent: colors.text.accent,
      error: colors.error.main,
      success: colors.success.main,
      warning: colors.warning.main,
    };
    return colorMap[color];
  };

  const fontSize = getSize();

  const textStyle: TextStyle = {
    fontSize,
    fontWeight: getWeight(),
    lineHeight: fontSize * typography.lineHeight.normal,
    color: getColor(),
    textAlign: align,
  };

  return (
    <RNText style={[textStyle, style]} {...props}>
      {children}
    </RNText>
  );
}

export default {
  Heading,
  Body,
  Caption,
  Label,
  Overline,
  Link,
  Text,
};

