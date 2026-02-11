import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, borderRadius, typography, shadows } from '../../../lib/design-system';

interface SegmentOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
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
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface.secondary,
          borderColor: colors.border.light,
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
              isActive && {
                backgroundColor: colors.surface.primary,
                ...shadows.sm,
              },
              itemStyle,
            ]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.text,
                { color: isActive ? colors.text.primary : colors.text.secondary },
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
    padding: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  item: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  text: {
    fontWeight: typography.fontWeight.semibold as any,
  },
});
