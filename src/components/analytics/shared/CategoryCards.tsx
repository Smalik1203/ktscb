import React, { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import type { ThemeColors } from '../../../theme/types';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { ChevronRight } from 'lucide-react-native';
import { typography, spacing, borderRadius, shadows, colors } from '../../../../lib/design-system';
import { AnalyticsFeature } from '../types';

interface CategoryCard {
  id: AnalyticsFeature;
  title: string;
  metric: string;
  subtext: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  iconColor: string;
  iconBackgroundColor: string;
  metricColor: string;
  onPress?: () => void;
}

interface CategoryCardsProps {
  cards: CategoryCard[];
}

export const CategoryCards: React.FC<CategoryCardsProps> = ({ cards }) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  if (!cards || cards.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {cards.map((card) => (
        <Pressable
          key={card.id}
          style={({ pressed }) => [
            styles.categoryCard,
            pressed && styles.categoryCardPressed,
          ]}
          onPress={card.onPress}
        >
          <View style={styles.categoryCardContent}>
            <View style={[styles.categoryIconContainer, { backgroundColor: card.iconBackgroundColor }]}>
              <card.icon size={24} color={card.iconColor} strokeWidth={2} />
            </View>
            <View style={styles.categoryCardText}>
              <Text variant="titleMedium" style={styles.categoryCardTitle}>{card.title}</Text>
              <Text variant="headlineSmall" style={[styles.categoryCardMetric, { color: card.metricColor }]}>
                {card.metric}
              </Text>
              <Text variant="bodySmall" style={styles.categoryCardSubtext}>{card.subtext}</Text>
            </View>
            {card.onPress && (
              <ChevronRight size={20} color={colors.text.tertiary} style={styles.categoryCardChevron} />
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    // gap handled by marginBottom on categoryCard
  },
  categoryCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
    minHeight: 80,
  },
  categoryCardPressed: {
    opacity: 0.8,
    backgroundColor: colors.surface.secondary,
  },
  categoryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    minHeight: 80,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryCardText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  categoryCardTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  categoryCardMetric: {
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.xl,
    marginBottom: spacing.xs,
  },
  categoryCardSubtext: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
  },
  categoryCardChevron: {
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
});

