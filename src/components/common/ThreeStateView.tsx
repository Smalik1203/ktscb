import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { RefreshCw, AlertCircle, Inbox } from 'lucide-react-native';
import { spacing, typography, colors } from '../../../lib/design-system';
import { useTheme } from '../../contexts/ThemeContext';

export interface ThreeStateViewProps {
  state: 'loading' | 'error' | 'empty' | 'success';
  loadingMessage?: string;
  errorMessage?: string;
  errorDetails?: string;
  emptyMessage?: string;
  emptyAction?: {
    label: string;
    onPress: () => void;
  };
  onRetry?: () => void;
  children?: React.ReactNode;
  timeout?: number; // in seconds
}

export const ThreeStateView: React.FC<ThreeStateViewProps> = ({
  state,
  loadingMessage = 'Loading...',
  errorMessage = 'Something went wrong',
  errorDetails,
  emptyMessage = 'No data available',
  emptyAction,
  onRetry,
  children,
  timeout = 6,
}) => {
  const { colors, isDark } = useTheme();
  
  // Create dynamic styles based on theme
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      backgroundColor: colors.background.app,
    },
    loadingText: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    timeoutText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    errorTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.error[500],
      marginTop: spacing.md,
      textAlign: 'center',
    },
    errorDetails: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginTop: spacing.sm,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    emptyTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.secondary,
      marginTop: spacing.md,
      textAlign: 'center',
    },
  }), [colors]);

  if (state === 'success' && children) {
    return <View style={{ flex: 1, backgroundColor: colors.background.app }}>{children}</View>;
  }

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text style={dynamicStyles.loadingText}>{loadingMessage}</Text>
            {timeout > 0 && (
              <Text style={dynamicStyles.timeoutText}>
                Taking longer than expected? Check your connection.
              </Text>
            )}
          </View>
        );

      case 'error':
        return (
          <View style={styles.centerContent}>
            <AlertCircle size={48} color={colors.error[500]} />
            <Text style={dynamicStyles.errorTitle}>{errorMessage}</Text>
            {errorDetails && (
              <Text style={dynamicStyles.errorDetails}>{errorDetails}</Text>
            )}
            {onRetry && (
              <Button
                mode="contained"
                onPress={onRetry}
                style={styles.retryButton}
                icon={() => <RefreshCw size={16} color={isDark ? colors.text.inverse : colors.surface.primary} />}
              >
                Retry
              </Button>
            )}
          </View>
        );

      case 'empty':
        return (
          <View style={styles.centerContent}>
            <Inbox size={48} color={colors.text.secondary} />
            <Text style={dynamicStyles.emptyTitle}>{emptyMessage}</Text>
            {emptyAction && (
              <Button
                mode="outlined"
                onPress={emptyAction.onPress}
                style={styles.emptyButton}
              >
                {emptyAction.label}
              </Button>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={dynamicStyles.container}>
      {renderContent()}
    </View>
  );
};

// Static styles that don't depend on theme
const styles = StyleSheet.create({
  centerContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  retryButton: {
    marginTop: spacing.lg,
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
});
