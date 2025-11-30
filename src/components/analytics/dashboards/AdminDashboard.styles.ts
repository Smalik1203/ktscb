import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../lib/design-system';

export const adminDashboardStyles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xl,
  },
  summaryCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  className: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  classInfo: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    fontSize: typography.fontSize.base,
  },
  metricHighlight: {
    color: colors.text.secondary,
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  progressItem: {
    marginBottom: spacing.md,
  },
  subjectName: {
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: typography.fontSize.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  progressText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
  },
});

