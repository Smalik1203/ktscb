/**
 * Krishnaveni Talent School Theme Context
 * 
 * Provides theme management for the entire application with:
 * - Dynamic theme switching (light, dark, per-school themes)
 * - System theme detection and auto-switching
 * - Persistent theme preference storage
 * - Convenient shortcuts for common theme values
 * 
 * Brand: "Mentored for Life"
 * 
 * Usage:
 * ```tsx
 * import { useTheme, ThemeProvider } from '@/contexts/ThemeContext';
 * 
 * // In your component
 * const { theme, colors, spacing, setTheme, toggleTheme } = useTheme();
 * 
 * // Access values
 * <View style={{ backgroundColor: colors.background.app, padding: spacing.md }}>
 *   <Text style={{ color: colors.text.primary }}>Hello</Text>
 * </View>
 * 
 * // Switch themes
 * <Button onPress={() => setTheme('dark')} title="Dark Mode" />
 * <Button onPress={() => setTheme('schoolA')} title="Purple Theme" />
 * <Button onPress={toggleTheme} title="Toggle Light/Dark" />
 * ```
 */

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Theme, ThemeId, ThemeContextValue, ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../theme/types';
import { getTheme, lightTheme, darkTheme } from '../theme/themes';

// Storage key for persisted theme preference
const THEME_STORAGE_KEY = '@kts_theme_preference';

// ============================================================================
// CONTEXT
// ============================================================================

// Create default context value using light theme
const defaultContextValue: ThemeContextValue = {
  theme: lightTheme,
  themeId: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
  colors: lightTheme.colors,
  typography: lightTheme.typography,
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
  shadows: lightTheme.shadows,
  animation: lightTheme.animation,
};

const ThemeContext = createContext<ThemeContextValue>(defaultContextValue);

// ============================================================================
// PROVIDER
// ============================================================================

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Initial theme to use (overrides stored preference) */
  initialTheme?: ThemeId;
  /** Disable system theme detection */
  disableSystemTheme?: boolean;
}

export function ThemeProvider({ 
  children, 
  initialTheme,
  disableSystemTheme = false 
}: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [themeId, setThemeId] = useState<ThemeId>(initialTheme || 'system');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        if (!initialTheme) {
          const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
          if (stored && isValidThemeId(stored)) {
            setThemeId(stored as ThemeId);
          }
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, [initialTheme]);

  // Validate theme ID
  const isValidThemeId = (id: string): id is ThemeId => {
    return ['light', 'dark', 'schoolA', 'schoolB', 'system'].includes(id);
  };

  // Resolve the actual theme based on themeId and system preference
  const resolvedTheme = useMemo((): Theme => {
    if (themeId === 'system' && !disableSystemTheme) {
      return systemColorScheme === 'dark' ? darkTheme : lightTheme;
    }
    return getTheme(themeId === 'system' ? 'light' : themeId);
  }, [themeId, systemColorScheme, disableSystemTheme]);

  // Set theme with persistence
  const setTheme = useCallback(async (newThemeId: ThemeId) => {
    setThemeId(newThemeId);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newThemeId);
    } catch (error) {
      console.warn('Failed to persist theme preference:', error);
    }
  }, []);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newThemeId = resolvedTheme.isDark ? 'light' : 'dark';
    setTheme(newThemeId);
  }, [resolvedTheme.isDark, setTheme]);

  // Build context value
  const value = useMemo<ThemeContextValue>(() => ({
    theme: resolvedTheme,
    themeId,
    isDark: resolvedTheme.isDark,
    setTheme,
    toggleTheme,
    // Shortcuts for common values
    colors: resolvedTheme.colors,
    typography: resolvedTheme.typography,
    spacing: resolvedTheme.spacing,
    borderRadius: resolvedTheme.borderRadius,
    shadows: resolvedTheme.shadows,
    animation: resolvedTheme.animation,
  }), [resolvedTheme, themeId, setTheme, toggleTheme]);

  // Don't render until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Main hook to access the theme context.
 * Provides access to the full theme object plus convenient shortcuts.
 * 
 * @example
 * ```tsx
 * const { theme, colors, spacing, setTheme } = useTheme();
 * ```
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Get just the colors from the current theme.
 * 
 * @example
 * ```tsx
 * const colors = useThemeColors();
 * <View style={{ backgroundColor: colors.primary.main }} />
 * ```
 */
export function useThemeColors(): ThemeColors {
  const { colors } = useTheme();
  return colors;
}

/**
 * Get just the typography from the current theme.
 * 
 * @example
 * ```tsx
 * const typography = useTypography();
 * <Text style={{ fontSize: typography.fontSize.lg }} />
 * ```
 */
export function useTypography(): Typography {
  const { typography } = useTheme();
  return typography;
}

/**
 * Get just the spacing from the current theme.
 * 
 * @example
 * ```tsx
 * const spacing = useSpacing();
 * <View style={{ padding: spacing.md, marginBottom: spacing.lg }} />
 * ```
 */
export function useSpacing(): Spacing {
  const { spacing } = useTheme();
  return spacing;
}

/**
 * Get just the border radius values from the current theme.
 * 
 * @example
 * ```tsx
 * const borderRadius = useBorderRadius();
 * <View style={{ borderRadius: borderRadius.card }} />
 * ```
 */
export function useBorderRadius(): BorderRadius {
  const { borderRadius } = useTheme();
  return borderRadius;
}

/**
 * Get just the shadows from the current theme.
 * 
 * @example
 * ```tsx
 * const shadows = useShadows();
 * <View style={{ ...shadows.md }} />
 * ```
 */
export function useShadows(): Shadows {
  const { shadows } = useTheme();
  return shadows;
}

/**
 * Check if dark mode is active.
 * 
 * @example
 * ```tsx
 * const isDark = useIsDarkMode();
 * const iconColor = isDark ? '#fff' : '#000';
 * ```
 */
export function useIsDarkMode(): boolean {
  const { isDark } = useTheme();
  return isDark;
}

/**
 * Get the theme setter function.
 * 
 * @example
 * ```tsx
 * const setTheme = useSetTheme();
 * <Button onPress={() => setTheme('dark')} title="Dark Mode" />
 * ```
 */
export function useSetTheme(): (id: ThemeId) => void {
  const { setTheme } = useTheme();
  return setTheme;
}

/**
 * Get the theme toggle function.
 * 
 * @example
 * ```tsx
 * const toggleTheme = useToggleTheme();
 * <Button onPress={toggleTheme} title="Toggle Theme" />
 * ```
 */
export function useToggleTheme(): () => void {
  const { toggleTheme } = useTheme();
  return toggleTheme;
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Re-export color types from theme for backward compatibility
export { lightColors } from '../theme/themes/light';
export { darkColors } from '../theme/themes/dark';
export type { ThemeColors } from '../theme/types';

export default ThemeContext;
