/**
 * Icon Component
 * 
 * Cross-platform icon component using MaterialIcons from @expo/vector-icons.
 * Theme-aware with sensible defaults for size and color.
 * 
 * @example
 * ```tsx
 * import { Icon } from '@/ui';
 * 
 * <Icon name="notifications" />
 * <Icon name="delete" size={24} color="red" />
 * <Icon name="check-circle" size={20} color={colors.success[500]} />
 * ```
 */

import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import type { MaterialIconName } from './iconMap';

export interface IconProps {
  /** MaterialIcons icon name */
  name: MaterialIconName;
  /** Icon size in pixels. Defaults to 24. */
  size?: number;
  /** Icon color. Defaults to theme text.primary. */
  color?: string;
  /** Optional style overrides */
  style?: React.ComponentProps<typeof MaterialIcons>['style'];
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Test ID for testing */
  testID?: string;
}

export const Icon = React.memo(function Icon({
  name,
  size = 24,
  color,
  style,
  accessibilityLabel,
  testID,
}: IconProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.text.primary;

  return (
    <MaterialIcons
      name={name}
      size={size}
      color={resolvedColor}
      style={style}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  );
});
