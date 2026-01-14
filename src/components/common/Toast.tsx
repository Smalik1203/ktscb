/**
 * Toast Component & Provider
 * 
 * A non-blocking notification system for success, error, and info messages.
 * Uses the app's theme system for consistent styling.
 * 
 * @example
 * ```tsx
 * // In your component
 * const { showToast } = useToast();
 * 
 * showToast({ type: 'success', message: 'Saved successfully!' });
 * showToast({ type: 'error', message: 'Something went wrong' });
 * showToast({ type: 'info', message: 'New update available' });
 * ```
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Body, Caption } from '../../ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    description?: string;
    duration?: number; // in ms, default 3000
    action?: {
        label: string;
        onPress: () => void;
    };
}

interface ToastContextType {
    showToast: (toast: Omit<ToastMessage, 'id'>) => void;
    hideToast: (id: string) => void;
    hideAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Hook to use toast
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// Individual Toast Item
function ToastItem({
    toast,
    onHide
}: {
    toast: ToastMessage;
    onHide: (id: string) => void;
}) {
    const { colors, spacing, borderRadius, shadows, typography } = useTheme();
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Slide in
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 100,
                friction: 10,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto-hide after duration
        const timer = setTimeout(() => {
            hideWithAnimation();
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, []);

    const hideWithAnimation = useCallback(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onHide(toast.id);
        });
    }, [slideAnim, opacityAnim, toast.id, onHide]);

    // Get toast styling based on type
    const getToastStyle = () => {
        switch (toast.type) {
            case 'success':
                return {
                    backgroundColor: colors.success[50],
                    borderColor: colors.success[200],
                    iconColor: colors.success[600],
                    Icon: CheckCircle,
                };
            case 'error':
                return {
                    backgroundColor: colors.error[50],
                    borderColor: colors.error[200],
                    iconColor: colors.error[600],
                    Icon: AlertCircle,
                };
            case 'warning':
                return {
                    backgroundColor: colors.warning[50],
                    borderColor: colors.warning[200],
                    iconColor: colors.warning[600],
                    Icon: AlertCircle,
                };
            case 'info':
            default:
                return {
                    backgroundColor: colors.info[50],
                    borderColor: colors.info[200],
                    iconColor: colors.info[600],
                    Icon: Info,
                };
        }
    };

    const style = getToastStyle();
    const Icon = style.Icon;

    return (
        <Animated.View
            style={[
                styles.toastItem,
                {
                    backgroundColor: style.backgroundColor,
                    borderColor: style.borderColor,
                    borderRadius: borderRadius.lg,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    ...shadows.lg,
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            <View style={styles.toastContent}>
                <Icon size={20} color={style.iconColor} />
                <View style={styles.toastTextContainer}>
                    <Body weight="medium" style={{ color: colors.text.primary }}>
                        {toast.message}
                    </Body>
                    {toast.description && (
                        <Caption color="secondary" style={{ marginTop: 2 }}>
                            {toast.description}
                        </Caption>
                    )}
                </View>
                <TouchableOpacity
                    onPress={hideWithAnimation}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginLeft: spacing.sm }}
                >
                    <X size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
            </View>
            {toast.action && (
                <TouchableOpacity
                    onPress={() => {
                        toast.action?.onPress();
                        hideWithAnimation();
                    }}
                    style={[styles.actionButton, { marginTop: spacing.sm }]}
                >
                    <Body weight="semibold" style={{ color: style.iconColor }}>
                        {toast.action.label}
                    </Body>
                </TouchableOpacity>
            )}
        </Animated.View>
    );
}

// Toast Provider Component
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const insets = useSafeAreaInsets();
    const { spacing } = useTheme();

    const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { ...toast, id }]);
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const hideAllToasts = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, hideToast, hideAllToasts }}>
            {children}
            <View
                style={[
                    styles.toastContainer,
                    {
                        top: insets.top + spacing.md,
                        paddingHorizontal: spacing.md,
                    },
                ]}
                pointerEvents="box-none"
            >
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onHide={hideToast} />
                ))}
            </View>
        </ToastContext.Provider>
    );
}

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
    },
    toastItem: {
        width: SCREEN_WIDTH - 32,
        maxWidth: 400,
        marginBottom: 8,
        borderWidth: 1,
    },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    toastTextContainer: {
        flex: 1,
    },
    actionButton: {
        alignSelf: 'flex-end',
    },
});

export default ToastProvider;
