/**
 * Portal Component
 * 
 * Renders children into a separate layer above the rest of the app.
 * Used by Modal, Toast, and Menu components.
 * 
 * Wrap your app root with <PortalProvider> and use <Portal> anywhere
 * to render content on top of everything else.
 * 
 * @example
 * ```tsx
 * // In _layout.tsx
 * <PortalProvider>
 *   <App />
 * </PortalProvider>
 * 
 * // Anywhere in the app
 * <Portal>
 *   <View style={styles.overlay}>
 *     <Text>I render above everything!</Text>
 *   </View>
 * </Portal>
 * ```
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

// ============================================================================
// Types
// ============================================================================

interface PortalEntry {
  key: string;
  children: React.ReactNode;
}

interface PortalContextValue {
  mount: (key: string, children: React.ReactNode) => void;
  unmount: (key: string) => void;
  update: (key: string, children: React.ReactNode) => void;
}

// ============================================================================
// Context
// ============================================================================

const PortalContext = createContext<PortalContextValue | null>(null);

function usePortalContext(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error('Portal must be used within a PortalProvider');
  }
  return ctx;
}

// ============================================================================
// PortalProvider
// ============================================================================

interface PortalProviderProps {
  children: React.ReactNode;
}

export function PortalProvider({ children }: PortalProviderProps) {
  const [entries, setEntries] = useState<PortalEntry[]>([]);

  const mount = useCallback((key: string, node: React.ReactNode) => {
    setEntries(prev => [...prev.filter(e => e.key !== key), { key, children: node }]);
  }, []);

  const unmount = useCallback((key: string) => {
    setEntries(prev => prev.filter(e => e.key !== key));
  }, []);

  const update = useCallback((key: string, node: React.ReactNode) => {
    setEntries(prev =>
      prev.map(e => (e.key === key ? { key, children: node } : e)),
    );
  }, []);

  return (
    <PortalContext.Provider value={{ mount, unmount, update }}>
      {children}
      {/* Portal host - renders all portaled content on top */}
      <View style={styles.host} pointerEvents="box-none">
        {entries.map(entry => (
          <View
            key={entry.key}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
            collapsable={false}
          >
            {entry.children}
          </View>
        ))}
      </View>
    </PortalContext.Provider>
  );
}

// ============================================================================
// Portal
// ============================================================================

interface PortalProps {
  children: React.ReactNode;
}

let portalKeyCounter = 0;

export function Portal({ children }: PortalProps) {
  const { mount, unmount, update } = usePortalContext();
  const keyRef = useRef<string>(`portal-${++portalKeyCounter}`);

  React.useEffect(() => {
    mount(keyRef.current, children);
    return () => unmount(keyRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    update(keyRef.current, children);
  }, [children, update]);

  return null;
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
});
