/**
 * Toast Component & Provider
 * 
 * Replaces react-native-paper Snackbar with a themed toast system.
 * 
 * @example
 * ```tsx
 * // Wrap app with provider (in _layout.tsx)
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * 
 * // Use anywhere
 * const { showToast } = useToast();
 * showToast({ message: 'Saved!', type: 'success' });
 * showToast({ message: 'Something went wrong', type: 'error', duration: 4000 });
 * ```
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { Body } from './Text';

// ============================================================================
// Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  hideToast: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ============================================================================
// Provider
// ============================================================================

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insets = useSafeAreaInsets();

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 100, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setToast(null);
    });
  }, [translateY, opacity]);

  const showToast = useCallback((config: ToastConfig) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setToast(config);
    setVisible(true);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const duration = config.duration ?? 3000;
    timeoutRef.current = setTimeout(hideToast, duration);
  }, [translateY, opacity, hideToast]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {visible && toast && (
        <ToastView
          config={toast}
          onDismiss={hideToast}
          translateY={translateY}
          opacity={opacity}
          bottomInset={insets.bottom}
        />
      )}
    </ToastContext.Provider>
  );
}

// ============================================================================
// Toast View
// ============================================================================

interface ToastViewProps {
  config: ToastConfig;
  onDismiss: () => void;
  translateY: Animated.Value;
  opacity: Animated.Value;
  bottomInset: number;
}

function ToastView({ config, onDismiss, translateY, opacity, bottomInset }: ToastViewProps) {
  const { colors, spacing, borderRadius, shadows } = useTheme();

  const getTypeConfig = () => {
    switch (config.type) {
      case 'success':
        return { icon: 'check-circle' as const, bg: colors.success.main, iconColor: '#fff' };
      case 'error':
        return { icon: 'error' as const, bg: colors.error.main, iconColor: '#fff' };
      case 'warning':
        return { icon: 'warning' as const, bg: colors.warning.main, iconColor: '#fff' };
      case 'info':
      default:
        return { icon: 'info' as const, bg: colors.primary.main, iconColor: '#fff' };
    }
  };

  const typeConfig = getTypeConfig();

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          bottom: Math.max(bottomInset, spacing.md) + spacing.md,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: typeConfig.bg,
            borderRadius: borderRadius.card,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            ...shadows.lg,
          },
        ]}
      >
        <MaterialIcons name={typeConfig.icon} size={20} color={typeConfig.iconColor} />
        <Body
          style={{ flex: 1, color: '#fff', marginHorizontal: spacing.sm }}
          numberOfLines={2}
        >
          {config.message}
        </Body>
        {config.action && (
          <TouchableOpacity onPress={config.action.onPress} style={styles.actionBtn}>
            <Body style={{ color: '#fff', fontWeight: '700' }}>{config.action.label}</Body>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 10000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 500,
    width: '100%',
  },
  toastText: {
    flex: 1,
  },
  actionBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
  },
});
