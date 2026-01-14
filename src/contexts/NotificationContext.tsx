/**
 * NotificationProvider
 * 
 * Wraps the app to initialize push notification registration.
 * Must be placed inside AuthProvider to access user context.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useNotifications, type UseNotificationsReturn } from '../hooks/useNotifications';

const NotificationContext = createContext<UseNotificationsReturn | null>(null);

interface NotificationProviderProps {
    children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
    const notifications = useNotifications();

    return (
        <NotificationContext.Provider value={notifications}>
            {children}
        </NotificationContext.Provider>
    );
}

/**
 * Hook to access notification context.
 * Can be used to trigger test notifications or check permission status.
 */
export function useNotificationContext(): UseNotificationsReturn {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotificationContext must be used within NotificationProvider');
    }
    return context;
}
