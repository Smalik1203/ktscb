import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router/stack';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useEffect, useMemo } from 'react';
import * as SystemUI from 'expo-system-ui';
import { queryClient } from '../src/lib/queryClient';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { ClassSelectionProvider } from '../src/contexts/ClassSelectionContext';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { NetworkStatus } from '../src/components/ui/NetworkStatus';
import { DrawerContent } from '../src/components/layout/DrawerContent';
import { initSentry } from '../src/lib/sentry';
import { ActivityIndicator, View } from 'react-native';

// Initialize Sentry error tracking
initSentry();

// Root Stack - Handles both auth and app screens
// Expo Router file-based routing means we need a single root navigator
function RootStack() {
  const auth = useAuth();
  const { colors, isDark } = useTheme();

  // Show loading while checking auth state
  if (auth.status === 'checking' || auth.loading || auth.bootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.app }}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  // If authenticated, show Drawer (App Stack)
  if (auth.status === 'signedIn' && auth.profile) {
    return (
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
        {/* Hide login from drawer - it's only accessible via Stack */}
        <Drawer.Screen
          name="login"
          options={{
            drawerLabel: () => null,
            title: 'Login',
            drawerItemStyle: { display: 'none' },
          }}
        />
      </Drawer>
    );
  }

  // If not authenticated, show Stack (Auth Stack)
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      {/* Hide authenticated routes from auth stack */}
      <Stack.Screen 
        name="(tabs)" 
        options={{ 
          presentation: 'transparentModal',
          animation: 'none',
        }} 
      />
    </Stack>
  );
}

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
            <RootStack />
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
