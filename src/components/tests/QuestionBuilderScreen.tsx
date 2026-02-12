import React, { useState , useMemo } from 'react';
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
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTestQuestions, useCreateQuestion, useUpdateQuestion, useDeleteQuestion } from '../../hooks/tests';
import { TestQuestion, QuestionType } from '../../types/test.types';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ParsedQuestion } from '../../utils/questionParsers';

export function QuestionBuilderScreen() {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const router = useRouter();
  const params = useLocalSearchParams();
  const testId = params.testId as string;
  const testTitle = params.testTitle as string;
  const aiGeneratedQuestionsParam = params.aiGeneratedQuestions as string | undefined;

  const { data: questions = [], isLoading } = useTestQuestions(testId);
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('mcq');
  const [options, setOptions] = useState(['', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [correctText, setCorrectText] = useState('');
  const [points, setPoints] = useState('10');
  const [importingAI, setImportingAI] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);

  const resetForm = () => {
    setEditingQuestionId(null);
    setQuestionText('');
    setQuestionType('mcq');
    setOptions(['', '']);
    setCorrectIndex(0);
    setCorrectText('');
    setPoints('10');
    setShowQuestionModal(false);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return; // Keep at least 2 options
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    if (correctIndex >= newOptions.length) {
      setCorrectIndex(newOptions.length - 1);
    }
  };

  // Handle AI-generated questions import
  React.useEffect(() => {
    if (aiGeneratedQuestionsParam && !importingAI && questions.length === 0) {
      importAIGeneratedQuestions();
    }
  }, [aiGeneratedQuestionsParam]);

  const importAIGeneratedQuestions = async () => {
    try {
      setImportingAI(true);
      
      // Runtime-safe: validate parameter exists and is valid JSON
      if (!aiGeneratedQuestionsParam || aiGeneratedQuestionsParam.trim().length === 0) {
        throw new Error('No AI-generated questions data available');
      }
      
      let aiQuestions;
      try {
        aiQuestions = JSON.parse(aiGeneratedQuestionsParam);
      } catch (parseError: any) {
        throw new Error(`Invalid AI questions data: ${parseError?.message || 'Parse error'}`);
      }
      
      // Validate parsed data structure
      if (!Array.isArray(aiQuestions) || aiQuestions.length === 0) {
        throw new Error('AI questions data is not a valid array or is empty');
      }

      for (let i = 0; i < aiQuestions.length; i++) {
        const aiQ = aiQuestions[i];

        await createQuestion.mutateAsync({
          test_id: testId,
          question_text: aiQ.question_text,
          question_type: 'mcq',
          options: aiQ.options,
          correct_index: aiQ.correct_index,
          correct_answer: undefined,
          points: 1,
          order_index: i,
        });
      }

      Alert.alert('Success', `Imported ${aiQuestions.length} AI-generated questions!`);
    } catch (error: any) {
      // AI import failed
      Alert.alert('Error', 'Failed to import AI-generated questions');
    } finally {
      setImportingAI(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      Alert.alert('Image Selected', 'Image upload functionality to be implemented');
    }
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
    });

    if (!result.canceled) {
      Alert.alert('Document Selected', 'Document upload functionality to be implemented');
    }
  };

  const validateQuestion = () => {
    if (!questionText.trim()) {
      Alert.alert('Error', 'Please enter question text');
      return false;
    }

    if (questionType === 'mcq') {
      const filledOptions = options.filter((opt) => opt.trim() !== '');
      if (filledOptions.length < 2) {
        Alert.alert('Error', 'Please provide at least 2 options for MCQ');
        return false;
      }
      if (!options[correctIndex]?.trim()) {
        Alert.alert('Error', 'Please select a valid correct option');
        return false;
      }
    }

    if (questionType === 'one_word' && !correctText.trim()) {
      Alert.alert('Error', 'Please enter the correct answer');
      return false;
    }

    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      Alert.alert('Error', 'Please enter valid points (greater than 0)');
      return false;
    }

    return true;
  };

  const handleSaveQuestion = async () => {
    if (!validateQuestion()) return;

    const questionData = {
      test_id: testId,
      question_text: questionText.trim(),
      question_type: questionType,
      points: parseInt(points),
      order_index: editingQuestionId ? 0 : questions.length,
      options: questionType === 'mcq' ? options.filter((opt) => opt.trim()) : undefined,
      correct_index: questionType === 'mcq' ? correctIndex : undefined,
      correct_text: questionType === 'one_word' ? correctText.trim() : undefined,
      correct_answer: undefined,
    };

    try {
      if (editingQuestionId) {
        await updateQuestion.mutateAsync({ questionId: editingQuestionId, questionData });
        Alert.alert('Success', 'Question updated successfully');
      } else {
        await createQuestion.mutateAsync(questionData);
        Alert.alert('Success', 'Question added successfully');
      }
      resetForm();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save question');
    }
  };

  const handleAddQuestion = () => {
    resetForm();
    setShowQuestionModal(true);
  };

  const handleEditQuestionClick = (question: TestQuestion) => {
    handleEditQuestion(question);
    setShowQuestionModal(true);
  };

  const handleEditQuestion = (question: TestQuestion) => {
    setEditingQuestionId(question.id);
    setQuestionText(question.question_text);
    setQuestionType(question.question_type);
    setPoints(String(question.points));

    if (question.question_type === 'mcq') {
      const questionOptions = question.options || [];
      // Ensure at least 2 options
      setOptions(questionOptions.length >= 2 ? questionOptions : ['', '']);
      setCorrectIndex(question.correct_index || 0);
    } else if (question.question_type === 'one_word') {
      setCorrectText(question.correct_text || '');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    Alert.alert('Delete Question', 'Are you sure you want to delete this question?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteQuestion.mutateAsync({ questionId, testId });
            Alert.alert('Success', 'Question deleted');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete question');
          }
        },
      },
    ]);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{testTitle}</Text>
          <Text style={styles.headerSubtitle}>{questions.length} Questions</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Add Question Button */}
        <TouchableOpacity
          style={styles.addQuestionButton}
          onPress={handleAddQuestion}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={20} color={colors.text.inverse} />
          <Text style={styles.addQuestionButtonText}>Add Question</Text>
        </TouchableOpacity>

        {/* Questions List */}
        <View style={styles.questionsSection}>
          <Text style={styles.sectionTitle}>
            All Questions ({questions.length})
          </Text>

          {questions.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="add" size={32} color={colors.text.tertiary} />
              </View>
              <Text style={styles.emptyStateText}>
                No questions yet. Add your first question above.
              </Text>
            </View>
          ) : (
            questions.map((question, index) => (
              <View key={question.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <View style={styles.questionNumberBadge}>
                    <Text style={styles.questionNumber}>{index + 1}</Text>
                  </View>
                  <View style={styles.questionMeta}>
                    <View style={[styles.typeBadge, { backgroundColor: getTypeColor(question.question_type).bg }]}>
                      <Text style={[styles.typeBadgeText, { color: getTypeColor(question.question_type).text }]}>
                        {question.question_type.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.pointsBadge}>
                      <Text style={styles.pointsText}>{question.points} pts</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.questionText}>{question.question_text}</Text>

                {question.question_type === 'mcq' && question.options && (
                  <View style={styles.optionsList}>
                    {question.options.map((option, optIndex) => (
                      <View
                        key={optIndex}
                        style={[
                          styles.optionDisplay,
                          optIndex === question.correct_index && styles.optionDisplayCorrect,
                        ]}
                      >
                        <View
                          style={[
                            styles.optionIndicator,
                            optIndex === question.correct_index && styles.optionIndicatorCorrect,
                          ]}
                        >
                          {optIndex === question.correct_index && (
                            <MaterialIcons name="check-circle" size={16} color={colors.text.inverse} />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.optionDisplayText,
                            optIndex === question.correct_index && styles.optionDisplayTextCorrect,
                          ]}
                        >
                          {option}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {question.question_type === 'one_word' && (
                  <View style={styles.answerDisplay}>
                    <Text style={styles.answerLabel}>Correct Answer:</Text>
                    <Text style={styles.answerValue}>{question.correct_text}</Text>
                  </View>
                )}

                <View style={styles.questionActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditQuestionClick(question as TestQuestion)}
                  >
                    <MaterialIcons name="edit" size={16} color={colors.primary[600]} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonDanger]}
                    onPress={() => handleDeleteQuestion(question.id)}
                  >
                    <MaterialIcons name="delete" size={16} color={colors.error[600]} />
                    <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Question Form Modal */}
      <Modal
        visible={showQuestionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalOverlay} />
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingQuestionId ? 'Edit Question' : 'Add Question'}
              </Text>
              <TouchableOpacity onPress={resetForm} style={styles.modalCloseButton}>
                <MaterialIcons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Question Type Selector */}
              <View style={styles.modalFormGroup}>
                <Text style={styles.modalLabel}>Question Type</Text>
                <View style={styles.typeSelector}>
                  {[
                    { value: 'mcq', label: 'MCQ' },
                    { value: 'one_word', label: 'One Word' },
                    { value: 'long_answer', label: 'Long Answer' },
                  ].map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeButton,
                        questionType === type.value && styles.typeButtonActive,
                      ]}
                      onPress={() => setQuestionType(type.value as QuestionType)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          questionType === type.value && styles.typeButtonTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Question Text */}
              <View style={styles.modalFormGroup}>
                <Text style={styles.modalLabel}>Question</Text>
                <TextInput
                  style={styles.modalTextArea}
                  placeholder="Enter question text..."
                  value={questionText}
                  onChangeText={setQuestionText}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              {/* MCQ Options */}
              {questionType === 'mcq' && (
                <View style={styles.modalFormGroup}>
                  <Text style={styles.modalLabel}>Options (Select correct answer)</Text>
                  {options.map((option, index) => (
                    <View
                      key={index}
                      style={[
                        styles.optionRow,
                        correctIndex === index && styles.optionRowActive,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.optionRadio}
                        onPress={() => setCorrectIndex(index)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.radioButton,
                          correctIndex === index && styles.radioButtonActive,
                        ]}>
                          {correctIndex === index && <View style={styles.radioButtonInner} />}
                        </View>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.optionInput}
                        placeholder="Type here..."
                        value={option}
                        onChangeText={(text) => updateOption(index, text)}
                        placeholderTextColor={colors.text.tertiary}
                      />
                      {options.length > 2 && (
                        <TouchableOpacity
                          style={styles.removeOptionButton}
                          onPress={() => removeOption(index)}
                        >
                          <Text style={styles.removeOptionText}>×</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addOptionButton}
                    onPress={addOption}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="add" size={16} color={colors.primary[600]} />
                    <Text style={styles.addOptionText}>Add Option</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* One Word Answer */}
              {questionType === 'one_word' && (
                <View style={styles.modalFormGroup}>
                  <Text style={styles.modalLabel}>Correct Answer</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter correct answer..."
                    value={correctText}
                    onChangeText={setCorrectText}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
              )}

              {/* Long Answer Info */}
              {questionType === 'long_answer' && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    Long answer questions will be graded manually by the teacher.
                  </Text>
                </View>
              )}

              {/* Points */}
              <View style={styles.modalFormGroup}>
                <Text style={styles.modalLabel}>Points</Text>
                <TextInput
                  style={[styles.modalInput, styles.pointsInput]}
                  placeholder="10"
                  value={points}
                  onChangeText={setPoints}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={resetForm}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveQuestion}
                activeOpacity={0.8}
              >
                <MaterialIcons name="save" size={20} color={colors.text.inverse} />
                <Text style={styles.modalSaveText}>
                  {editingQuestionId ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getTypeColor = (type: string) => {
  switch (type) {
    case 'mcq':
      return { bg: colors.primary[50], text: colors.primary[700] };
    case 'one_word':
      return { bg: colors.secondary[50], text: colors.secondary[700] };
    case 'long_answer':
      return { bg: colors.warning[50], text: colors.warning[700] };
    default:
      return { bg: colors.neutral[100], text: colors.neutral[700] };
  }
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
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
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[600],
    marginBottom: spacing.md,
  },
  addQuestionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlay,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    marginTop: '20%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalScrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  modalFormGroup: {
    marginBottom: spacing.lg,
  },
  modalLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  modalTextArea: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalInput: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.surface.primary,
  },
  modalCancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  modalSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[600],
  },
  modalSaveText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  typeButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  typeButtonTextActive: {
    color: colors.text.inverse,
  },
  textArea: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  optionsContainer: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.surface.secondary,
  },
  optionRowActive: {
    borderColor: colors.success[500],
    backgroundColor: colors.success[50],
  },
  optionRadio: {
    padding: spacing.xs / 2,
  },
  radioButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonActive: {
    borderColor: colors.success[600],
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success[600],
  },
  optionInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    padding: 0,
    paddingVertical: spacing.xs,
  },
  removeOptionButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeOptionText: {
    fontSize: typography.fontSize.lg,
    color: colors.error[600],
    lineHeight: 20,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary[300],
    borderStyle: 'dashed',
    backgroundColor: colors.primary[50],
    marginTop: spacing.xs,
  },
  addOptionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  input: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  infoBox: {
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  infoText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
  },
  formFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  pointsLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  pointsInput: {
    width: 60,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    padding: 0,
    textAlign: 'center',
    fontWeight: typography.fontWeight.semibold,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[600],
  },
  saveButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  questionsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  emptyState: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl * 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  questionCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  questionNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
  },
  questionMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  pointsBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.neutral[100],
  },
  pointsText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  questionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  optionsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
  },
  optionDisplayCorrect: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  optionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIndicatorCorrect: {
    backgroundColor: colors.success[600],
  },
  optionDisplayText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  optionDisplayTextCorrect: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  answerDisplay: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  answerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  answerValue: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  questionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  actionButtonDanger: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[200],
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  actionButtonTextDanger: {
    color: colors.error[600],
  },
});
