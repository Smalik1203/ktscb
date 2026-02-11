/**
 * School-Customized Theme Generator
 * 
 * Creates themes with school-specific branding colors.
 * Colors are passed from app.config.js via Constants.expoConfig.extra.school
 */

import Constants from 'expo-constants';
import { lightTheme } from './themes/light';
import { darkTheme } from './themes/dark';
import type { Theme, ThemeColors } from './types';

// School branding from build config
interface SchoolBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
}

interface SchoolConfig {
  code: string;
  name: string;
  branding?: SchoolBranding;
}

/**
 * Get school config from Expo Constants (set at build time)
 */
export function getSchoolConfig(): SchoolConfig | null {
  try {
    const extra = Constants.expoConfig?.extra;
    if (extra?.school) {
      return extra.school as SchoolConfig;
    }
  } catch (error) {
    // School config not available - use defaults
  }
  return null;
}

/**
 * Generate a color palette from a single hex color
 * Creates lighter and darker variants
 */
function generateColorPalette(baseColor: string): Record<string, string> {
  // Simple palette generation - in production you might use a library like chroma-js
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const lighten = (amount: number) => {
    const newR = Math.min(255, Math.round(r + (255 - r) * amount));
    const newG = Math.min(255, Math.round(g + (255 - g) * amount));
    const newB = Math.min(255, Math.round(b + (255 - b) * amount));
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  const darken = (amount: number) => {
    const newR = Math.max(0, Math.round(r * (1 - amount)));
    const newG = Math.max(0, Math.round(g * (1 - amount)));
    const newB = Math.max(0, Math.round(b * (1 - amount)));
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  return {
    50: lighten(0.95),
    100: lighten(0.9),
    200: lighten(0.7),
    300: lighten(0.5),
    400: lighten(0.25),
    500: baseColor,
    600: baseColor,
    700: darken(0.15),
    800: darken(0.3),
    900: darken(0.45),
    950: darken(0.6),
    main: baseColor,
  };
}

/**
 * Apply school branding to a base theme
 */
function applySchoolBranding(baseTheme: Theme, branding: SchoolBranding): Theme {
  const colors: ThemeColors = { ...baseTheme.colors };

  // Override primary color palette
  if (branding.primaryColor) {
    colors.primary = {
      ...colors.primary,
      ...generateColorPalette(branding.primaryColor),
    };
    colors.info = {
      ...colors.info,
      ...generateColorPalette(branding.primaryColor),
    };
    colors.text = {
      ...colors.text,
      accent: branding.primaryColor,
    };
    colors.border = {
      ...colors.border,
      accent: branding.primaryColor,
    };
  }

  // Override secondary color palette
  if (branding.secondaryColor) {
    colors.secondary = {
      ...colors.secondary,
      ...generateColorPalette(branding.secondaryColor),
    };
    colors.warning = {
      ...colors.warning,
      ...generateColorPalette(branding.secondaryColor),
    };
  }

  // Override accent color palette
  if (branding.accentColor) {
    colors.accent = {
      ...colors.accent,
      ...generateColorPalette(branding.accentColor),
    };
    colors.error = {
      ...colors.error,
      ...generateColorPalette(branding.accentColor),
    };
  }

  // Override background color
  if (branding.backgroundColor && !baseTheme.isDark) {
    colors.background = {
      ...colors.background,
      primary: branding.backgroundColor,
      elevated: branding.backgroundColor,
      light: branding.backgroundColor,
      paper: branding.backgroundColor,
      card: branding.backgroundColor,
    };
    colors.surface = {
      ...colors.surface,
      primary: branding.backgroundColor,
      elevated: branding.backgroundColor,
      paper: branding.backgroundColor,
    };
  }

  // Update gradients with new primary/secondary
  if (branding.primaryColor || branding.secondaryColor) {
    const primaryMain = branding.primaryColor || colors.primary.main;
    const secondaryMain = branding.secondaryColor || colors.secondary.main;
    
    colors.gradient = {
      ...colors.gradient,
      primary: [primaryMain, colors.primary[400], colors.primary[300]],
      secondary: [secondaryMain, colors.secondary[400], colors.secondary[300]],
      sunset: [primaryMain, colors.accent.main, secondaryMain],
      cosmic: [colors.primary[950], primaryMain, secondaryMain],
    };
  }

  return {
    ...baseTheme,
    colors,
  };
}

/**
 * Get the school-customized light theme
 */
export function getSchoolLightTheme(): Theme {
  const schoolConfig = getSchoolConfig();
  
  if (schoolConfig?.branding) {
    return applySchoolBranding(lightTheme, schoolConfig.branding);
  }
  
  return lightTheme;
}

/**
 * Get the school-customized dark theme
 */
export function getSchoolDarkTheme(): Theme {
  const schoolConfig = getSchoolConfig();
  
  if (schoolConfig?.branding) {
    // For dark theme, we apply branding but keep dark backgrounds
    const brandedTheme = applySchoolBranding(darkTheme, {
      ...schoolConfig.branding,
      backgroundColor: undefined, // Don't override dark background
    });
    return brandedTheme;
  }
  
  return darkTheme;
}

/**
 * Get school name from config
 */
export function getSchoolName(): string {
  const schoolConfig = getSchoolConfig();
  return schoolConfig?.name || 'School';
}

/**
 * Get school code from config
 */
export function getSchoolCode(): string {
  const schoolConfig = getSchoolConfig();
  return schoolConfig?.code || 'SCHOOL';
}
