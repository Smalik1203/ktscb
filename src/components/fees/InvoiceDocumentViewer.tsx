/**
 * InvoiceDocumentViewer - HTML-first invoice viewer with PDF/Share/Print
 * Shows invoice document generated from fee_invoices (not payments)
 * PDF is a derivative export, not the source
 */

import React, { useMemo, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Share, Alert } from 'react-native';
import { Text, ActivityIndicator, IconButton, Button } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { documentDirectory, moveAsync, copyAsync } from 'expo-file-system/legacy';
import { X, Download, Share2, Printer, FileText, Image as ImageIcon, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { invoiceService } from '../../services/fees';
import { useMutation } from '@tanstack/react-query';

interface InvoiceDocumentViewerProps {
  invoiceId: string;
  visible: boolean;
  onClose: () => void;
}

interface InvoiceDocumentData {
  invoice_number: string;
  html_content: string;
  server_computed: {
    total: number;
    paid: number;
    balance: number;
    status: string;
  };
  generated_at: string;
}

export function InvoiceDocumentViewer({ invoiceId, visible, onClose }: InvoiceDocumentViewerProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate invoice document
  const generateMutation = useMutation({
    mutationFn: (forceRegenerate: boolean) => 
      invoiceService.generateInvoiceDocument(invoiceId, forceRegenerate),
    onError: (err: any) => {
      setError(err.message || 'Failed to generate invoice document');
    },
  });

  const invoiceData = generateMutation.data;

  // Auto-generate on open
  React.useEffect(() => {
    if (visible && invoiceId && !generateMutation.data && !generateMutation.isPending) {
      generateMutation.mutate(false);
      setError(null);
    }
  }, [visible, invoiceId]);

  const handleRetry = useCallback(() => {
    setError(null);
    generateMutation.mutate(true);
  }, [generateMutation]);

  const handleShare = useCallback(async () => {
    if (!invoiceData) return;
    try {
      await Share.share({
        message: `Invoice - ${invoiceData.invoice_number}\nTotal: ₹${invoiceData.server_computed.total.toLocaleString('en-IN')}\nBalance: ₹${invoiceData.server_computed.balance.toLocaleString('en-IN')}`,
        title: `Invoice ${invoiceData.invoice_number}`,
      });
    } catch (e: any) {
      if (e.message !== 'User cancelled') Alert.alert('Share Failed', 'Unable to share.');
    }
  }, [invoiceData]);

  const handlePrint = useCallback(async () => {
    if (!invoiceData?.html_content) return;
    try {
      setIsDownloading(true);
      await Print.printAsync({ 
        html: invoiceData.html_content, 
        orientation: Print.Orientation.portrait 
      });
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
      const { uri } = await Print.printToFileAsync({ 
        html: invoiceData.html_content, 
        base64: false 
      });
      const filename = `Invoice_${invoiceData.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const newUri = `${documentDirectory}${filename}`;
      await moveAsync({ from: uri, to: newUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, { 
          mimeType: 'application/pdf', 
          dialogTitle: 'Save Invoice PDF' 
        });
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
      const uri = await captureRef(viewShotRef, { 
        format: 'png', 
        quality: 1, 
        result: 'tmpfile' 
      });
      const filename = `Invoice_${invoiceData.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      const newUri = `${documentDirectory}${filename}`;
      await copyAsync({ from: uri, to: newUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, { 
          mimeType: 'image/png', 
          dialogTitle: 'Save Invoice Image' 
        });
      } else {
        Alert.alert('Image Ready', `Saved: ${filename}`);
      }
    } catch (e) {
      Alert.alert('Download Failed', 'Unable to create image.');
    } finally {
      setIsDownloading(false);
    }
  }, [invoiceData]);

  if (!visible) return null;

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="pageSheet" 
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.title}>Invoice Document</Text>
            {invoiceData && (
              <Text style={styles.subtitle}>{invoiceData.invoice_number}</Text>
            )}
          </View>
          <View style={styles.headerActions}>
            <IconButton 
              icon={() => <RefreshCw size={20} color={colors.text.secondary} />} 
              onPress={handleRetry} 
              disabled={generateMutation.isPending || isDownloading}
            />
            <IconButton 
              icon={() => <Share2 size={20} color={colors.text.secondary} />} 
              onPress={handleShare} 
              disabled={!invoiceData || isDownloading}
            />
            <IconButton 
              icon={() => <Printer size={20} color={colors.text.secondary} />} 
              onPress={handlePrint} 
              disabled={!invoiceData || isDownloading}
            />
          </View>
        </View>

        {/* Loading State */}
        {generateMutation.isPending && !invoiceData && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Generating Invoice...</Text>
          </View>
        )}

        {/* Error State with Fallback */}
        {error && !invoiceData && (
          <View style={styles.centered}>
            <AlertCircle size={48} color={colors.error[600]} />
            <Text style={styles.errorTitle}>Failed to Generate Invoice</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button 
              mode="contained" 
              onPress={handleRetry}
              style={styles.retryButton}
            >
              Retry
            </Button>
            <Button 
              mode="outlined" 
              onPress={onClose}
              style={styles.closeButton}
            >
              Close
            </Button>
          </View>
        )}

        {/* Invoice Content */}
        {invoiceData && !error && (
          <>
            {/* Info Banner */}
            <View style={styles.banner}>
              <View style={styles.bannerItem}>
                <Text style={styles.bannerLabel}>Status</Text>
                <Text style={[
                  styles.bannerValue, 
                  { color: invoiceData.server_computed.status === 'PAID' ? colors.success[700] : 
                           invoiceData.server_computed.status === 'PARTIAL' ? colors.warning[700] : 
                           colors.error[700] }
                ]}>
                  {invoiceData.server_computed.status}
                </Text>
              </View>
              <View style={styles.bannerDivider} />
              <View style={styles.bannerItem}>
                <Text style={styles.bannerLabel}>Total</Text>
                <Text style={styles.bannerValue}>
                  ₹{invoiceData.server_computed.total.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.bannerDivider} />
              <View style={styles.bannerItem}>
                <Text style={styles.bannerLabel}>Balance</Text>
                <Text style={[
                  styles.bannerValue,
                  { color: invoiceData.server_computed.balance > 0 ? colors.error[700] : colors.success[700] }
                ]}>
                  ₹{invoiceData.server_computed.balance.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* WebView */}
            <ViewShot ref={viewShotRef} style={styles.webViewWrap}>
              {webViewLoading && (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                </View>
              )}
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
                <TouchableOpacity 
                  style={styles.downloadOption} 
                  onPress={handleDownloadPDF} 
                  disabled={isDownloading}
                >
                  <FileText size={20} color={colors.primary[600]} />
                  <Text style={styles.downloadOptionText}>Save as PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.downloadOption} 
                  onPress={handleDownloadImage} 
                  disabled={isDownloading}
                >
                  <ImageIcon size={20} color={colors.primary[600]} />
                  <Text style={styles.downloadOptionText}>Save as Image</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.generatedText}>
                Generated: {new Date(invoiceData.generated_at).toLocaleString('en-IN')}
              </Text>
              <View style={styles.footerActions}>
                <Button 
                  mode="outlined" 
                  onPress={handleShare} 
                  disabled={isDownloading}
                >
                  Share
                </Button>
                <Button 
                  mode="contained" 
                  onPress={() => setShowDownloadOptions(!showDownloadOptions)} 
                  loading={isDownloading} 
                  disabled={isDownloading}
                  icon={() => <Download size={18} color="#fff" />}
                >
                  {isDownloading ? 'Saving...' : 'Download'}
                </Button>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (
  colors: ThemeColors,
  typography: any,
  spacing: any,
  borderRadius: any,
  shadows: any
) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background.app 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: { 
    marginTop: spacing.md, 
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  errorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  closeButton: {
    marginTop: spacing.xs,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: spacing.md, 
    backgroundColor: colors.surface.primary, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border.light 
  },
  closeBtn: { 
    padding: spacing.xs, 
    marginRight: spacing.sm 
  },
  headerTitle: { 
    flex: 1 
  },
  title: { 
    fontSize: typography.fontSize.lg, 
    fontWeight: typography.fontWeight.bold, 
    color: colors.text.primary 
  },
  subtitle: { 
    fontSize: typography.fontSize.sm, 
    color: colors.text.secondary 
  },
  headerActions: { 
    flexDirection: 'row' 
  },
  banner: { 
    flexDirection: 'row', 
    backgroundColor: colors.primary[50], 
    padding: spacing.md 
  },
  bannerItem: { 
    flex: 1, 
    alignItems: 'center' 
  },
  bannerDivider: { 
    width: 1, 
    height: 30, 
    backgroundColor: colors.primary[200] 
  },
  bannerLabel: { 
    fontSize: typography.fontSize.xs, 
    color: colors.primary[600], 
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  bannerValue: { 
    fontSize: typography.fontSize.sm, 
    fontWeight: typography.fontWeight.semibold, 
    color: colors.text.primary 
  },
  webViewWrap: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  webViewLoading: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: colors.background.app, 
    zIndex: 1 
  },
  webView: { 
    flex: 1 
  },
  downloadOptions: { 
    position: 'absolute', 
    bottom: 80, 
    right: spacing.md, 
    backgroundColor: colors.surface.primary, 
    borderRadius: borderRadius.lg, 
    ...shadows.lg, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: colors.border.light 
  },
  downloadOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: spacing.md, 
    gap: spacing.sm, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border.light 
  },
  downloadOptionText: { 
    fontSize: typography.fontSize.base, 
    color: colors.text.primary 
  },
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: spacing.md, 
    backgroundColor: colors.surface.primary, 
    borderTopWidth: 1, 
    borderTopColor: colors.border.light 
  },
  generatedText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  footerActions: { 
    flexDirection: 'row', 
    gap: spacing.sm 
  },
});

