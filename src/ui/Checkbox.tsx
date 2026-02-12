/**
 * Checkbox Component
 * 
 * A themed checkbox with label support.
 * Replaces react-native-paper Checkbox.
 * 
 * @example
 * ```tsx
 * <Checkbox
 *   checked={isSelected}
 *   onPress={() => setIsSelected(!isSelected)}
 *   label="I agree to the terms"
 * />
 * 
 * <Checkbox
 *   checked={item.done}
 *   onPress={() => toggleItem(item.id)}
 *   size="sm"
 * />
 * ```
 */

import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, View, Animated, StyleSheet, ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { Body } from './Text';

export type CheckboxSize = 'sm' | 'md' | 'lg';

export interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  label?: string;
  size?: CheckboxSize;
  disabled?: boolean;
  color?: string;
  style?: ViewStyle;
  testID?: string;
}

export function Checkbox({
  checked,
  onPress,
  label,
  size = 'md',
  disabled = false,
  color,
  style,
  testID,
}: CheckboxProps) {
  const { colors, spacing, borderRadius } = useTheme();
  const scaleAnim = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: checked ? 1 : 0,
      tension: 300,
      friction: 15,
      useNativeDriver: true,
    }).start();
  }, [checked, scaleAnim]);

  const resolvedColor = color ?? colors.primary.main;

  const sizeConfig = {
    sm: { box: 18, icon: 14, gap: spacing.xs },
    md: { box: 22, icon: 18, gap: spacing.sm },
    lg: { box: 28, icon: 22, gap: spacing.md },
  }[size];

  return (
    <TouchableOpacity
      style={[styles.container, { gap: sizeConfig.gap }, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      testID={testID}
    >
      <View
        style={[
          styles.box,
          {
            width: sizeConfig.box,
            height: sizeConfig.box,
            borderRadius: borderRadius.sm,
            borderColor: checked ? resolvedColor : colors.border.DEFAULT,
            backgroundColor: checked ? resolvedColor : 'transparent',
            borderWidth: checked ? 0 : 2,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <MaterialIcons name="check" size={sizeConfig.icon} color="#fff" />
        </Animated.View>
      </View>
      {label && (
        <Body style={{ color: disabled ? colors.text.disabled : colors.text.primary }}>
          {label}
        </Body>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  box: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
