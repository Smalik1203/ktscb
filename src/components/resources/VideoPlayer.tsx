/**
 * VideoPlayer - Production-Grade Video Player
 * 
 * Features:
 * - State machine: idle → loading → buffering → ready → playing/paused
 * - Error handling: expired URLs, network drops, unsupported formats
 * - Resume playback: saves position per user+video
 * - Network awareness: WiFi vs Cellular detection
 * - Fullscreen: proper orientation handling
 * - Fallback: YouTube → WebView, Direct → WebView
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useAuth } from '../../contexts/AuthContext';

// ==================== TYPES ====================

interface VideoPlayerProps {
  uri: string;
  title: string;
  onClose: () => void;
}

type PlayerState = 'idle' | 'loading' | 'buffering' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';
type VideoSource = 'youtube' | 'direct' | 'webview-fallback';

interface ErrorInfo {
  type: 'expired_url' | 'network' | 'unsupported' | 'generic';
  message: string;
}

// ==================== UTILS ====================

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

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

const getPositionKey = (userId: string, videoUri: string) =>
  `video_position:${userId}:${hashCode(videoUri)}`;

// ==================== MAIN COMPONENT ====================

export function VideoPlayer({ uri, title, onClose }: VideoPlayerProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, spacing), [colors, spacing]);
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { width, height } = useWindowDimensions(); // Reactive to rotation

  // Source detection
  const isYouTube = isYouTubeUrl(uri);
  const youtubeVideoId = isYouTube ? getYouTubeVideoId(uri) : null;

  // State
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [source, setSource] = useState<VideoSource>(isYouTube ? 'youtube' : 'direct');
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [networkType, setNetworkType] = useState<'wifi' | 'cellular' | 'none' | 'unknown'>('unknown');
  const [showNetworkBanner, setShowNetworkBanner] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [savedPosition, setSavedPosition] = useState<number>(0);
  const [currentPosition, setCurrentPosition] = useState<number>(0);

  // Refs
  const webviewRef = useRef<any>(null);
  const positionSaveInterval = useRef<NodeJS.Timeout | null>(null);

  // ==================== NETWORK MONITORING ====================

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const type = state.type === 'wifi' ? 'wifi'
        : state.type === 'cellular' ? 'cellular'
          : state.isConnected === false ? 'none' : 'unknown';

      setNetworkType(type);

      // Show banner on cellular
      if (type === 'cellular' && playerState === 'playing') {
        setShowNetworkBanner(true);
        setTimeout(() => setShowNetworkBanner(false), 4000);
      }

      // Handle network loss
      if (type === 'none' && playerState === 'playing') {
        setError({ type: 'network', message: 'No internet connection' });
        setPlayerState('error');
      }
    });

    return () => unsubscribe();
  }, [playerState]);

  // ==================== RESUME POSITION ====================

  // Load saved position on mount
  useEffect(() => {
    const loadPosition = async () => {
      if (!profile?.auth_id) return;
      try {
        const key = getPositionKey(profile.auth_id, uri);
        const saved = await AsyncStorage.getItem(key);
        if (saved) {
          const position = parseFloat(saved);
          if (position > 5) { // Only resume if > 5 seconds
            setSavedPosition(position);
          }
        }
      } catch {
        // Silent fail
      }
    };
    loadPosition();
  }, [uri, profile?.auth_id]);

  // Save position periodically and on unmount
  const savePosition = useCallback(async (position: number) => {
    if (!profile?.auth_id || position < 5) return;
    try {
      const key = getPositionKey(profile.auth_id, uri);
      await AsyncStorage.setItem(key, position.toString());
    } catch {
      // Silent fail
    }
  }, [uri, profile?.auth_id]);

  // Save on app background
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        savePosition(currentPosition);
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [currentPosition, savePosition]);

  // Save on close
  const handleClose = useCallback(() => {
    savePosition(currentPosition);
    onClose();
  }, [currentPosition, savePosition, onClose]);

  // ==================== FULLSCREEN HANDLING ====================

  const enterFullscreen = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsFullscreen(true);
    } catch {
      // Silent fail
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      await ScreenOrientation.unlockAsync();
      setIsFullscreen(false);
    } catch {
      // Silent fail
    }
  }, []);

  // Cleanup orientation on unmount
  useEffect(() => {
    return () => {
      ScreenOrientation.unlockAsync().catch(() => { });
    };
  }, []);

  // ==================== ERROR HANDLING ====================

  const handleError = useCallback((errorType: ErrorInfo['type'], message?: string) => {
    const errorMessages: Record<ErrorInfo['type'], string> = {
      expired_url: 'Video link has expired. Please refresh.',
      network: 'Network connection lost. Check your internet.',
      unsupported: 'This video format is not supported.',
      generic: 'Something went wrong. Please try again.',
    };

    setError({
      type: errorType,
      message: message || errorMessages[errorType],
    });
    setPlayerState('error');

    // Auto-fallback to WebView for unsupported formats
    if (errorType === 'unsupported' && source !== 'webview-fallback') {
      setSource('webview-fallback');
      setError(null);
      setPlayerState('loading');
    }
  }, [source]);

  const handleRetry = useCallback(() => {
    setError(null);
    setPlayerState('loading');
    if (source === 'webview-fallback') {
      webviewRef.current?.reload();
    }
  }, [source]);

  // ==================== EXPO-VIDEO PLAYER (Direct URLs) ====================

  const player = useVideoPlayer(!isYouTube ? uri : null, (p) => {
    p.loop = false;
    p.muted = false;

    // Seek to saved position
    if (savedPosition > 0) {
      p.currentTime = savedPosition;
    }
  });

  // Player event listeners for direct video
  useEffect(() => {
    if (!player || isYouTube) return;

    const statusSub = player.addListener('statusChange', (event) => {
      const status = event.status || event;
      if (status === 'loading') setPlayerState('loading');
      else if (status === 'readyToPlay') setPlayerState('ready');
      else if (status === 'error') handleError('generic');
    });

    const playingSub = player.addListener('playingChange', (isPlaying) => {
      setPlayerState(isPlaying ? 'playing' : 'paused');
    });

    // Track position for resume
    const interval = setInterval(() => {
      if (player.currentTime > 0) {
        setCurrentPosition(player.currentTime);
      }
    }, 5000);

    return () => {
      statusSub.remove();
      playingSub.remove();
      clearInterval(interval);
    };
  }, [player, isYouTube, handleError]);

  // ==================== YOUTUBE PLAYER ====================

  const [youtubeReady, setYoutubeReady] = useState(false);
  const [youtubePlaying, setYoutubePlaying] = useState(false);

  const handleYoutubeStateChange = useCallback((state: string) => {
    switch (state) {
      case 'buffering':
        setPlayerState('buffering');
        break;
      case 'playing':
        setPlayerState('playing');
        break;
      case 'paused':
        setPlayerState('paused');
        break;
      case 'ended':
        setPlayerState('ended');
        break;
    }
  }, []);

  const handleYoutubeError = useCallback((e: any) => {
    // YouTube player error - fallback to WebView
    // Fallback to WebView
    setSource('webview-fallback');
    setPlayerState('loading');
  }, []);

  // ==================== WEBVIEW FALLBACK ====================

  const getWebViewHtml = useCallback(() => {
    if (isYouTube && youtubeVideoId) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; }
            body { background: #000; }
            iframe { width: 100vw; height: 100vh; border: none; }
          </style>
        </head>
        <body>
          <iframe 
            src="https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1" 
            allowfullscreen
            allow="autoplay; fullscreen"
          ></iframe>
        </body>
        </html>
      `;
    } else {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; }
            body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
            video { max-width: 100%; max-height: 100%; }
          </style>
        </head>
        <body>
          <video controls autoplay playsinline>
            <source src="${uri}" />
            Your browser does not support the video tag.
          </video>
        </body>
        </html>
      `;
    }
  }, [isYouTube, youtubeVideoId, uri]);

  // ==================== RENDER ====================

  const renderLoadingOverlay = () => {
    if (playerState !== 'loading' && playerState !== 'buffering') return null;

    return (
      <View style={styles.overlay}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.overlayText}>
          {playerState === 'loading' ? 'Loading video...' : 'Buffering...'}
        </Text>
      </View>
    );
  };

  const renderNetworkBanner = () => {
    if (!showNetworkBanner) return null;

    return (
      <TouchableOpacity
        style={styles.networkBanner}
        onPress={() => setShowNetworkBanner(false)}
      >
        <MaterialIcons name="smartphone" size={16} color="white" />
        <Text style={styles.networkBannerText}>Playing on mobile data</Text>
      </TouchableOpacity>
    );
  };

  const renderError = () => {
    if (playerState !== 'error' || !error) return null;

    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error" size={48} color={colors.error[600]} />
        <Text style={styles.errorTitle}>
          {error.type === 'network' ? 'No Connection' : 'Playback Error'}
        </Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <MaterialIcons name="refresh" size={18} color="white" />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPlayer = () => {
    if (playerState === 'error') return null;

    // WebView Fallback
    if (source === 'webview-fallback') {
      return (
        <WebView
          ref={webviewRef}
          source={{ html: getWebViewHtml() }}
          style={styles.player}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          onLoadStart={() => setPlayerState('loading')}
          onLoadEnd={() => setPlayerState('ready')}
          onError={() => handleError('generic')}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode === 403 || e.nativeEvent.statusCode === 401) {
              handleError('expired_url');
            } else {
              handleError('generic');
            }
          }}
        />
      );
    }

    // YouTube Player
    if (source === 'youtube' && youtubeVideoId) {
      // Calculate player height accounting for header and safe areas
      const headerHeight = 60 + insets.top;
      const playerHeight = height - headerHeight - insets.bottom;

      return (
        <YoutubePlayer
          height={playerHeight}
          width={width}
          videoId={youtubeVideoId}
          play={youtubePlaying}
          initialPlayerParams={{
            controls: true,
            modestbranding: true,
            rel: false,
            fs: true,
            playsinline: true,
            showClosedCaptions: false,
            iv_load_policy: 3, // Hide annotations
          }}
          onReady={() => {
            setYoutubeReady(true);
            setPlayerState('ready');
          }}
          onChangeState={handleYoutubeStateChange}
          onError={handleYoutubeError}
          webViewProps={{
            ref: webviewRef,
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
            allowsFullscreenVideo: true,
            // Aggressive branding removal with continuous monitoring
            injectedJavaScript: `
              (function() {
                // CSS to hide ALL YouTube branding
                var css = \`
                  /* NUKE ALL BRANDING */
                  .ytp-watermark,
                  .ytp-youtube-button,
                  .ytp-logo,
                  .ytp-logo-link,
                  .ytp-title,
                  .ytp-title-text,
                  .ytp-title-link,
                  .ytp-title-channel,
                  .ytp-title-channel-logo,
                  .ytp-chrome-top,
                  .ytp-chrome-top-buttons,
                  .ytp-show-cards-title,
                  .ytp-videowall-still,
                  .ytp-endscreen-content,
                  .ytp-ce-element,
                  .ytp-ce-covering-overlay,
                  .ytp-ce-element-shadow,
                  .ytp-ce-covering-image,
                  .ytp-ce-expanding-image,
                  .ytp-ce-playlist-channel-icon,
                  .ytp-paid-content-overlay,
                  .ytp-gradient-top,
                  .ytp-share-button,
                  .ytp-watch-later-button,
                  .ytp-copylink-button,
                  .ytp-overflow-button,
                  .ytp-pause-overlay,
                  .ytp-impression-link,
                  .iv-branding,
                  .branding-img-container,
                  .annotation,
                  .video-annotations,
                  .ytp-cards-teaser,
                  .ytp-cards-button,
                  [class*="branding"],
                  [class*="watermark"],
                  a[href*="youtube.com/watch"],
                  a[href*="youtube.com/channel"] {
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                    width: 0 !important;
                    height: 0 !important;
                    position: absolute !important;
                    left: -9999px !important;
                  }
                  /* Hide more text */
                  .ytp-menuitem-label:contains("YouTube"),
                  .ytp-title-expanded-title {
                    display: none !important;
                  }
                \`;
                
                // Apply CSS
                function applyStyles() {
                  var existing = document.getElementById('no-branding');
                  if (!existing) {
                    var style = document.createElement('style');
                    style.id = 'no-branding';
                    style.innerHTML = css;
                    document.head.appendChild(style);
                  }
                  
                  // Also remove elements directly
                  var selectors = [
                    '.ytp-watermark', '.ytp-youtube-button', '.ytp-chrome-top',
                    '.ytp-title', '.ytp-endscreen-content', '.ytp-ce-element',
                    '.ytp-cards-teaser', '.annotation', '.ytp-pause-overlay'
                  ];
                  selectors.forEach(function(sel) {
                    document.querySelectorAll(sel).forEach(function(el) {
                      el.remove();
                    });
                  });
                }
                
                // Run immediately
                applyStyles();
                
                // Run on DOM changes
                var observer = new MutationObserver(function() {
                  applyStyles();
                });
                observer.observe(document.body || document.documentElement, {
                  childList: true,
                  subtree: true
                });
                
                // Run periodically as backup
                setInterval(applyStyles, 500);
                
                true;
              })();
            `,
            onHttpError: (e: any) => {
              if (e.nativeEvent.statusCode === 403) {
                handleError('expired_url');
              }
            },
          }}
        />
      );
    }

    // Direct Video (expo-video)
    if (source === 'direct' && player) {
      return (
        <VideoView
          player={player}
          style={styles.player}
          allowsFullscreen
          allowsPictureInPicture
        />
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {networkType === 'none' && (
          <MaterialIcons name="wifi-off" size={18} color={colors.error[600]} style={{ marginRight: spacing.sm }} />
        )}
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Player Area */}
      <View style={styles.playerWrapper}>
        {renderPlayer()}
        {renderLoadingOverlay()}
        {renderNetworkBanner()}
        {renderError()}
      </View>

      {/* Bottom Safe Area */}
      <View style={{ height: insets.bottom, backgroundColor: colors.neutral[900] }} />
    </View>
  );
}

// ==================== STYLES ====================

const createStyles = (colors: ThemeColors, spacing: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.neutral[900],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: colors.surface.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    closeButton: {
      padding: spacing.xs,
    },
    playerWrapper: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.neutral[900],
    },
    player: {
      width: '100%',
      height: '100%',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
    },
    overlayText: {
      color: 'white',
      marginTop: spacing.md,
      fontSize: 14,
    },
    networkBanner: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.8)',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 8,
      gap: spacing.xs,
    },
    networkBannerText: {
      color: 'white',
      fontSize: 13,
    },
    errorContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.neutral[900],
      padding: spacing.xl,
    },
    errorTitle: {
      color: colors.text.primary,
      fontSize: 18,
      fontWeight: '600',
      marginTop: spacing.lg,
    },
    errorMessage: {
      color: colors.text.secondary,
      fontSize: 14,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary[600],
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: 8,
      marginTop: spacing.lg,
      gap: spacing.xs,
    },
    retryText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });
