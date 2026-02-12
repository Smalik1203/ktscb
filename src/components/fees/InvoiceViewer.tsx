/**
 * InvoiceViewer - Receipt viewer with PDF/Image export
 * Compact version for invoice-first system
 */

import React, { useMemo, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Share, Alert, Text, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { IconButton, Button } from '../../ui';
import { WebView } from 'react-native-webview';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { documentDirectory, moveAsync, copyAsync } from 'expo-file-system/legacy';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import type { InvoiceResponse } from '../../hooks/useInvoice';

interface InvoiceViewerProps {
  visible: boolean;
  invoiceData: InvoiceResponse | null;
  onClose: () => void;
  isLoading?: boolean;
}

export const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ visible, invoiceData, onClose, isLoading = false }) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  const handleShare = useCallback(async () => {
    if (!invoiceData) return;
    try {
      await Share.share({
        message: `Fee Receipt - ${invoiceData.invoice_number}\nStudent: ${invoiceData.student_name}\nAmount: ₹${invoiceData.amount}`,
        title: `Receipt ${invoiceData.invoice_number}`,
      });
    } catch (e: any) {
      if (e.message !== 'User cancelled') Alert.alert('Share Failed', 'Unable to share.');
    }
  }, [invoiceData]);

  const handlePrint = useCallback(async () => {
    if (!invoiceData?.html_content) return;
    try {
      setIsDownloading(true);
      await Print.printAsync({ html: invoiceData.html_content, orientation: Print.Orientation.portrait });
    } catch (e) {
      Alert.alert('Print Failed', 'Unable to print.');
    } finally {
      setIsDownloading(false);
    }
  }, [invoiceData]);

  const handleDownloadPDF = useCallback(async () => {
    if (!invoiceData?.html_content) return;
    try {
      setIsDownloading(true);
      setShowDownloadOptions(false);
      const { uri } = await Print.printToFileAsync({ html: invoiceData.html_content, base64: false });
      const filename = `Receipt_${invoiceData.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const newUri = `${documentDirectory}${filename}`;
      await moveAsync({ from: uri, to: newUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, { mimeType: 'application/pdf', dialogTitle: 'Save Receipt PDF' });
      } else {
        Alert.alert('PDF Ready', `Saved: ${filename}`);
      }
    } catch (e) {
      Alert.alert('Download Failed', 'Unable to create PDF.');
    } finally {
      setIsDownloading(false);
    }
  }, [invoiceData]);

  const handleDownloadImage = useCallback(async () => {
    if (!viewShotRef.current || !invoiceData) return;
    try {
      setIsDownloading(true);
      setShowDownloadOptions(false);
      const uri = await captureRef(viewShotRef, { format: 'png', quality: 1, result: 'tmpfile' });
      const filename = `Receipt_${invoiceData.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      const newUri = `${documentDirectory}${filename}`;
      await copyAsync({ from: uri, to: newUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, { mimeType: 'image/png', dialogTitle: 'Save Receipt Image' });
      } else {
        Alert.alert('Image Ready', `Saved: ${filename}`);
      }
    } catch (e) {
      Alert.alert('Download Failed', 'Unable to create image.');
    } finally {
      setIsDownloading(false);
    }
  }, [invoiceData]);

  if (!invoiceData && isLoading) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Generating Invoice...</Text>
        </View>
      </Modal>
    );
  }

  if (!invoiceData) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}><MaterialIcons name="close" size={24} color={colors.text.primary} /></TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.title}>Fee Receipt</Text>
            <Text style={styles.subtitle}>{invoiceData.invoice_number}</Text>
          </View>
          <View style={styles.headerActions}>
            <IconButton icon={<MaterialIcons name="share" size={20} color={colors.text.secondary} />} onPress={handleShare} disabled={isDownloading} />
            <IconButton icon={<MaterialIcons name="print" size={20} color={colors.text.secondary} />} onPress={handlePrint} disabled={isDownloading} />
          </View>
        </View>

        {/* Info Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerItem}><Text style={styles.bannerLabel}>Student</Text><Text style={styles.bannerValue} numberOfLines={1}>{invoiceData.student_name}</Text></View>
          <View style={styles.bannerDivider} />
          <View style={styles.bannerItem}><Text style={styles.bannerLabel}>Amount</Text><Text style={[styles.bannerValue, { color: colors.success[700] }]}>₹{parseFloat(invoiceData.amount).toLocaleString('en-IN')}</Text></View>
          <View style={styles.bannerDivider} />
          <View style={styles.bannerItem}><Text style={styles.bannerLabel}>Date</Text><Text style={styles.bannerValue}>{invoiceData.payment_date}</Text></View>
        </View>

        {/* WebView */}
        <ViewShot ref={viewShotRef} style={styles.webViewWrap}>
          {webViewLoading && <View style={styles.webViewLoading}><ActivityIndicator size="small" color={colors.primary[600]} /></View>}
          <WebView
            ref={webViewRef}
            source={{ html: invoiceData.html_content, baseUrl: '' }}
            style={styles.webView}
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
            javaScriptEnabled
            domStorageEnabled
            scalesPageToFit
          />
        </ViewShot>

        {/* Download Options */}
        {showDownloadOptions && (
          <View style={styles.downloadOptions}>
            <TouchableOpacity style={styles.downloadOption} onPress={handleDownloadPDF} disabled={isDownloading}>
              <MaterialIcons name="description" size={20} color={colors.primary[600]} />
              <Text style={styles.downloadOptionText}>Save as PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadOption} onPress={handleDownloadImage} disabled={isDownloading}>
              <MaterialIcons name="image" size={20} color={colors.primary[600]} />
              <Text style={styles.downloadOptionText}>Save as Image</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          {invoiceData.cached && (
            <View style={styles.cachedBadge}><MaterialIcons name="check-circle" size={14} color={colors.success[600]} /><Text style={styles.cachedText}>Cached</Text></View>
          )}
          <View style={styles.footerActions}>
            <Button variant="outline" onPress={handleShare} disabled={isDownloading}>Share</Button>
            <Button variant="primary" onPress={() => setShowDownloadOptions(!showDownloadOptions)} loading={isDownloading} disabled={isDownloading}>
              {isDownloading ? 'Saving...' : 'Download'}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.app },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.text.secondary },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface.primary, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  closeBtn: { padding: spacing.xs, marginRight: spacing.sm },
  headerTitle: { flex: 1 },
  title: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary },
  subtitle: { fontSize: typography.fontSize.sm, color: colors.text.secondary },
  headerActions: { flexDirection: 'row' },
  banner: { flexDirection: 'row', backgroundColor: colors.primary[50], padding: spacing.md },
  bannerItem: { flex: 1, alignItems: 'center' },
  bannerDivider: { width: 1, height: 30, backgroundColor: colors.primary[200] },
  bannerLabel: { fontSize: typography.fontSize.xs, color: colors.primary[600], textTransform: 'uppercase' },
  bannerValue: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.text.primary },
  webViewWrap: { flex: 1, backgroundColor: '#f5f5f5' },
  webViewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.app, zIndex: 1 },
  webView: { flex: 1 },
  downloadOptions: { position: 'absolute', bottom: 80, right: spacing.md, backgroundColor: colors.surface.primary, borderRadius: borderRadius.lg, ...shadows.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border.light },
  downloadOption: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  downloadOptionText: { fontSize: typography.fontSize.base, color: colors.text.primary },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface.primary, borderTopWidth: 1, borderTopColor: colors.border.light },
  cachedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.success[50], paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full, gap: 4 },
  cachedText: { fontSize: typography.fontSize.xs, color: colors.success[700] },
  footerActions: { flexDirection: 'row', gap: spacing.sm },
});

export default InvoiceViewer;
