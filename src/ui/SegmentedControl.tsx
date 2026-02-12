/**
 * SegmentedControl Component
 * 
 * A themed segmented control / tab selector.
 * Replaces react-native-paper SegmentedButtons.
 * 
 * @example
 * ```tsx
 * <SegmentedControl
 *   options={[
 *     { label: 'Day', value: 'day' },
 *     { label: 'Week', value: 'week' },
 *     { label: 'Month', value: 'month' },
 *   ]}
 *   value={view}
 *   onChange={setView}
 * />
 * ```
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle, TextStyle, Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface SegmentOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  containerStyle?: ViewStyle;
  itemStyle?: ViewStyle;
  textStyle?: TextStyle;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  containerStyle,
  itemStyle,
  textStyle,
}: SegmentedControlProps) {
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface.secondary,
          borderColor: colors.border.light,
          borderRadius: borderRadius.full,
          padding: 4,
        },
        containerStyle,
      ]}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.item,
              {
                borderRadius: borderRadius.full,
                paddingVertical: spacing.sm,
              },
              isActive && {
                backgroundColor: colors.surface.primary,
                ...shadows.sm,
              },
              itemStyle,
            ]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            {option.icon && <View style={{ marginRight: spacing.xs }}>{option.icon}</View>}
            <Text
              style={[
                styles.text,
                {
                  color: isActive ? colors.text.primary : colors.text.secondary,
                  fontWeight: typography.fontWeight.semibold as any,
                  fontSize: typography.fontSize.sm,
                },
                textStyle,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {},
});
