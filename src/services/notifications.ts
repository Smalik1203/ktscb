/**
 * Push Notification Service
 * 
 * Handles registration, token management, and lifecycle events.
 * 
 * Production standards:
 * 1. Security: No direct table access, all via secure RPCs.
 * 2. Dynamic Config: Resolves projectId from Expo Constants.
 * 3. Stateless: No UI side effects or alerts.
 * 4. Resilient: Handles permission states and platform differences.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { log } from '../lib/logger';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/**
 * Result of a registration attempt
 */
export interface PushRegistrationResult {
    success: boolean;
    token: string | null;
    error?: string;
}

/**
 * Register for push notifications and get the Expo push token.
 * Does NOT sync with the server.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
    if (!Device.isDevice) {
        return { success: false, token: null, error: 'Must use physical device for push notifications' };
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            return { success: false, token: null, error: 'Permission not granted' };
        }

        // Configure Android channel for maximum visibility
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'KTS Notifications',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6B3FA0',
                description: 'Notifications from Krishnaveni Talent School',
            });
        }

        // Resolve projectId dynamically from Expo config
        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ||
            Constants.easConfig?.projectId;

        if (!projectId) {
            log.error('EAS Project ID not found in Constants');
            return { success: false, token: null, error: 'Project configuration missing' };
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

        return {
            success: true,
            token: tokenData.data,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown registration error';
        log.error('Push registration error', { error });
        return {
            success: false,
            token: null,
            error: errorMsg
        };
    }
}

/**
 * Sync the push token with the Supabase backend via secure RPC.
 */
export async function syncTokenWithServer(token: string): Promise<boolean> {
    try {
        const { error } = await supabase.rpc('register_push_token', {
            p_token: token,
            p_device_type: Platform.OS,
        });

        if (error) {
            log.error('Failed to sync push token via RPC', { error });
            return false;
        }

        return true;
    } catch (error) {
        log.error('Unexpected error syncing push token', { error });
        return false;
    }
}

/**
 * Remove the current device's token from the server on logout.
 */
export async function removeTokenFromServer(token: string): Promise<boolean> {
    try {
        const { error } = await supabase.rpc('remove_push_token', {
            p_token: token,
        });

        if (error) {
            log.error('Failed to remove push token via RPC', { error });
            return false;
        }

        return true;
    } catch (error) {
        log.error('Unexpected error removing push token', { error });
        return false;
    }
}

/**
 * Cleanly add and remove notification listeners.
 */
export function addNotificationListeners(
    onReceived: (notification: Notifications.Notification) => void,
    onTapped: (response: Notifications.NotificationResponse) => void
) {
    const receivedSub = Notifications.addNotificationReceivedListener(onReceived);
    const tappedSub = Notifications.addNotificationResponseReceivedListener(onTapped);

    return () => {
        receivedSub.remove();
        tappedSub.remove();
    };
}

/**
 * Local development test
 */
export async function sendLocalTestNotification(title: string, body: string) {
    await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
    });
}
