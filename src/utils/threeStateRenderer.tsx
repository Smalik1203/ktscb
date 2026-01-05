/**
 * Three-State Renderer Utility
 * 
 * Enforces the mandatory pattern for all data-fetching components:
 * 1. if (loading) return <Skeleton />;
 * 2. if (error) return <ErrorState />;
 * 3. if (!data || data.length === 0) return <EmptyState />;
 * 
 * This prevents the "empty white cards" bug on mobile.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { AlertCircle, Inbox } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Skeleton } from '../ui';
import { Body, Button } from '../ui';

export interface ThreeStateRendererOptions<T> {
  /** Query result from useQuery */
  query: {
    data?: T;
    isLoading: boolean;
    error: Error | null;
    refetch?: () => void;
  };
  /** Function to check if data is empty */
  isEmpty?: (data: T | undefined) => boolean;
  /** Loading component (optional, defaults to Skeleton) */
  loadingComponent?: React.ReactNode;
  /** Error component (optional, defaults to ErrorState) */
  errorComponent?: React.ReactNode;
  /** Empty component (optional, defaults to EmptyState) */
  emptyComponent?: React.ReactNode;
  /** Loading message */
  loadingMessage?: string;
  /** Error message */
  errorMessage?: string;
  /** Empty message */
  emptyMessage?: string;
  /** Empty action */
  emptyAction?: {
    label: string;
    onPress: () => void;
  };
  /** Children to render when data is available */
  children: React.ReactNode;
  /** Minimum height for container (prevents collapse on mobile) */
  minHeight?: number;
}

/**
 * Default empty check for arrays
 */
export const isEmptyArray = <T,>(data: T | undefined): boolean => {
  return !data || (Array.isArray(data) && data.length === 0);
};

/**
 * Default empty check for objects
 */
export const isEmptyObject = <T,>(data: T | undefined): boolean => {
  return !data || (typeof data === 'object' && Object.keys(data).length === 0);
};

/**
 * Three-State Renderer Component
 * 
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useQuery(...);
 * 
 * return (
 *   <ThreeStateRenderer
 *     query={{ data, isLoading, error }}
 *     isEmpty={isEmptyArray}
 *     loadingMessage="Loading tasks..."
 *     errorMessage="Failed to load tasks"
 *     emptyMessage="No tasks found"
 *     minHeight={120}
 *   >
 *     <TaskList tasks={data} />
 *   </ThreeStateRenderer>
 * );
 * ```
 */
export function ThreeStateRenderer<T>({
  query,
  isEmpty = isEmptyArray,
  loadingComponent,
  errorComponent,
  emptyComponent,
  loadingMessage = 'Loading...',
  errorMessage = 'Something went wrong',
  emptyMessage = 'No data available',
  emptyAction,
  children,
  minHeight = 120,
}: ThreeStateRendererOptions<T>) {
  const { colors, spacing } = useTheme();

  // 1. Loading state
  if (query.isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <View style={[styles.container, { minHeight }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Body style={{ marginTop: spacing.md, textAlign: 'center' }}>
            {loadingMessage}
          </Body>
        </View>
      </View>
    );
  }

  // 2. Error state
  if (query.error) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    return (
      <View style={[styles.container, { minHeight }]}>
        <View style={styles.centerContent}>
          <AlertCircle size={48} color={colors.error.main} />
          <Body color="error" style={{ marginTop: spacing.md, textAlign: 'center' }}>
            {errorMessage}
          </Body>
          {query.refetch && (
            <Button
              onPress={query.refetch}
              variant="primary"
              style={{ marginTop: spacing.md }}
            >
              Retry
            </Button>
          )}
        </View>
      </View>
    );
  }

  // 3. Empty state
  if (isEmpty(query.data)) {
    if (emptyComponent) {
      return <>{emptyComponent}</>;
    }
    return (
      <View style={[styles.container, { minHeight }]}>
        <View style={styles.centerContent}>
          <Inbox size={48} color={colors.text.tertiary} />
          <Body color="secondary" style={{ marginTop: spacing.md, textAlign: 'center' }}>
            {emptyMessage}
          </Body>
          {emptyAction && (
            <Button
              onPress={emptyAction.onPress}
              variant="outline"
              style={{ marginTop: spacing.md }}
            >
              {emptyAction.label}
            </Button>
          )}
        </View>
      </View>
    );
  }

  // 4. Success state - render children
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  centerContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
});

/**
 * Hook version for inline usage
 * 
 * Usage:
 * ```tsx
 * const { data, isLoading, error } = useQuery(...);
 * const state = useThreeState({ data, isLoading, error });
 * 
 * if (state === 'loading') return <Skeleton />;
 * if (state === 'error') return <ErrorState />;
 * if (state === 'empty') return <EmptyState />;
 * return <DataView data={data} />;
 * ```
 */
export function useThreeState<T>({
  data,
  isLoading,
  error,
  isEmpty = isEmptyArray,
}: {
  data?: T;
  isLoading: boolean;
  error: Error | null;
  isEmpty?: (data: T | undefined) => boolean;
}): 'loading' | 'error' | 'empty' | 'success' {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (isEmpty(data)) return 'empty';
  return 'success';
}
