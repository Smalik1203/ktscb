/**
 * Theme Exports
 * 
 * Central export for all available themes.
 */

export { lightTheme, lightColors } from './light';
export { darkTheme, darkColors } from './dark';
export { schoolATheme, schoolAColors } from './schoolA';
export { schoolBTheme, schoolBColors } from './schoolB';

import { lightTheme } from './light';
import { darkTheme } from './dark';
import { schoolATheme } from './schoolA';
import { schoolBTheme } from './schoolB';
import type { Theme, ThemeId } from '../types';

/** Map of all available themes */
export const themes: Record<Exclude<ThemeId, 'system'>, Theme> = {
  light: lightTheme,
  dark: darkTheme,
  schoolA: schoolATheme,
  schoolB: schoolBTheme,
};

/** Get theme by ID */
export const getTheme = (id: Exclude<ThemeId, 'system'>): Theme => {
  return themes[id] || lightTheme;
};

/** List of available theme IDs */
export const availableThemes: Array<{ id: ThemeId; name: string; isDark: boolean }> = [
  { id: 'light', name: 'Light', isDark: false },
  { id: 'dark', name: 'Dark', isDark: true },
  { id: 'schoolA', name: 'Emerald Academic', isDark: false },
  { id: 'schoolB', name: 'Maroon Traditional', isDark: false },
  { id: 'system', name: 'System', isDark: false },
];

