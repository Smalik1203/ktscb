import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { LucideIcon } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius } from '../../../lib/design-system';

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
  iconColor = colors.primary[600],
  iconBackgroundColor = colors.primary[50],
  trend,
  trendValue,
  isLoading = false,
}) => {
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
          <View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}>
            <Icon size={24} color={iconColor} />
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

const styles = StyleSheet.create({
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
