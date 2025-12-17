/**
 * Krishnaveni Talent School Design System
 * 
 * THIS FILE IS FOR BACKWARD COMPATIBILITY.
 * All design tokens are now managed in src/theme/
 * 
 * New code should import from:
 * - '@/theme' for theme types and tokens
 * - '@/contexts/ThemeContext' for useTheme hook
 * 
 * Brand: "Mentored for Life"
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
// This is the light theme colors as static values - KTS Brand (Purple & Orange)
export const colors = {
  primary: {
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
  secondary: {
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
  accent: {
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
    secondary: '#FAF8FC',
    tertiary: '#F5F0FA',
    quaternary: '#EBE0F5',
    dark: '#2A173D',
    app: '#FAF8FC',
    elevated: '#FFFFFF',
    glass: 'rgba(255, 255, 255, 0.9)',
    default: '#FAF8FC',
    light: '#FFFFFF',
    paper: '#FFFFFF',
    card: '#FFFFFF',
  },
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
  border: {
    light: '#EBE0F5',
    DEFAULT: '#D6C2EB',
    dark: '#9B6BC9',
    accent: '#6B3FA0',
  },
  text: {
    primary: '#1A1A2E',
    secondary: '#4A4A5A',
    tertiary: '#6B7280',
    quaternary: '#9CA3AF',
    inverse: '#FFFFFF',
    disabled: '#D1D5DB',
    accent: '#6B3FA0',
  },
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
};

// Legacy component styles (for backward compatibility - KTS brand)
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
