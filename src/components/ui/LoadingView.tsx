import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { spacing, typography, colors } from '../../../lib/design-system';

interface LoadingViewProps {
  message?: string;
  size?: 'small' | 'large';
  showMessage?: boolean;
}

export function LoadingView({
  message = 'Loading...',
  size = 'large',
  showMessage = true
}: LoadingViewProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ActivityIndicator 
        size={size} 
        color={colors.primary[500]} 
        accessibilityLabel="Loading content"
      />
      {showMessage && (
        <Text 
          style={styles.message}
          accessibilityLabel={`Loading: ${message}`}
        >
          {message}
        </Text>
      )}
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  message: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
});
