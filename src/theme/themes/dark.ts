/**
 * ClassBridge Dark Theme
 * 
 * Dark Mode Best Practices Applied:
 * 1. Dark gray (#0F0F0F) instead of pure black - reduces eye strain
 * 2. Off-white (#F5F5F5) text instead of pure white - softer contrast
 * 3. Desaturated accent colors - prevents color vibration
 * 4. Elevation through lighter surfaces, not shadows
 * 5. Subtle borders instead of shadows for depth
 * 6. Maintains WCAG 4.5:1 contrast ratio
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
// DARK THEME COLORS - ClassBridge Brand
// ============================================================================

export const darkColors: ThemeColors = {
  // Primary - ClassBridge Blue (lighter for dark backgrounds)
  primary: {
    50: '#0E2D4C',
    100: '#164672',
    200: '#1E5F98',
    300: '#2678BE',
    400: '#3B9EF5',
    500: '#5CB2FF',
    600: '#7AC4FF',
    700: '#99D3FF',
    800: '#B8E2FF',
    900: '#D6F0FF',
    950: '#EBF7FF',
    main: '#5CB2FF',
  },

  // Secondary
  secondary: {
    50: '#0E2D4C',
    100: '#164672',
    200: '#1E5F98',
    300: '#2678BE',
    400: '#3B9EF5',
    500: '#5CB2FF',
    600: '#7AC4FF',
    700: '#99D3FF',
    800: '#B8E2FF',
    900: '#D6F0FF',
    950: '#EBF7FF',
    main: '#7AC4FF',
  },

  // Accent - Emerald (desaturated for dark)
  accent: {
    50: '#022C22',
    100: '#064E3B',
    200: '#065F46',
    300: '#047857',
    400: '#059669',
    500: '#10B981',
    600: '#34D399',
    700: '#6EE7B7',
    800: '#A7F3D0',
    900: '#D1FAE5',
    950: '#ECFDF5',
    main: '#34D399',
  },

  // Success - Emerald (desaturated for dark)
  success: {
    50: '#022C22',
    100: '#064E3B',
    200: '#065F46',
    300: '#047857',
    400: '#059669',
    500: '#10B981',
    600: '#34D399',
    700: '#6EE7B7',
    800: '#A7F3D0',
    900: '#D1FAE5',
    950: '#ECFDF5',
    main: '#34D399',
  },

  // Warning - Desaturated amber
  warning: {
    50: '#2e2a1a',
    100: '#3d351f',
    200: '#5a4f2d',
    300: '#7a6a3d',
    400: '#9a875a',
    500: '#D4A656',
    600: '#E4BA6B',
    700: '#F0CE8C',
    800: '#F8E0B0',
    900: '#FCF0D4',
    950: '#FEF8EC',
    main: '#E4BA6B',
  },

  // Error - Desaturated red
  error: {
    50: '#2e1a1a',
    100: '#3d1f1f',
    200: '#5a2d2d',
    300: '#7a3d3d',
    400: '#9a5a5a',
    500: '#E06B6B',
    600: '#EB8585',
    700: '#F5A8A8',
    800: '#FAC8C8',
    900: '#FDE8E8',
    950: '#FEF4F4',
    main: '#EB8585',
  },

  // Info - ClassBridge Blue
  info: {
    50: '#0E2D4C',
    100: '#164672',
    200: '#1E5F98',
    300: '#2678BE',
    400: '#3B9EF5',
    500: '#5CB2FF',
    600: '#7AC4FF',
    700: '#99D3FF',
    800: '#B8E2FF',
    900: '#D6F0FF',
    950: '#EBF7FF',
    main: '#5CB2FF',
  },

  // Neutral - Inverted scale for dark mode
  neutral: {
    50: '#2A2A2A',
    100: '#333333',
    200: '#404040',
    300: '#525252',
    400: '#6B6B6B',
    500: '#858585',
    600: '#9E9E9E',
    700: '#B8B8B8',
    800: '#D1D1D1',
    900: '#EBEBEB',
    950: '#F5F5F5',
    main: '#858585',
  },

  // Backgrounds - Dark grays, NOT pure black
  background: {
    primary: '#0F0F0F',
    secondary: '#1A1A1A',
    tertiary: '#242424',
    quaternary: '#1a2744',
    elevated: '#1A1A1A',
    app: '#0F0F0F',
    dark: '#000000',
    glass: 'rgba(15, 15, 15, 0.9)',
    default: '#0F0F0F',
    light: '#1A1A1A',
    paper: '#1A1A1A',
    card: '#1E1E1E',
  },

  // Surfaces - Elevation through lighter colors
  surface: {
    primary: '#0F0F0F',
    secondary: '#1A1A1A',
    tertiary: '#242424',
    elevated: '#1E1E1E',
    overlay: 'rgba(0, 0, 0, 0.7)',
    glass: 'rgba(26, 26, 26, 0.95)',
    dark: '#000000',
    light: '#242424',
    paper: '#1A1A1A',
  },

  // Text - Off-white for comfort
  text: {
    primary: '#F5F5F5',
    secondary: '#B3B3B3',
    tertiary: '#808080',
    quaternary: '#666666',
    inverse: '#0F0F0F',
    disabled: '#4A4A4A',
    accent: '#5CB2FF',
  },

  // Borders - Subtle borders for depth
  border: {
    light: '#2A2A2A',
    DEFAULT: '#3A3A3A',
    dark: '#4A4A4A',
    accent: '#5CB2FF',
  },

  // Gradients - ClassBridge brand for dark mode
  gradient: {
    primary: ['#1E5F98', '#2678BE', '#5CB2FF'],
    secondary: ['#2678BE', '#3B9EF5', '#7AC4FF'],
    success: ['#047857', '#10B981', '#34D399'],
    warning: ['#B45309', '#F59E0B', '#FBBF24'],
    sunset: ['#0E2D4C', '#2678BE', '#5CB2FF'],
    ocean: ['#0E2D4C', '#1E5F98', '#3B9EF5'],
    forest: ['#064E3B', '#059669', '#34D399'],
    cosmic: ['#0E2D4C', '#2678BE', '#7AC4FF'],
  },

  // Education - ClassBridge brand for dark mode
  education: {
    math: '#5CB2FF',
    science: '#34D399',
    english: '#7AC4FF',
    history: '#EB8585',
    art: '#F472B6',
    music: '#C084FC',
    sports: '#5CB2FF',
    library: '#7AC4FF',
  },

  statusBar: 'light',
};

// ============================================================================
// COMPONENT STYLES
// ============================================================================

const spacing = createSpacing();
const shadows = createShadows(darkColors.primary.main);

const createComponentStyles = (): ComponentStyles => ({
  card: {
    backgroundColor: darkColors.surface.elevated,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: darkColors.border.light,
  },
  cardElevated: {
    backgroundColor: darkColors.surface.tertiary,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: darkColors.border.light,
  },
  cardGlass: {
    backgroundColor: darkColors.surface.glass,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: darkColors.border.light,
  },
  button: {
    primary: {
      backgroundColor: darkColors.primary.main,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    secondary: {
      backgroundColor: darkColors.surface.secondary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      borderWidth: 1,
      borderColor: darkColors.primary.main,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: darkColors.primary.main,
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
      backgroundColor: darkColors.error.main,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
    },
    disabled: {
      backgroundColor: darkColors.neutral[200],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.button,
      opacity: 0.5,
    },
  },
  input: {
    backgroundColor: darkColors.surface.secondary,
    borderWidth: 1,
    borderColor: darkColors.border.DEFAULT,
    borderRadius: borderRadius.input,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  inputFocused: {
    backgroundColor: darkColors.surface.secondary,
    borderWidth: 2,
    borderColor: darkColors.primary.main,
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
    backgroundColor: darkColors.neutral[100],
    borderWidth: 1,
    borderColor: darkColors.border.light,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: darkColors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: darkColors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ============================================================================
// EXPORT COMPLETE THEME
// ============================================================================

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark',
  isDark: true,
  colors: darkColors,
  typography: createTypography(),
  spacing: createSpacing(),
  borderRadius,
  shadows: createShadows(darkColors.primary.main),
  animation,
  layout: createLayout(),
  responsive,
  components: createComponentStyles(),
};

export default darkTheme;

