import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { LucideIcon } from 'lucide-react-native';
import { typography, spacing, borderRadius, colors } from '../../../lib/design-system';

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBackgroundColor?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  isLoading?: boolean;
}

export const KPICard = React.memo<KPICardProps>(({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBackgroundColor,
  trend,
  trendValue,
  isLoading = false,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  // Use theme colors as defaults if not provided
  const finalIconColor = iconColor || colors.primary[600];
  const finalIconBgColor = iconBackgroundColor || colors.primary[50];
  const getTrendColor = () => {
    if (!trend) return colors.text.secondary;
    switch (trend) {
      case 'up':
        return colors.success[600];
      case 'down':
        return colors.error[600];
      case 'stable':
        return colors.text.secondary;
    }
  };

  const getTrendSymbol = () => {
    if (!trend) return '';
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
    }
  };

  return (
    <Card style={styles.card} elevation={1}>
      <View style={styles.content}>
        {Icon && (
          <View style={[styles.iconContainer, { backgroundColor: finalIconBgColor }]}>
            <Icon size={24} color={finalIconColor} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text variant="bodyMedium" style={styles.title}>
            {title}
          </Text>
          <Text variant="headlineMedium" style={styles.value}>
            {isLoading ? '...' : value}
          </Text>
          {(subtitle || trendValue) && (
            <View style={styles.bottomRow}>
              {subtitle && (
                <Text variant="bodySmall" style={styles.subtitle}>
                  {subtitle}
                </Text>
              )}
              {trendValue && (
                <Text variant="bodySmall" style={[styles.trend, { color: getTrendColor() }]}>
                  {getTrendSymbol()} {trendValue}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Card>
  );
});

KPICard.displayName = 'KPICard';

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  value: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    color: colors.text.tertiary,
  },
  trend: {
    fontWeight: typography.fontWeight.semibold,
  },
});
