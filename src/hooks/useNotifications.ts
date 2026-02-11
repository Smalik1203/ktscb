/**
 * useNotifications Hook
 * 
 * Manages push notification registration and lifecycle.
 * Automatically registers token when user is authenticated.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    registerForPushNotifications,
    syncTokenWithServer,
    addNotificationListeners,
} from '../services/notifications';
import { log } from '../lib/logger';

export interface UseNotificationsReturn {
    /** Current push token, if registered */
    pushToken: string | null;
    /** Whether notification permissions are granted */
    permissionGranted: boolean;
    /** Send a test notification to verify setup */
    sendTestNotification: () => Promise<void>;
    /** Manually re-register for push notifications */
    reRegister: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
    const { user, status } = useAuth();
    const [pushToken, setPushToken] = useState<string | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const tokenRef = useRef<string | null>(null);
    const registrationAttempted = useRef(false);

    const register = useCallback(async () => {
        const result = await registerForPushNotifications();

        if (result.success && result.token) {
            setPushToken(result.token);
            tokenRef.current = result.token;
            setPermissionGranted(true);

            await syncTokenWithServer(result.token);

            // Persist for logout cleanup
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            await AsyncStorage.setItem('push-token-v2', result.token);
        } else {
            log.warn('Push registration skipped or failed', { error: result.error });
            setPermissionGranted(false);
        }
    }, []);

    // Register for push notifications when authenticated
    useEffect(() => {
        if (status !== 'signedIn' || !user?.id) {
            setPushToken(null);
            tokenRef.current = null;
            registrationAttempted.current = false;
            return;
        }

        if (registrationAttempted.current) {
            return;
        }
        registrationAttempted.current = true;

        register();
    }, [status, user?.id, register]);

    // Handle listeners
    useEffect(() => {
        const cleanup = addNotificationListeners(
            (notification) => {
                log.info('Notification received in foreground', {
                    title: notification.request.content.title,
                });
            },
            (response) => {
                const data = response.notification.request.content.data;
                log.info('Notification tapped', { data });
            }
        );

        return cleanup;
    }, []);

    const sendTestNotification = useCallback(async () => {
        const { sendLocalTestNotification } = await import('../services/notifications');
        await sendLocalTestNotification('Test Notification 🎉', 'Everything is configured correctly!');
    }, []);

    const reRegister = useCallback(async () => {
        if (!user?.id) return;
        await register();
    }, [user?.id, register]);

    return {
        pushToken,
        permissionGranted,
        sendTestNotification,
        reRegister,
    };
}
