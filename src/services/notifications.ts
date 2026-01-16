/**
 * Push Notification Service
 * 
 * Handles registration, token management, and sending notifications.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
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

export interface PushNotificationToken {
    token: string;
    deviceType: 'ios' | 'android' | 'web';
}

/**
 * Register for push notifications and get the Expo push token.
 * 
 * @returns The push token and device type, or null if registration fails
 */
export async function registerForPushNotifications(): Promise<PushNotificationToken | null> {
    // Check if running on a physical device
    if (!Device.isDevice) {
        log.warn('Push notifications only work on physical devices');
        return null;
    }

    try {
        // Check existing permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Request permissions if not already granted
        if (existingStatus !== 'granted') {
            log.info('Requesting push permissions...');
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
            log.info(`Permission request result: ${status}`);
        }

        if (finalStatus !== 'granted') {
            log.warn(`Push notification permission denied. Status: ${finalStatus}`);
            return null;
        }

        // Set up Android notification channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'KTS Notifications',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6B3FA0',
                description: 'Notifications from Krishnaveni Talent School',
            });
        }

        // Get the Expo push token
        // Use default config first
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: 'f9bfdbf0-86d0-462d-b627-2a4edad56adc', // From app.json
        });

        log.info('Push notification token obtained', { token: tokenData.data });

        return {
            token: tokenData.data,
            deviceType: Platform.OS as 'ios' | 'android',
        };
    } catch (error) {
        log.error('Failed to register for push notifications', { error });
        return null;
    }
}

/**
 * Save push token to Supabase for the current user.
 */
export async function savePushToken(userId: string, tokenData: PushNotificationToken): Promise<boolean> {
    try {
        log.debug('[savePushToken] Attempting to save token via RPC', {
            userId,
            tokenPreview: tokenData.token.substring(0, 30) + '...',
            deviceType: tokenData.deviceType
        });

        console.log('[savePushToken] DEBUG - Starting RPC call for user:', userId);

        // Use RPC function to handle upsert securely (bypassing RLS for unique constraints)
        const { data, error } = await supabase.rpc('register_push_token', {
            p_token: tokenData.token,
            p_device_type: tokenData.deviceType,
        });

        console.log('[savePushToken] DEBUG - RPC result:', { data, error: error?.message });

        if (error) {
            console.error('[savePushToken] RPC error:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            log.error('Failed to save push token via RPC', { error });
            // Show alert for debugging - REMOVE IN PRODUCTION
            const { Alert } = require('react-native');
            Alert.alert('Push Token Error', `Failed to register: ${error.message}`);
            return false;
        }

        console.log('[savePushToken] DEBUG - Token saved successfully!');
        log.info('Push token saved successfully');
        return true;
    } catch (error) {
        console.error('[savePushToken] Unexpected error:', error);
        log.error('Failed to save push token', { error });
        // Show alert for debugging - REMOVE IN PRODUCTION
        const { Alert } = require('react-native');
        Alert.alert('Push Token Error', `Unexpected: ${(error as Error).message}`);
        return false;
    }
}

/**
 * Remove push token from Supabase (call on logout).
 */
export async function removePushToken(token: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('push_notification_tokens')
            .delete()
            .eq('token', token);

        if (error) {
            log.error('Failed to remove push token', { error });
            return false;
        }

        log.info('Push token removed successfully');
        return true;
    } catch (error) {
        log.error('Failed to remove push token', { error });
        return false;
    }
}

/**
 * Send a local test notification (for verifying setup).
 */
export async function sendTestNotification(): Promise<void> {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Test Notification 🎉',
            body: 'Push notifications are working!',
            data: { type: 'test' },
        },
        trigger: null, // Immediately
    });
}

/**
 * Schedule a local notification.
 */
export async function scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    delaySeconds?: number
): Promise<string> {
    const trigger: Notifications.NotificationTriggerInput = delaySeconds
        ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds }
        : null;

    return await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data ?? {},
        },
        trigger,
    });
}

/**
 * Add listener for notification received while app is foregrounded.
 */
export function addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notification response (when user taps notification).
 */
export function addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
}

// REMOVED: sendNotificationToAllUsers()
// Security risk - client must never call Expo Push API or read all tokens
// Use Edge Function instead: supabase.functions.invoke('send-notification', {...})
