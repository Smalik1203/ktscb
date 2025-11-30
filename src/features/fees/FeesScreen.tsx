/**
 * FeesScreen
 * 
 * Refactored to use centralized design system with dynamic theming.
 * All styling uses theme tokens via useTheme hook.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useClassSelection } from '../../contexts/ClassSelectionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { FeeComponents, FeePlans, StudentFeesView } from '../../components/fees';
import { Settings, CreditCard } from 'lucide-react-native';

export default function FeesScreen() {
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
  const { scope } = useClassSelection();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<'components' | 'plans'>('components');
  
  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, spacing, borderRadius, typography, shadows, isDark), 
    [colors, spacing, borderRadius, typography, shadows, isDark]);

  const isStudent = profile?.role === 'student';

  useEffect(() => {
    if (!isStudent) {
      if (tab === 'components' || tab === 'plans') {
        setActiveTab(tab);
      } else {
        setActiveTab('components');
      }
    }
  }, [tab, isStudent]);

  // Show student view if user is a student
  if (isStudent) {
    return <StudentFeesView />;
  }

  return (
      <View style={styles.container}>
        {/* Segmented Control Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'components' && styles.tabButtonActive]}
            onPress={() => setActiveTab('components')}
          >
          <Settings size={18} color={activeTab === 'components' ? colors.primary.main : colors.text.secondary} />
            <Text style={[styles.tabText, activeTab === 'components' && styles.tabTextActive]}>
              Components
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'plans' && styles.tabButtonActive]}
            onPress={() => setActiveTab('plans')}
          >
          <CreditCard size={18} color={activeTab === 'plans' ? colors.primary.main : colors.text.secondary} />
            <Text style={[styles.tabText, activeTab === 'plans' && styles.tabTextActive]}>
              Fee Plans
            </Text>
          </TouchableOpacity>
        </View>

      {/* Content */}
        {activeTab === 'components' && (
          <FeeComponents schoolCode={scope.school_code || ''} />
        )}
        {activeTab === 'plans' && (
        <FeePlans />
        )}
      </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  spacing: any,
  borderRadius: any,
  typography: any,
  shadows: any,
  isDark: boolean
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    ...shadows.sm,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border.DEFAULT,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.primary.main,
    fontWeight: typography.fontWeight.semibold,
  },
});
