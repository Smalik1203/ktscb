import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet } from 'react-native';
import { CardSkeleton, ListCardSkeleton } from './CardSkeleton';
import { spacing, colors } from '../../../lib/design-system';

export function TimetableSkeleton() {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  return (
    <View style={styles.container}>
      {/* Date Navigator */}
      <View style={styles.dateNavigator}>
        <CardSkeleton height={40} width={40} />
        <CardSkeleton height={40} width="50%" />
        <CardSkeleton height={40} width={40} />
      </View>

      {/* Today Button */}
      <View style={styles.todayButton}>
        <CardSkeleton height={36} width="30%" />
      </View>

      {/* Timetable Slots */}
      <View style={styles.slotsContainer}>
        {[1, 2, 3, 4, 5, 6].map((_, index) => (
          <View key={index} style={styles.slotCard}>
            <View style={styles.slotTime}>
              <CardSkeleton height={16} width={60} />
            </View>
            <View style={styles.slotContent}>
              <CardSkeleton height={20} width="70%" style={{ marginBottom: spacing['2'] }} />
              <CardSkeleton height={16} width="50%" style={{ marginBottom: spacing['2'] }} />
              <CardSkeleton height={14} width="40%" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing['4'],
    backgroundColor: colors.background.primary,
  },
  dateNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['4'],
  },
  todayButton: {
    alignItems: 'center',
    marginBottom: spacing['6'],
  },
  slotsContainer: {
    gap: spacing['3'],
  },
  slotCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    padding: spacing['4'],
    borderRadius: 12,
    gap: spacing['3'],
  },
  slotTime: {
    width: 80,
    justifyContent: 'center',
  },
  slotContent: {
    flex: 1,
  },
});

