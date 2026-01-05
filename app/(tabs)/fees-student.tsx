import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StudentFeesView } from '../../src/components/fees';

export default function StudentFeesScreen() {
  return (
    <View style={styles.container}>
      <StudentFeesView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
