/**
 * Krishnaveni Talent School Dark Theme
 * 
 * Dark Mode Best Practices Applied:
 * 1. Dark gray (#0F0F0F) instead of pure black - reduces eye strain
 * 2. Off-white (#F5F5F5) text instead of pure white - softer contrast
 * 3. Desaturated accent colors - prevents color vibration
 * 4. Elevation through lighter surfaces, not shadows
 * 5. Subtle borders instead of shadows for depth
 * 6. Maintains WCAG 4.5:1 contrast ratio
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
// DARK THEME COLORS - KTS Brand (Purple & Orange)
// ============================================================================

export const darkColors: ThemeColors = {
  // Primary - KTS Purple (lighter for dark backgrounds)
  primary: {
    50: '#2A173D',
    100: '#3A2156',
    200: '#4A2B6E',
    300: '#5A3587',
    400: '#6B3FA0',
    500: '#9B6BC9',
    600: '#B48AD9',
    700: '#C9A8E6',
    800: '#DEC6F2',
    900: '#EBE0F5',
    950: '#F5F0FA',
    main: '#9B6BC9',
  },

  // Secondary - KTS Golden Orange
  secondary: {
    50: '#704A0D',
    100: '#8C5D11',
    200: '#A87016',
    300: '#C4831B',
    400: '#E09620',
    500: '#F5A623',
    600: '#FFBF5C',
    700: '#FFCF85',
    800: '#FFDFAD',
    900: '#FFEFD6',
    950: '#FFF8EB',
    main: '#FFBF5C',
  },

  // Accent - KTS Crimson (desaturated for dark)
  accent: {
    50: '#450A0A',
    100: '#7F1D1D',
    200: '#991B1B',
    300: '#B91C1C',
    400: '#DC2626',
    500: '#E74C3C',
    600: '#F87171',
    700: '#FCA5A5',
    800: '#FECACA',
    900: '#FEE2E2',
    950: '#FEF2F2',
    main: '#F87171',
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

  // Warning - KTS Golden Orange (desaturated for dark)
  warning: {
    50: '#704A0D',
    100: '#8C5D11',
    200: '#A87016',
    300: '#C4831B',
    400: '#E09620',
    500: '#F5A623',
    600: '#FFBF5C',
    700: '#FFCF85',
    800: '#FFDFAD',
    900: '#FFEFD6',
    950: '#FFF8EB',
    main: '#FFBF5C',
  },

  // Error - KTS Crimson (desaturated for dark)
  error: {
    50: '#450A0A',
    100: '#7F1D1D',
    200: '#991B1B',
    300: '#B91C1C',
    400: '#DC2626',
    500: '#E74C3C',
    600: '#F87171',
    700: '#FCA5A5',
    800: '#FECACA',
    900: '#FEE2E2',
    950: '#FEF2F2',
    main: '#F87171',
  },

  // Info - KTS Purple
  info: {
    50: '#2A173D',
    100: '#3A2156',
    200: '#4A2B6E',
    300: '#5A3587',
    400: '#6B3FA0',
    500: '#9B6BC9',
    600: '#B48AD9',
    700: '#C9A8E6',
    800: '#DEC6F2',
    900: '#EBE0F5',
    950: '#F5F0FA',
    main: '#9B6BC9',
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
    accent: '#9B6BC9',
  },

  // Borders - Subtle borders for depth
  border: {
    light: '#2A2A2A',
    DEFAULT: '#3A3A3A',
    dark: '#4A4A4A',
    accent: '#9B6BC9',
  },

  // Gradients - KTS brand for dark mode
  gradient: {
    primary: ['#5A3587', '#6B3FA0', '#9B6BC9'],
    secondary: ['#E09620', '#F5A623', '#FFBF5C'],
    success: ['#047857', '#10B981', '#34D399'],
    warning: ['#C4831B', '#F5A623', '#FFBF5C'],
    sunset: ['#5A3587', '#E74C3C', '#F5A623'],
    ocean: ['#2A173D', '#5A3587', '#9B6BC9'],
    forest: ['#064E3B', '#059669', '#34D399'],
    cosmic: ['#2A173D', '#6B3FA0', '#FFBF5C'],
  },

  // Education - KTS brand for dark mode
  education: {
    math: '#9B6BC9',
    science: '#34D399',
    english: '#FFBF5C',
    history: '#F87171',
    art: '#F472B6',
    music: '#B48AD9',
    sports: '#FFBF5C',
    library: '#9B6BC9',
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

