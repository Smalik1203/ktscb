/**
 * SectionBlock Component
 * 
 * A container for grouping related content with an optional header.
 * Use for organizing screens into logical sections.
 * 
 * @example
 * ```tsx
 * <SectionBlock title="Recent Activity" action={{ label: "View All", onPress: handleViewAll }}>
 *   <ActivityList />
 * </SectionBlock>
 * 
 * <SectionBlock title="Settings" subtitle="Manage your preferences">
 *   <SettingsList />
 * </SectionBlock>
 * ```
 */

import React from 'react';
import { View, ViewStyle, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Heading } from './Text';
import { Caption } from './Text';

export interface SectionBlockProps {
  children: React.ReactNode;
  /** Section title */
  title?: string;
  /** Section subtitle */
  subtitle?: string;
  /** Title heading level */
  titleLevel?: 3 | 4 | 5 | 6;
  /** Action button */
  action?: {
    label: string;
    onPress: () => void;
  };
  /** Spacing after section */
  spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Horizontal padding */
  paddingHorizontal?: 'none' | 'sm' | 'md' | 'lg';
  /** Custom style */
  style?: ViewStyle;
  /** Custom header style */
  headerStyle?: ViewStyle;
  /** Test ID */
  testID?: string;
}

export function SectionBlock({
  children,
  title,
  subtitle,
  titleLevel = 4,
  action,
  spacing = 'lg',
  paddingHorizontal = 'md',
  style,
  headerStyle,
  testID,
}: SectionBlockProps) {
  const { colors, spacing: spacingTokens, typography } = useTheme();

  // Get spacing value
  const getSpacing = (size: string): number => {
    if (size === 'none') return 0;
    const map: Record<string, number> = {
      sm: spacingTokens.sm,
      md: spacingTokens.md,
      lg: spacingTokens.lg,
      xl: spacingTokens.xl,
    };
    return map[size] || spacingTokens.md;
  };

  const containerStyle: ViewStyle = {
    marginBottom: getSpacing(spacing),
    paddingHorizontal: getSpacing(paddingHorizontal),
  };

  const hasHeader = title || action;

  return (
    <View style={[containerStyle, style]} testID={testID}>
      {hasHeader && (
        <View style={[styles.header, headerStyle]}>
          <View style={styles.titleContainer}>
            {title && (
              <Heading level={titleLevel}>{title}</Heading>
            )}
            {subtitle && (
              <Caption style={{ marginTop: spacingTokens.xs }}>{subtitle}</Caption>
            )}
          </View>
          {action && (
            <TouchableOpacity
              onPress={action.onPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Caption
                color="accent"
                weight="semibold"
                style={{ color: colors.primary.main }}
              >
                {action.label}
              </Caption>
            </TouchableOpacity>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
  },
});

export default SectionBlock;

