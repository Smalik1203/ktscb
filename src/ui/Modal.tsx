/**
 * Modal Component
 * 
 * A themed modal component that renders via Portal.
 * Supports backdrop dismiss, slide-up animation, and multiple sizes.
 * 
 * Drop-in replacement for react-native-paper Modal.
 * 
 * @example
 * ```tsx
 * // With built-in header (recommended)
 * <Modal visible={show} onDismiss={hide} title="Edit Profile">
 *   <Body>Modal content</Body>
 * </Modal>
 * 
 * // Without header (legacy / custom header)
 * <Modal visible={showModal} onDismiss={() => setShowModal(false)}>
 *   <Heading level={3}>Modal Title</Heading>
 *   <Body>Modal content</Body>
 *   <Button onPress={() => setShowModal(false)}>Close</Button>
 * </Modal>
 * ```
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ViewStyle,
  BackHandler,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Portal } from './Portal';
import { useTheme } from '../contexts/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ModalSize = 'auto' | 'sm' | 'md' | 'lg' | 'full';

export interface ModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onDismiss: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Optional title — renders a standardized header with close button */
  title?: string;
  /** Called when the close button is pressed (defaults to onDismiss) */
  onClose?: () => void;
  /** Whether tapping backdrop closes the modal */
  dismissable?: boolean;
  /** Whether Android back button closes the modal */
  dismissableBackButton?: boolean;
  /** Modal size preset */
  size?: ModalSize;
  /** Custom content container style */
  contentContainerStyle?: ViewStyle;
  /** Custom style for the entire modal overlay */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

export function Modal({
  visible,
  onDismiss,
  children,
  title,
  onClose,
  dismissable = true,
  dismissableBackButton = true,
  size = 'auto',
  contentContainerStyle,
  style,
  testID,
}: ModalProps) {
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT * 0.3)).current;
  const isAnimating = useRef(false);

  // Handle animations
  useEffect(() => {
    if (visible) {
      isAnimating.current = true;
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    } else {
      isAnimating.current = true;
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT * 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    }
  }, [visible, fadeAnim, slideAnim]);

  // Handle Android back button
  useEffect(() => {
    if (!visible) return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dismissableBackButton) {
        onDismiss();
        return true;
      }
      return true; // prevent default back
    });

    return () => handler.remove();
  }, [visible, dismissableBackButton, onDismiss]);

  const handleBackdropPress = useCallback(() => {
    if (dismissable && !isAnimating.current) {
      onDismiss();
    }
  }, [dismissable, onDismiss]);

  // Size styles
  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return { maxWidth: 340, width: '90%' };
      case 'md':
        return { maxWidth: 480, width: '90%' };
      case 'lg':
        return { maxWidth: 600, width: '95%' };
      case 'full':
        return { width: '100%', maxHeight: '100%', borderRadius: 0, flex: 1 };
      case 'auto':
      default:
        return { maxWidth: 500, width: '90%', maxHeight: SCREEN_HEIGHT * 0.85 };
    }
  };

  if (!visible && (fadeAnim as any)._value === 0) {
    return null;
  }

  return (
    <Portal>
      <View style={[styles.wrapper, style]} testID={testID}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="rgba(0,0,0,0.5)"
        />
        
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.6],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.content,
              {
                backgroundColor: colors.surface.primary,
                borderRadius: size === 'full' ? 0 : borderRadius.lg,
                padding: spacing.lg,
                ...(isDark
                  ? { borderWidth: 1, borderColor: colors.border.light }
                  : shadows.lg),
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
              getSizeStyle(),
              contentContainerStyle,
            ]}
          >
            {title && (
              <>
                <View style={styles.headerRow}>
                  <Text
                    style={[
                      styles.headerTitle,
                      { color: colors.text.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                  <TouchableOpacity
                    onPress={onClose ?? onDismiss}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    style={[
                      styles.closeButton,
                      { backgroundColor: colors.neutral[100] },
                    ]}
                  >
                    <MaterialIcons
                      name="close"
                      size={20}
                      color={colors.text.secondary}
                    />
                  </TouchableOpacity>
                </View>
                <View
                  style={[
                    styles.headerDivider,
                    { backgroundColor: colors.border.light },
                  ]}
                />
              </>
            )}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  content: {
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDivider: {
    height: 1,
    marginHorizontal: -24, // bleed to edges (counteract parent padding)
    marginBottom: 16,
  },
});

export default Modal;
