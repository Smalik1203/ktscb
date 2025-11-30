/**
 * School B Theme - Maroon Traditional
 * 
 * A classic, traditional theme with:
 * - Primary: Maroon (#9F1239) - Tradition, strength, heritage
 * - Secondary: Cream/Tan (#D4A574) - Warmth, elegance
 * - Accent: Navy (#1E3A5F) - Authority, trust
 * 
 * Perfect for schools emphasizing tradition and heritage.
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
// SCHOOL B COLORS - MAROON TRADITIONAL
// ============================================================================

export const schoolBColors: ThemeColors = {
  // Primary - Maroon
  primary: {
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
    main: '#9f1239',
  },

  // Secondary - Tan/Cream
  secondary: {
    50: '#fefdfb',
    100: '#fdf8f0',
    200: '#faeed9',
    300: '#f5debb',
    400: '#edc995',
    500: '#e4b06f',
    600: '#d4a574',
    700: '#b88b5d',
    800: '#96704a',
    900: '#7a5b3d',
    950: '#4a3624',
    main: '#d4a574',
  },

  // Accent - Navy
  accent: {
    50: '#f0f6ff',
    100: '#e0edff',
    200: '#c7deff',
    300: '#a4c7ff',
    400: '#76a4ff',
    500: '#4d7fff',
    600: '#2563eb',
    700: '#1e4eb8',
    800: '#1e3a5f',
    900: '#1e3a5f',
    950: '#172554',
    main: '#1e3a5f',
  },

  // Success - Forest Green
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
    main: '#16a34a',
  },

  // Warning - Amber
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

  // Error - Crimson (deeper than primary)
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
    main: '#dc2626',
  },

  // Info - Navy (same as accent)
  info: {
    50: '#f0f6ff',
    100: '#e0edff',
    200: '#c7deff',
    300: '#a4c7ff',
    400: '#76a4ff',
    500: '#4d7fff',
    600: '#2563eb',
    700: '#1e4eb8',
    800: '#1e3a5f',
    900: '#1e3a5f',
    950: '#172554',
    main: '#1e3a5f',
  },

  // Neutral - Warm Stone
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
    primary: '#FFFDFB',
    secondary: '#FAF8F5',
    tertiary: '#F5F3F0',
    quaternary: '#fff1f2',
    elevated: '#FFFFFF',
    app: '#FAF8F5',
    dark: '#4c0519',
    glass: 'rgba(255, 253, 251, 0.9)',
    default: '#FAF8F5',
    light: '#FFFDFB',
    paper: '#FFFFFF',
    card: '#FFFFFF',
  },

  // Surfaces
  surface: {
    primary: '#FFFFFF',
    secondary: '#FAF8F5',
    tertiary: '#F5F3F0',
    elevated: '#FFFFFF',
    overlay: 'rgba(76, 5, 25, 0.6)',
    glass: 'rgba(255, 253, 251, 0.95)',
    dark: '#4c0519',
    light: '#FAF8F5',
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
    accent: '#9f1239',
  },

  // Borders
  border: {
    light: '#e7e5e4',
    DEFAULT: '#d6d3d1',
    dark: '#a8a29e',
    accent: '#9f1239',
  },

  // Gradients - Maroon themed
  gradient: {
    primary: ['#9f1239', '#be123c', '#e11d48'],
    secondary: ['#b88b5d', '#d4a574', '#e4b06f'],
    success: ['#15803d', '#16a34a', '#22c55e'],
    warning: ['#d97706', '#f59e0b', '#fbbf24'],
    sunset: ['#9f1239', '#1e3a5f', '#1e4eb8'],
    ocean: ['#1e3a5f', '#1e4eb8', '#2563eb'],
    forest: ['#166534', '#16a34a', '#22c55e'],
    cosmic: ['#4c0519', '#9f1239', '#e11d48'],
  },

  // Education - School B palette
  education: {
    math: '#9f1239',
    science: '#16a34a',
    english: '#1e3a5f',
    history: '#b88b5d',
    art: '#d4a574',
    music: '#7c3aed',
    sports: '#9f1239',
    library: '#1e3a5f',
  },

  statusBar: 'dark',
};

// ============================================================================
// COMPONENT STYLES
// ============================================================================

const spacing = createSpacing();
const shadows = createShadows(schoolBColors.primary.main);

const createComponentStyles = (): ComponentStyles => ({
  card: {
    backgroundColor: schoolBColors.surface.primary,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardElevated: {
    backgroundColor: schoolBColors.surface.elevated,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardGlass: {
    backgroundColor: schoolBColors.surface.glass,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    ...shadows.sm,
  },
  button: {
    primary: {
      backgroundColor: schoolBColors.primary.main,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    secondary: {
      backgroundColor: schoolBColors.background.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      borderWidth: 1,
      borderColor: schoolBColors.primary.main,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: schoolBColors.primary.main,
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
      backgroundColor: schoolBColors.error.main,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    disabled: {
      backgroundColor: schoolBColors.neutral[200],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      opacity: 0.5,
    },
  },
  input: {
    backgroundColor: schoolBColors.surface.primary,
    borderWidth: 1,
    borderColor: schoolBColors.border.DEFAULT,
    borderRadius: borderRadius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  inputFocused: {
    backgroundColor: schoolBColors.surface.primary,
    borderWidth: 2,
    borderColor: schoolBColors.primary.main,
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
    backgroundColor: schoolBColors.neutral[100],
    borderWidth: 1,
    borderColor: schoolBColors.border.light,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: schoolBColors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: schoolBColors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ============================================================================
// EXPORT COMPLETE THEME
// ============================================================================

export const schoolBTheme: Theme = {
  id: 'schoolB',
  name: 'Maroon Traditional',
  isDark: false,
  colors: schoolBColors,
  typography: createTypography(),
  spacing: createSpacing(),
  borderRadius,
  shadows: createShadows(schoolBColors.primary.main),
  animation,
  layout: createLayout(),
  responsive,
  components: createComponentStyles(),
};

export default schoolBTheme;

