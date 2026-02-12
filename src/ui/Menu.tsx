/**
 * Menu Component
 * 
 * Dropdown menu anchored to a trigger element.
 * Replaces react-native-paper Menu.
 * 
 * @example
 * ```tsx
 * const [visible, setVisible] = useState(false);
 * 
 * <Menu
 *   visible={visible}
 *   onDismiss={() => setVisible(false)}
 *   anchor={
 *     <IconButton onPress={() => setVisible(true)}>
 *       <Icon name="more-vert" />
 *     </IconButton>
 *   }
 * >
 *   <Menu.Item title="Edit" icon="edit" onPress={handleEdit} />
 *   <Menu.Item title="Delete" icon="delete" onPress={handleDelete} destructive />
 *   <Menu.Divider />
 *   <Menu.Item title="Cancel" onPress={() => setVisible(false)} />
 * </Menu>
 * ```
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Dimensions,
  ViewStyle,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Portal } from './Portal';
import { useTheme } from '../contexts/ThemeContext';
import { Body } from './Text';
import type { MaterialIconName } from './iconMap';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// Menu Item
// ============================================================================

interface MenuItemProps {
  title: string;
  onPress: () => void;
  icon?: MaterialIconName;
  destructive?: boolean;
  disabled?: boolean;
}

function MenuItem({ title, onPress, icon, destructive = false, disabled = false }: MenuItemProps) {
  const { colors, spacing, typography } = useTheme();

  const textColor = destructive
    ? colors.error.main
    : disabled
    ? colors.text.disabled
    : colors.text.primary;

  return (
    <TouchableOpacity
      style={[styles.menuItem, { paddingVertical: spacing.md, paddingHorizontal: spacing.lg }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
    >
      {icon && (
        <MaterialIcons
          name={icon}
          size={20}
          color={textColor}
          style={{ marginRight: spacing.md }}
        />
      )}
      <Body style={{ color: textColor, fontSize: typography.fontSize.base }}>{title}</Body>
    </TouchableOpacity>
  );
}

// ============================================================================
// Menu Divider
// ============================================================================

function MenuDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border.light }]} />;
}

// ============================================================================
// Menu
// ============================================================================

export interface MenuProps {
  visible: boolean;
  onDismiss: () => void;
  anchor: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}

function MenuComponent({ visible, onDismiss, anchor, children, style }: MenuProps) {
  const { colors, borderRadius, shadows, isDark, spacing } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const anchorRef = useRef<View>(null);
  const [anchorLayout, setAnchorLayout] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
  const [menuLayout, setMenuLayout] = React.useState({ width: 0, height: 0 });

  useEffect(() => {
    if (visible) {
      // Measure anchor position
      anchorRef.current?.measureInWindow((x, y, width, height) => {
        setAnchorLayout({ x, y, width, height });
      });
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 100, friction: 12, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, scale]);

  // Calculate menu position
  const getMenuPosition = (): ViewStyle => {
    const menuWidth = Math.max(menuLayout.width, 180);
    const menuHeight = menuLayout.height;

    // Default: below anchor, right-aligned
    let top = anchorLayout.y + anchorLayout.height + 4;
    let left = anchorLayout.x + anchorLayout.width - menuWidth;

    // Keep within screen bounds
    if (left < 8) left = 8;
    if (left + menuWidth > SCREEN_WIDTH - 8) left = SCREEN_WIDTH - menuWidth - 8;
    if (top + menuHeight > SCREEN_HEIGHT - 40) {
      top = anchorLayout.y - menuHeight - 4;
    }

    return { position: 'absolute', top, left };
  };

  return (
    <View>
      <View ref={anchorRef} collapsable={false}>
        {anchor}
      </View>
      {visible && (
        <Portal>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={onDismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          {/* Menu */}
          <Animated.View
            onLayout={(e) => setMenuLayout(e.nativeEvent.layout)}
            style={[
              styles.menu,
              {
                backgroundColor: colors.surface.elevated,
                borderRadius: borderRadius.card,
                ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.lg),
                opacity,
                transform: [{ scale }],
                minWidth: 180,
                paddingVertical: spacing.xs,
              },
              getMenuPosition(),
              style,
            ]}
          >
            {children}
          </Animated.View>
        </Portal>
      )}
    </View>
  );
}

// ============================================================================
// Compose
// ============================================================================

export const Menu = Object.assign(MenuComponent, {
  Item: MenuItem,
  Divider: MenuDivider,
});

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  menu: {
    overflow: 'hidden',
  },
});
