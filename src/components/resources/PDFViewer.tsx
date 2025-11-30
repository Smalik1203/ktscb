/**
 * PDF Viewer Component - Opens in external browser/PDF app
 * No size limits, works everywhere
 */

import React, { useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { X } from 'lucide-react-native';

interface PDFViewerProps {
  uri: string;
  title: string;
  onClose: () => void;
}

export function PDFViewer({ uri, title, onClose }: PDFViewerProps) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    openInBrowser();
  }, []);

  const openInBrowser = async () => {
    try {
      const supported = await Linking.canOpenURL(uri);
      if (supported) {
        await Linking.openURL(uri);
        // Wait a bit then close
        setTimeout(() => onClose(), 500);
      } else {
        Alert.alert('Error', 'Cannot open this PDF URL');
        onClose();
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      Alert.alert('Error', 'Failed to open PDF');
      onClose();
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.primary[600] }]}>
        <Text style={[styles.title, { color: colors.text.inverse, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold }]}>
          {title}
        </Text>
        <TouchableOpacity onPress={onClose} style={[styles.closeButton, { borderRadius: borderRadius.full, padding: spacing.xs }]}>
          <X size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      </View>

      <View style={[styles.content, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={[styles.text, { color: colors.text.primary, fontSize: typography.fontSize.base, marginTop: spacing.lg }]}>
          Opening PDF in browser...
        </Text>
        <Text style={[styles.subtext, { color: colors.text.secondary, fontSize: typography.fontSize.sm, marginTop: spacing.sm }]}>
          Your PDF will open in a new window
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    textAlign: 'center',
  },
  subtext: {
    textAlign: 'center',
  },
});
