import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useEffect } from 'react';
import * as SystemUI from 'expo-system-ui';
import { queryClient } from '../src/lib/queryClient';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ClassSelectionProvider } from '../src/contexts/ClassSelectionContext';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { NetworkStatus } from '../src/components/ui/NetworkStatus';
import { DrawerContent } from '../src/components/layout/DrawerContent';
import { initSentry } from '../src/lib/sentry';

// Initialize Sentry error tracking
initSentry();

export default function RootLayout() {
  useFrameworkReady();

  // Force light mode at runtime
  useEffect(() => {
    SystemUI.setBackgroundColorAsync('#fffbf9'); // Match app background color
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <PaperProvider>
              <BottomSheetModalProvider>
                <AuthProvider>
                  <ClassSelectionProvider>
                    <Drawer
                      drawerContent={(props) => <DrawerContent {...props} />}
                      screenOptions={{
                        headerShown: false,
                        drawerStyle: {
                          backgroundColor: '#ffffff',
                          width: 280,
                        },
                        overlayColor: 'rgba(0, 0, 0, 0.5)',
                        drawerType: 'front',
                        swipeEnabled: true,
                      }}
                    >
                      <Drawer.Screen
                        name="(tabs)"
                        options={{
                          drawerLabel: () => null, // Hide from drawer since we have custom navigation
                          title: 'ClassBridge',
                        }}
                      />
                      <Drawer.Screen
                        name="login"
                        options={{
                          drawerLabel: () => null, // Hide from drawer
                          title: 'Login',
                        }}
                      />
                    </Drawer>
                    <StatusBar style="dark" translucent={false} />
                    <NetworkStatus />
                  </ClassSelectionProvider>
                </AuthProvider>
              </BottomSheetModalProvider>
            </PaperProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
