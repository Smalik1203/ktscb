import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import PaymentHistory from '../../components/fees/PaymentHistory';

export default function PaymentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <PaymentHistory />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
  });
