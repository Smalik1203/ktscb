import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle, XCircle, Clock, Award } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTestQuestions, useStudentAttempts } from '../../hooks/tests';
import { useAuth } from '../../contexts/AuthContext';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';

export function TestResultsScreen() {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const router = useRouter();
  const params = useLocalSearchParams();
  const testId = params.testId as string;
  const testTitle = params.testTitle as string;

  const { user } = useAuth();
  const studentId = user?.id;

  const { data: questions = [], isLoading: questionsLoading } = useTestQuestions(testId);
  const { data: attempts = [], isLoading: attemptsLoading } = useStudentAttempts(
    studentId || '',
    testId
  );

  // Get the latest completed attempt
  const latestAttempt = attempts.find((a) => a.status === 'completed');

  const isLoading = questionsLoading || attemptsLoading;

  const formatTime = (seconds: number | null | undefined) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: 'A+', color: colors.success[600] };
    if (percentage >= 80) return { grade: 'A', color: colors.success[500] };
    if (percentage >= 70) return { grade: 'B+', color: colors.primary[600] };
    if (percentage >= 60) return { grade: 'B', color: colors.primary[500] };
    if (percentage >= 50) return { grade: 'C', color: colors.warning[600] };
    if (percentage >= 40) return { grade: 'D', color: colors.warning[500] };
    return { grade: 'F', color: colors.error[600] };
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!latestAttempt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Test Results</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results available yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  const earnedPoints = latestAttempt.earned_points || 0;
  const totalPoints = latestAttempt.total_points || 0;
  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const gradeInfo = getGrade(percentage);
  const answers = latestAttempt.answers as Record<string, any>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Test Results</Text>
          <Text style={styles.headerSubtitle}>{testTitle}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Award size={32} color={gradeInfo.color} />
            <Text style={styles.scoreTitle}>Your Score</Text>
          </View>

          <View style={styles.scoreMain}>
            <Text style={styles.scoreValue}>
              {earnedPoints} / {totalPoints}
            </Text>
            <View style={[styles.gradeBadge, { backgroundColor: gradeInfo.color }]}>
              <Text style={styles.gradeText}>{gradeInfo.grade}</Text>
            </View>
          </View>

          <View style={styles.percentageBar}>
            <View style={styles.percentageBarBg}>
              <View
                style={[
                  styles.percentageBarFill,
                  { width: `${percentage}%`, backgroundColor: gradeInfo.color },
                ]}
              />
            </View>
            <Text style={styles.percentageText}>{percentage}%</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <CheckCircle size={20} color={colors.success[600]} />
              <Text style={styles.statLabel}>Correct</Text>
              <Text style={styles.statValue}>
                {questions.filter((q) => {
                  const answer = answers[q.id];
                  if (!answer) return false;
                  if (q.question_type === 'mcq') {
                    return answer.answer === q.correct_index;
                  }
                  if (q.question_type === 'one_word') {
                    return (
                      answer.answer?.trim().toLowerCase() === q.correct_text?.trim().toLowerCase()
                    );
                  }
                  return false;
                }).length}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <XCircle size={20} color={colors.error[600]} />
              <Text style={styles.statLabel}>Incorrect</Text>
              <Text style={styles.statValue}>
                {questions.filter((q) => {
                  const answer = answers[q.id];
                  if (!answer) return false;
                  if (q.question_type === 'mcq') {
                    return answer.answer !== q.correct_index;
                  }
                  if (q.question_type === 'one_word') {
                    return (
                      answer.answer?.trim().toLowerCase() !== q.correct_text?.trim().toLowerCase()
                    );
                  }
                  return false;
                }).length}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Clock size={20} color={colors.warning[600]} />
              <Text style={styles.statLabel}>Time</Text>
              <Text style={styles.statValue}>{formatTime((latestAttempt as any).time_taken_seconds)}</Text>
            </View>
          </View>
        </View>

        {/* Questions Review */}
        <View style={styles.reviewSection}>
          <Text style={styles.sectionTitle}>Question Review</Text>

          {questions.map((question, index) => {
            const answer = answers[question.id];
            const isCorrect =
              question.question_type === 'mcq'
                ? answer?.answer === question.correct_index
                : question.question_type === 'one_word'
                ? answer?.answer?.trim().toLowerCase() === question.correct_text?.trim().toLowerCase()
                : null;

            return (
              <View key={question.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Q{index + 1}</Text>
                  {isCorrect !== null && (
                    <View
                      style={[
                        styles.resultBadge,
                        isCorrect ? styles.resultBadgeCorrect : styles.resultBadgeIncorrect,
                      ]}
                    >
                      {isCorrect ? (
                        <CheckCircle size={16} color={colors.success[600]} />
                      ) : (
                        <XCircle size={16} color={colors.error[600]} />
                      )}
                      <Text
                        style={[
                          styles.resultBadgeText,
                          isCorrect ? styles.resultBadgeTextCorrect : styles.resultBadgeTextIncorrect,
                        ]}
                      >
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.questionPoints}>{question.points} pts</Text>
                </View>

                <Text style={styles.questionText}>{question.question_text}</Text>

                {question.question_type === 'mcq' && question.options && (
                  <>
                    <View style={styles.optionsContainer}>
                      {question.options.map((option, optIndex) => {
                        const isStudentAnswer = answer?.answer === optIndex;
                        const isCorrectOption = optIndex === question.correct_index;

                        return (
                          <View
                            key={optIndex}
                            style={[
                              styles.optionItem,
                              isCorrectOption && styles.optionItemCorrect,
                              isStudentAnswer && !isCorrectOption && styles.optionItemIncorrect,
                            ]}
                          >
                            <View
                              style={[
                                styles.optionBullet,
                                isCorrectOption && styles.optionBulletCorrect,
                                isStudentAnswer && !isCorrectOption && styles.optionBulletIncorrect,
                              ]}
                            >
                              {isCorrectOption && <CheckCircle size={12} color={colors.success[600]} />}
                              {isStudentAnswer && !isCorrectOption && (
                                <XCircle size={12} color={colors.error[600]} />
                              )}
                            </View>
                            <Text
                              style={[
                                styles.optionText,
                                isCorrectOption && styles.optionTextCorrect,
                                isStudentAnswer && !isCorrectOption && styles.optionTextIncorrect,
                              ]}
                            >
                              {option}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Explanation Section */}
                    {question.correct_answer && (
                      <View style={styles.explanationSection}>
                        <Text style={styles.explanationLabel}>Explanation:</Text>
                        <Text style={styles.explanationText}>{question.correct_answer}</Text>
                      </View>
                    )}
                  </>
                )}

                {question.question_type === 'one_word' && (
                  <View style={styles.answerSection}>
                    <View style={styles.answerRow}>
                      <Text style={styles.answerLabel}>Your Answer:</Text>
                      <Text
                        style={[
                          styles.answerValue,
                          isCorrect ? styles.answerValueCorrect : styles.answerValueIncorrect,
                        ]}
                      >
                        {answer?.answer || 'Not answered'}
                      </Text>
                    </View>
                    {!isCorrect && (
                      <View style={styles.answerRow}>
                        <Text style={styles.answerLabel}>Correct Answer:</Text>
                        <Text style={[styles.answerValue, styles.answerValueCorrect]}>
                          {question.correct_text}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {question.question_type === 'long_answer' && (
                  <View style={styles.longAnswerSection}>
                    <Text style={styles.longAnswerLabel}>Your Answer:</Text>
                    <Text style={styles.longAnswerText}>{answer?.answer || 'Not answered'}</Text>
                    <Text style={styles.manualGradingNote}>
                      This answer will be graded manually by your teacher
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.primary,
    ...shadows.sm,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  scoreCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  scoreTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  scoreMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  scoreValue: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  gradeBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  gradeText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
  },
  percentageBar: {
    marginBottom: spacing.lg,
  },
  percentageBarBg: {
    height: 12,
    backgroundColor: colors.neutral[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  percentageBarFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  percentageText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
    paddingTop: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.DEFAULT,
  },
  reviewSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  questionCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  questionNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  resultBadgeCorrect: {
    backgroundColor: colors.success[50],
  },
  resultBadgeIncorrect: {
    backgroundColor: colors.error[50],
  },
  resultBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  resultBadgeTextCorrect: {
    color: colors.success[700],
  },
  resultBadgeTextIncorrect: {
    color: colors.error[700],
  },
  questionPoints: {
    marginLeft: 'auto',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  questionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.md,
    lineHeight: typography.fontSize.base * 1.5,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
  },
  optionItemCorrect: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[600],
  },
  optionItemIncorrect: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[600],
  },
  optionBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[300],
  },
  optionBulletCorrect: {
    backgroundColor: colors.success[100],
  },
  optionBulletIncorrect: {
    backgroundColor: colors.error[100],
  },
  optionText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  optionTextCorrect: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  optionTextIncorrect: {
    color: colors.error[700],
  },
  answerSection: {
    gap: spacing.sm,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
  },
  answerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  answerValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  answerValueCorrect: {
    color: colors.success[700],
  },
  answerValueIncorrect: {
    color: colors.error[700],
  },
  longAnswerSection: {
    gap: spacing.sm,
  },
  longAnswerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  longAnswerText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    padding: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    minHeight: 80,
    lineHeight: typography.fontSize.base * 1.5,
  },
  manualGradingNote: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontStyle: 'italic',
  },
  explanationSection: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[600],
  },
  explanationLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  explanationText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: typography.fontSize.base * 1.5,
  },
});
