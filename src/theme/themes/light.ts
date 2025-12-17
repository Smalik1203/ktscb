/**
 * Krishnaveni Talent School Light Theme
 * 
 * The default light theme with Royal Purple primary and Golden Orange secondary.
 * Clean, professional, and optimized for readability.
 * Brand: "Mentored for Life"
 */

import type { Theme, ThemeColors, ComponentStyles } from '../types';
import {
  createTypography,
  createSpacing,
  createShadows,
  createLayout,
  borderRadius,
  animation,
  responsive,
} from '../tokens';

// ============================================================================
// LIGHT THEME COLORS - KTS Brand (Purple & Orange)
// ============================================================================

export const lightColors: ThemeColors = {
  // Primary - KTS Royal Purple
  primary: {
    50: '#F5F0FA',
    100: '#EBE0F5',
    200: '#D6C2EB',
    300: '#C2A3E0',
    400: '#9B6BC9',
    500: '#7B4BAF',  // KTS Brand Purple
    600: '#6B3FA0',  // Main brand color
    700: '#5A3587',
    800: '#4A2B6E',
    900: '#3A2156',
    950: '#2A173D',
    main: '#6B3FA0',
  },

  // Secondary - KTS Golden Orange
  secondary: {
    50: '#FFF8EB',
    100: '#FFEFD6',
    200: '#FFDFAD',
    300: '#FFCF85',
    400: '#FFBF5C',
    500: '#F5A623',  // KTS Brand Orange
    600: '#E09620',
    700: '#C4831B',
    800: '#A87016',
    900: '#8C5D11',
    950: '#704A0D',
    main: '#F5A623',
  },

  // Accent - KTS Crimson Red (from crown accent)
  accent: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#E74C3C',  // KTS Accent Red
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
    main: '#E74C3C',
  },

  // Success - Emerald Green
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
    950: '#022C22',
    main: '#10B981',
  },

  // Warning - Golden Orange (aligned with KTS secondary)
  warning: {
    50: '#FFF8EB',
    100: '#FFEFD6',
    200: '#FFDFAD',
    300: '#FFCF85',
    400: '#FFBF5C',
    500: '#F5A623',
    600: '#E09620',
    700: '#C4831B',
    800: '#A87016',
    900: '#8C5D11',
    950: '#704A0D',
    main: '#F5A623',
  },

  // Error - KTS Crimson
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#E74C3C',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
    main: '#E74C3C',
  },

  // Info - KTS Purple (aligned with primary)
  info: {
    50: '#F5F0FA',
    100: '#EBE0F5',
    200: '#D6C2EB',
    300: '#C2A3E0',
    400: '#9B6BC9',
    500: '#7B4BAF',
    600: '#6B3FA0',
    700: '#5A3587',
    800: '#4A2B6E',
    900: '#3A2156',
    950: '#2A173D',
    main: '#6B3FA0',
  },

  // Neutral
  neutral: {
    50: '#fafafa',
    100: '#F5F7FA',
    200: '#e5e7eb',
    300: '#D9DCE1',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#2A2A2A',
    900: '#1f2937',
    950: '#030712',
    main: '#6b7280',
  },

  // Backgrounds
  background: {
    primary: '#FFFFFF',
    secondary: '#FAF8FC',
    tertiary: '#F5F0FA',
    quaternary: '#EBE0F5',
    elevated: '#FFFFFF',
    app: '#FAF8FC',
    dark: '#2A173D',
    glass: 'rgba(255, 255, 255, 0.9)',
    default: '#FAF8FC',
    light: '#FFFFFF',
    paper: '#FFFFFF',
    card: '#FFFFFF',
  },

  // Surfaces
  surface: {
    primary: '#FFFFFF',
    secondary: '#FAF8FC',
    tertiary: '#F5F0FA',
    elevated: '#FFFFFF',
    overlay: 'rgba(42, 23, 61, 0.6)',
    glass: 'rgba(255, 255, 255, 0.95)',
    dark: '#2A173D',
    light: '#FAF8FC',
    paper: '#FFFFFF',
  },

  // Text
  text: {
    primary: '#1A1A2E',
    secondary: '#4A4A5A',
    tertiary: '#6B7280',
    quaternary: '#9CA3AF',
    inverse: '#FFFFFF',
    disabled: '#D1D5DB',
    accent: '#6B3FA0',
  },

  // Borders
  border: {
    light: '#EBE0F5',
    DEFAULT: '#D6C2EB',
    dark: '#9B6BC9',
    accent: '#6B3FA0',
  },

  // Gradients - KTS Brand (Purple & Orange)
  gradient: {
    primary: ['#6B3FA0', '#7B4BAF', '#9B6BC9'],
    secondary: ['#F5A623', '#FFBF5C', '#FFCF85'],
    success: ['#10B981', '#34D399', '#6EE7B7'],
    warning: ['#F5A623', '#FFBF5C', '#FFCF85'],
    sunset: ['#6B3FA0', '#E74C3C', '#F5A623'],
    ocean: ['#5A3587', '#6B3FA0', '#9B6BC9'],
    forest: ['#059669', '#10B981', '#34D399'],
    cosmic: ['#2A173D', '#6B3FA0', '#F5A623'],
  },

  // Education - KTS themed
  education: {
    math: '#6B3FA0',
    science: '#10B981',
    english: '#F5A623',
    history: '#E74C3C',
    art: '#EC4899',
    music: '#9B6BC9',
    sports: '#F5A623',
    library: '#6B3FA0',
  },

  statusBar: 'dark',
};

// ============================================================================
// COMPONENT STYLES
// ============================================================================

const spacing = createSpacing();
const shadows = createShadows(lightColors.primary.main);

const createComponentStyles = (): ComponentStyles => ({
  card: {
    backgroundColor: lightColors.surface.primary,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardElevated: {
    backgroundColor: lightColors.surface.elevated,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardGlass: {
    backgroundColor: lightColors.surface.glass,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    ...shadows.sm,
  },
  button: {
    primary: {
      backgroundColor: lightColors.primary.main,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    secondary: {
      backgroundColor: lightColors.background.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      borderWidth: 1,
      borderColor: lightColors.primary.main,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: lightColors.primary.main,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    ghost: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    destructive: {
      backgroundColor: lightColors.error.main,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    disabled: {
      backgroundColor: lightColors.neutral[200],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      opacity: 0.5,
    },
  },
  input: {
    backgroundColor: lightColors.surface.primary,
    borderWidth: 1,
    borderColor: lightColors.border.DEFAULT,
    borderRadius: borderRadius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  inputFocused: {
    backgroundColor: lightColors.surface.primary,
    borderWidth: 2,
    borderColor: lightColors.primary.main,
    borderRadius: borderRadius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: lightColors.neutral[100],
    borderWidth: 1,
    borderColor: lightColors.border.light,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: lightColors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: lightColors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ============================================================================
// EXPORT COMPLETE THEME
// ============================================================================

export const lightTheme: Theme = {
  id: 'light',
  name: 'Light',
  isDark: false,
  colors: lightColors,
  typography: createTypography(),
  spacing: createSpacing(),
  borderRadius,
  shadows: createShadows(lightColors.primary.main),
  animation,
  layout: createLayout(),
  responsive,
  components: createComponentStyles(),
};

export default lightTheme;

