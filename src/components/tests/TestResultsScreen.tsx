import React, { useMemo, useState, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTestQuestions, useStudentAttempts } from '../../hooks/tests';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Badge, ProgressRing, Button, LoadingView, EmptyStateIllustration } from '../../ui';

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
  const { data: attempts = [], isLoading: attemptsLoading } = useStudentAttempts(studentId || '', testId);

  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);

  const latestAttempt = attempts.find((a) => a.status === 'completed');
  const isLoading = questionsLoading || attemptsLoading;

  const formatTime = (seconds: number | null | undefined) => {
    if (!seconds) return 'N/A';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const getGrade = useCallback((percentage: number) => {
    if (percentage >= 90) return { grade: 'A+', color: colors.success[600] };
    if (percentage >= 80) return { grade: 'A', color: colors.success[500] };
    if (percentage >= 70) return { grade: 'B+', color: colors.primary[600] };
    if (percentage >= 60) return { grade: 'B', color: colors.primary[500] };
    if (percentage >= 50) return { grade: 'C', color: colors.warning[600] };
    if (percentage >= 40) return { grade: 'D', color: colors.warning[500] };
    return { grade: 'F', color: colors.error[600] };
  }, [colors]);

  if (isLoading) {
    return <LoadingView message="Loading results..." />;
  }

  if (!latestAttempt) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Test Results</Text>
          <View style={{ width: 24 }} />
        </View>
        <EmptyStateIllustration type="tests" title="No Results" description="No results available for this test yet" />
      </SafeAreaView>
    );
  }

  const earnedPoints = latestAttempt.earned_points || 0;
  const totalPoints = latestAttempt.total_points || 0;
  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const gradeInfo = getGrade(percentage);
  const answers = latestAttempt.answers as Record<string, any>;

  // Question analysis
  const questionAnalysis = questions.map((q, index) => {
    const answer = answers[q.id];
    let isCorrect: boolean | null = null;
    if (q.question_type === 'mcq') {
      isCorrect = answer ? answer.answer === q.correct_index : false;
    } else if (q.question_type === 'one_word') {
      isCorrect = answer ? answer.answer?.trim().toLowerCase() === q.correct_text?.trim().toLowerCase() : false;
    }
    return { question: q, answer, isCorrect, index };
  });

  const correctCount = questionAnalysis.filter(q => q.isCorrect === true).length;
  const incorrectCount = questionAnalysis.filter(q => q.isCorrect === false).length;
  const unansweredCount = questionAnalysis.filter(q => !q.answer).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>Results</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{testTitle}</Text>
        </View>
        <Badge variant={percentage >= 50 ? 'success' : 'error'} size="sm">{gradeInfo.grade}</Badge>
      </View>

      <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score Card */}
        <Card variant="elevated" padding="lg" style={styles.scoreCard}>
          <View style={styles.scoreTop}>
            <ProgressRing
              progress={percentage}
              size={100}
              strokeWidth={10}
              color={gradeInfo.color}
              showPercentage
              label={`${earnedPoints}/${totalPoints}`}
            />

            <View style={styles.scoreStats}>
              <View style={styles.scoreStat}>
                <MaterialIcons name="check-circle" size={18} color={colors.success[600]} />
                <Text style={styles.scoreStatLabel}>Correct</Text>
                <Text style={[styles.scoreStatValue, { color: colors.success[600] }]}>{correctCount}</Text>
              </View>
              <View style={styles.scoreStat}>
                <MaterialIcons name="cancel" size={18} color={colors.error[600]} />
                <Text style={styles.scoreStatLabel}>Wrong</Text>
                <Text style={[styles.scoreStatValue, { color: colors.error[600] }]}>{incorrectCount}</Text>
              </View>
              <View style={styles.scoreStat}>
                <MaterialIcons name="remove-circle-outline" size={18} color={colors.text.tertiary} />
                <Text style={styles.scoreStatLabel}>Skipped</Text>
                <Text style={styles.scoreStatValue}>{unansweredCount}</Text>
              </View>
              <View style={styles.scoreStat}>
                <MaterialIcons name="schedule" size={18} color={colors.warning[600]} />
                <Text style={styles.scoreStatLabel}>Time</Text>
                <Text style={styles.scoreStatValue}>{formatTime((latestAttempt as any).time_taken_seconds)}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Question navigation chips */}
        <View style={styles.navChipRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navChipScroll}>
            {questionAnalysis.map((qa, index) => (
              <TouchableOpacity
                key={qa.question.id}
                style={[
                  styles.navChip,
                  qa.isCorrect === true && styles.navChipCorrect,
                  qa.isCorrect === false && styles.navChipIncorrect,
                  !qa.answer && styles.navChipUnanswered,
                  activeQuestionIndex === index && styles.navChipActive,
                ]}
                onPress={() => setActiveQuestionIndex(index)}
              >
                <Text style={[
                  styles.navChipText,
                  qa.isCorrect === true && { color: colors.success[700] },
                  qa.isCorrect === false && { color: colors.error[700] },
                ]}>{index + 1}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Question Review */}
        <Text style={styles.sectionTitle}>Question Review</Text>

        {questionAnalysis.map((qa) => {
          const { question, answer, isCorrect, index } = qa;
          return (
            <Card key={question.id} variant="outlined" padding="md" style={styles.questionCard}>
              {/* Question header */}
              <View style={styles.questionHeader}>
                <Text style={styles.questionNumber}>Q{index + 1}</Text>
                {isCorrect !== null && (
                  <Badge variant={isCorrect ? 'success' : 'error'} size="xs">
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </Badge>
                )}
                {question.question_type === 'long_answer' && (
                  <Badge variant="warning" size="xs">Pending Review</Badge>
                )}
                <Text style={styles.questionPoints}>{question.points} pts</Text>
              </View>

              <Text style={styles.questionText}>{question.question_text}</Text>

              {/* MCQ Review */}
              {question.question_type === 'mcq' && question.options && (
                <View style={styles.optionsContainer}>
                  {question.options.map((option, optIndex) => {
                    const isStudentAnswer = answer?.answer === optIndex;
                    const isCorrectOption = optIndex === question.correct_index;
                    return (
                      <View
                        key={optIndex}
                        style={[
                          styles.optionItem,
                          isCorrectOption && styles.optionCorrect,
                          isStudentAnswer && !isCorrectOption && styles.optionIncorrect,
                        ]}
                      >
                        <View style={[
                          styles.optionBullet,
                          isCorrectOption && styles.optionBulletCorrect,
                          isStudentAnswer && !isCorrectOption && styles.optionBulletIncorrect,
                        ]}>
                          {isCorrectOption && <MaterialIcons name="check" size={12} color={colors.success[600]} />}
                          {isStudentAnswer && !isCorrectOption && <MaterialIcons name="close" size={12} color={colors.error[600]} />}
                        </View>
                        <Text style={[
                          styles.optionText,
                          isCorrectOption && { fontWeight: typography.fontWeight.semibold, color: colors.success[700] },
                          isStudentAnswer && !isCorrectOption && { color: colors.error[700] },
                        ]}>{option}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* One word review */}
              {question.question_type === 'one_word' && (
                <View style={styles.answerSection}>
                  <View style={styles.answerRow}>
                    <Text style={styles.answerLabel}>Your answer:</Text>
                    <Text style={[styles.answerValue, isCorrect ? { color: colors.success[700] } : { color: colors.error[700] }]}>
                      {answer?.answer || 'Not answered'}
                    </Text>
                  </View>
                  {!isCorrect && (
                    <View style={styles.answerRow}>
                      <Text style={styles.answerLabel}>Correct:</Text>
                      <Text style={[styles.answerValue, { color: colors.success[700] }]}>{question.correct_text}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Long answer review */}
              {question.question_type === 'long_answer' && (
                <View style={styles.longAnswerSection}>
                  <Text style={styles.answerLabel}>Your answer:</Text>
                  <Text style={styles.longAnswerText}>{answer?.answer || 'Not answered'}</Text>
                  <Text style={styles.manualNote}>This answer will be graded manually by your teacher</Text>
                </View>
              )}

              {/* Explanation */}
              {question.correct_answer && (
                <View style={styles.explanationBox}>
                  <Text style={styles.explanationLabel}>Explanation</Text>
                  <Text style={styles.explanationText}>{question.correct_answer}</Text>
                </View>
              )}
            </Card>
          );
        })}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.app,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface.primary,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border.light,
      gap: spacing.sm,
    },
    headerContent: {
      flex: 1,
    },
    headerTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    headerSubtitle: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: 1,
    },
    content: {
      flex: 1,
      padding: spacing.md,
    },
    scoreCard: {
      marginBottom: spacing.md,
    },
    scoreTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    scoreStats: {
      flex: 1,
      gap: spacing.sm,
    },
    scoreStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    scoreStatLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      flex: 1,
    },
    scoreStatValue: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    navChipRow: {
      marginBottom: spacing.md,
    },
    navChipScroll: {
      gap: spacing.xs,
      paddingRight: spacing.md,
    },
    navChip: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.neutral[200],
      justifyContent: 'center',
      alignItems: 'center',
    },
    navChipCorrect: {
      backgroundColor: colors.success[100],
    },
    navChipIncorrect: {
      backgroundColor: colors.error[100],
    },
    navChipUnanswered: {
      backgroundColor: colors.neutral[100],
    },
    navChipActive: {
      borderWidth: 2,
      borderColor: colors.primary[600],
    },
    navChipText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    sectionTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    questionCard: {
      marginBottom: spacing.sm,
    },
    questionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    questionNumber: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.bold,
      color: colors.primary[600],
    },
    questionPoints: {
      marginLeft: 'auto',
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.tertiary,
    },
    questionText: {
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
      lineHeight: typography.fontSize.base * 1.5,
      marginBottom: spacing.md,
    },
    optionsContainer: {
      gap: spacing.xs,
    },
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surface.secondary,
    },
    optionCorrect: {
      backgroundColor: colors.success[50],
      borderWidth: 1,
      borderColor: colors.success[300],
    },
    optionIncorrect: {
      backgroundColor: colors.error[50],
      borderWidth: 1,
      borderColor: colors.error[300],
    },
    optionBullet: {
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.neutral[200],
    },
    optionBulletCorrect: {
      backgroundColor: colors.success[100],
    },
    optionBulletIncorrect: {
      backgroundColor: colors.error[100],
    },
    optionText: {
      flex: 1,
      fontSize: typography.fontSize.sm,
      color: colors.text.primary,
    },
    answerSection: {
      gap: spacing.xs,
    },
    answerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      backgroundColor: colors.surface.secondary,
      borderRadius: borderRadius.sm,
    },
    answerLabel: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.secondary,
    },
    answerValue: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.bold,
    },
    longAnswerSection: {
      gap: spacing.xs,
    },
    longAnswerText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.primary,
      padding: spacing.sm,
      backgroundColor: colors.surface.secondary,
      borderRadius: borderRadius.sm,
      minHeight: 60,
      lineHeight: typography.fontSize.sm * 1.5,
    },
    manualNote: {
      fontSize: typography.fontSize.xs,
      color: colors.warning[600],
      fontStyle: 'italic',
    },
    explanationBox: {
      marginTop: spacing.sm,
      padding: spacing.sm,
      backgroundColor: colors.primary[50],
      borderRadius: borderRadius.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary[600],
    },
    explanationLabel: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.bold,
      color: colors.primary[700],
      marginBottom: spacing.xs / 2,
    },
    explanationText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.primary,
      lineHeight: typography.fontSize.sm * 1.5,
    },
  });
