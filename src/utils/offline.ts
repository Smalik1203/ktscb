import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

export function useNetworkStatus() {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    type: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    return unsubscribe;
  }, []);

  return networkState;
}

export function isOnline(): Promise<boolean> {
  return NetInfo.fetch().then(state => state.isConnected ?? false);
}

export function getNetworkType(): Promise<string | null> {
  return NetInfo.fetch().then(state => state.type);
}

// Offline queue for failed requests
class OfflineQueue {
  private queue: {
    id: string;
    request: () => Promise<any>;
    timestamp: number;
  }[] = [];

  add(request: () => Promise<any>): string {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.queue.push({
      id,
      request,
      timestamp: Date.now(),
    });
    return id;
  }

  async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    const online = await isOnline();
    if (!online) return;

    const requests = [...this.queue];
    this.queue = [];

    for (const item of requests) {
      try {
        await item.request();
      } catch (_error) {
        // Re-add to queue if it fails
        this.queue.push(item);
      }
    }
  }

  clear(): void {
    this.queue = [];
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const offlineQueue = new OfflineQueue();

// Auto-process queue when connection is restored.
// Listener is stored so it can be unsubscribed if needed.
export const _unsubscribeNetInfo = NetInfo.addEventListener(state => {
  if (state.isConnected) {
    offlineQueue.processQueue();
  }
});
