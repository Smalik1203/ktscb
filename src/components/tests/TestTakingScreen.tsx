import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, ChevronLeft, ChevronRight, Flag, Check, AlertCircle } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTestQuestions, useCreateAttempt, useUpdateAttempt, useSubmitTest, useStudentAttempts } from '../../hooks/tests';
import { colors, spacing, typography, borderRadius, shadows } from '../../../lib/design-system';
import { useAuth } from '../../contexts/AuthContext';
import { SuccessAnimation } from '../ui/SuccessAnimation';

interface Answer {
  questionId: string;
  answer: any;
  marked_for_review?: boolean;
}

export function TestTakingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const testId = params.testId as string;
  const testTitle = params.testTitle as string;
  const timeLimit = params.timeLimit ? parseInt(params.timeLimit as string) : null;
  const studentIdParam = params.studentId as string | undefined;

  const { user, profile } = useAuth();
  // For students, we pass studentId via route params since profile doesn't include student relation yet
  const studentId = studentIdParam || user?.id;

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
  const [showQuestionPalette, setShowQuestionPalette] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [submissionScore, setSubmissionScore] = useState<{ earned: number; total: number } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAnswersRef = useRef<string>('');
  const isSubmittedRef = useRef<boolean>(false);
  const timerStartedRef = useRef<boolean>(false);

  // Initialize test attempt
  useEffect(() => {
    if (!studentId || !testId || attemptId) return;

    const initializeAttempt = async () => {
      // Check if there's an existing in-progress attempt
      const inProgressAttempt = existingAttempts?.find((a) => a.status === 'in_progress');

      // Reset timer flag for new attempt
      timerStartedRef.current = false;
      isSubmittedRef.current = false;

      if (inProgressAttempt) {
        setAttemptId(inProgressAttempt.id);
        // Restore previous answers
        if (inProgressAttempt.answers && typeof inProgressAttempt.answers === 'object') {
          setAnswers(inProgressAttempt.answers as unknown as Record<string, Answer>);
        }
        // Calculate time remaining if there's a time limit
        if (timeLimit) {
          const elapsed = Math.floor(
            (new Date().getTime() - new Date(inProgressAttempt.started_at).getTime()) / 1000
          );
          const remaining = Math.max(0, timeLimit - elapsed);
          setTimeRemaining(remaining);
        }
      } else {
        // Create new attempt
        try {
          const newAttempt = await createAttempt.mutateAsync({
            test_id: testId,
            student_id: studentId,
            answers: {},
            status: 'in_progress',
          });
          setAttemptId(newAttempt.id);

          // Set initial time remaining for new attempts
          if (timeLimit) {
            setTimeRemaining(timeLimit);
          }
        } catch (error: any) {
          Alert.alert('Error', 'Failed to start test. Please try again.');
          router.back();
        }
      }
    };

    initializeAttempt();
  }, [studentId, testId, existingAttempts]);

  // Timer countdown - start once when attempt is ready
  useEffect(() => {
    if (!timeLimit || !attemptId) return;
    if (isSubmittedRef.current) return;
    if (timerStartedRef.current) return; // Don't restart if already started

    // Wait a tick to ensure timeRemaining is set
    const startTimer = () => {
      if (timeRemaining <= 0) {
        console.log('Timer not started: timeRemaining is 0');
        return;
      }

      console.log('Starting timer:', { timeLimit, attemptId, timeRemaining });
      timerStartedRef.current = true;

      timerRef.current = setInterval(() => {
        // Check if submitted before each tick
        if (isSubmittedRef.current) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }

        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            // Clear interval immediately when time's up
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            // Trigger auto-submit
            handleAutoSubmit();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    };

    // Delay slightly to ensure state is updated
    const timer = setTimeout(startTimer, 100);

    return () => {
      clearTimeout(timer);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timeLimit, attemptId]); // Only depend on timeLimit and attemptId, NOT timeRemaining

  // Auto-save functionality
  useEffect(() => {
    if (!attemptId) return;
    if (isSubmittedRef.current) return; // Don't auto-save if already submitted

    const currentAnswersStr = JSON.stringify(answers);

    // Don't save if answers haven't changed
    if (currentAnswersStr === lastSavedAnswersRef.current) return;

    autoSaveRef.current = setTimeout(() => {
      if (!isSubmittedRef.current) {
        saveAnswers();
      }
    }, 5000); // Auto-save every 5 seconds after a change

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [answers, attemptId]);

  // Prevent back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, []);

  const saveAnswers = async () => {
    if (!attemptId) return;

    try {
      const currentAnswersStr = JSON.stringify(answers);

      // Only save if changed
      if (currentAnswersStr === lastSavedAnswersRef.current) return;

      await updateAttempt.mutateAsync({
        attemptId,
        attemptData: {
          answers,
          status: 'in_progress',
        },
      });

      lastSavedAnswersRef.current = currentAnswersStr;
    } catch (error) {
      console.error('Failed to save answers:', error);
    }
  };

  const calculateScore = () => {
    let earnedPoints = 0;
    let totalPoints = 0;

    questions.forEach((question) => {
      totalPoints += question.points;
      const answer = answers[question.id];

      if (!answer) return;

      // Auto-grade MCQ and one_word questions
      if (question.question_type === 'mcq' && typeof answer.answer === 'number') {
        if (answer.answer === question.correct_index) {
          earnedPoints += question.points;
        }
      } else if (question.question_type === 'one_word' && typeof answer.answer === 'string') {
        // Case-insensitive comparison, trim whitespace
        const studentAnswer = answer.answer.trim().toLowerCase();
        const correctAnswer = question.correct_text?.trim().toLowerCase() || '';
        if (studentAnswer === correctAnswer) {
          earnedPoints += question.points;
        }
      }
      // Long answer questions need manual grading, so we don't add points here
    });

    return { earnedPoints, totalPoints };
  };

  const handleAutoSubmit = async () => {
    console.log('Auto-submit triggered - time is up!');

    // Prevent double submission
    if (isSubmittedRef.current) {
      console.log('Test already submitted, skipping auto-submit');
      return;
    }

    // Directly submit without confirmation since time is up
    if (!attemptId) {
      Alert.alert('Error', 'No active attempt found');
      return;
    }

    isSubmittedRef.current = true;
    setIsSubmitting(true);

    // Stop all timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
      autoSaveRef.current = null;
    }

    try {
      await saveAnswers();

      const { earnedPoints, totalPoints } = calculateScore();

      await submitTest.mutateAsync({
        attemptId,
        finalAnswers: answers,
        earnedPoints,
        totalPoints,
      });

      // Show success animation
      setSubmissionScore({ earned: earnedPoints, total: totalPoints });
      setShowSuccessAnimation(true);
    } catch (error: any) {
      console.error('Auto-submit failed:', error);
      Alert.alert('Error', 'Failed to submit test automatically. Please try again.');
      isSubmittedRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleBackPress = () => {
    Alert.alert(
      'Exit Test?',
      'Are you sure you want to exit? Your progress will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            await saveAnswers();
            router.back();
          },
        },
      ]
    );
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        answer,
      },
    }));
  };

  const toggleMarkForReview = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setMarkedForReview((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestion.id)) {
        newSet.delete(currentQuestion.id);
      } else {
        newSet.add(currentQuestion.id);
      }
      return newSet;
    });
  };

  const navigateToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
      setShowQuestionPalette(false);
    }
  };

  const handleAnimationEnd = () => {
    setShowSuccessAnimation(false);

    if (submissionScore) {
      Alert.alert(
        'Test Submitted',
        `Your test has been submitted successfully!\n\nScore: ${submissionScore.earned}/${submissionScore.total} points`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSubmit = async (autoSubmit = false) => {
    // Prevent double submission
    if (isSubmittedRef.current) {
      console.log('Test already submitted, skipping manual submit');
      return;
    }

    if (!attemptId) {
      Alert.alert('Error', 'No active attempt found');
      return;
    }

    // Save answers before submitting
    await saveAnswers();

    const confirmSubmit = () => {
      Alert.alert(
        'Submit Test?',
        `You have answered ${Object.keys(answers).length} out of ${questions.length} questions. ${
          autoSubmit ? 'Time is up.' : 'Are you sure you want to submit?'
        }`,
        [
          ...(autoSubmit ? [] : [{ text: 'Cancel', style: 'cancel' as const }]),
          {
            text: 'Submit',
            style: 'destructive' as const,
            onPress: async () => {
              // Mark as submitted immediately
              isSubmittedRef.current = true;
              setIsSubmitting(true);

              // Stop all timers immediately
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              if (autoSaveRef.current) {
                clearTimeout(autoSaveRef.current);
                autoSaveRef.current = null;
              }

              try {
                const { earnedPoints, totalPoints } = calculateScore();

                await submitTest.mutateAsync({
                  attemptId,
                  finalAnswers: answers,
                  earnedPoints,
                  totalPoints,
                });

                // Show success animation
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

    confirmSubmit();
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuestionStatus = (questionId: string) => {
    if (answers[questionId]) return 'answered';
    if (markedForReview.has(questionId)) return 'marked';
    return 'unanswered';
  };

  if (questionsLoading || !attemptId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading test...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <AlertCircle size={64} color={colors.error[500]} />
          <Text style={styles.emptyText}>No questions available for this test</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion?.id];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backIcon}>
            <ChevronLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>{testTitle}</Text>
            <Text style={styles.headerSubtitle}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </Text>
          </View>
        </View>
        {timeLimit && (
          <View style={[styles.timerContainer, timeRemaining < 300 && styles.timerWarning]}>
            <Clock size={20} color={timeRemaining < 300 ? colors.error[600] : colors.primary[600]} />
            <Text
              style={[
                styles.timerText,
                timeRemaining < 300 && styles.timerTextWarning,
              ]}
            >
              {formatTime(timeRemaining)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Question Card */}
        <View style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionNumber}>Q{currentQuestionIndex + 1}</Text>
            <View style={styles.badges}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{currentQuestion.question_type.toUpperCase()}</Text>
              </View>
              <View style={[styles.badge, styles.badgePoints]}>
                <Text style={styles.badgeText}>{currentQuestion.points} pts</Text>
              </View>
            </View>
          </View>

          <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

          {/* Answer Input */}
          <View style={styles.answerSection}>
            {currentQuestion.question_type === 'mcq' && currentQuestion.options && (
              <View style={styles.optionsContainer}>
                {currentQuestion.options.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionButton,
                      currentAnswer?.answer === index && styles.optionButtonSelected,
                    ]}
                    onPress={() => handleAnswerChange(currentQuestion.id, index)}
                  >
                    <View
                      style={[
                        styles.radioButton,
                        currentAnswer?.answer === index && styles.radioButtonSelected,
                      ]}
                    >
                      {currentAnswer?.answer === index && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        currentAnswer?.answer === index && styles.optionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {currentQuestion.question_type === 'one_word' && (
              <TextInput
                style={styles.textInput}
                placeholder="Enter your answer..."
                value={currentAnswer?.answer || ''}
                onChangeText={(text) => handleAnswerChange(currentQuestion.id, text)}
                placeholderTextColor={colors.text.secondary}
              />
            )}

            {currentQuestion.question_type === 'long_answer' && (
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Type your answer here..."
                value={currentAnswer?.answer || ''}
                onChangeText={(text) => handleAnswerChange(currentQuestion.id, text)}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                placeholderTextColor={colors.text.secondary}
              />
            )}
          </View>

          {/* Mark for Review */}
          <TouchableOpacity style={styles.reviewButton} onPress={toggleMarkForReview}>
            <Flag
              size={20}
              color={
                markedForReview.has(currentQuestion.id) ? colors.warning[600] : colors.text.secondary
              }
              fill={markedForReview.has(currentQuestion.id) ? colors.warning[600] : 'none'}
            />
            <Text
              style={[
                styles.reviewButtonText,
                markedForReview.has(currentQuestion.id) && styles.reviewButtonTextActive,
              ]}
            >
              {markedForReview.has(currentQuestion.id) ? 'Marked for Review' : 'Mark for Review'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Question Palette */}
        <TouchableOpacity
          style={styles.paletteToggle}
          onPress={() => setShowQuestionPalette(!showQuestionPalette)}
        >
          <Text style={styles.paletteToggleText}>
            {showQuestionPalette ? 'Hide' : 'Show'} Question Overview
          </Text>
        </TouchableOpacity>

        {showQuestionPalette && (
          <View style={styles.questionPalette}>
            <View style={styles.paletteHeader}>
              <Text style={styles.paletteTitle}>All Questions</Text>
              <View style={styles.paletteLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendAnswered]} />
                  <Text style={styles.legendText}>Answered</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendMarked]} />
                  <Text style={styles.legendText}>Review</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendUnanswered]} />
                  <Text style={styles.legendText}>Unanswered</Text>
                </View>
              </View>
            </View>
            <View style={styles.paletteGrid}>
              {questions.map((q, index) => {
                const status = getQuestionStatus(q.id);
                return (
                  <TouchableOpacity
                    key={q.id}
                    style={[
                      styles.paletteItem,
                      index === currentQuestionIndex && styles.paletteItemActive,
                      status === 'answered' && styles.paletteItemAnswered,
                      status === 'marked' && styles.paletteItemMarked,
                    ]}
                    onPress={() => navigateToQuestion(index)}
                  >
                    <Text
                      style={[
                        styles.paletteItemText,
                        index === currentQuestionIndex && styles.paletteItemTextActive,
                      ]}
                    >
                      {index + 1}
                    </Text>
                    {status === 'answered' && (
                      <Check size={12} color={colors.success[600]} style={styles.checkIcon} />
                    )}
                    {status === 'marked' && (
                      <Flag size={12} color={colors.warning[600]} style={styles.flagIcon} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Progress Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Object.keys(answers).length}</Text>
            <Text style={styles.statLabel}>Answered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{markedForReview.size}</Text>
            <Text style={styles.statLabel}>For Review</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {questions.length - Object.keys(answers).length}
            </Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
        </View>
      </ScrollView>

      {/* Navigation Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, currentQuestionIndex === 0 && styles.navButtonDisabled]}
          onPress={() => navigateToQuestion(currentQuestionIndex - 1)}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronLeft size={20} color={currentQuestionIndex === 0 ? colors.text.secondary : colors.primary[600]} />
          <Text
            style={[
              styles.navButtonText,
              currentQuestionIndex === 0 && styles.navButtonTextDisabled,
            ]}
          >
            Previous
          </Text>
        </TouchableOpacity>

        {currentQuestionIndex === questions.length - 1 ? (
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => handleSubmit(false)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <>
                <Check size={20} color={colors.text.inverse} />
                <Text style={styles.submitButtonText}>Submit Test</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => navigateToQuestion(currentQuestionIndex + 1)}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <ChevronRight size={20} color={colors.text.inverse} />
          </TouchableOpacity>
        )}
      </View>

      {/* Success Animation */}
      <SuccessAnimation
        visible={showSuccessAnimation}
        onAnimationEnd={handleAnimationEnd}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  backButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.primary,
    ...shadows.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backIcon: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
  },
  timerWarning: {
    backgroundColor: colors.error[50],
  },
  timerText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  timerTextWarning: {
    color: colors.error[600],
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  questionCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
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
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[100],
  },
  badgePoints: {
    backgroundColor: colors.success[100],
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  questionText: {
    fontSize: typography.fontSize.lg,
    lineHeight: typography.fontSize.lg * 1.5,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  answerSection: {
    marginBottom: spacing.md,
  },
  optionsContainer: {
    gap: spacing.md,
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
    width: 24,
    height: 24,
    borderRadius: 12,
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
  textInput: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  textArea: {
    height: 150,
    textAlignVertical: 'top',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.secondary,
  },
  reviewButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  reviewButtonTextActive: {
    color: colors.warning[600],
    fontWeight: typography.fontWeight.semibold,
  },
  paletteToggle: {
    padding: spacing.md,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  paletteToggleText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  questionPalette: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  paletteHeader: {
    marginBottom: spacing.md,
  },
  paletteTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  paletteLegend: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendAnswered: {
    backgroundColor: colors.success[500],
  },
  legendMarked: {
    backgroundColor: colors.warning[500],
  },
  legendUnanswered: {
    backgroundColor: colors.neutral[300],
  },
  legendText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paletteItem: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
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
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  paletteItemTextActive: {
    color: colors.primary[600],
  },
  checkIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  flagIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.DEFAULT,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
    ...shadows.sm,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[600],
    backgroundColor: colors.surface.secondary,
  },
  navButtonDisabled: {
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.secondary,
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  navButtonTextDisabled: {
    color: colors.text.secondary,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[600],
  },
  nextButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.success[600],
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
});
