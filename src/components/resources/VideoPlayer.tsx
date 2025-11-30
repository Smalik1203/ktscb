import React, { useState, useRef, useEffect , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { VideoView, useVideoPlayer } from 'expo-video';
import { X } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import { spacing, colors } from '../../../lib/design-system';
import { removeYouTubeBranding } from '../../utils/youtubeBrandingRemoval';

interface VideoPlayerProps {
  uri: string;
  title: string;
  onClose: () => void;
}

function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be') || getYouTubeVideoId(url) !== null;
}

export function VideoPlayer({ uri, title, onClose }: VideoPlayerProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const isYouTube = isYouTubeUrl(uri);
  const youtubeVideoId = isYouTube ? getYouTubeVideoId(uri) : null;
  const insets = useSafeAreaInsets();
  const [playerMethod, setPlayerMethod] = useState<'youtube-iframe' | 'webview'>('youtube-iframe');
  const [webViewError, setWebViewError] = useState(false);
  const [youtubeVideoInfo, setYoutubeVideoInfo] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [wantsFullscreenOnPlay, setWantsFullscreenOnPlay] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const webviewRef = useRef<any>(null);

  // No need for YouTube extraction with enhanced WebView approach

  // Simplified YouTube embed URL - fallback only
  const youtubeEmbedUrl = youtubeVideoId
    ? `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=0&playsinline=1&controls=0&rel=0&modestbranding=1&showinfo=0&fs=0&enablejsapi=1`
    : null;

  const { width, height } = Dimensions.get('window');

  // Use the new expo-video player for non-YouTube videos
  const player = useVideoPlayer(isYouTube ? null : uri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.videoWrapper}>
        {isYouTube && youtubeVideoId ? (
          playerMethod === 'youtube-iframe' ? (
            <View style={{ 
              position: 'relative', 
              width, 
              height: height - 100,
              overflow: 'hidden' // Ensure proper fullscreen behavior
            }}>
              <YoutubePlayer
                height={height - 100}
                width={width}
                videoId={youtubeVideoId}
                play={playing}
                initialPlayerParams={{
                  // Keep controls available for native fullscreen toggle; we'll hide overlays via CSS
                  controls: 1,
                  modestbranding: 1,
                  rel: 0,
                  showinfo: 0,
                  fs: 1, // Allow fullscreen
                  playsinline: 1,
                  enablejsapi: 1, // Enable JavaScript API
                }}
                onReady={() => {
                  setIsReady(true);
                  // If user tapped to play, ensure playback starts immediately
                  if (wantsFullscreenOnPlay) {
                    setPlaying(true);
                  }
                }}
                onChangeState={(state) => {
                  // Auto-enter fullscreen the moment it starts playing
                  if (state === 'playing' && wantsFullscreenOnPlay) {
                    // small delay to ensure WebView is ready to accept JS
                    setTimeout(() => {
                      try {
                        webviewRef.current?.injectJavaScript(`
                          (function(){
                            var btn=document.querySelector('.ytp-fullscreen-button');
                            if(btn){ btn.click(); }
                            true;
                          })();
                        `);
                      } catch (_) {}
                    }, 100);
                    setWantsFullscreenOnPlay(false);
                  }
                  if (state === 'ended') {
                    setPlaying(false);
                  }
                }}
                onError={(e) => {
                  console.warn('YouTube player error:', e);
                  setPlayerMethod('webview');
                }}
                webViewStyle={{ 
                  opacity: 0.99,
                  backgroundColor: colors.neutral[900]
                }}
                webViewProps={{
                  ref: (r: any) => { webviewRef.current = r; },
                  allowsInlineMediaPlayback: true,
                  mediaPlaybackRequiresUserAction: false,
                  allowsFullscreenVideo: true,
                  // Additional props for fullscreen support
                  scalesPageToFit: false,
                  bounces: false,
                  scrollEnabled: false,
                  showsHorizontalScrollIndicator: false,
                  showsVerticalScrollIndicator: false,
                  mixedContentMode: 'compatibility',
                  thirdPartyCookiesEnabled: false,
                  sharedCookiesEnabled: false,
                  injectedJavaScript: `
                    (function(){
                      var style = document.createElement('style');
                      style.innerHTML = '.ytp-watermark, .ytp-branding, .ytp-show-cards-title, .ytp-impression-link, .ytp-endscreen-content, .ytp-chrome-top, .ytp-title { display:none !important; opacity:0 !important; visibility:hidden !important; }';
                      document.head.appendChild(style);
                      true;
                    })();
                  `,
                  onMessage: () => {},
                }}
              />
              {/* Custom touch overlay: tap to play and auto-fullscreen */}
              {!playing && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    setWantsFullscreenOnPlay(true);
                    setPlaying(true);
                  }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
              )}
            </View>
          ) : youtubeEmbedUrl ? (
            <WebView
              source={{ uri: youtubeEmbedUrl }}
              style={[styles.video, { width, height: height - 100 }]}
              allowsFullscreenVideo={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              injectedJavaScript={removeYouTubeBranding}
              startInLoadingState={true}
              scalesPageToFit={false}
              bounces={false}
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              mixedContentMode="compatibility"
              thirdPartyCookiesEnabled={false}
              sharedCookiesEnabled={false}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('WebView error: ', nativeEvent);
                setWebViewError(true);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('WebView HTTP error: ', nativeEvent);
                setWebViewError(true);
              }}
              onLoadEnd={() => {
                console.log('YouTube WebView loaded successfully');
              }}
            />
          ) : null
        ) : (
          <VideoView
            player={player}
            style={[styles.video, { width, height: height - 100 }]}
            allowsFullscreen
            allowsPictureInPicture
          />
        )}
      </View>
      <View style={{ height: insets.bottom, backgroundColor: colors.neutral[900] }} />
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[900],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    height: 60,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
  },
  videoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[900],
    position: 'relative',
    // Ensure fullscreen works properly
    overflow: 'visible',
    paddingVertical: spacing.xl,
  },
  video: {
    backgroundColor: colors.neutral[900],
    borderRadius: 8,
    overflow: 'hidden',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[900],
  },
  loadingText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[900],
    padding: spacing.lg,
  },
  errorText: {
    color: colors.error[600],
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
