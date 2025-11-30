import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../lib/design-system';

export const studentDashboardStyles = StyleSheet.create({
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
  attendanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
    gap: spacing.lg,
  },
  attendanceStats: {
    alignItems: 'center',
  },
  attendanceValue: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  attendanceLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  subSectionTitle: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: typography.fontSize.sm,
  },
  personalBest: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  bestScore: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    marginVertical: spacing.sm,
  },
  scoreLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  feesOverview: {
    gap: spacing.md,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    color: colors.text.secondary,
  },
  feeValue: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
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

