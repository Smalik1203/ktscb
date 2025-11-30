/**
 * ClassBridge Design System
 * 
 * THIS FILE IS FOR BACKWARD COMPATIBILITY.
 * All design tokens are now managed in src/theme/
 * 
 * New code should import from:
 * - '@/theme' for theme types and tokens
 * - '@/contexts/ThemeContext' for useTheme hook
 * 
 * @deprecated Import from '@/theme' instead
 */

// Re-export everything from the new theme system
export {
  // Theme hooks
  useTheme,
  useThemeColors,
  useIsDarkMode,
  ThemeProvider,
  // Legacy color exports
  lightColors,
  darkColors,
} from '../src/contexts/ThemeContext';

export type { ThemeColors } from '../src/theme/types';

// Re-export tokens from the new theme system
export {
  // Spacing
  spacing,
  createSpacing,
  scaleSpacing,
  // Typography
  typography,
  createTypography,
  scaleFont,
  // Border radius
  borderRadius,
  // Shadows
  shadows,
  createShadows,
  // Animation
  animation,
  // Layout
  layout,
  createLayout,
  // Responsive
  responsive,
  breakpoints,
  // Helpers
  createGradient,
} from '../src/theme/tokens';

// Re-export static color palette for legacy code
// This is the light theme colors as static values - ClassBridge Brand
export const colors = {
  primary: {
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
  },
  neutral: {
    50: '#fafafa',
    100: '#F5F7FA',
    200: '#e5e7eb',
    300: '#D1D5DB',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1A1A2E',
    900: '#1f2937',
    950: '#030712',
  },
  background: {
    primary: '#FFFFFF',
    secondary: '#F5F7FA',
    tertiary: '#F3F4F6',
    quaternary: '#E8F4FD',
    dark: '#0E2D4C',
    app: '#F5F7FA',
    elevated: '#FFFFFF',
    glass: 'rgba(255, 255, 255, 0.9)',
    default: '#F5F7FA',
    light: '#FFFFFF',
    paper: '#FFFFFF',
    card: '#FFFFFF',
  },
  surface: {
    primary: '#FFFFFF',
    secondary: '#F5F7FA',
    tertiary: '#F3F4F6',
    elevated: '#FFFFFF',
    overlay: 'rgba(14, 45, 76, 0.6)',
    glass: 'rgba(255, 255, 255, 0.95)',
    dark: '#0E2D4C',
    light: '#F5F7FA',
    paper: '#FFFFFF',
  },
  border: {
    light: '#E5E7EB',
    DEFAULT: '#D1D5DB',
    dark: '#9CA3AF',
    accent: '#2678BE',
  },
  text: {
    primary: '#1A1A2E',
    secondary: '#4A4A5A',
    tertiary: '#6B7280',
    quaternary: '#9CA3AF',
    inverse: '#FFFFFF',
    disabled: '#D1D5DB',
    accent: '#2678BE',
  },
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
};

// Legacy component styles (for backward compatibility - ClassBridge brand)
export const componentStyles = {
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: 12,
    padding: 24,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardElevated: {
    backgroundColor: colors.surface.elevated,
    borderRadius: 12,
    padding: 24,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGlass: {
    backgroundColor: colors.surface.glass,
    borderRadius: 12,
    padding: 24,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  button: {
    primary: {
      backgroundColor: colors.primary.main,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 8,
    },
    secondary: {
      backgroundColor: '#FFFFFF',
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary.main,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary.main,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 8,
    },
    ghost: {
      backgroundColor: 'transparent',
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 8,
    },
    destructive: {
      backgroundColor: colors.error.main,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 8,
    },
    disabled: {
      backgroundColor: colors.neutral[200],
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 8,
      opacity: 0.5,
    },
  },
  input: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 48,
  },
  inputFocused: {
    backgroundColor: colors.surface.primary,
    borderWidth: 2,
    borderColor: colors.primary[600],
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 48,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 9999,
    alignSelf: 'flex-start' as const,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: colors.primary[100],
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: colors.primary[100],
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};

// Legacy layout tokens
export const layoutTokens = {
  container: {
    padding: 24,
    maxWidth: 1200,
  },
  section: {
    marginBottom: 32,
  },
  grid: {
    gap: 16,
  },
  stack: {
    gap: 8,
  },
  stackLarge: {
    gap: 24,
  },
};
