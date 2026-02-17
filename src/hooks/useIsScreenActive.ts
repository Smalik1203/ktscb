/**
 * useIsScreenActive — Combines screen focus + app foreground state
 *
 * Returns `true` only when BOTH conditions are met:
 *   1. The screen is the currently focused tab/stack screen
 *   2. The app is in the foreground (active)
 *
 * Use this to gate expensive work (polling, animations, subscriptions)
 * so they pause automatically when the user navigates away or
 * backgrounds the app.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

export function useIsScreenActive(): boolean {
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === 'active',
  );
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      // Only update state when actually changing to avoid re-renders
      if (
        (next === 'active') !== (appStateRef.current === 'active')
      ) {
        setAppActive(next === 'active');
      }
      appStateRef.current = next;
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return isFocused && appActive;
}
