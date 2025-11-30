/**
 * ClassBridge Theme System - Shared Design Tokens
 * 
 * These tokens are shared across all themes and provide the foundation
 * for spacing, typography, shadows, animations, and layout.
 * 
 * Design Philosophy:
 * - 8px grid system for spacing
 * - Responsive scaling based on screen size
 * - Accessibility-first typography
 * - Consistent elevation through shadows
 */

import { Dimensions, TextStyle } from 'react-native';
import type {
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Animation,
  Layout,
  Breakpoints,
  Responsive,
} from './types';

// ============================================================================
// RESPONSIVE CONFIGURATION
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const breakpoints: Breakpoints = {
  small: 320,   // Small phones
  medium: 375,  // Standard phones (iPhone SE, iPhone 8)
  large: 414,   // Large phones (iPhone 11, 12, 13)
  tablet: 768,  // Tablets
  desktop: 1024 // Desktop/Large tablets
};

/** Get responsive scale based on screen width */
const getScale = (): number => {
  if (SCREEN_WIDTH >= breakpoints.desktop) return 1.2;
  if (SCREEN_WIDTH >= breakpoints.tablet) return 1.1;
  if (SCREEN_WIDTH >= breakpoints.large) return 1.0;
  if (SCREEN_WIDTH >= breakpoints.medium) return 0.95;
  return 0.9; // Small phones
};

const SCALE = getScale();

/** Scale a font size based on screen */
export const scaleFont = (size: number): number => Math.round(size * SCALE);

/** Scale spacing based on screen */
export const scaleSpacing = (size: number): number => Math.round(size * SCALE);

export const responsive: Responsive = {
  isSmallPhone: SCREEN_WIDTH < breakpoints.medium,
  isPhone: SCREEN_WIDTH < breakpoints.tablet,
  isTablet: SCREEN_WIDTH >= breakpoints.tablet && SCREEN_WIDTH < breakpoints.desktop,
  isDesktop: SCREEN_WIDTH >= breakpoints.desktop,
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  scale: SCALE,
};

// ============================================================================
// SPACING TOKENS (8px Grid System)
// ============================================================================

export const createSpacing = (scale: number = SCALE): Spacing => ({
  0: 0,
  1: Math.round(4 * scale),   // 4px
  2: Math.round(8 * scale),   // 8px
  3: Math.round(12 * scale),  // 12px
  4: Math.round(16 * scale),  // 16px
  5: Math.round(20 * scale),  // 20px
  6: Math.round(24 * scale),  // 24px
  8: Math.round(32 * scale),  // 32px
  10: Math.round(40 * scale), // 40px
  12: Math.round(48 * scale), // 48px
  16: Math.round(64 * scale), // 64px
  20: Math.round(80 * scale), // 80px
  24: Math.round(96 * scale), // 96px
  // Named aliases
  xs: Math.round(4 * scale),   // Extra small
  sm: Math.round(8 * scale),   // Small
  md: Math.round(16 * scale),  // Medium (base unit)
  lg: Math.round(24 * scale),  // Large
  xl: Math.round(32 * scale),  // Extra large
  '2xl': Math.round(48 * scale), // 2x extra large
  '3xl': Math.round(64 * scale), // 3x extra large
  xxl: Math.round(80 * scale),   // XXL
});

export const spacing = createSpacing();

// ============================================================================
// BORDER RADIUS TOKENS
// ============================================================================

export const borderRadius: BorderRadius = {
  none: 0,
  sm: 4,
  button: 6,    // ClassBridge button radius
  DEFAULT: 8,
  input: 8,     // ClassBridge input radius
  md: 12,
  card: 12,     // ClassBridge card radius
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
};

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

export const createTypography = (scale: number = SCALE): Typography => ({
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
    display: 'System',
    mono: 'Courier',
  },
  fontSize: {
    xs: Math.round(11 * scale),      // Tiny labels, captions
    sm: Math.round(13 * scale),      // Small text, secondary info
    base: Math.round(15 * scale),    // Body text (optimal readability)
    md: Math.round(16 * scale),      // Comfortable reading
    lg: Math.round(17 * scale),      // Emphasized body
    xl: Math.round(19 * scale),      // Large text, section headers
    '2xl': Math.round(22 * scale),   // Page headers
    '3xl': Math.round(26 * scale),   // Large headers
    '4xl': Math.round(32 * scale),   // Hero text
    '5xl': Math.round(40 * scale),   // Display
    '6xl': Math.round(48 * scale),   // Large display
    '7xl': Math.round(60 * scale),   // Hero display
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
  variants: {
    h1: {
      fontSize: Math.round(26 * scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 1.25,
      letterSpacing: -0.25,
    },
    h2: {
      fontSize: Math.round(22 * scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 1.3,
    },
    h3: {
      fontSize: Math.round(19 * scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 1.35,
    },
    h4: {
      fontSize: Math.round(17 * scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 1.4,
    },
    h5: {
      fontSize: Math.round(16 * scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 1.4,
    },
    h6: {
      fontSize: Math.round(15 * scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 1.4,
    },
    body1: {
      fontSize: Math.round(15 * scale),
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: 1.5,
    },
    body2: {
      fontSize: Math.round(13 * scale),
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: 1.5,
    },
    caption: {
      fontSize: Math.round(11 * scale),
      fontWeight: '400' as TextStyle['fontWeight'],
      lineHeight: 1.4,
    },
    button: {
      fontSize: Math.round(15 * scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 1.4,
    },
    overline: {
      fontSize: Math.round(10 * scale),
      fontWeight: '600' as TextStyle['fontWeight'],
      lineHeight: 1.4,
      letterSpacing: 1,
    },
    label: {
      fontSize: Math.round(13 * scale),
      fontWeight: '500' as TextStyle['fontWeight'],
      lineHeight: 1.4,
    },
  },
});

export const typography = createTypography();

// ============================================================================
// SHADOW TOKENS
// ============================================================================

export const createShadows = (primaryColor: string = '#1E4EB8'): Shadows => ({
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
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  DEFAULT: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  '2xl': {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 10,
  },
  inner: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 0,
  },
  glow: {
    shadowColor: primaryColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 0,
  },
});

export const shadows = createShadows();

// ============================================================================
// ANIMATION TOKENS
// ============================================================================

export const animation: Animation = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 200,
    slow: 250,
    slower: 300,
    slowest: 500,
  },
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
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

// ============================================================================
// LAYOUT TOKENS
// ============================================================================

export const createLayout = (): Layout => ({
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
  contentMaxWidth: SCREEN_WIDTH >= breakpoints.tablet ? 680 : SCREEN_WIDTH - 32,
});

export const layout = createLayout();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Create a gradient configuration */
export const createGradient = (colors: string[]) => ({
  colors,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
});

