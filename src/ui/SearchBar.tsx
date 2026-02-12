/**
 * SearchBar Component
 * 
 * A themed search input with clear button.
 * Uses MaterialIcons via the Icon component.
 * 
 * @example
 * ```tsx
 * import { SearchBar } from '@/ui';
 * 
 * <SearchBar
 *   value={query}
 *   onChangeText={setQuery}
 *   placeholder="Search students..."
 * />
 * ```
 */

import React from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, borderRadius, typography, shadows } from '../../lib/design-system';

export interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  containerStyle,
  inputStyle,
}: SearchBarProps) {
  const { colors } = useTheme();

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface.secondary, borderColor: colors.border.light }, containerStyle]}>
      <MaterialIcons name="search" size={18} color={colors.text.tertiary} />
      <TextInput
        style={[styles.input, { color: colors.text.primary }, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} accessibilityRole="button" accessibilityLabel="Clear search">
          <MaterialIcons name="close" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    ...shadows.none,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
  },
});
