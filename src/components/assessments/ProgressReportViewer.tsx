// src/components/assessments/ProgressReportViewer.tsx
import React, { useMemo, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { documentDirectory, moveAsync, copyAsync } from 'expo-file-system/legacy';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import type { ProgressReportResponse } from '../../hooks/useProgressReport';
import { log } from '../../lib/logger';

interface ProgressReportViewerProps {
  visible: boolean;
  reportData: ProgressReportResponse | null;
  onClose: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const ProgressReportViewer: React.FC<ProgressReportViewerProps> = ({
  visible,
  reportData,
  onClose,
  onRefresh,
  isLoading = false,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );
  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A+': return colors.success[600];
      case 'A': return colors.success[500];
      case 'B+': return colors.primary[600];
      case 'B': return colors.primary[500];
      case 'C': return colors.warning[600];
      case 'D': return colors.warning[500];
      default: return colors.error[600];
    }
  };

  // Handle share functionality
  const handleShare = useCallback(async () => {
    if (!reportData) return;

    try {
      const shareMessage = 
        `📊 Progress Report - ${reportData.student_name}\n` +
        `📚 Total Tests: ${reportData.total_tests}\n` +
        `📈 Overall Average: ${reportData.overall_average.toFixed(1)}%`;

      await Share.share({
        message: shareMessage,
        title: `Progress Report - ${reportData.student_name}`,
      });
    } catch (error: any) {
      log.error('Share error:', error);
      if (error.message !== 'User cancelled') {
        Alert.alert('Share Failed', 'Unable to share the report. Please try again.');
      }
    }
  }, [reportData]);

  // Handle print functionality
  const handlePrint = useCallback(async () => {
    if (!reportData?.html_content) return;

    try {
      setIsDownloading(true);
      await Print.printAsync({
        html: reportData.html_content,
        orientation: Print.Orientation.portrait,
      });
    } catch (error: any) {
      log.error('Print error:', error);
      if (!error.message?.includes('cancelled')) {
        Alert.alert('Print Failed', 'Unable to print the report. Please try again.');
      }
    } finally {
      setIsDownloading(false);
    }
  }, [reportData]);

  // Handle PDF download/share
  const handleDownloadPDF = useCallback(async () => {
    if (!reportData?.html_content) return;

    try {
      setIsDownloading(true);
      setShowDownloadOptions(false);

      const { uri } = await Print.printToFileAsync({
        html: reportData.html_content,
        base64: false,
      });

      const safeName = reportData.student_name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Progress_Report_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`;
      const newUri = `${documentDirectory}${filename}`;

      await moveAsync({
        from: uri,
        to: newUri,
      });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      
      if (isSharingAvailable) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share Progress Report PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(
          'PDF Ready',
          `Your progress report has been saved as PDF.\n\nLocation: ${newUri}`,
          [{ text: 'OK' }]
        );
      }

      log.info('Progress report PDF generated:', filename);
    } catch (error: any) {
      log.error('PDF download error:', error);
      Alert.alert(
        'Download Failed',
        'Unable to create PDF. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDownloading(false);
    }
  }, [reportData]);

  // Handle Image download/share
  const handleDownloadImage = useCallback(async () => {
    if (!viewShotRef.current || !reportData) return;

    try {
      setIsDownloading(true);
      setShowDownloadOptions(false);

      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const safeName = reportData.student_name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Progress_Report_${safeName}_${new Date().toISOString().split('T')[0]}.png`;
      const newUri = `${documentDirectory}${filename}`;

      await copyAsync({
        from: uri,
        to: newUri,
      });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      
      if (isSharingAvailable) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'image/png',
          dialogTitle: 'Save or Share Progress Report Image',
          UTI: 'public.png',
        });
      } else {
        Alert.alert(
          'Image Ready',
          `Your progress report has been saved as an image.\n\nLocation: ${newUri}`,
          [{ text: 'OK' }]
        );
      }

      log.info('Progress report image generated:', filename);
    } catch (error: any) {
      log.error('Image download error:', error);
      Alert.alert(
        'Download Failed',
        'Unable to create image. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDownloading(false);
    }
  }, [reportData]);

  const toggleDownloadOptions = useCallback(() => {
    setShowDownloadOptions(prev => !prev);
  }, []);

  // Render loading state
  if (!reportData && isLoading) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Generating Progress Report...</Text>
            <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Don't render if no data
  if (!reportData) {
    return null;
  }

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
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Progress Report</Text>
              <Text style={styles.headerSubtitle}>{reportData.student_name}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {onRefresh && (
              <TouchableOpacity
                onPress={onRefresh}
                disabled={isLoading || isDownloading}
                style={styles.headerIconButton}
              >
                <MaterialIcons name="refresh" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleShare}
              disabled={isDownloading}
              style={styles.headerIconButton}
            >
              <MaterialIcons name="share" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePrint}
              disabled={isDownloading}
              style={styles.headerIconButton}
            >
              <MaterialIcons name="print" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Banner - NO GRADE, only percentage */}
        <View style={styles.statsBanner}>
          <View style={styles.statItem}>
            <View style={styles.statIcon}>
              <MaterialIcons name="menu-book" size={16} color={colors.primary[600]} />
            </View>
            <Text style={styles.statLabel}>Tests</Text>
            <Text style={styles.statValue}>{reportData.total_tests}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statIcon}>
              <MaterialIcons name="trending-up" size={16} color={colors.success[600]} />
            </View>
            <Text style={styles.statLabel}>Average</Text>
            <Text style={[styles.statValue, { color: colors.success[600] }]}>
              {reportData.overall_average.toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* WebView for Report HTML (wrapped in ViewShot for image capture) */}
        <ViewShot
          ref={viewShotRef}
          style={styles.webViewContainer}
          options={{ format: 'png', quality: 1 }}
        >
          {webViewLoading && !webViewError && (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.webViewLoadingText}>Loading report...</Text>
            </View>
          )}
          
          {/* Error State */}
          {webViewError && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error" size={48} color={colors.error[500]} />
              <Text style={styles.errorTitle}>Failed to Load Report</Text>
              <Text style={styles.errorText}>{webViewError}</Text>
              <TouchableOpacity
                onPress={() => {
                  setWebViewError(null);
                  setWebViewLoading(true);
                  webViewRef.current?.reload();
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {!webViewError && (
            <WebView
              ref={webViewRef}
              source={{
                html: reportData.html_content,
                baseUrl: '',
              }}
              style={styles.webView}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={true}
              onLoadStart={() => {
                setWebViewLoading(true);
                setWebViewError(null);
              }}
              onLoadEnd={() => setWebViewLoading(false)}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                log.error('WebView error:', nativeEvent);
                setWebViewLoading(false);
                setWebViewError(nativeEvent.description || 'Unable to display the report. Please try again.');
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                log.error('WebView HTTP error:', nativeEvent);
                if (nativeEvent.statusCode >= 400) {
                  setWebViewError(`HTTP Error ${nativeEvent.statusCode}: Unable to load report.`);
                }
              }}
              renderError={(errorDomain, errorCode, errorDesc) => (
                <View style={styles.errorContainer}>
                  <MaterialIcons name="error" size={48} color={colors.error[500]} />
                  <Text style={styles.errorTitle}>Display Error</Text>
                  <Text style={styles.errorText}>{errorDesc || 'Failed to render report'}</Text>
                </View>
              )}
              injectedJavaScript={`
                const meta = document.createElement('meta');
                meta.name = 'viewport';
                meta.content = 'width=device-width, initial-scale=0.45, maximum-scale=2.0, user-scalable=yes';
                document.head.appendChild(meta);
                document.body.style.margin = '0';
                document.body.style.padding = '0';
                true;
              `}
            />
          )}
        </ViewShot>

        {/* Download Options Dropdown */}
        {showDownloadOptions && (
          <View style={styles.downloadOptionsContainer}>
            <TouchableOpacity
              style={styles.downloadOption}
              onPress={handleDownloadPDF}
              disabled={isDownloading}
            >
              <MaterialIcons name="description" size={20} color={colors.primary[600]} />
              <View style={styles.downloadOptionText}>
                <Text style={styles.downloadOptionTitle}>Save as PDF</Text>
                <Text style={styles.downloadOptionSubtitle}>Best for printing & records</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.downloadOptionDivider} />
            <TouchableOpacity
              style={styles.downloadOption}
              onPress={handleDownloadImage}
              disabled={isDownloading}
            >
              <MaterialIcons name="image" size={20} color={colors.primary[600]} />
              <View style={styles.downloadOptionText}>
                <Text style={styles.downloadOptionTitle}>Save as Image</Text>
                <Text style={styles.downloadOptionSubtitle}>Best for sharing on WhatsApp</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer with Actions */}
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <MaterialIcons name="emoji-events" size={16} color={colors.text.secondary} />
            <Text style={styles.footerInfoText}>
              {reportData.total_tests > 0 
                ? `Based on ${reportData.total_tests} assessments`
                : 'No assessments yet'}
            </Text>
          </View>
          <View style={styles.footerActions}>
            <TouchableOpacity
              onPress={handleShare}
              style={styles.footerShareButton}
              disabled={isDownloading}
            >
              <MaterialIcons name="share" size={18} color={colors.primary[600]} />
              <Text style={styles.footerShareButtonText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleDownloadOptions}
              style={[styles.footerButton, styles.downloadButton]}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size={18} color="#fff" />
              ) : (
                <MaterialIcons name="download" size={18} color="#fff" />
              )}
              <Text style={styles.downloadButtonText}>
                {isDownloading ? 'Saving...' : 'Download'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (
  colors: ThemeColors,
  typography: any,
  spacing: any,
  borderRadius: any,
  shadows: any
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.app,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      ...shadows.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    closeButton: {
      padding: spacing.sm,
      marginRight: spacing.sm,
    },
    headerTitleContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    headerSubtitle: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    headerIconButton: {
      padding: spacing.sm,
    },
    statsBanner: {
      flexDirection: 'row',
      backgroundColor: colors.primary[50],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statIcon: {
      marginBottom: spacing.xs,
    },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.primary[200],
    },
    statLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.primary[600],
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    statValue: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    gradeCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    gradeText: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.bold,
      color: '#fff',
    },
    webViewContainer: {
      flex: 1,
      backgroundColor: '#f5f5f5',
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
      zIndex: 1,
    },
    webViewLoadingText: {
      marginTop: spacing.sm,
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    webView: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    loadingSubtext: {
      marginTop: spacing.xs,
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    downloadOptionsContainer: {
      position: 'absolute',
      bottom: 80,
      right: spacing.md,
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      ...shadows.lg,
      width: 260,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    downloadOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.md,
    },
    downloadOptionText: {
      flex: 1,
    },
    downloadOptionTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    downloadOptionSubtitle: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: 2,
    },
    downloadOptionDivider: {
      height: 1,
      backgroundColor: colors.border.light,
      marginHorizontal: spacing.md,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface.primary,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      ...shadows.md,
    },
    footerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    footerInfoText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
    },
    footerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    footerShareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.primary[600],
    },
    footerShareButtonText: {
      fontSize: typography.fontSize.sm,
      color: colors.primary[600],
      fontWeight: typography.fontWeight.semibold,
    },
    footerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
    },
    downloadButton: {
      backgroundColor: colors.primary[600],
    },
    downloadButtonText: {
      fontSize: typography.fontSize.sm,
      color: '#fff',
      fontWeight: typography.fontWeight.semibold,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
      backgroundColor: colors.background.app,
    },
    errorTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    errorText: {
      fontSize: typography.fontSize.base,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    retryButton: {
      marginTop: spacing.md,
      backgroundColor: colors.primary[600],
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.md,
    },
    retryButtonText: {
      color: '#fff',
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
    },
  });

export default ProgressReportViewer;

