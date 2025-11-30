/**
 * ClassBridge Light Theme
 * 
 * The default light theme with Sapphire Blue primary and Lime Green accent.
 * Clean, professional, and optimized for readability.
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
// LIGHT THEME COLORS - ClassBridge Brand
// ============================================================================

export const lightColors: ThemeColors = {
  // Primary - ClassBridge Blue
  primary: {
    50: '#E8F4FD',
    100: '#D1E9FB',
    200: '#A3D3F7',
    300: '#75BDF3',
    400: '#47A7EF',
    500: '#2678BE',  // ClassBridge Brand Blue
    600: '#2678BE',  // Main brand color
    700: '#1E5F98',
    800: '#164672',
    900: '#0E2D4C',
    950: '#071626',
    main: '#2678BE',
  },

  // Secondary - Light Blue
  secondary: {
    50: '#F0F7FF',
    100: '#E0EFFF',
    200: '#B8DCFF',
    300: '#8AC7FF',
    400: '#5CB2FF',
    500: '#3B9EF5',
    600: '#2678BE',
    700: '#1E5F98',
    800: '#164672',
    900: '#0E2D4C',
    950: '#071626',
    main: '#3B9EF5',
  },

  // Accent - Emerald Green
  accent: {
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

  // Error - Red
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
    main: '#ef4444',
  },

  // Info - ClassBridge Blue
  info: {
    50: '#E8F4FD',
    100: '#D1E9FB',
    200: '#A3D3F7',
    300: '#75BDF3',
    400: '#47A7EF',
    500: '#2678BE',
    600: '#2678BE',
    700: '#1E5F98',
    800: '#164672',
    900: '#0E2D4C',
    950: '#071626',
    main: '#2678BE',
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
    secondary: '#F5F7FA',
    tertiary: '#F3F4F6',
    quaternary: '#eff6ff',
    elevated: '#FFFFFF',
    app: '#F5F7FA',
    dark: '#0B1A3C',
    glass: 'rgba(255, 255, 255, 0.9)',
    default: '#F5F7FA',
    light: '#FFFFFF',
    paper: '#FFFFFF',
    card: '#FFFFFF',
  },

  // Surfaces
  surface: {
    primary: '#FFFFFF',
    secondary: '#F5F7FA',
    tertiary: '#F3F4F6',
    elevated: '#FFFFFF',
    overlay: 'rgba(11, 26, 60, 0.6)',
    glass: 'rgba(255, 255, 255, 0.95)',
    dark: '#0B1A3C',
    light: '#F5F7FA',
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
    accent: '#2678BE',
  },

  // Borders
  border: {
    light: '#E5E7EB',
    DEFAULT: '#D1D5DB',
    dark: '#9CA3AF',
    accent: '#2678BE',
  },

  // Gradients - ClassBridge Brand
  gradient: {
    primary: ['#2678BE', '#3B9EF5', '#5CB2FF'],
    secondary: ['#3B9EF5', '#5CB2FF', '#8AC7FF'],
    success: ['#10B981', '#34D399', '#6EE7B7'],
    warning: ['#F59E0B', '#FBBF24', '#FCD34D'],
    sunset: ['#2678BE', '#3B9EF5', '#5CB2FF'],
    ocean: ['#164672', '#2678BE', '#3B9EF5'],
    forest: ['#059669', '#10B981', '#34D399'],
    cosmic: ['#164672', '#2678BE', '#5CB2FF'],
  },

  // Education
  education: {
    math: '#2678BE',
    science: '#10B981',
    english: '#3B9EF5',
    history: '#EF4444',
    art: '#EC4899',
    music: '#A855F7',
    sports: '#2678BE',
    library: '#3B9EF5',
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

