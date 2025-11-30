import { StyleSheet } from 'react-native';
import { colors as defaultColors, typography, spacing, borderRadius } from '../../../lib/design-system';
import { ThemeColors } from '../../contexts/ThemeContext';

// Legacy static styles (for backwards compatibility)
export const analyticsScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background.app,
  },
  header: {
    backgroundColor: defaultColors.primary[600],
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    color: defaultColors.text.inverse,
    fontWeight: typography.fontWeight.bold,
  },
  headerSubtitle: {
    color: defaultColors.text.inverse,
    opacity: 0.9,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  restrictedTitle: {
    color: defaultColors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  restrictedMessage: {
    color: defaultColors.text.secondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: defaultColors.error[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorText: {
    color: defaultColors.error[600],
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorSubtext: {
    color: defaultColors.text.secondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
});

// Dynamic styles function for theme support
export const createAnalyticsStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  header: {
    backgroundColor: colors.primary[600],
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.bold,
  },
  headerSubtitle: {
    color: colors.text.inverse,
    opacity: 0.9,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  restrictedTitle: {
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  restrictedMessage: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorSubtext: {
    color: colors.text.secondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
});

