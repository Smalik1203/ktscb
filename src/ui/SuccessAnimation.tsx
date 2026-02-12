/**
 * SuccessAnimation Component
 * 
 * Animated success checkmark with expanding ring effect.
 * 
 * @example
 * ```tsx
 * <SuccessAnimation visible={showSuccess} onAnimationEnd={() => setShowSuccess(false)} />
 * ```
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

export interface SuccessAnimationProps {
  visible: boolean;
  size?: number;
  color?: string;
  onAnimationEnd?: () => void;
}

export function SuccessAnimation({
  visible,
  size = 100,
  color,
  onAnimationEnd,
}: SuccessAnimationProps) {
  const { colors } = useTheme();
  const finalColor = color || colors.success.main;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      ringScale.setValue(0);
      ringOpacity.setValue(1);

      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 3,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.5,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        onAnimationEnd?.();
      });
    }
  }, [visible, scaleAnim, opacityAnim, ringScale, ringOpacity, onAnimationEnd]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: finalColor,
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: finalColor },
          ]}
        >
          <MaterialIcons name="check-circle" size={size * 0.5} color={colors.text.inverse} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
  },
  iconContainer: {
    position: 'absolute',
  },
  iconCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
