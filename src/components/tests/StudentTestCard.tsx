import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { TestWithDetails, TestAttempt } from '../../types/test.types';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { Card, Badge, Chip, ProgressBar, Button } from '../../ui';

interface StudentTestCardProps {
  test: TestWithDetails;
  attempt?: TestAttempt;
  mark?: { marks_obtained: number; max_marks: number; remarks?: string | null; test_mode?: string };
}

export function StudentTestCard({ test, attempt, mark }: StudentTestCardProps) {
  const router = useRouter();
  const { colors, isDark, spacing, typography, borderRadius } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark, spacing, typography, borderRadius), [colors, isDark]);

  // --- Derived state ---
  const isOnline = test.test_mode === 'online';
  const status = !attempt ? 'not_started' : (attempt.status === 'completed' ? 'completed' : attempt.status === 'in_progress' ? 'in_progress' : 'not_started');

  const statusConfig = useMemo(() => {
    switch (status) {
      case 'completed':
        return { variant: 'success' as const, label: 'Completed', icon: 'check-circle' as const };
      case 'in_progress':
        return { variant: 'warning' as const, label: 'In Progress', icon: 'replay' as const };
      default:
        return { variant: 'primary' as const, label: 'Not Started', icon: 'play-arrow' as const };
    }
  }, [status]);

  // Card tint based on status
  const cardTintStyle = useMemo(() => {
    if (status === 'completed') return { borderLeftWidth: 3, borderLeftColor: colors.success[500] };
    if (status === 'in_progress') return { borderLeftWidth: 3, borderLeftColor: colors.warning[500] };
    return {};
  }, [status, colors]);

  // Test availability
  const isTestAvailable = () => {
    if (test.status !== 'active') return false;
    if (!isOnline) return false;
    if (test.test_date) {
      const now = new Date();
      if (now < new Date(test.test_date)) return false;
    }
    return true;
  };
  const canTakeTest = isTestAvailable();

  // Score
  const scoreDisplay = useMemo(() => {
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
  }, [isOnline, status, attempt, mark]);

  // --- Handlers ---
  const handleCardPress = () => {
    if (isOnline) {
      if (status === 'completed') {
        router.push({ pathname: `/test/${test.id}/results` as any, params: { testTitle: test.title } });
      } else if (status === 'in_progress' && canTakeTest) {
        router.push({ pathname: `/test/${test.id}/take` as any, params: { testTitle: test.title, timeLimit: test.time_limit_seconds || '' } });
      } else if (canTakeTest) {
        router.push({ pathname: `/test/${test.id}/take` as any, params: { testTitle: test.title, timeLimit: test.time_limit_seconds || '' } });
      }
    }
  };

  const getProgressVariant = (pct: number) => {
    if (pct >= 80) return 'success' as const;
    if (pct >= 50) return 'warning' as const;
    return 'error' as const;
  };

  return (
    <Card
      variant="outlined"
      padding="md"
      onPress={(isOnline && canTakeTest) || status === 'completed' ? handleCardPress : undefined}
      style={cardTintStyle}
      accessibilityLabel={`${test.title} - ${statusConfig.label}`}
    >
      {/* Top row: title + status badge */}
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>{test.title}</Text>
        <Badge variant={statusConfig.variant} size="sm">{statusConfig.label}</Badge>
      </View>

      {/* Metadata chips */}
      <View style={styles.chipRow}>
        <Chip
          size="sm"
          variant={isOnline ? 'primary' : 'secondary'}
          icon={<MaterialIcons name={isOnline ? 'desktop-windows' : 'fact-check'} size={12} color={isOnline ? colors.primary[600] : colors.secondary[600]} />}
          compact
        >
          {isOnline ? 'Online' : 'Offline'}
        </Chip>

        {test.subject_name ? (
          <Chip
            size="sm"
            compact
            icon={<MaterialIcons name="menu-book" size={12} color={colors.text.secondary} />}
          >
            {test.subject_name}
          </Chip>
        ) : null}

        {test.test_date ? (
          <Chip
            size="sm"
            compact
            icon={<MaterialIcons name="event" size={12} color={colors.text.secondary} />}
          >
            {format(new Date(test.test_date), 'MMM dd')}
          </Chip>
        ) : null}

        {test.time_limit_seconds && isOnline ? (
          <Chip
            size="sm"
            compact
            icon={<MaterialIcons name="schedule" size={12} color={colors.text.secondary} />}
          >
            {Math.floor(test.time_limit_seconds / 60)}m
          </Chip>
        ) : null}
      </View>

      {/* Score bar */}
      {scoreDisplay && (
        <View style={styles.scoreSection}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreLabel}>Score</Text>
            <Text style={styles.scoreValue}>{scoreDisplay.score}/{scoreDisplay.total} ({scoreDisplay.percentage}%)</Text>
          </View>
          <ProgressBar
            progress={scoreDisplay.percentage}
            variant={getProgressVariant(scoreDisplay.percentage)}
            size="sm"
          />
        </View>
      )}

      {/* Action area */}
      {isOnline ? (
        canTakeTest ? (
          status === 'completed' && test.allow_reattempts ? (
            <View style={styles.buttonRow}>
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push({ pathname: `/test/${test.id}/results` as any, params: { testTitle: test.title } })}
                style={styles.flex1}
              >
                View Result
              </Button>
              <Button
                size="sm"
                onPress={() => router.push({ pathname: `/test/${test.id}/take` as any, params: { testTitle: test.title, timeLimit: test.time_limit_seconds || '' } })}
                style={styles.flex1}
              >
                Retake
              </Button>
            </View>
          ) : status === 'completed' ? null /* Card press handles it */ : (
            <Button
              size="sm"
              onPress={handleCardPress}
              fullWidth
            >
              {status === 'in_progress' ? 'Continue Test' : 'Start Test'}
            </Button>
          )
        ) : (
          <View style={styles.unavailableRow}>
            <MaterialIcons name="lock" size={14} color={colors.text.tertiary} />
            <Text style={styles.unavailableText}>
              {test.status !== 'active' ? 'Test not active' : 'Not available yet'}
            </Text>
          </View>
        )
      ) : (
        !mark ? (
          <View style={styles.pendingRow}>
            <MaterialIcons name="hourglass-empty" size={14} color={colors.warning[600]} />
            <Text style={styles.pendingText}>Marks pending</Text>
          </View>
        ) : null
      )}
    </Card>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean, spacing: any, typography: any, borderRadius: any) => StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    lineHeight: typography.fontSize.base * 1.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  scoreSection: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  scoreValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  unavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  unavailableText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  pendingText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    fontWeight: typography.fontWeight.medium,
  },
});
