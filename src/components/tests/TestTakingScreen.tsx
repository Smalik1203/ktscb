import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTestQuestions, useCreateAttempt, useUpdateAttempt, useSubmitTest, useStudentAttempts } from '../../hooks/tests';
import { useAuth } from '../../contexts/AuthContext';
import { SuccessAnimation, Card, Badge, Button, ProgressBar, Input, LoadingView, ErrorView } from '../../ui';
import { supabase } from '../../lib/supabase';

interface Answer {
  questionId: string;
  answer: any;
  marked_for_review?: boolean;
}

export function TestTakingScreen() {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const router = useRouter();
  const params = useLocalSearchParams();
  const testId = params.testId as string;
  const testTitle = params.testTitle as string;
  const timeLimit = params.timeLimit ? parseInt(params.timeLimit as string) : null;
  const studentIdParam = params.studentId as string | undefined;

  const { user } = useAuth();
  const [fetchedStudentId, setFetchedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (studentIdParam) return;
    if (!user?.id) return;
    const fetchStudentId = async () => {
      const { data } = await supabase
        .from('student')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (data?.id) setFetchedStudentId(data.id);
    };
    fetchStudentId();
  }, [studentIdParam, user?.id]);

  const studentId = studentIdParam || fetchedStudentId;

  const { data: questions = [], isLoading: questionsLoading } = useTestQuestions(testId);
  const { data: existingAttempts } = useStudentAttempts(studentId || '', testId);
  const createAttempt = useCreateAttempt();
  const updateAttempt = useUpdateAttempt();
  const submitTest = useSubmitTest();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [submissionScore, setSubmissionScore] = useState<{ earned: number; total: number } | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAnswersRef = useRef<string>('');
  const isSubmittedRef = useRef<boolean>(false);
  const timerStartedRef = useRef<boolean>(false);

  // Initialize test attempt
  useEffect(() => {
    if (!studentId || !testId || attemptId) return;
    const initializeAttempt = async () => {
      const inProgressAttempt = existingAttempts?.find((a) => a.status === 'in_progress');
      timerStartedRef.current = false;
      isSubmittedRef.current = false;

      if (inProgressAttempt) {
        setAttemptId(inProgressAttempt.id);
        if (inProgressAttempt.answers && typeof inProgressAttempt.answers === 'object') {
          setAnswers(inProgressAttempt.answers as unknown as Record<string, Answer>);
        }
        if (timeLimit) {
          const elapsed = Math.floor((new Date().getTime() - new Date(inProgressAttempt.started_at || '').getTime()) / 1000);
          setTimeRemaining(Math.max(0, timeLimit - elapsed));
        }
      } else {
        try {
          const newAttempt = await createAttempt.mutateAsync({
            test_id: testId,
            student_id: studentId,
            answers: {},
            status: 'in_progress',
          });
          setAttemptId(newAttempt.id);
          if (timeLimit) setTimeRemaining(timeLimit);
        } catch {
          Alert.alert('Error', 'Failed to start test. Please try again.');
          router.back();
        }
      }
    };
    initializeAttempt();
  }, [studentId, testId, existingAttempts]);

  // Timer
  useEffect(() => {
    if (!timeLimit || !attemptId || !existingAttempts) return;
    if (isSubmittedRef.current || timerStartedRef.current) return;

    const inProgressAttempt = existingAttempts?.find((a) => a.status === 'in_progress');
    const startTimePayload = inProgressAttempt?.started_at ? new Date(inProgressAttempt.started_at).getTime() : Date.now();
    const endTime = startTimePayload + (timeLimit * 1000);

    const startTimer = () => {
      const initialRemaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      if (initialRemaining <= 0 && !isSubmittedRef.current) { handleAutoSubmit(); return; }
      setTimeRemaining(initialRemaining);
      timerStartedRef.current = true;

      timerRef.current = setInterval(() => {
        if (isSubmittedRef.current) { if (timerRef.current) clearInterval(timerRef.current); return; }
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        setTimeRemaining(remaining);
        if (remaining <= 0) { if (timerRef.current) clearInterval(timerRef.current); handleAutoSubmit(); }
      }, 1000);
    };

    const timer = setTimeout(startTimer, 100);
    return () => { clearTimeout(timer); if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLimit, attemptId, existingAttempts]);

  // Auto-save
  useEffect(() => {
    if (!attemptId || isSubmittedRef.current) return;
    const currentStr = JSON.stringify(answers);
    if (currentStr === lastSavedAnswersRef.current) return;

    autoSaveRef.current = setTimeout(() => {
      if (!isSubmittedRef.current) saveAnswers();
    }, 5000);

    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [answers, attemptId]);

  // Back handler
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => { handleBackPress(); return true; });
    return () => handler.remove();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, []);

  const saveAnswers = async () => {
    if (!attemptId) return;
    const currentStr = JSON.stringify(answers);
    if (currentStr === lastSavedAnswersRef.current) return;
    setAutoSaveStatus('saving');
    try {
      await updateAttempt.mutateAsync({ attemptId, attemptData: { answers, status: 'in_progress' } });
      lastSavedAnswersRef.current = currentStr;
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch {
      setAutoSaveStatus('error');
    }
  };

  const calculateScore = useCallback(() => {
    let earnedPoints = 0;
    let totalPoints = 0;
    questions.forEach((question) => {
      totalPoints += (question.points || 0);
      const answer = answers[question.id];
      if (!answer) return;
      if (question.question_type === 'mcq' && typeof answer.answer === 'number') {
        if (answer.answer === question.correct_index) earnedPoints += (question.points || 0);
      } else if (question.question_type === 'one_word' && typeof answer.answer === 'string') {
        if (answer.answer.trim().toLowerCase() === (question.correct_text?.trim().toLowerCase() || '')) {
          earnedPoints += (question.points || 0);
        }
      }
    });
    return { earnedPoints, totalPoints };
  }, [questions, answers]);

  const handleAutoSubmit = async () => {
    if (isSubmittedRef.current) return;
    if (!attemptId) { Alert.alert('Error', 'No active attempt found'); return; }
    isSubmittedRef.current = true;
    setIsSubmitting(true);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoSaveRef.current) { clearTimeout(autoSaveRef.current); autoSaveRef.current = null; }
    try {
      await saveAnswers();
      const { earnedPoints, totalPoints } = calculateScore();
      await submitTest.mutateAsync({ attemptId, finalAnswers: answers, earnedPoints, totalPoints });
      setSubmissionScore({ earned: earnedPoints, total: totalPoints });
      setShowSuccessAnimation(true);
    } catch {
      Alert.alert('Error', 'Failed to submit test automatically. Please try again.');
      isSubmittedRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleBackPress = () => {
    Alert.alert('Exit Test?', 'Your progress will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Exit', style: 'destructive', onPress: async () => { await saveAnswers(); router.back(); } },
    ]);
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { questionId, answer } }));
  };

  const toggleMarkForReview = () => {
    const q = questions[currentQuestionIndex];
    if (!q) return;
    setMarkedForReview((prev) => {
      const s = new Set(prev);
      s.has(q.id) ? s.delete(q.id) : s.add(q.id);
      return s;
    });
  };

  const navigateToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) setCurrentQuestionIndex(index);
  };

  const handleAnimationEnd = () => {
    setShowSuccessAnimation(false);
    if (submissionScore) {
      Alert.alert('Test Submitted', `Score: ${submissionScore.earned}/${submissionScore.total} points`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else { router.back(); }
  };

  const handleSubmit = async () => {
    if (isSubmittedRef.current || !attemptId) return;
    await saveAnswers();
    Alert.alert(
      'Submit Test?',
      `Answered ${Object.keys(answers).length} of ${questions.length} questions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'destructive',
          onPress: async () => {
            isSubmittedRef.current = true;
            setIsSubmitting(true);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            if (autoSaveRef.current) { clearTimeout(autoSaveRef.current); autoSaveRef.current = null; }
            try {
              const { earnedPoints, totalPoints } = calculateScore();
              await submitTest.mutateAsync({ attemptId, finalAnswers: answers, earnedPoints, totalPoints });
              setSubmissionScore({ earned: earnedPoints, total: totalPoints });
              setShowSuccessAnimation(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to submit test');
              isSubmittedRef.current = false;
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const getQuestionStatus = (questionId: string) => {
    if (answers[questionId]) return 'answered';
    if (markedForReview.has(questionId)) return 'marked';
    return 'unanswered';
  };

  // Timer percentage for progress bar
  const timerPercentage = timeLimit ? Math.round((timeRemaining / timeLimit) * 100) : 100;
  const isTimerWarning = timeLimit ? timerPercentage <= 25 : false;

  // Loading states
  if (questionsLoading || !attemptId || !studentId) {
    return <LoadingView message="Loading test..." />;
  }

  if (questions.length === 0) {
    return <ErrorView message="No questions available for this test" onRetry={() => router.back()} />;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion?.id];
  const answeredCount = Object.keys(answers).length;
  const completionPct = Math.round((answeredCount / questions.length) * 100);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backIcon}>
            <MaterialIcons name="chevron-left" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{testTitle}</Text>
            <View style={styles.headerMeta}>
              <Text style={styles.headerSubtitle}>Q {currentQuestionIndex + 1}/{questions.length}</Text>
              {/* Auto-save indicator */}
              {autoSaveStatus === 'saving' && (
                <View style={styles.autoSaveIndicator}>
                  <MaterialIcons name="sync" size={12} color={colors.text.tertiary} />
                  <Text style={styles.autoSaveText}>Saving...</Text>
                </View>
              )}
              {autoSaveStatus === 'saved' && (
                <View style={styles.autoSaveIndicator}>
                  <MaterialIcons name="cloud-done" size={12} color={colors.success[600]} />
                  <Text style={[styles.autoSaveText, { color: colors.success[600] }]}>Saved</Text>
                </View>
              )}
              {autoSaveStatus === 'error' && (
                <View style={styles.autoSaveIndicator}>
                  <MaterialIcons name="cloud-off" size={12} color={colors.error[500]} />
                  <Text style={[styles.autoSaveText, { color: colors.error[500] }]}>Error</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {timeLimit ? (
          <View style={[styles.timerContainer, isTimerWarning && styles.timerWarning]}>
            <MaterialIcons name="schedule" size={16} color={isTimerWarning ? colors.error[600] : colors.primary[600]} />
            <Text style={[styles.timerText, isTimerWarning && styles.timerTextWarning]}>{formatTime(timeRemaining)}</Text>
          </View>
        ) : null}
      </View>

      {/* Timer progress bar */}
      {timeLimit ? (
        <ProgressBar
          progress={timerPercentage}
          variant={isTimerWarning ? 'error' : 'primary'}
          size="xs"
          animated
        />
      ) : null}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Question palette — always visible */}
        <View style={styles.paletteRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteScroll}>
            {questions.map((q, index) => {
              const status = getQuestionStatus(q.id);
              const isActive = index === currentQuestionIndex;
              return (
                <TouchableOpacity
                  key={q.id}
                  style={[
                    styles.paletteItem,
                    isActive && styles.paletteItemActive,
                    status === 'answered' && styles.paletteItemAnswered,
                    status === 'marked' && styles.paletteItemMarked,
                  ]}
                  onPress={() => navigateToQuestion(index)}
                >
                  <Text style={[styles.paletteItemText, isActive && styles.paletteItemTextActive]}>
                    {index + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Completion progress */}
        <View style={styles.completionRow}>
          <Text style={styles.completionText}>{answeredCount}/{questions.length} answered</Text>
          <ProgressBar progress={completionPct} variant="success" size="xs" style={{ flex: 1, marginLeft: spacing.sm }} />
        </View>

        {/* Question Card */}
        <Card variant="elevated" padding="lg" style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionNumber}>Q{currentQuestionIndex + 1}</Text>
            <View style={styles.badgeRow}>
              <Badge variant="info" size="xs">{currentQuestion.question_type.toUpperCase()}</Badge>
              <Badge variant="success" size="xs">{currentQuestion.points} pts</Badge>
            </View>
          </View>

          <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

          {/* MCQ Options */}
          {currentQuestion.question_type === 'mcq' && currentQuestion.options && (
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, index) => {
                const isSelected = currentAnswer?.answer === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                    onPress={() => handleAnswerChange(currentQuestion.id, index)}
                  >
                    <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                      {isSelected && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* One word */}
          {currentQuestion.question_type === 'one_word' && (
            <Input
              placeholder="Enter your answer..."
              value={currentAnswer?.answer || ''}
              onChangeText={(text) => handleAnswerChange(currentQuestion.id, text)}
            />
          )}

          {/* Long answer */}
          {currentQuestion.question_type === 'long_answer' && (
            <Input
              placeholder="Type your answer here..."
              value={currentAnswer?.answer || ''}
              onChangeText={(text) => handleAnswerChange(currentQuestion.id, text)}
              multiline
              numberOfLines={8}
            />
          )}

          {/* Mark for review */}
          <TouchableOpacity style={styles.reviewButton} onPress={toggleMarkForReview}>
            <MaterialIcons
              name="flag"
              size={18}
              color={markedForReview.has(currentQuestion.id) ? colors.warning[600] : colors.text.secondary}
            />
            <Text style={[styles.reviewButtonText, markedForReview.has(currentQuestion.id) && { color: colors.warning[600], fontWeight: typography.fontWeight.semibold }]}>
              {markedForReview.has(currentQuestion.id) ? 'Marked for Review' : 'Mark for Review'}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Navigation Footer */}
      <View style={styles.footer}>
        <Button
          variant="outline"
          size="md"
          onPress={() => navigateToQuestion(currentQuestionIndex - 1)}
          disabled={currentQuestionIndex === 0}
          style={styles.flex1}
        >
          Previous
        </Button>

        {currentQuestionIndex === questions.length - 1 ? (
          <Button
            size="md"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.flex1}
          >
            Submit Test
          </Button>
        ) : (
          <Button
            size="md"
            onPress={() => navigateToQuestion(currentQuestionIndex + 1)}
            style={styles.flex1}
          >
            Next
          </Button>
        )}
      </View>

      <SuccessAnimation visible={showSuccessAnimation} onAnimationEnd={handleAnimationEnd} />
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
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface.primary,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border.light,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    backIcon: {
      marginRight: spacing.sm,
    },
    headerTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    headerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 2,
    },
    headerSubtitle: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
    },
    autoSaveIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    autoSaveText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: colors.primary[50],
      borderRadius: borderRadius.md,
    },
    timerWarning: {
      backgroundColor: colors.error[50],
    },
    timerText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.bold,
      color: colors.primary[600],
      fontVariant: ['tabular-nums'],
    },
    timerTextWarning: {
      color: colors.error[600],
    },
    content: {
      flex: 1,
      padding: spacing.md,
    },
    paletteRow: {
      marginBottom: spacing.sm,
    },
    paletteScroll: {
      gap: spacing.xs,
      paddingRight: spacing.md,
    },
    paletteItem: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.neutral[200],
      justifyContent: 'center',
      alignItems: 'center',
    },
    paletteItemActive: {
      borderWidth: 2,
      borderColor: colors.primary[600],
    },
    paletteItemAnswered: {
      backgroundColor: colors.success[100],
    },
    paletteItemMarked: {
      backgroundColor: colors.warning[100],
    },
    paletteItemText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    paletteItemTextActive: {
      color: colors.primary[600],
    },
    completionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    completionText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.secondary,
    },
    questionCard: {
      marginBottom: spacing.md,
    },
    questionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    questionNumber: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.primary[600],
    },
    badgeRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    questionText: {
      fontSize: typography.fontSize.lg,
      lineHeight: typography.fontSize.lg * 1.5,
      color: colors.text.primary,
      marginBottom: spacing.lg,
    },
    optionsContainer: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: colors.border.DEFAULT,
      backgroundColor: colors.surface.secondary,
    },
    optionButtonSelected: {
      borderColor: colors.primary[600],
      backgroundColor: colors.primary[50],
    },
    radioButton: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border.DEFAULT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioButtonSelected: {
      borderColor: colors.primary[600],
    },
    radioButtonInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary[600],
    },
    optionText: {
      flex: 1,
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
    },
    optionTextSelected: {
      fontWeight: typography.fontWeight.semibold,
      color: colors.primary[700],
    },
    reviewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    reviewButtonText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.surface.primary,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    flex1: {
      flex: 1,
    },
  });
