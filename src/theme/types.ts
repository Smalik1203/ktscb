/**
 * ClassBridge Theme System - Type Definitions
 * 
 * This file defines the complete TypeScript interface for the theme system.
 * All themes (light, dark, per-school) must conform to these types.
 */

import { TextStyle, ViewStyle } from 'react-native';

// ============================================================================
// COLOR TYPES
// ============================================================================

/** Color scale from 50 (lightest) to 950 (darkest) */
export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
  /** Main color for this scale (typically 500-600) */
  main: string;
}

/** Semantic background colors */
export interface BackgroundColors {
  /** Main app background */
  primary: string;
  /** Secondary/alternate background */
  secondary: string;
  /** Tertiary background for nested elements */
  tertiary: string;
  /** Fourth-level background */
  quaternary: string;
  /** Elevated surface (cards, modals) */
  elevated: string;
  /** App-wide background */
  app: string;
  /** Dark background for contrast sections */
  dark: string;
  /** Glass/frosted effect background */
  glass: string;
  /** Default fallback */
  default: string;
  /** Light background */
  light: string;
  /** Paper-like background */
  paper: string;
  /** Card background */
  card: string;
}

/** Semantic surface colors */
export interface SurfaceColors {
  primary: string;
  secondary: string;
  tertiary: string;
  elevated: string;
  overlay: string;
  glass: string;
  dark: string;
  light: string;
  paper: string;
}

/** Semantic text colors */
export interface TextColors {
  /** High-emphasis text */
  primary: string;
  /** Medium-emphasis text */
  secondary: string;
  /** Low-emphasis text */
  tertiary: string;
  /** Disabled/placeholder text */
  quaternary: string;
  /** Text on dark backgrounds */
  inverse: string;
  /** Disabled state */
  disabled: string;
  /** Accent/link text */
  accent: string;
}

/** Border colors */
export interface BorderColors {
  light: string;
  DEFAULT: string;
  dark: string;
  accent: string;
}

/** Gradient definitions */
export interface GradientColors {
  primary: string[];
  secondary: string[];
  success: string[];
  warning: string[];
  sunset: string[];
  ocean: string[];
  forest: string[];
  cosmic: string[];
}

/** Educational subject colors */
export interface EducationColors {
  math: string;
  science: string;
  english: string;
  history: string;
  art: string;
  music: string;
  sports: string;
  library: string;
}

/** Complete color palette */
export interface ThemeColors {
  primary: ColorScale;
  secondary: ColorScale;
  accent: ColorScale;
  success: ColorScale;
  warning: ColorScale;
  error: ColorScale;
  info: ColorScale;
  neutral: ColorScale;
  background: BackgroundColors;
  surface: SurfaceColors;
  text: TextColors;
  border: BorderColors;
  gradient: GradientColors;
  education: EducationColors;
  /** Status bar style */
  statusBar: 'light' | 'dark';
}

// ============================================================================
// TYPOGRAPHY TYPES
// ============================================================================

export interface FontFamily {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  display: string;
  mono: string;
}

export interface FontSizes {
  xs: number;
  sm: number;
  base: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  '3xl': number;
  '4xl': number;
  '5xl': number;
  '6xl': number;
  '7xl': number;
}

export interface FontWeights {
  light: TextStyle['fontWeight'];
  normal: TextStyle['fontWeight'];
  medium: TextStyle['fontWeight'];
  semibold: TextStyle['fontWeight'];
  bold: TextStyle['fontWeight'];
  extrabold: TextStyle['fontWeight'];
  black: TextStyle['fontWeight'];
}

export interface LineHeights {
  tight: number;
  snug: number;
  normal: number;
  relaxed: number;
  loose: number;
}

export interface LetterSpacing {
  tighter: number;
  tight: number;
  normal: number;
  wide: number;
  wider: number;
  widest: number;
}

export interface TypographyVariant {
  fontSize: number;
  fontWeight: TextStyle['fontWeight'];
  lineHeight: number;
  letterSpacing?: number;
}

export interface TypographyVariants {
  h1: TypographyVariant;
  h2: TypographyVariant;
  h3: TypographyVariant;
  h4: TypographyVariant;
  h5: TypographyVariant;
  h6: TypographyVariant;
  body1: TypographyVariant;
  body2: TypographyVariant;
  caption: TypographyVariant;
  button: TypographyVariant;
  overline: TypographyVariant;
  label: TypographyVariant;
}

export interface Typography {
  fontFamily: FontFamily;
  fontSize: FontSizes;
  fontWeight: FontWeights;
  lineHeight: LineHeights;
  letterSpacing: LetterSpacing;
  variants: TypographyVariants;
}

// ============================================================================
// SPACING TYPES
// ============================================================================

export interface Spacing {
  0: number;
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  8: number;
  10: number;
  12: number;
  16: number;
  20: number;
  24: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  '3xl': number;
  xxl: number;
}

// ============================================================================
// BORDER RADIUS TYPES
// ============================================================================

export interface BorderRadius {
  none: number;
  sm: number;
  button: number;
  DEFAULT: number;
  input: number;
  md: number;
  card: number;
  lg: number;
  xl: number;
  '2xl': number;
  full: number;
}

// ============================================================================
// SHADOW TYPES
// ============================================================================

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface Shadows {
  none: ShadowStyle;
  xs: ShadowStyle;
  sm: ShadowStyle;
  DEFAULT: ShadowStyle;
  md: ShadowStyle;
  lg: ShadowStyle;
  xl: ShadowStyle;
  '2xl': ShadowStyle;
  inner: ShadowStyle;
  glow: ShadowStyle;
}

// ============================================================================
// ANIMATION TYPES
// ============================================================================

export interface AnimationDurations {
  instant: number;
  fast: number;
  normal: number;
  slow: number;
  slower: number;
  slowest: number;
}

export interface AnimationEasing {
  linear: string;
  ease: string;
  easeIn: string;
  easeOut: string;
  easeInOut: string;
  bounce: string;
  smooth: string;
  snappy: string;
}

export interface SpringConfig {
  tension: number;
  friction: number;
}

export interface AnimationSprings {
  gentle: SpringConfig;
  wobbly: SpringConfig;
  stiff: SpringConfig;
}

export interface Animation {
  duration: AnimationDurations;
  easing: AnimationEasing;
  spring: AnimationSprings;
}

// ============================================================================
// LAYOUT TYPES
// ============================================================================

export interface MaxWidths {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface ContainerConfig {
  padding: number;
  maxWidth: number;
}

export interface Layout {
  maxWidth: MaxWidths;
  container: ContainerConfig;
  contentMaxWidth: number;
}

// ============================================================================
// RESPONSIVE TYPES
// ============================================================================

export interface Breakpoints {
  small: number;
  medium: number;
  large: number;
  tablet: number;
  desktop: number;
}

export interface Responsive {
  isSmallPhone: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  scale: number;
}

// ============================================================================
// COMPONENT STYLE TYPES
// ============================================================================

export interface ButtonStyles {
  primary: ViewStyle;
  secondary: ViewStyle;
  outline: ViewStyle;
  ghost: ViewStyle;
  destructive: ViewStyle;
  disabled: ViewStyle;
}

export interface ComponentStyles {
  card: ViewStyle;
  cardElevated: ViewStyle;
  cardGlass: ViewStyle;
  button: ButtonStyles;
  input: ViewStyle;
  inputFocused: ViewStyle;
  badge: ViewStyle;
  chip: ViewStyle;
  avatar: ViewStyle;
  avatarLarge: ViewStyle;
}

// ============================================================================
// COMPLETE THEME TYPE
// ============================================================================

export interface Theme {
  /** Theme identifier */
  id: string;
  /** Human-readable theme name */
  name: string;
  /** Whether this is a dark theme */
  isDark: boolean;
  /** Color palette */
  colors: ThemeColors;
  /** Typography system */
  typography: Typography;
  /** Spacing scale */
  spacing: Spacing;
  /** Border radius values */
  borderRadius: BorderRadius;
  /** Shadow definitions */
  shadows: Shadows;
  /** Animation configuration */
  animation: Animation;
  /** Layout configuration */
  layout: Layout;
  /** Responsive utilities */
  responsive: Responsive;
  /** Pre-built component styles */
  components: ComponentStyles;
}

// ============================================================================
// THEME CONTEXT TYPES
// ============================================================================

export type ThemeId = 'light' | 'dark' | 'schoolA' | 'schoolB' | 'system';

export interface ThemeContextValue {
  /** Current theme object */
  theme: Theme;
  /** Current theme ID */
  themeId: ThemeId;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Set theme by ID */
  setTheme: (id: ThemeId) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
  /** Colors shortcut (theme.colors) */
  colors: ThemeColors;
  /** Typography shortcut (theme.typography) */
  typography: Typography;
  /** Spacing shortcut (theme.spacing) */
  spacing: Spacing;
  /** Border radius shortcut (theme.borderRadius) */
  borderRadius: BorderRadius;
  /** Shadows shortcut (theme.shadows) */
  shadows: Shadows;
  /** Animation shortcut (theme.animation) */
  animation: Animation;
}

// ============================================================================
// THEME CREATION HELPER TYPES
// ============================================================================

/** Partial theme for extending base themes */
export type PartialTheme = Partial<Omit<Theme, 'colors'>> & {
  colors?: Partial<ThemeColors>;
};

/** Function to create a theme from base + overrides */
export type ThemeCreator = (overrides?: PartialTheme) => Theme;

