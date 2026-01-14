/**
 * useNotifications Hook
 * 
 * Manages push notification registration and lifecycle.
 * Automatically registers token when user is authenticated.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import {
    registerForPushNotifications,
    savePushToken,
    removePushToken,
    sendTestNotification as sendTest,
    addNotificationReceivedListener,
    addNotificationResponseListener,
    type PushNotificationToken,
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

    // Register for push notifications when authenticated
    useEffect(() => {
        if (status !== 'signedIn' || !user?.id) {
            // Clear token state if not signed in
            setPushToken(null);
            tokenRef.current = null;
            registrationAttempted.current = false;
            return;
        }

        // Only attempt registration once per session
        if (registrationAttempted.current) return;
        registrationAttempted.current = true;

        const register = async () => {
            log.debug('[useNotifications] Starting token registration for user', { userId: user.id });

            const tokenData = await registerForPushNotifications();

            log.debug('[useNotifications] Token registration result', {
                hasToken: !!tokenData,
                deviceType: tokenData?.deviceType
            });

            if (tokenData) {
                setPushToken(tokenData.token);
                tokenRef.current = tokenData.token;
                setPermissionGranted(true);

                // Save to Supabase
                log.debug('[useNotifications] Saving token to Supabase');
                await savePushToken(user.id, tokenData);

                // Store in AsyncStorage for logout cleanup
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                await AsyncStorage.setItem('pushToken', tokenData.token);
            } else {
                log.debug('[useNotifications] No token received - check permissions or device compatibility');
            }
        };

        register();
    }, [status, user?.id]);

    // Handle notification received while app is foregrounded
    useEffect(() => {
        const subscription = addNotificationReceivedListener((notification) => {
            log.info('Notification received in foreground', {
                title: notification.request.content.title,
                data: notification.request.content.data,
            });
        });

        return () => subscription.remove();
    }, []);

    // Handle notification tap
    useEffect(() => {
        const subscription = addNotificationResponseListener((response) => {
            const data = response.notification.request.content.data;
            log.info('Notification tapped', { data });

            // TODO: Handle navigation based on notification type
            // For example, navigate to attendance screen if type is 'attendance'
        });

        return () => subscription.remove();
    }, []);

    // Cleanup token on unmount (logout handled separately)
    useEffect(() => {
        return () => {
            // Token cleanup is handled by signOut in AuthContext
        };
    }, []);

    const sendTestNotification = useCallback(async () => {
        await sendTest();
    }, []);

    const reRegister = useCallback(async () => {
        if (!user?.id) return;

        const tokenData = await registerForPushNotifications();
        if (tokenData) {
            setPushToken(tokenData.token);
            tokenRef.current = tokenData.token;
            setPermissionGranted(true);
            await savePushToken(user.id, tokenData);
        }
    }, [user?.id]);

    return {
        pushToken,
        permissionGranted,
        sendTestNotification,
        reRegister,
    };
}

/**
 * Get the current push token reference (for use in signOut).
 * This is an internal export for AuthContext cleanup.
 */
export function getCurrentPushToken(): string | null {
    return null; // Will be managed via AsyncStorage if needed
}
