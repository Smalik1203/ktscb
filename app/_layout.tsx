import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { queryClient } from '../src/lib/queryClient';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ClassSelectionProvider } from '../src/contexts/ClassSelectionContext';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { NetworkStatus } from '../src/components/ui/NetworkStatus';
import { DrawerContent } from '../src/components/layout/DrawerContent';
import { initSentry } from '../src/lib/sentry';

// Initialize Sentry error tracking
initSentry();

// Inner component that uses theme
function AppContent() {
  const { colors, isDark } = useTheme();
  
  // Update system UI background based on theme
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background.app);
  }, [colors.background.app]);

  // Create Paper theme based on dark mode
  const paperTheme = useMemo(() => {
    const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.primary[600],
        background: colors.background.app,
        surface: colors.surface.primary,
        onSurface: colors.text.primary,
        onSurfaceVariant: colors.text.secondary,
        outline: colors.border.DEFAULT,
      },
    };
  }, [isDark, colors]);

  return (
    <PaperProvider theme={paperTheme}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <ClassSelectionProvider>
            <Drawer
              drawerContent={(props) => <DrawerContent {...props} />}
              screenOptions={{
                headerShown: false,
                drawerStyle: {
                  backgroundColor: colors.surface.primary,
                  width: 280,
                },
                overlayColor: colors.surface.overlay,
                drawerType: 'front',
                swipeEnabled: true,
              }}
            >
              <Drawer.Screen
                name="(tabs)"
                options={{
                  drawerLabel: () => null,
                  title: 'ClassBridge',
                }}
              />
              <Drawer.Screen
                name="login"
                options={{
                  drawerLabel: () => null,
                  title: 'Login',
                }}
              />
            </Drawer>
            <StatusBar style={isDark ? 'light' : 'dark'} translucent={false} />
            <NetworkStatus />
          </ClassSelectionProvider>
        </AuthProvider>
      </BottomSheetModalProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AppContent />
            </ThemeProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
