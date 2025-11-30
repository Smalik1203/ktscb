import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../lib/design-system';

export const superAdminDashboardStyles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xl,
  },
  filterContainer: {
    marginTop: spacing.md,
  },
  // Top fetching bar for time period changes
  topFetchingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  topFetchingText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  // Slight opacity on content while fetching
  fetchingContent: {
    opacity: 0.7,
  },
  fetchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  fetchingText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  dateRangeContainer: {
    marginVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  dateRangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  dateRangeText: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  fetchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  fetchingBadgeText: {
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.xs,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
    marginBottom: spacing.lg,
    minHeight: 44,
    gap: spacing.xs,
  },
  backButtonIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  featureHeader: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  featureTitle: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    fontSize: typography.fontSize['2xl'],
  },
});

