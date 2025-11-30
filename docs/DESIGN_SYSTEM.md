# ClassBridge Design System & Theming Architecture

> A comprehensive guide to the design system, theming infrastructure, and multi-school customization capabilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Theme System](#theme-system)
4. [Design Tokens](#design-tokens)
5. [UI Kit Components](#ui-kit-components)
6. [Multi-School Customization](#multi-school-customization)
7. [Implementation Patterns](#implementation-patterns)
8. [Audit Findings](#audit-findings)
9. [Migration Guide](#migration-guide)
10. [Best Practices](#best-practices)

---

## Overview

ClassBridge uses a **token-based design system** with dynamic theming capabilities that supports:

- ✅ **Light/Dark mode** switching
- ✅ **Per-school custom themes** (colors, typography, branding)
- ✅ **Centralized design tokens** (spacing, typography, shadows, etc.)
- ✅ **Reusable UI Kit components**
- ✅ **Theme persistence** via AsyncStorage

### Key Principles

1. **No hardcoded values** - All styling derives from design tokens
2. **Theme-first approach** - Components adapt to any theme automatically
3. **Single source of truth** - Change once, update everywhere
4. **Scalable architecture** - Easy to add new school themes

---

## Architecture

```
src/
├── theme/                    # Theme definitions
│   ├── types.ts              # TypeScript interfaces
│   ├── tokens.ts             # Shared design tokens
│   ├── index.ts              # Main exports
│   └── themes/
│       ├── light.ts          # Light mode colors
│       ├── dark.ts           # Dark mode colors
│       ├── schoolA.ts        # School A custom theme
│       ├── schoolB.ts        # School B custom theme
│       └── index.ts          # Theme exports
│
├── contexts/
│   └── ThemeContext.tsx      # Theme provider & hooks
│
├── ui/                       # UI Kit components
│   ├── index.ts              # Component exports
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Container.tsx
│   ├── Text.tsx              # Heading, Body, Caption, etc.
│   ├── Stack.tsx             # Layout components
│   ├── Badge.tsx
│   ├── Chip.tsx
│   ├── Avatar.tsx
│   ├── ProgressBar.tsx
│   ├── Skeleton.tsx
│   └── ...
│
└── lib/
    └── design-system.ts      # Legacy tokens (re-exports from theme/)
```

---

## Theme System

### ThemeContext

The `ThemeContext` provides theme state and switching capabilities:

```typescript
// src/contexts/ThemeContext.tsx

interface ThemeContextType {
  theme: AppTheme;              // Current theme object
  colors: ThemeColors;          // Current color palette
  isDark: boolean;              // Dark mode flag
  currentThemeName: ThemeName;  // 'light' | 'dark' | 'schoolA' | 'schoolB'
  setTheme: (name: ThemeName) => void;
  toggleTheme: () => void;
}
```

### Available Themes

| Theme | Description | Use Case |
|-------|-------------|----------|
| `light` | Default light mode | Standard users |
| `dark` | Dark mode (OLED-friendly) | Low-light environments |
| `schoolA` | Emerald Academic | School with green/gold branding |
| `schoolB` | Maroon Traditional | School with maroon/cream branding |

### Theme Structure

Each theme exports a `ThemeColors` object:

```typescript
interface ThemeColors {
  primary: ColorShades;      // Main brand color (50-900)
  secondary: ColorShades;    // Secondary accent
  accent: ColorShades;       // Tertiary accent
  success: ColorShades;      // Success states
  warning: ColorShades;      // Warning states
  error: ColorShades;        // Error states
  info: ColorShades;         // Info states
  neutral: ColorShades;      // Grays
  
  background: {
    app: string;             // App background
    primary: string;         // Primary surfaces
    secondary: string;       // Secondary surfaces
    tertiary: string;        // Tertiary surfaces
  };
  
  surface: {
    primary: string;         // Cards, modals
    secondary: string;       // Nested surfaces
    elevated: string;        // Elevated elements
    overlay: string;         // Modal overlays
  };
  
  text: {
    primary: string;         // Main text
    secondary: string;       // Secondary text
    tertiary: string;        // Muted text
    inverse: string;         // Text on dark backgrounds
    disabled: string;        // Disabled text
  };
  
  border: {
    DEFAULT: string;         // Default borders
    light: string;           // Subtle borders
    dark: string;            // Strong borders
  };
}
```

---

## Design Tokens

### Spacing Scale

```typescript
// src/theme/tokens.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};
```

### Typography

```typescript
export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};
```

### Border Radius

```typescript
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
  button: 12,
  card: 16,
  input: 12,
};
```

### Shadows

```typescript
export const shadows = {
  none: {},
  xs: { shadowOpacity: 0.05, elevation: 1, ... },
  sm: { shadowOpacity: 0.1, elevation: 2, ... },
  DEFAULT: { shadowOpacity: 0.1, elevation: 3, ... },
  md: { shadowOpacity: 0.1, elevation: 4, ... },
  lg: { shadowOpacity: 0.15, elevation: 6, ... },
  xl: { shadowOpacity: 0.2, elevation: 8, ... },
};
```

---

## UI Kit Components

### Core Components

| Component | Description | Props |
|-----------|-------------|-------|
| `Container` | Screen wrapper with safe areas | `padding`, `scroll`, `background` |
| `Card` | Content container | `variant`, `padding`, `radius`, `onPress` |
| `Button` | Interactive button | `variant`, `size`, `loading`, `icon` |
| `Input` | Text input field | `label`, `error`, `leftIcon`, `rightIcon` |
| `Badge` | Status indicator | `variant`, `size`, `dot` |
| `Chip` | Selectable tag | `variant`, `selected`, `onDelete` |
| `Avatar` | User representation | `size`, `shape`, `status`, `initials` |

### Typography Components

| Component | Use Case |
|-----------|----------|
| `Heading` | Page/section titles (level 1-6) |
| `Body` | Body text |
| `Caption` | Small helper text |
| `Label` | Form labels |
| `Link` | Clickable text |

### Layout Components

| Component | Description |
|-----------|-------------|
| `Stack` | Vertical flex layout |
| `Row` | Horizontal flex layout |
| `Center` | Centered content |
| `Spacer` | Flexible space |
| `Divider` | Visual separator |
| `SectionBlock` | Content section with title |

### Usage Example

```tsx
import { Container, Card, Heading, Body, Button, Stack, Row } from '../ui';
import { useTheme } from '../contexts/ThemeContext';

function ExampleScreen() {
  const { colors } = useTheme();
  
  return (
    <Container scroll padding="lg">
      <Stack spacing="lg">
        <Heading level={1}>Welcome</Heading>
        <Body color="secondary">This is themed content</Body>
        
        <Card variant="elevated" padding="lg">
          <Stack spacing="md">
            <Heading level={3}>Card Title</Heading>
            <Body>Card content goes here</Body>
            <Row spacing="sm">
              <Button variant="primary">Action</Button>
              <Button variant="outline">Cancel</Button>
            </Row>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
```

---

## Multi-School Customization

### How It Works

1. **Theme files per school** - Each school has a dedicated theme file
2. **Server-driven configuration** - School code determines theme
3. **Runtime switching** - Themes load dynamically based on user's school
4. **Persistence** - Theme preference stored in AsyncStorage

### Adding a New School Theme

1. Create theme file:

```typescript
// src/theme/themes/schoolC.ts
import { ThemeColors } from '../types';

export const schoolCColors: ThemeColors = {
  primary: {
    50: '#FFF5F5',
    100: '#FED7D7',
    // ... full color scale
    600: '#C53030',  // Main brand color
    // ...
  },
  // ... rest of color palette
};
```

2. Register in themes index:

```typescript
// src/theme/themes/index.ts
export { schoolCColors } from './schoolC';
```

3. Add to ThemeContext:

```typescript
// src/contexts/ThemeContext.tsx
const themes = {
  light: lightColors,
  dark: darkColors,
  schoolA: schoolAColors,
  schoolB: schoolBColors,
  schoolC: schoolCColors,  // Add new theme
};
```

### Scaling to 100+ Schools

For large-scale deployment:

```typescript
// Option 1: Lazy loading themes
const loadSchoolTheme = async (schoolCode: string): Promise<ThemeColors> => {
  const response = await fetch(`/api/themes/${schoolCode}`);
  return response.json();
};

// Option 2: Theme generation from brand colors
const generateSchoolTheme = (brandColors: {
  primary: string;
  secondary: string;
  accent: string;
}): ThemeColors => {
  return {
    primary: generateColorScale(brandColors.primary),
    secondary: generateColorScale(brandColors.secondary),
    // ... generate full theme from base colors
  };
};

// Option 3: Database-driven themes
// Store theme configurations in Supabase
// Load dynamically based on school_code from user profile
```

### Theme Configuration Schema (for API)

```typescript
interface SchoolThemeConfig {
  school_code: string;
  theme_name: string;
  brand_colors: {
    primary: string;      // Hex color
    secondary: string;
    accent: string;
  };
  typography?: {
    font_family?: string;
    font_scale?: number;  // 0.9 to 1.2
  };
  logo_url?: string;
  dark_mode_enabled: boolean;
}
```

---

## Implementation Patterns

### ✅ Correct Pattern: Dynamic Styles

```typescript
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../contexts/ThemeContext';
import { spacing, borderRadius } from '../lib/design-system';

function MyComponent() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  
  return <View style={styles.container}>...</View>;
}

const createStyles = (colors: ThemeColors, isDark: boolean) => 
  StyleSheet.create({
    container: {
      backgroundColor: colors.background.app,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border.DEFAULT,
    },
  });
```

### ❌ Incorrect Pattern: Static Colors

```typescript
// DON'T DO THIS
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',  // ❌ Hardcoded
    borderColor: '#E5E7EB',      // ❌ Hardcoded
  },
});
```

### ✅ Correct Pattern: Using UI Kit

```typescript
import { Card, Button, Heading } from '../ui';

function MyComponent() {
  return (
    <Card variant="elevated" padding="lg">
      <Heading level={2}>Title</Heading>
      <Button variant="primary">Click Me</Button>
    </Card>
  );
}
```

---

## Audit Findings

### Current State Summary

| Metric | Count | Status |
|--------|-------|--------|
| Files with hardcoded hex colors | 28 | 🔴 Critical |
| Files using static StyleSheet | 30+ | 🔴 Critical |
| Files importing colors directly | 30 | 🔴 Critical |
| Files with mixed patterns | 5+ | 🟡 Moderate |
| Screens fully migrated | 12 | ✅ Complete |

### Critical Files Needing Refactoring

#### Priority 1 - High Impact

| File | Issues | Hardcoded Colors |
|------|--------|------------------|
| `ModernTimetableScreen.tsx` | Static styles | 50+ |
| `ManageScreen.tsx` | Inline hardcoded | 15+ |
| `PaymentHistory.tsx` | No useTheme | 11 |
| `Button.tsx` | Hardcoded white | 1 |

#### Priority 2 - Modals & Forms

| File | Issues |
|------|--------|
| `CreateTestForm.tsx` | Static colors import |
| `TaskFormModal.tsx` | Static colors import |
| `TaskSubmissionModal.tsx` | Static colors import |
| `AddResourceModal.tsx` | Static colors import |
| `CalendarEventFormModal.tsx` | Static colors import |

#### Priority 3 - Admin Screens

| File | Issues |
|------|--------|
| `AddStudentScreen.tsx` | Static colors import |
| `AddAdminScreen.tsx` | Static colors import |
| `AddSubjectsScreen.tsx` | Needs verification |
| `AddClassesScreen.tsx` | Needs verification |

### Files Correctly Implemented ✅

- `DashboardScreen.tsx` - Uses UI Kit components
- `LoginScreen.tsx` - Uses UI Kit components
- `AttendanceScreen.tsx` - Uses createStyles pattern
- `CalendarScreen.tsx` - Uses createStyles pattern
- `FeesScreen.tsx` - Uses createStyles pattern
- `ResourcesScreen.tsx` - Uses createStyles pattern
- `TasksScreen.tsx` - Uses createStyles pattern
- `AssessmentsScreen.tsx` - Uses createStyles pattern
- `AnalyticsScreen.tsx` - Uses createStyles pattern
- `DrawerContent.tsx` - Uses useTheme
- `AppNavbarExpo.tsx` - Uses dynamicStyles

---

## Migration Guide

### Step 1: Update Imports

```typescript
// Before
import { colors, spacing } from '../../../lib/design-system';

// After
import { spacing, borderRadius, typography } from '../../../lib/design-system';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
```

### Step 2: Add useTheme Hook

```typescript
function MyComponent() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  // ...
}
```

### Step 3: Convert StyleSheet

```typescript
// Before
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.app,
  },
});

// After
const createStyles = (colors: ThemeColors, isDark: boolean) => 
  StyleSheet.create({
    container: {
      backgroundColor: colors.background.app,
    },
  });
```

### Step 4: Replace Hardcoded Values

| Hardcoded | Replace With |
|-----------|--------------|
| `'#FFFFFF'` | `colors.surface.primary` |
| `'#000000'` | `colors.text.primary` |
| `'rgba(0,0,0,0.5)'` | `colors.surface.overlay` |
| `'#F9FAFB'` | `colors.surface.secondary` |
| `'#E5E7EB'` | `colors.border.DEFAULT` |
| `'#6366F1'` | `colors.primary[600]` |
| `'#10B981'` | `colors.success[600]` |
| `'#EF4444'` | `colors.error[600]` |
| `'#F59E0B'` | `colors.warning[600]` |

---

## Best Practices

### Do's ✅

1. **Always use `useTheme()` hook** for colors
2. **Create dynamic styles** with `useMemo` and `createStyles`
3. **Use UI Kit components** instead of raw View/Text
4. **Pass `isDark` flag** for conditional styling
5. **Use design tokens** for spacing, typography, shadows
6. **Test in both light and dark modes**

### Don'ts ❌

1. **Never hardcode hex colors** in StyleSheet or JSX
2. **Don't import `colors` directly** from design-system
3. **Don't use inline styles** with hardcoded values
4. **Don't create static StyleSheet** outside components
5. **Don't assume light mode** as default

### Linting Rules (Recommended)

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/^#[0-9A-Fa-f]{3,6}$/]',
        message: 'Hardcoded hex colors are not allowed. Use theme tokens.',
      },
    ],
  },
};
```

---

## Roadmap

### Phase 1 - Foundation ✅
- [x] Theme architecture
- [x] Design tokens
- [x] UI Kit components
- [x] ThemeContext with persistence

### Phase 2 - Migration (In Progress)
- [x] Core screens migrated
- [ ] Fix 28 files with hardcoded colors
- [ ] Convert 30+ files to createStyles pattern
- [ ] Remove direct colors imports

### Phase 3 - Scale
- [ ] API-driven theme loading
- [ ] Theme builder admin UI
- [ ] School onboarding with theme generation
- [ ] A/B testing for theme variations

---

## Support

For questions about the design system:
- Check this documentation first
- Review existing implementations in migrated screens
- Follow the patterns established in `DashboardScreen.tsx`

---

*Last updated: November 30, 2025*

