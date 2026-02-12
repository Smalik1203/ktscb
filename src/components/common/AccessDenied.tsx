/**
 * AccessDenied Component
 * 
 * Standard component to display when a user lacks required capabilities.
 * This provides a consistent, explicit UI for unauthorized access attempts.
 * 
 * NEVER silently hide content - always show this component when access is denied.
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { spacing, borderRadius, typography } from '../../../lib/design-system';
import { Capability } from '../../domain/auth/capabilities';
import { Button } from '../../ui/Button';
import { useRouter } from 'expo-router';

export type AccessDeniedVariant = 'full' | 'inline' | 'card';

export interface AccessDeniedProps {
  /**
   * Title to display
   * @default "Access Restricted"
   */
  title?: string;
  
  /**
   * Message explaining why access is denied
   * @default "You don't have permission to view this content."
   */
  message?: string;
  
  /**
   * Optional: The capability that was required (for debugging/logging)
   */
  capability?: Capability;
  
  /**
   * Display variant
   * - 'full': Full screen with large icon (for screen-level access denial)
   * - 'inline': Compact version for section-level denial
   * - 'card': Card-styled for embedded sections
   * @default 'full'
   */
  variant?: AccessDeniedVariant;
  
  /**
   * Whether to show a "Go Back" or "Go Home" button
   * @default true for 'full' variant
   */
  showAction?: boolean;
  
  /**
   * Custom action button label
   */
  actionLabel?: string;
  
  /**
   * Custom action handler
   */
  onAction?: () => void;
  
  /**
   * Icon to display
   * @default ShieldX for 'full', Lock for others
   */
  icon?: 'shield' | 'lock' | 'alert';
}

export function AccessDenied({
  title = 'Access Restricted',
  message = "You don't have permission to view this content.",
  capability,
  variant = 'full',
  showAction,
  actionLabel,
  onAction,
  icon,
}: AccessDeniedProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const styles = React.useMemo(() => createStyles(colors, isDark, variant), [colors, isDark, variant]);
  
  // Determine if action should be shown
  const shouldShowAction = showAction ?? variant === 'full';
  
  // Determine icon
  const iconName = React.useMemo((): React.ComponentProps<typeof MaterialIcons>['name'] => {
    if (icon === 'lock') return 'lock';
    if (icon === 'alert') return 'error';
    if (icon === 'shield' || variant === 'full') return 'gpp-bad';
    return 'lock';
  }, [icon, variant]);
  
  const iconSize = variant === 'full' ? 64 : variant === 'card' ? 40 : 32;
  
  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      // Default: go to dashboard
      router.replace('/(tabs)');
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons 
            name={iconName} 
            size={iconSize} 
            color={colors.error[isDark ? 400 : 500]} 
          />
        </View>
        
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        
        {/* Debug info in development */}
        {__DEV__ && capability && (
          <Text style={styles.debugText}>
            Required capability: {capability}
          </Text>
        )}
        
        {shouldShowAction && (
          <Button
            onPress={handleAction}
            variant="primary"
            size="md"
            style={styles.actionButton}
          >
            {actionLabel || 'Go to Dashboard'}
          </Button>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean, variant: AccessDeniedVariant) => {
  const isFullScreen = variant === 'full';
  const isCard = variant === 'card';
  
  return StyleSheet.create({
    container: {
      flex: isFullScreen ? 1 : undefined,
      backgroundColor: isCard 
        ? colors.surface.primary 
        : isFullScreen 
          ? colors.background.app 
          : 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      padding: isFullScreen ? spacing.xl : spacing.lg,
      minHeight: isFullScreen ? undefined : isCard ? 200 : 120,
      borderRadius: isCard ? borderRadius.lg : 0,
      borderWidth: isCard ? 1 : 0,
      borderColor: colors.border.light,
      ...(isCard && {
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 8,
        elevation: 3,
      }),
    },
    content: {
      alignItems: 'center',
      maxWidth: 320,
    },
    iconContainer: {
      width: isFullScreen ? 100 : isCard ? 64 : 48,
      height: isFullScreen ? 100 : isCard ? 64 : 48,
      borderRadius: isFullScreen ? 50 : isCard ? 32 : 24,
      backgroundColor: colors.error[isDark ? 100 : 50],
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: isFullScreen 
        ? typography.fontSize.xl 
        : isCard 
          ? typography.fontSize.lg 
          : typography.fontSize.base,
      fontWeight: typography.fontWeight.bold as any,
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      fontSize: isFullScreen 
        ? typography.fontSize.base 
        : typography.fontSize.sm,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: isFullScreen ? 24 : 20,
    },
    debugText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      fontFamily: 'monospace',
      marginTop: spacing.md,
      backgroundColor: colors.background.secondary,
      padding: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    actionButton: {
      marginTop: spacing.xl,
      minWidth: 180,
    },
  });
};

export default AccessDenied;

