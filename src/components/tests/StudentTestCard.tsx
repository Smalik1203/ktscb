import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { BookOpen, Calendar, Clock, Play, RotateCcw, CheckCircle, AlertCircle, Monitor, FileCheck } from 'lucide-react-native';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { TestWithDetails, TestAttempt } from '../../types/test.types';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';

interface StudentTestCardProps {
  test: TestWithDetails;
  attempt?: TestAttempt;
  mark?: { marks_obtained: number; max_marks: number; remarks?: string | null; test_mode?: string };
}

export function StudentTestCard({ test, attempt, mark }: StudentTestCardProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  
  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const getTestStatus = () => {
    if (!attempt) return 'not_started';
    if (attempt.status === 'completed') return 'completed';
    if (attempt.status === 'in_progress') return 'in_progress';
    return 'not_started';
  };

  const status = getTestStatus();
  const isOnline = test.test_mode === 'online';

  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          color: colors.success[600],
          backgroundColor: colors.success[50],
          label: 'Completed',
          buttonText: 'View Results',
          buttonColor: colors.success[600],
        };
      case 'in_progress':
        return {
          icon: RotateCcw,
          color: colors.warning[600],
          backgroundColor: colors.warning[50],
          label: 'In Progress',
          buttonText: 'Continue Test',
          buttonColor: colors.warning[600],
        };
      default:
        return {
          icon: Play,
          color: colors.primary[600],
          backgroundColor: colors.primary[50],
          label: 'Not Started',
          buttonText: 'Start Test',
          buttonColor: colors.primary[600],
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const handleStartTest = () => {
    if (!isOnline) return;

    router.push({
      pathname: `/test/${test.id}/take` as any,
      params: {
        testTitle: test.title,
        timeLimit: test.time_limit_seconds || '',
      },
    });
  };

  const handleViewResults = () => {
    if (!isOnline) return;

    router.push({
      pathname: `/test/${test.id}/results` as any,
      params: {
        testTitle: test.title,
      },
    });
  };

  const isTestAvailable = () => {
    if (test.status !== 'active') return false;
    if (!isOnline) return false;
    if (test.test_date) {
      const testDate = new Date(test.test_date);
      const now = new Date();
      if (now < testDate) return false;
    }
    if (status === 'completed' && !test.allow_reattempts) {
      return true; // Can view results
    }
    return true;
  };

  const canTakeTest = isTestAvailable();

  const getScoreDisplay = () => {
    if (isOnline && status === 'completed' && attempt) {
      const score = attempt.earned_points || 0;
      const total = attempt.total_points || 0;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      return { score, total, percentage };
    }
    if (!isOnline && mark) {
      const score = mark.marks_obtained || 0;
      const total = mark.max_marks || 0;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      return { score, total, percentage };
    }
    return null;
  };

  const scoreDisplay = getScoreDisplay();
  const modeIcon = isOnline ? Monitor : FileCheck;
  const modeColor = isOnline ? colors.primary[600] : colors.secondary[600];
  const modeBg = isOnline ? colors.primary[50] : colors.secondary[50];

  return (
    <View style={styles.card}>
      <Pressable
        android_ripple={{ color: colors.primary[100] }}
        style={({ pressed }) => [
          styles.cardPressable,
          pressed && styles.cardPressed
        ]}
      >
        <View style={styles.cardInner}>
          {/* Icon */}
          <View style={[styles.testIcon, { backgroundColor: modeBg }]}>
            {React.createElement(modeIcon, { size: 20, color: modeColor })}
          </View>

          {/* Content */}
          <View style={styles.testDetails}>
            <View style={styles.titleRow}>
              <Text style={styles.testTitle} numberOfLines={2}>
                {test.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
                <StatusIcon size={14} color={statusConfig.color} />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>

            {/* Meta Info */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <BookOpen size={14} color={colors.text.secondary} />
                <Text style={styles.metaText}>{test.subject_name}</Text>
              </View>
              {test.test_date && (
                <>
                  <View style={styles.metaDot} />
                  <View style={styles.metaItem}>
                    <Calendar size={14} color={colors.text.secondary} />
                    <Text style={styles.metaText}>
                      {format(new Date(test.test_date), 'MMM dd')}
                    </Text>
                  </View>
                </>
              )}
              {test.time_limit_seconds && isOnline && (
                <>
                  <View style={styles.metaDot} />
                  <View style={styles.metaItem}>
                    <Clock size={14} color={colors.text.secondary} />
                    <Text style={styles.metaText}>
                      {Math.floor(test.time_limit_seconds / 60)}m
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Score Display */}
            {scoreDisplay && (
              <View style={styles.scoreSection}>
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Score:</Text>
                  <View style={styles.scoreDisplay}>
                    <Text style={styles.scoreValue}>
                      {scoreDisplay.score}/{scoreDisplay.total}
                    </Text>
                    <View style={styles.percentageBadge}>
                      <Text style={styles.percentageText}>{scoreDisplay.percentage}%</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Action Button */}
            {isOnline ? (
              canTakeTest ? (
                status === 'completed' && test.allow_reattempts ? (
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={handleViewResults}
                    >
                      <CheckCircle size={18} color={colors.success[600]} />
                      <Text style={styles.secondaryButtonText}>View Result</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.primary[600] }]}
                      onPress={handleStartTest}
                    >
                      <RotateCcw size={18} color={colors.text.inverse} />
                      <Text style={styles.primaryButtonText}>Retake</Text>
                    </TouchableOpacity>
                  </View>
                ) : status === 'completed' ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.success[600] }]}
                    onPress={handleViewResults}
                  >
                    <CheckCircle size={18} color={colors.text.inverse} />
                    <Text style={styles.primaryButtonText}>View Result</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: statusConfig.buttonColor }]}
                    onPress={handleStartTest}
                  >
                    <StatusIcon size={18} color={colors.text.inverse} />
                    <Text style={styles.primaryButtonText}>{statusConfig.buttonText}</Text>
                  </TouchableOpacity>
                )
              ) : (
                <View style={styles.unavailableBadge}>
                  <AlertCircle size={14} color={colors.text.secondary} />
                  <Text style={styles.unavailableText}>
                    {test.status !== 'active' ? 'Test not active' : 'Not available yet'}
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.offlineBadge}>
                {mark ? (
                  <>
                    <CheckCircle size={14} color={colors.success[600]} />
                    <Text style={styles.offlineText}>
                      Marks uploaded
                    </Text>
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} color={colors.text.secondary} />
                    <Text style={styles.offlineText}>
                      Offline test - marks pending
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  cardPressable: {
    backgroundColor: colors.surface.primary,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  testIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  testDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  testTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: typography.fontSize.base * 1.4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    flexShrink: 0,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.tertiary,
  },
  scoreSection: {
    paddingTop: spacing.xs,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? colors.success[100] : colors.success[50],
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  scoreLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
  },
  percentageBadge: {
    backgroundColor: colors.success[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  percentageText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: isDark ? colors.success[100] : colors.success[50],
    borderWidth: 1.5,
    borderColor: colors.success[600],
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  unavailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
  },
  unavailableText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: isDark ? colors.warning[100] : colors.warning[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  offlineText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },
});
