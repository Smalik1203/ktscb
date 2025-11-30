/**
 * School A Theme - Emerald Academic
 * 
 * A prestigious academic theme with:
 * - Primary: Emerald Green (#059669) - Growth, prestige, academia
 * - Secondary: Gold (#D97706) - Excellence, achievement
 * - Accent: Teal (#0D9488) - Modern, fresh
 * 
 * Perfect for schools emphasizing academic excellence and tradition.
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
// SCHOOL A COLORS - EMERALD ACADEMIC
// ============================================================================

export const schoolAColors: ThemeColors = {
  // Primary - Emerald Green
  primary: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
    main: '#059669',
  },

  // Secondary - Gold
  secondary: {
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
    main: '#d97706',
  },

  // Accent - Teal
  accent: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
    950: '#042f2e',
    main: '#0d9488',
  },

  // Success - Emerald (same as primary)
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
    main: '#059669',
  },

  // Warning - Amber/Gold
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
    main: '#f59e0b',
  },

  // Error - Rose
  error: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
    950: '#4c0519',
    main: '#e11d48',
  },

  // Info - Teal (same as accent)
  info: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
    950: '#042f2e',
    main: '#0d9488',
  },

  // Neutral - Warm Gray
  neutral: {
    50: '#fafaf9',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
    950: '#0c0a09',
    main: '#78716c',
  },

  // Backgrounds - Warm cream tones
  background: {
    primary: '#FFFFFF',
    secondary: '#FAFAF9',
    tertiary: '#F5F5F4',
    quaternary: '#ecfdf5',
    elevated: '#FFFFFF',
    app: '#FAFAF9',
    dark: '#064e3b',
    glass: 'rgba(255, 255, 255, 0.9)',
    default: '#FAFAF9',
    light: '#FFFFFF',
    paper: '#FFFFFF',
    card: '#FFFFFF',
  },

  // Surfaces
  surface: {
    primary: '#FFFFFF',
    secondary: '#FAFAF9',
    tertiary: '#F5F5F4',
    elevated: '#FFFFFF',
    overlay: 'rgba(6, 78, 59, 0.6)',
    glass: 'rgba(255, 255, 255, 0.95)',
    dark: '#064e3b',
    light: '#FAFAF9',
    paper: '#FFFFFF',
  },

  // Text - Warm tones
  text: {
    primary: '#1c1917',
    secondary: '#44403c',
    tertiary: '#78716c',
    quaternary: '#a8a29e',
    inverse: '#FFFFFF',
    disabled: '#d6d3d1',
    accent: '#059669',
  },

  // Borders
  border: {
    light: '#e7e5e4',
    DEFAULT: '#d6d3d1',
    dark: '#a8a29e',
    accent: '#059669',
  },

  // Gradients - Emerald themed
  gradient: {
    primary: ['#059669', '#10b981', '#34d399'],
    secondary: ['#d97706', '#f59e0b', '#fbbf24'],
    success: ['#059669', '#10b981', '#34d399'],
    warning: ['#d97706', '#f59e0b', '#fbbf24'],
    sunset: ['#059669', '#0d9488', '#14b8a6'],
    ocean: ['#0d9488', '#14b8a6', '#2dd4bf'],
    forest: ['#047857', '#059669', '#10b981'],
    cosmic: ['#064e3b', '#059669', '#34d399'],
  },

  // Education - School A palette
  education: {
    math: '#059669',
    science: '#0d9488',
    english: '#d97706',
    history: '#b45309',
    art: '#f43f5e',
    music: '#8b5cf6',
    sports: '#059669',
    library: '#0d9488',
  },

  statusBar: 'dark',
};

// ============================================================================
// COMPONENT STYLES
// ============================================================================

const spacing = createSpacing();
const shadows = createShadows(schoolAColors.primary.main);

const createComponentStyles = (): ComponentStyles => ({
  card: {
    backgroundColor: schoolAColors.surface.primary,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardElevated: {
    backgroundColor: schoolAColors.surface.elevated,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardGlass: {
    backgroundColor: schoolAColors.surface.glass,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    ...shadows.sm,
  },
  button: {
    primary: {
      backgroundColor: schoolAColors.primary.main,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    secondary: {
      backgroundColor: schoolAColors.background.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      borderWidth: 1,
      borderColor: schoolAColors.primary.main,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: schoolAColors.primary.main,
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
      backgroundColor: schoolAColors.error.main,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    disabled: {
      backgroundColor: schoolAColors.neutral[200],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      opacity: 0.5,
    },
  },
  input: {
    backgroundColor: schoolAColors.surface.primary,
    borderWidth: 1,
    borderColor: schoolAColors.border.DEFAULT,
    borderRadius: borderRadius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  inputFocused: {
    backgroundColor: schoolAColors.surface.primary,
    borderWidth: 2,
    borderColor: schoolAColors.primary.main,
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
    backgroundColor: schoolAColors.neutral[100],
    borderWidth: 1,
    borderColor: schoolAColors.border.light,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: schoolAColors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: schoolAColors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ============================================================================
// EXPORT COMPLETE THEME
// ============================================================================

export const schoolATheme: Theme = {
  id: 'schoolA',
  name: 'Emerald Academic',
  isDark: false,
  colors: schoolAColors,
  typography: createTypography(),
  spacing: createSpacing(),
  borderRadius,
  shadows: createShadows(schoolAColors.primary.main),
  animation,
  layout: createLayout(),
  responsive,
  components: createComponentStyles(),
};

export default schoolATheme;

