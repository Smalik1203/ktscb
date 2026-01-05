/**
 * PDF Viewer Component - FAST In-App Rendering
 * 
 * Uses pdf.js to stream directly from URL (much faster than base64)
 * Progressive rendering - shows pages as they render
 * Efficient for large files
 */

import React, { useState, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { X, AlertCircle, RefreshCw } from 'lucide-react-native';
import { WebView } from 'react-native-webview';

interface PDFViewerProps {
  uri: string;
  title: string;
  onClose: () => void;
}

type ViewerState = 'loading' | 'ready' | 'error';

export function PDFViewer({ uri, title, onClose }: PDFViewerProps) {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const [state, setState] = useState<ViewerState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ page: 0, total: 0 });

  const handleRetry = () => {
    setState('loading');
    setError(null);
    setProgress({ page: 0, total: 0 });
    webViewRef.current?.reload();
  };

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      // Validate event data exists and is a string
      const eventData = event?.nativeEvent?.data;
      if (!eventData || typeof eventData !== 'string' || eventData.trim().length === 0) {
        return; // Ignore invalid messages
      }
      
      let data;
      try {
        data = JSON.parse(eventData);
      } catch (parseError) {
        // Invalid JSON - ignore message
        console.warn('Invalid JSON in PDF viewer message:', parseError);
        return;
      }
      
      if (data.type === 'progress') {
        setProgress({ page: data.page, total: data.total });
        if (data.page === 1) setState('ready'); // Show as soon as first page renders
      } else if (data.type === 'loaded') {
        setState('ready');
      } else if (data.type === 'error') {
        setError(data.message);
        setState('error');
      }
    } catch (e) { }
  };

  // Optimized HTML with streaming pdf.js - progressive rendering
  const getPdfJsHtml = (pdfUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; height: 100%; 
      background: #525659;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
    }
    #viewer {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      gap: 8px;
    }
    canvas {
      display: block;
      background: white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: white;
      font-family: -apple-system, sans-serif;
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .page-badge {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.75);
      color: white;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 13px;
      font-family: -apple-system, sans-serif;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body>
  <div id="loading" class="loading">
    <div class="spinner"></div>
    <p style="margin-top:12px;font-size:14px;">Loading PDF...</p>
  </div>
  <div id="viewer"></div>
  <div id="badge" class="page-badge" style="display:none;"></div>

  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const url = '${pdfUrl}';
    const viewer = document.getElementById('viewer');
    const loading = document.getElementById('loading');
    const badge = document.getElementById('badge');
    const RN = window.ReactNativeWebView;
    
    pdfjsLib.getDocument(url).promise.then(async pdf => {
      loading.style.display = 'none';
      const total = pdf.numPages;
      
      for (let i = 1; i <= total; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        const scale = Math.min((window.innerWidth - 16) / vp.width, 1.5);
        const scaled = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        canvas.width = scaled.width;
        canvas.height = scaled.height;
        viewer.appendChild(canvas);
        
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled }).promise;
        
        badge.textContent = i + ' / ' + total;
        badge.style.display = 'block';
        
        if (RN) RN.postMessage(JSON.stringify({ type: 'progress', page: i, total }));
      }
      
      if (RN) RN.postMessage(JSON.stringify({ type: 'loaded', pages: total }));
      
    }).catch(err => {
      loading.innerHTML = '<p style="color:#ff6b6b;">Failed to load: ' + err.message + '</p>';
      if (RN) RN.postMessage(JSON.stringify({ type: 'error', message: err.message }));
    });
  </script>
</body>
</html>`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.primary[600] }]}>
        <Text style={[styles.title, { color: colors.text.inverse, fontSize: typography.fontSize.base }]} numberOfLines={1}>
          {title}
        </Text>
        {progress.total > 0 && (
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginRight: spacing.sm }}>
            {progress.page}/{progress.total}
          </Text>
        )}
        <TouchableOpacity onPress={onClose} style={[styles.closeButton, { borderRadius: borderRadius.full, padding: spacing.xs }]}>
          <X size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {state === 'error' ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color={colors.error[600]} />
            <Text style={[styles.errorText, { color: colors.text.primary, marginTop: spacing.lg }]}>
              Failed to load PDF
            </Text>
            <Text style={{ color: colors.text.secondary, marginTop: spacing.xs, textAlign: 'center' }}>
              {error}
            </Text>
            <TouchableOpacity onPress={handleRetry} style={[styles.retryBtn, { backgroundColor: colors.primary[600], borderRadius: borderRadius.md, marginTop: spacing.lg }]}>
              <RefreshCw size={18} color={colors.text.inverse} />
              <Text style={{ color: colors.text.inverse, marginLeft: spacing.xs, fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.webViewContainer}>
            {state === 'loading' && (
              <View style={[styles.loadingOverlay, { backgroundColor: '#525659' }]}>
                <ActivityIndicator size="large" color="white" />
                <Text style={{ color: 'white', marginTop: spacing.md, fontSize: 14 }}>Loading PDF...</Text>
              </View>
            )}
            <WebView
              ref={webViewRef}
              source={{ html: getPdfJsHtml(uri), baseUrl: '' }}
              style={styles.webView}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              mixedContentMode="always"
              onMessage={handleMessage}
              onError={() => { setError('WebView error'); setState('error'); }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { flex: 1, marginRight: 8, fontWeight: '600' },
  closeButton: { backgroundColor: 'rgba(255,255,255,0.15)' },
  content: { flex: 1 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 18, fontWeight: '600' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  webViewContainer: { flex: 1 },
  webView: { flex: 1, backgroundColor: '#525659' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
});
