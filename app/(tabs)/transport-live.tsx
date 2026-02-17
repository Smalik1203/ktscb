import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

// react-native-maps is native-only — lazy import to prevent web bundle crash
const LiveBusMapScreen = React.lazy(
  () => import('../../src/features/transport/viewer/LiveBusMapScreen')
);

export default function TransportLive() {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.center}>
        <Text>Maps are not supported on web.</Text>
      </View>
    );
  }

  return (
    <React.Suspense fallback={<View style={styles.center} />}>
      <LiveBusMapScreen />
    </React.Suspense>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
