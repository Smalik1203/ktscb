import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { StudentFeesView } from '../../components/fees/StudentFeesView';

export default function StudentFeesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <StudentFeesView />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.app,
    },
  });
