/**
 * ClassBridge Theme System
 * 
 * Centralized theme exports for the entire application.
 * 
 * Usage:
 * ```tsx
 * import { useTheme, Theme, ThemeId } from '@/theme';
 * 
 * const MyComponent = () => {
 *   const { theme, colors, spacing, setTheme } = useTheme();
 *   
 *   return (
 *     <View style={{ backgroundColor: colors.background.app, padding: spacing.md }}>
 *       <Button onPress={() => setTheme('dark')}>Switch to Dark</Button>
 *     </View>
 *   );
 * };
 * ```
 */

// Types
export type {
  Theme,
  ThemeId,
  ThemeContextValue,
  ThemeColors,
  ColorScale,
  BackgroundColors,
  SurfaceColors,
  TextColors,
  BorderColors,
  GradientColors,
  EducationColors,
  Typography,
  TypographyVariant,
  TypographyVariants,
  FontFamily,
  FontSizes,
  FontWeights,
  LineHeights,
  LetterSpacing,
  Spacing,
  BorderRadius,
  Shadows,
  ShadowStyle,
  Animation,
  AnimationDurations,
  AnimationEasing,
  AnimationSprings,
  SpringConfig,
  Layout,
  MaxWidths,
  ContainerConfig,
  Breakpoints,
  Responsive,
  ComponentStyles,
  ButtonStyles,
  PartialTheme,
  ThemeCreator,
} from './types';

// Tokens
export {
  breakpoints,
  responsive,
  spacing,
  borderRadius,
  typography,
  shadows,
  animation,
  layout,
  scaleFont,
  scaleSpacing,
  createSpacing,
  createTypography,
  createShadows,
  createLayout,
  createGradient,
} from './tokens';

// Themes
export {
  themes,
  getTheme,
  availableThemes,
  lightTheme,
  lightColors,
  darkTheme,
  darkColors,
  schoolATheme,
  schoolAColors,
  schoolBTheme,
  schoolBColors,
} from './themes';

