/**
 * Theme Exports
 * 
 * Central export for all available themes.
 * Supports school-customized themes from build config.
 */

import { lightTheme } from './light';
import { darkTheme } from './dark';
import { schoolATheme } from './schoolA';
import { schoolBTheme } from './schoolB';
import { getSchoolLightTheme, getSchoolDarkTheme } from '../schoolTheme';
import type { Theme, ThemeId } from '../types';

export { lightTheme, lightColors } from './light';
export { darkTheme, darkColors } from './dark';
export { schoolATheme, schoolAColors } from './schoolA';
export { schoolBTheme, schoolBColors } from './schoolB';

/** 
 * Get themes with school branding applied
 * School branding is set at build time via SCHOOL env var
 */
const getSchoolBrandedThemes = (): Record<Exclude<ThemeId, 'system'>, Theme> => {
  try {
    const brandedLight = getSchoolLightTheme();
    const brandedDark = getSchoolDarkTheme();
    return {
      light: brandedLight,
      dark: brandedDark,
      schoolA: schoolATheme,
      schoolB: schoolBTheme,
    };
  } catch (_e) {
    return {
      light: lightTheme,
      dark: darkTheme,
      schoolA: schoolATheme,
      schoolB: schoolBTheme,
    };
  }
};

// Cache branded themes (computed once at startup)
let _cachedThemes: Record<Exclude<ThemeId, 'system'>, Theme> | null = null;

/** Map of all available themes (with school branding) */
export const themes: Record<Exclude<ThemeId, 'system'>, Theme> = (() => {
  if (!_cachedThemes) {
    _cachedThemes = getSchoolBrandedThemes();
  }
  return _cachedThemes;
})();

/** Get theme by ID (with school branding) */
export const getTheme = (id: Exclude<ThemeId, 'system'>): Theme => {
  if (!_cachedThemes) {
    _cachedThemes = getSchoolBrandedThemes();
  }
  return _cachedThemes[id] || _cachedThemes.light;
};

/** List of available theme IDs */
export const availableThemes: { id: ThemeId; name: string; isDark: boolean }[] = [
  { id: 'light', name: 'Light', isDark: false },
  { id: 'dark', name: 'Dark', isDark: true },
  { id: 'schoolA', name: 'Emerald Academic', isDark: false },
  { id: 'schoolB', name: 'Maroon Traditional', isDark: false },
  { id: 'system', name: 'System', isDark: false },
];

