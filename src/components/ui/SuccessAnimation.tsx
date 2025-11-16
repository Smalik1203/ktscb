import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../../lib/design-system';
import { CheckCircle2 } from 'lucide-react-native';

interface SuccessAnimationProps {
  visible: boolean;
  size?: number;
  color?: string;
  onAnimationEnd?: () => void;
}

export function SuccessAnimation({
  visible,
  size = 100,
  color = colors.success[500],
  onAnimationEnd,
}: SuccessAnimationProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      ringScale.setValue(0);
      ringOpacity.setValue(1);

      // Run animations in sequence
      Animated.sequence([
        // Icon pops in
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
        // Ring expands
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
        if (onAnimationEnd) {
          onAnimationEnd();
        }
      });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Expanding ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />

      {/* Success icon */}
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
            { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
          ]}
        >
          <CheckCircle2 size={size * 0.5} color={colors.text.inverse} strokeWidth={3} />
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
