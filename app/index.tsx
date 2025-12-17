import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { colors } from '../lib/design-system';

export default function IndexScreen() {
  const auth = useAuth();

  // 1) While checking session or bootstrapping profile, show loading
  if (auth.status === 'checking' || auth.loading || auth.bootstrapping) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </SafeAreaView>
    );
  }

  // 2) Signed in with profile -> redirect to app (Drawer will handle this)
  if (auth.status === 'signedIn' && auth.profile) {
    return <Redirect href="/(tabs)" />;
  }

  // 3) All other cases (signedOut, accessDenied, no profile) -> redirect to login
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
});
