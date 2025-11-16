/**
 * ClassBridge Design System
 * Production-grade responsive design system inspired by Duolingo
 *
 * Features:
 * - Responsive typography that scales across devices (phone, tablet, desktop)
 * - 8px spacing grid system with responsive scaling
 * - Consistent font sizes optimized for readability
 * - Sapphire Blue primary color (#1E4EB8)
 * - Lime Green accent color (#9DFF7A)
 *
 * Screen Sizes:
 * - Small phones: 320-374px (scale: 0.9)
 * - Standard phones: 375-413px (scale: 0.95)
 * - Large phones: 414-767px (scale: 1.0)
 * - Tablets: 768-1023px (scale: 1.1)
 * - Desktop: 1024px+ (scale: 1.2)
 */

import { ViewStyle, TextStyle, Dimensions } from 'react-native';

// Responsive breakpoints
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const breakpoints = {
  small: 320,   // Small phones
  medium: 375,  // Standard phones (iPhone SE, iPhone 8)
  large: 414,   // Large phones (iPhone 11, 12, 13)
  tablet: 768,  // Tablets
  desktop: 1024 // Desktop/Large tablets
};

// Get responsive scale based on screen width
const getScale = () => {
  if (SCREEN_WIDTH >= breakpoints.desktop) return 1.2;
  if (SCREEN_WIDTH >= breakpoints.tablet) return 1.1;
  if (SCREEN_WIDTH >= breakpoints.large) return 1.0;
  if (SCREEN_WIDTH >= breakpoints.medium) return 0.95;
  return 0.9; // Small phones
};

const SCALE = getScale();

// Responsive font scaling
const scaleFont = (size: number) => Math.round(size * SCALE);
const scaleSpacing = (size: number) => Math.round(size * SCALE);

// ClassBridge Color Palette - Sapphire Blue Theme
export const colors = {
  // Primary Brand Colors - Sapphire Blue
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#4FA3FF', // Sky Blue
    600: '#1E4EB8', // Sapphire Blue (Main brand color)
    700: '#1e40af',
    800: '#1e3a8a',
    900: '#1e3a8a',
    950: '#172554',
    main: '#1E4EB8', // Main primary color
  },

  // Secondary - Sky Blue (lighter variant for secondary actions)
  secondary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#4FA3FF', // Sky Blue
    600: '#3b82f6',
    700: '#2563eb',
    800: '#1d4ed8',
    900: '#1e3a8a',
    950: '#172554',
    main: '#4FA3FF', // Sky Blue for secondary
  },

  // Accent - Lime Green (use sparingly for success states, highlights)
  accent: {
    50: '#f7fee7',
    100: '#ecfccb',
    200: '#d9f99d',
    300: '#bef264',
    400: '#a3e635',
    500: '#9DFF7A', // Lime Green (Main accent)
    600: '#65a30d',
    700: '#4d7c0f',
    800: '#3f6212',
    900: '#365314',
    950: '#1a2e05',
    main: '#9DFF7A', // Lime Green accent
  },

  // Success - Lime Green (same as accent for consistency)
  success: {
    50: '#f7fee7',
    100: '#ecfccb',
    200: '#d9f99d',
    300: '#bef264',
    400: '#a3e635',
    500: '#9DFF7A', // Lime Green
    600: '#65a30d',
    700: '#4d7c0f',
    800: '#3f6212',
    900: '#365314',
    950: '#1a2e05',
    main: '#9DFF7A', // Lime Green for success
  },

  // Warning - Modern Amber
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
    main: '#f59e0b', // Main warning color
  },

  // Error - Modern Red
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
    main: '#ef4444', // Main error color
  },

  // Info - Sapphire Blue (same as primary for consistency)
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#4FA3FF', // Sky Blue
    600: '#1E4EB8', // Sapphire Blue
    700: '#1e40af',
    800: '#1e3a8a',
    900: '#1e3a8a',
    950: '#172554',
  },

  // Neutral - ClassBridge Grays (Light, clean)
  neutral: {
    50: '#fafafa',
    100: '#F5F7FA', // Light Gray (ClassBridge)
    200: '#e5e7eb',
    300: '#D9DCE1', // Border Gray (ClassBridge)
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#2A2A2A', // Text Dark (ClassBridge)
    900: '#1f2937',
    950: '#030712',
  },

  // Background System - Light, Clean (ClassBridge)
  background: {
    primary: '#FFFFFF', // White
    secondary: '#F5F7FA', // Light Gray
    tertiary: '#F3F4F6', // Very light gray
    quaternary: '#eff6ff', // Very light blue tint
    dark: '#0B1A3C', // Dark Navy (Operium)
    app: '#F5F7FA', // Light Gray app background
    elevated: '#FFFFFF',
    glass: 'rgba(255, 255, 255, 0.9)',
    default: '#F5F7FA', // Light Gray default
    light: '#FFFFFF', // White for light backgrounds
    paper: '#FFFFFF', // Paper background
    card: '#FFFFFF', // Card background
  },

  // Surface System - Light, Clean (ClassBridge)
  surface: {
    primary: '#FFFFFF', // White
    secondary: '#F5F7FA', // Light Gray
    tertiary: '#F3F4F6', // Very light gray
    elevated: '#FFFFFF',
    overlay: 'rgba(11, 26, 60, 0.6)', // Dark Navy overlay
    glass: 'rgba(255, 255, 255, 0.95)',
    dark: '#0B1A3C', // Dark Navy
    light: '#F5F7FA', // Light Gray surface
    paper: '#FFFFFF', // Paper surface
  },

  // Border System - Clean Gray (ClassBridge)
  border: {
    light: '#e5e7eb', // Very light gray border
    DEFAULT: '#D9DCE1', // Border Gray (ClassBridge)
    dark: '#9ca3af', // Darker gray border
    accent: '#1E4EB8', // Sapphire Blue accent
  },

  // Text System - ClassBridge Typography (accessibility standards)
  text: {
    primary: '#2A2A2A',        // Text Dark (ClassBridge) for maximum readability
    secondary: '#374151',      // Dark gray for secondary text
    tertiary: '#6b7280',       // Medium gray for tertiary text
    quaternary: '#9ca3af',     // Light gray for disabled text
    inverse: '#FFFFFF',        // White for dark backgrounds
    disabled: '#d1d5db',       // Light gray for disabled states
    accent: '#1E4EB8',         // Sapphire Blue for links/accents
  },

  // Modern Gradients - Sapphire Blue Theme
  gradient: {
    primary: ['#3A57F5', '#537BFF', '#4FA3FF'], // Sapphire to Sky Blue (Operium style)
    secondary: ['#4FA3FF', '#60a5fa', '#93c5fd'], // Sky Blue gradient
    success: ['#9DFF7A', '#a3e635', '#65a30d'], // Lime Green gradient
    warning: ['#f59e0b', '#f97316', '#ef4444'], // Amber to red
    sunset: ['#1E4EB8', '#2563eb', '#4FA3FF'], // Sapphire sunset
    ocean: ['#1E4EB8', '#2563eb', '#4FA3FF'], // Sapphire Blue gradient
    forest: ['#9DFF7A', '#a3e635', '#65a30d'], // Lime Green gradient
    cosmic: ['#1E4EB8', '#4FA3FF', '#93c5fd'], // Blue cosmic
  },

  // Special Educational Colors - ClassBridge Theme
  education: {
    math: '#1E4EB8', // Sapphire Blue
    science: '#9DFF7A', // Lime Green
    english: '#4FA3FF', // Sky Blue
    history: '#ef4444', // Red
    art: '#ec4899', // Pink
    music: '#a855f7', // Purple
    sports: '#1E4EB8', // Sapphire Blue
    library: '#4FA3FF', // Sky Blue
  },
};

// Responsive spacing (8px grid system with scaling)
export const spacing = {
  0: 0,
  1: scaleSpacing(4),   // 4px
  2: scaleSpacing(8),   // 8px
  3: scaleSpacing(12),  // 12px
  4: scaleSpacing(16),  // 16px
  5: scaleSpacing(20),  // 20px
  6: scaleSpacing(24),  // 24px
  8: scaleSpacing(32),  // 32px
  10: scaleSpacing(40), // 40px
  12: scaleSpacing(48), // 48px
  16: scaleSpacing(64), // 64px
  20: scaleSpacing(80), // 80px
  24: scaleSpacing(96), // 96px
  // Named spacing (production-grade)
  xs: scaleSpacing(4),   // Extra small - 4px
  sm: scaleSpacing(8),   // Small - 8px
  md: scaleSpacing(16),  // Medium - 16px (base unit)
  lg: scaleSpacing(24),  // Large - 24px
  xl: scaleSpacing(32),  // Extra large - 32px
  '2xl': scaleSpacing(48), // 2x extra large - 48px
  '3xl': scaleSpacing(64), // 3x extra large - 64px
  xxl: scaleSpacing(80),   // XXL - 80px
};

export const borderRadius = {
  none: 0,
  sm: 4,
  button: 6, // ClassBridge button radius
  DEFAULT: 8,
  input: 8, // ClassBridge input radius
  md: 12,
  card: 12, // ClassBridge card radius
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
};

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, // Softer shadow (ClassBridge)
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, // Softer shadow (ClassBridge)
    shadowRadius: 3,
    elevation: 2,
  },
  DEFAULT: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, // Softer shadow (ClassBridge)
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, // Softer shadow (ClassBridge)
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, // Softer shadow (ClassBridge)
    shadowRadius: 16,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08, // Softer shadow (ClassBridge)
    shadowRadius: 24,
    elevation: 8,
  },
  '2xl': {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08, // Softer shadow (ClassBridge)
    shadowRadius: 32,
    elevation: 10,
  },
  inner: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, // Softer shadow (ClassBridge)
    shadowRadius: 2,
    elevation: 0,
  },
  glow: {
    shadowColor: colors.primary[600], // Sapphire Blue glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 0,
  },
};

export const typography = {
  fontFamily: {
    // Modern font stack for educational apps
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
    display: 'Inter-Bold', // For large headings
    mono: 'SFMono-Regular', // For code/numbers
  },
  // Production-grade font sizes (Duolingo-style, responsive)
  fontSize: {
    xs: scaleFont(11),      // 11px - tiny labels, captions
    sm: scaleFont(13),      // 13px - small text, secondary info
    base: scaleFont(15),    // 15px - body text (optimal readability)
    md: scaleFont(16),      // 16px - comfortable reading
    lg: scaleFont(17),      // 17px - emphasized body
    xl: scaleFont(19),      // 19px - large text, section headers
    '2xl': scaleFont(22),   // 22px - page headers
    '3xl': scaleFont(26),   // 26px - large headers
    '4xl': scaleFont(32),   // 32px - hero text
    '5xl': scaleFont(40),   // 40px - display
    '6xl': scaleFont(48),   // 48px - large display
    '7xl': scaleFont(60),   // 60px - hero display
  },
  fontWeight: {
    light: '300' as TextStyle['fontWeight'],
    normal: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
    extrabold: '800' as TextStyle['fontWeight'],
    black: '900' as TextStyle['fontWeight'],
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
    widest: 1,
  },
  // Typography variants for easy use (Production-grade, responsive)
  h1: {
    fontSize: scaleFont(26), // Hero headers
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 1.25,
  },
  h2: {
    fontSize: scaleFont(22), // Page headers
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 1.3,
  },
  h3: {
    fontSize: scaleFont(19), // Section headers
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 1.35,
  },
  h4: {
    fontSize: scaleFont(17), // Subsection headers
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 1.4,
  },
  h5: {
    fontSize: scaleFont(16), // Small headers
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 1.4,
  },
  h6: {
    fontSize: scaleFont(15), // Tiny headers
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 1.4,
  },
  body1: {
    fontSize: scaleFont(15), // Primary body text (optimal)
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 1.5,
  },
  body2: {
    fontSize: scaleFont(13), // Secondary body text
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 1.5,
  },
  caption: {
    fontSize: scaleFont(11), // Captions, labels
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 1.4,
  },
  button: {
    fontSize: scaleFont(15), // Button text (readable)
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 1.4,
  },
};

export const animation = {
  duration: {
    instant: 0,
    fast: 150, // ClassBridge fast (150-250ms)
    normal: 200, // ClassBridge normal
    slow: 250, // ClassBridge slow (max recommended)
    slower: 300,
    slowest: 500,
  },
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out', // ClassBridge recommended
    easeInOut: 'ease-in-out',
    // Custom easing curves for modern feel
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Avoid for ClassBridge
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)', // ClassBridge recommended
    snappy: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  spring: {
    gentle: {
      tension: 120,
      friction: 14,
    },
    wobbly: {
      tension: 180,
      friction: 12,
    },
    stiff: {
      tension: 210,
      friction: 20,
    },
  },
};

// Responsive layout system
export const layout = {
  maxWidth: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    full: SCREEN_WIDTH,
  },
  container: {
    padding: spacing.md,
    maxWidth: SCREEN_WIDTH >= breakpoints.tablet ? 1200 : SCREEN_WIDTH,
  },
  // Content max width for readability (like Duolingo)
  contentMaxWidth: SCREEN_WIDTH >= breakpoints.tablet ? 680 : SCREEN_WIDTH - 32,
};

// Utility for responsive values
export const responsive = {
  isSmallPhone: SCREEN_WIDTH < breakpoints.medium,
  isPhone: SCREEN_WIDTH < breakpoints.tablet,
  isTablet: SCREEN_WIDTH >= breakpoints.tablet && SCREEN_WIDTH < breakpoints.desktop,
  isDesktop: SCREEN_WIDTH >= breakpoints.desktop,
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  scale: SCALE,
};

// Modern Component Design Tokens (ClassBridge)
export const componentStyles = {
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.card, // 12px ClassBridge
    padding: spacing.lg,
    ...shadows.md,
    borderWidth: 0, // No border for clean look
  } as ViewStyle,

  cardElevated: {
    backgroundColor: colors.surface.elevated,
    borderRadius: borderRadius.card, // 12px ClassBridge
    padding: spacing.lg,
    ...shadows.md,
    borderWidth: 0, // No border for clean look
  } as ViewStyle,

  cardGlass: {
    backgroundColor: colors.surface.glass,
    borderRadius: borderRadius.card, // 12px ClassBridge
    padding: spacing.lg,
    ...shadows.sm,
    borderWidth: 0,
  } as ViewStyle,

  button: {
    primary: {
      backgroundColor: colors.primary[600], // Sapphire Blue
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button, // 6px ClassBridge
      ...shadows.none, // No shadow for buttons (ClassBridge)
      borderWidth: 0,
    } as ViewStyle,

    secondary: {
      backgroundColor: '#FFFFFF', // White (ClassBridge)
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button, // 6px ClassBridge
      borderWidth: 1,
      borderColor: colors.primary[600], // Sapphire border
    } as ViewStyle,

    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1, // Thinner border (ClassBridge)
      borderColor: colors.primary[600], // Sapphire Blue
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button, // 6px ClassBridge
    } as ViewStyle,

    ghost: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      borderWidth: 0,
    } as ViewStyle,

    destructive: {
      backgroundColor: colors.error[600], // Red (ClassBridge)
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button, // 6px ClassBridge
      ...shadows.none,
      borderWidth: 0,
    } as ViewStyle,

    disabled: {
      backgroundColor: colors.neutral[200],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      borderWidth: 0,
      opacity: 0.2, // 20% opacity (ClassBridge)
    } as ViewStyle,
  },

  input: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1, // Thinner border (ClassBridge)
    borderColor: colors.border.DEFAULT, // Border Gray
    borderRadius: borderRadius.input, // 8px ClassBridge
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base, // Responsive 15px
    color: colors.text.primary, // #2A2A2A
    ...shadows.none, // No shadow on inputs
    minHeight: 48, // Minimum touch target
  } as ViewStyle,

  inputFocused: {
    backgroundColor: colors.surface.primary,
    borderWidth: 2, // 2px blue outline (ClassBridge)
    borderColor: colors.primary[600], // Sapphire Blue
    borderRadius: borderRadius.input, // 8px ClassBridge
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base, // Responsive
    color: colors.text.primary,
    ...shadows.none, // No shadow on inputs
    minHeight: 48, // Minimum touch target
  } as ViewStyle,

  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    ...shadows.xs,
  } as ViewStyle,

  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.xs,
  } as ViewStyle,

  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  } as ViewStyle,

  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  } as ViewStyle,
};

// Modern Layout Tokens
export const layoutTokens = {
  container: {
    padding: spacing.lg,
    maxWidth: 1200,
  },
  section: {
    marginBottom: spacing.xl,
  },
  grid: {
    gap: spacing.md,
  },
  stack: {
    gap: spacing.sm,
  },
  stackLarge: {
    gap: spacing.lg,
  },
};

export const createGradient = (colors: string[]) => ({
  colors,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
});
