/**
 * FAB (Floating Action Button) Component
 * 
 * A themed floating action button with optional speed-dial multi-action support.
 * Replaces react-native-paper FAB and all custom FAB implementations.
 * 
 * @example Single action:
 * ```tsx
 * <FAB icon="add" onPress={handleCreate} />
 * <FAB icon="add" label="New Item" onPress={handleCreate} extended />
 * ```
 * 
 * @example Multi-action speed dial:
 * ```tsx
 * <FAB.Group
 *   icon="add"
 *   actions={[
 *     { icon: 'event', label: 'Add Event', onPress: handleEvent },
 *     { icon: 'beach-access', label: 'Add Holiday', onPress: handleHoliday },
 *   ]}
 * />
 * ```
 */

import React, { useRef, useCallback, useState } from 'react';
import {
  TouchableOpacity,
  Pressable,
  Animated,
  StyleSheet,
  ViewStyle,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Portal } from './Portal';
import { Body, Caption } from './Text';
import type { MaterialIconName } from './iconMap';

export type FABSize = 'sm' | 'md' | 'lg';
export type FABVariant = 'primary' | 'secondary' | 'surface';

export interface FABProps {
  icon: MaterialIconName;
  onPress: () => void;
  label?: string;
  extended?: boolean;
  size?: FABSize;
  variant?: FABVariant;
  disabled?: boolean;
  /** When false, the FAB is not rendered (for role-gating) */
  visible?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export interface FABGroupAction {
  icon: MaterialIconName;
  label: string;
  onPress: () => void;
  /** Use error color for destructive actions */
  destructive?: boolean;
}

export interface FABGroupProps {
  /** Icon when closed */
  icon?: MaterialIconName;
  /** Icon when open (defaults to 'close') */
  openIcon?: MaterialIconName;
  actions: FABGroupAction[];
  size?: FABSize;
  variant?: FABVariant;
  /** When false, the FAB.Group is not rendered */
  visible?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Single FAB
// ---------------------------------------------------------------------------

export function FAB({
  icon,
  onPress,
  label,
  extended = false,
  size = 'md',
  variant = 'primary',
  disabled = false,
  visible = true,
  style,
  testID,
  accessibilityLabel,
}: FABProps) {
  const { colors, spacing, shadows, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  }, [scaleAnim]);

  if (!visible) return null;

  const sizeConfig = {
    sm: { dimension: 40, iconSize: 20, padding: spacing.sm },
    md: { dimension: 56, iconSize: 24, padding: spacing.md },
    lg: { dimension: 64, iconSize: 28, padding: spacing.lg },
  }[size];

  const variantConfig = {
    primary: { bg: colors.primary.main, iconColor: colors.text.inverse },
    secondary: { bg: colors.secondary.main, iconColor: colors.text.inverse },
    surface: { bg: colors.surface.elevated, iconColor: colors.primary.main },
  }[variant];

  const fabStyles: ViewStyle = {
    backgroundColor: variantConfig.bg,
    ...shadows.lg,
    opacity: disabled ? 0.5 : 1,
  };

  const positionStyle: ViewStyle = {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg + insets.bottom,
  };

  if (extended && label) {
    return (
      <Animated.View style={[positionStyle, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          style={[
            styles.extended,
            fabStyles,
            {
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing.lg,
              height: sizeConfig.dimension,
              gap: spacing.sm,
            },
            style,
          ]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || label}
          testID={testID}
        >
          <MaterialIcons name={icon} size={sizeConfig.iconSize} color={variantConfig.iconColor} />
          <Body style={{ color: variantConfig.iconColor, fontWeight: '600' }}>{label}</Body>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[positionStyle, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[
          styles.fab,
          fabStyles,
          {
            width: sizeConfig.dimension,
            height: sizeConfig.dimension,
            borderRadius: sizeConfig.dimension / 2,
          },
          style,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || 'Action button'}
        testID={testID}
      >
        <MaterialIcons name={icon} size={sizeConfig.iconSize} color={variantConfig.iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// FAB.Group — Speed-dial multi-action FAB
// ---------------------------------------------------------------------------

function FABGroup({
  icon = 'add',
  openIcon = 'close',
  actions,
  size = 'md',
  variant = 'primary',
  visible = true,
  style,
  testID,
  accessibilityLabel,
}: FABGroupProps) {
  const { colors, spacing, shadows, borderRadius, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const actionAnims = useRef(actions.map(() => new Animated.Value(0))).current;

  const toggle = useCallback(() => {
    const toOpen = !open;
    setOpen(toOpen);

    Animated.parallel([
      Animated.spring(rotateAnim, {
        toValue: toOpen ? 1 : 0,
        useNativeDriver: true,
        tension: 300,
        friction: 12,
      }),
      Animated.timing(backdropAnim, {
        toValue: toOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      ...actionAnims.map((anim, i) =>
        Animated.spring(anim, {
          toValue: toOpen ? 1 : 0,
          useNativeDriver: true,
          tension: 200,
          friction: 14,
          delay: toOpen ? i * 40 : 0,
        }),
      ),
    ]).start();
  }, [open, rotateAnim, backdropAnim, actionAnims]);

  const handleActionPress = useCallback((action: FABGroupAction) => {
    // Close first, then fire action
    toggle();
    // Small delay so close animation starts before screen changes
    setTimeout(() => action.onPress(), 120);
  }, [toggle]);

  if (!visible) return null;

  const sizeConfig = {
    sm: { dimension: 40, iconSize: 20 },
    md: { dimension: 56, iconSize: 24 },
    lg: { dimension: 64, iconSize: 28 },
  }[size];

  const variantConfig = {
    primary: { bg: colors.primary.main, iconColor: colors.text.inverse },
    secondary: { bg: colors.secondary.main, iconColor: colors.text.inverse },
    surface: { bg: colors.surface.elevated, iconColor: colors.primary.main },
  }[variant];

  const miniDimension = 40;

  return (
    <>
      {/* Scrim + speed-dial rendered in Portal so it covers the full screen */}
      {open && (
        <Portal>
          {/* Full-screen scrim */}
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 90 }]}
            onPress={toggle}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: 'rgba(0,0,0,0.3)', opacity: backdropAnim },
              ]}
            />
          </Pressable>

          {/* Speed-dial actions (in portal so they sit above the scrim) */}
          <View
            style={[
              styles.groupContainer,
              { right: spacing.lg, bottom: spacing.lg + insets.bottom, zIndex: 91 },
            ]}
            pointerEvents="box-none"
          >
            {actions.map((action, i) => {
              const translateY = actionAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              });
              const actionColor = action.destructive ? colors.error.main : colors.text.primary;
              return (
                <Animated.View
                  key={action.label}
                  style={[
                    styles.actionRow,
                    {
                      opacity: actionAnims[i],
                      transform: [{ translateY }],
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  {/* Label chip */}
                  <View
                    style={[
                      styles.actionLabel,
                      {
                        backgroundColor: isDark ? colors.surface.elevated : colors.background.primary,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                        borderRadius: borderRadius.button,
                        ...shadows.sm,
                        ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : {}),
                      },
                    ]}
                  >
                    <Caption style={{ color: actionColor, fontWeight: '600' }}>{action.label}</Caption>
                  </View>

                  {/* Mini FAB */}
                  <TouchableOpacity
                    style={[
                      styles.fab,
                      {
                        width: miniDimension,
                        height: miniDimension,
                        borderRadius: miniDimension / 2,
                        backgroundColor: isDark ? colors.surface.elevated : colors.background.primary,
                        ...shadows.md,
                        ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : {}),
                      },
                    ]}
                    onPress={() => handleActionPress(action)}
                    activeOpacity={0.8}
                    accessibilityLabel={action.label}
                  >
                    <MaterialIcons name={action.icon} size={20} color={actionColor} />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Portal>
      )}

      {/* Main FAB button (always in normal tree for positioning) */}
      <View
        style={[
          styles.groupContainer,
          { right: spacing.lg, bottom: spacing.lg + insets.bottom, zIndex: open ? 92 : 1 },
          style,
        ]}
        testID={testID}
      >
        <TouchableOpacity
          style={[
            styles.fab,
            {
              width: sizeConfig.dimension,
              height: sizeConfig.dimension,
              borderRadius: sizeConfig.dimension / 2,
              backgroundColor: variantConfig.bg,
              ...shadows.lg,
            },
          ]}
          onPress={toggle}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || 'Toggle actions'}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg'],
                  }),
                },
              ],
            }}
          >
            <MaterialIcons
              name={icon}
              size={sizeConfig.iconSize}
              color={variantConfig.iconColor}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

// Attach Group as a static property
FAB.Group = FABGroup;

const styles = StyleSheet.create({
  fab: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  extended: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  groupContainer: {
    position: 'absolute',
    alignItems: 'flex-end',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    elevation: 2,
  },
});
