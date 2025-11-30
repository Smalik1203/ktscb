import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { AlertCircle } from 'lucide-react-native';
import { spacing, typography, colors } from '../../../lib/design-system';
import { Button } from './Button';

interface ErrorViewProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorView({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
}: ErrorViewProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <AlertCircle 
          size={64} 
          color={colors.error[500]} 
          accessibilityLabel="Error icon"
        />
      </Animated.View>
      <Text 
        style={styles.title}
        accessibilityRole="header"
        accessibilityLabel={`Error: ${title}`}
      >
        {title}
      </Text>
      <Text 
        style={styles.message}
        accessibilityLabel={`Error details: ${message}`}
      >
        {message}
      </Text>
      {onRetry && (
        <Button
          title={retryLabel}
          onPress={onRetry}
          variant="primary"
          style={styles.button}
          accessibilityLabel={`${retryLabel} button`}
        />
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
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    marginTop: spacing.lg,
  },
});
