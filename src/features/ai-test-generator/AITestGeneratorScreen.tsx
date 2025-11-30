import React, { useState , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Upload,
  Sparkles,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Zap,
  BookOpen,
  Users,
} from 'lucide-react-native';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';
import { generateQuestionsFromImage, GeneratedQuestion } from '../../services/aiTestGeneratorFetch';
import { useAuth } from '../../contexts/AuthContext';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { useCreateTest } from '../../hooks/tests';
import { TestInput } from '../../types/test.types';
import { supabase } from '../../lib/supabase';

export default function AITestGeneratorScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );
  
  const { data: classes = [] } = useClasses(profile?.school_code || '');
  const { data: subjectsResult } = useSubjects(profile?.school_code || '');
  const subjects = subjectsResult?.data || [];
  const createTest = useCreateTest();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [saving, setSaving] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // Request permissions
  React.useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images.');
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        setGeneratedQuestions([]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleGenerateQuestions = async () => {
    if (!selectedImage) {
      Alert.alert('No Image', 'Please select an image first');
      return;
    }

    if (questionCount < 5 || questionCount > 20) {
      Alert.alert('Invalid Count', 'Please select between 5 and 20 questions');
      return;
    }

    try {
      setGenerating(true);
      setGeneratedQuestions([]);
      setStreamingText('🔄 Preparing image...');

      const result = await generateQuestionsFromImage(
        selectedImage,
        questionCount,
        additionalContext || undefined,
        (text) => setStreamingText(text)
      );

      if (result.error) {
        Alert.alert('Generation Failed', result.error);
        return;
      }

      if (result.questions.length === 0) {
        Alert.alert('No Questions', 'No questions were generated. Please try again.');
        return;
      }

      setGeneratedQuestions(result.questions);
      setStreamingText('');
      Alert.alert(
        '✨ Success!',
        `Generated ${result.totalGenerated} questions! Review and save as a test.`
      );
    } catch (error: any) {
      console.error('Error generating questions:', error);
      Alert.alert('Error', error.message || 'Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveAsTest = async () => {
    if (!testTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a test title');
      return;
    }

    if (!selectedClassId) {
      Alert.alert('Missing Class', 'Please select a class');
      return;
    }

    if (!selectedSubjectId) {
      Alert.alert('Missing Subject', 'Please select a subject');
      return;
    }

    if (generatedQuestions.length === 0) {
      Alert.alert('No Questions', 'Generate questions first');
      return;
    }

    try {
      setSaving(true);

      const testData: TestInput = {
        title: testTitle.trim(),
        description: `AI-generated test with ${generatedQuestions.length} questions`,
        class_instance_id: selectedClassId,
        subject_id: selectedSubjectId,
        school_code: profile?.school_code || '',
        test_type: 'quiz',
        test_mode: 'online',
        time_limit_seconds: generatedQuestions.length * 60,
        status: 'active',
        created_by: user?.id || '',
      };

      const createdTest = await createTest.mutateAsync(testData);

      const questionsToCreate = generatedQuestions.map((q, index) => ({
        test_id: createdTest.id,
        question_text: q.question_text,
        question_type: 'mcq',
        options: q.options,
        correct_index: q.correct_index,
        correct_answer: null,
        points: 1,
        order_index: index,
      }));

      const { error: questionsError } = await supabase
        .from('test_questions')
        .insert(questionsToCreate);

      if (questionsError) {
        throw new Error(questionsError.message || 'Failed to create questions');
      }

      Alert.alert(
        '🎉 Success!',
        `Test "${testTitle}" created with ${generatedQuestions.length} AI-generated questions!`,
        [
          {
            text: 'View Test',
            onPress: () => router.push(`/test/${createdTest.id}/questions?testTitle=${encodeURIComponent(testTitle)}`),
          },
          {
            text: 'Done',
            onPress: () => router.back(),
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      console.error('[AI Test Generator] Error saving test:', error);
      Alert.alert('Error', error.message || 'Failed to save test');
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = (index: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Gradient Header */}
      <View style={styles.gradientHeader}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text.inverse} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIcon}>
              <Sparkles size={28} color={colors.primary[600]} />
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Test Generator</Text>
              <Text style={styles.headerSubtitle}>Create tests from images instantly</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Step 1: Upload Image Card */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View>
                <Text style={styles.stepTitle}>Upload Image</Text>
                <Text style={styles.stepDescription}>
                  Upload textbook pages, notes, or study material
                </Text>
              </View>
            </View>

            {selectedImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageButton} onPress={() => setSelectedImage(null)}>
                  <X size={20} color={colors.text.inverse} />
                </TouchableOpacity>
                <View style={styles.imageOverlay}>
                  <View style={styles.imageBadge}>
                    <ImageIcon size={14} color={colors.text.inverse} />
                    <Text style={styles.imageBadgeText}>Image Selected</Text>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadArea} onPress={pickImage}>
                <View style={styles.uploadIconContainer}>
                  <Upload size={40} color={colors.primary[600]} />
                </View>
                <Text style={styles.uploadTitle}>Choose Image</Text>
                <Text style={styles.uploadSubtext}>PNG, JPG up to 10MB</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Step 2: Configure Test Card */}
          {selectedImage && (
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepNumber, { backgroundColor: colors.secondary[500] }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View>
                  <Text style={styles.stepTitle}>Configure Test</Text>
                  <Text style={styles.stepDescription}>
                    Set number of questions and focus areas
                  </Text>
                </View>
              </View>

              {/* Question Count Selector */}
              <View style={styles.configSection}>
                <Text style={styles.configLabel}>Number of Questions</Text>
                <View style={styles.questionCountGrid}>
                  {[5, 10, 15, 20].map((count) => (
                    <TouchableOpacity
                      key={count}
                      style={[
                        styles.countOption,
                        questionCount === count && styles.countOptionActive,
                      ]}
                      onPress={() => setQuestionCount(count)}
                    >
                      <Text
                        style={[
                          styles.countOptionNumber,
                          questionCount === count && styles.countOptionNumberActive,
                        ]}
                      >
                        {count}
                      </Text>
                      <Text
                        style={[
                          styles.countOptionLabel,
                          questionCount === count && styles.countOptionLabelActive,
                        ]}
                      >
                        Questions
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Context Input */}
              <View style={styles.configSection}>
                <Text style={styles.configLabel}>Additional Context (Optional)</Text>
                <TextInput
                  style={styles.contextInput}
                  placeholder="e.g., Focus on photosynthesis, include definitions..."
                  value={additionalContext}
                  onChangeText={setAdditionalContext}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              {/* Generate Button */}
              <TouchableOpacity
                style={[styles.generateButton, generating && styles.buttonDisabled]}
                onPress={handleGenerateQuestions}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <ActivityIndicator size="small" color={colors.text.inverse} />
                    <Text style={styles.buttonText}>Generating...</Text>
                  </>
                ) : (
                  <>
                    <Zap size={20} color={colors.text.inverse} />
                    <Text style={styles.buttonText}>Generate Questions</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* AI Streaming Display */}
              {generating && streamingText && (
                <View style={styles.aiStreamingCard}>
                  <View style={styles.aiStreamingHeader}>
                    <Sparkles size={18} color={colors.primary[600]} />
                    <Text style={styles.aiStreamingTitle}>AI is working...</Text>
                  </View>
                  <ScrollView style={styles.aiStreamingContent} nestedScrollEnabled>
                    <Text style={styles.aiStreamingText}>{streamingText}</Text>
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Step 3: Review & Save Card */}
          {generatedQuestions.length > 0 && (
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepNumber, { backgroundColor: colors.success[500] }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View>
                  <Text style={styles.stepTitle}>Review & Save</Text>
                  <Text style={styles.stepDescription}>
                    {generatedQuestions.length} questions generated
                  </Text>
                </View>
              </View>

              {/* Test Details Form */}
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Test Title *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., Biology Chapter 3 Quiz"
                    value={testTitle}
                    onChangeText={setTestTitle}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Select Class *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                    {classes.map((cls: any) => (
                      <TouchableOpacity
                        key={cls.id}
                        style={[
                          styles.selectionChip,
                          selectedClassId === cls.id && styles.selectionChipActive,
                        ]}
                        onPress={() => setSelectedClassId(cls.id)}
                      >
                        <Users size={14} color={selectedClassId === cls.id ? colors.primary[600] : colors.text.tertiary} />
                        <Text
                          style={[
                            styles.selectionChipText,
                            selectedClassId === cls.id && styles.selectionChipTextActive,
                          ]}
                        >
                          Grade {cls.grade}-{cls.section}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Select Subject *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                    {subjects.map((subject: any) => (
                      <TouchableOpacity
                        key={subject.id}
                        style={[
                          styles.selectionChip,
                          selectedSubjectId === subject.id && styles.selectionChipActive,
                        ]}
                        onPress={() => setSelectedSubjectId(subject.id)}
                      >
                        <BookOpen size={14} color={selectedSubjectId === subject.id ? colors.primary[600] : colors.text.tertiary} />
                        <Text
                          style={[
                            styles.selectionChipText,
                            selectedSubjectId === subject.id && styles.selectionChipTextActive,
                          ]}
                        >
                          {subject.subject_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Questions Preview */}
              <View style={styles.questionsSection}>
                <Text style={styles.questionsSectionTitle}>Generated Questions</Text>
                {generatedQuestions.map((question, index) => (
                  <View key={index} style={styles.questionPreviewCard}>
                    <View style={styles.questionPreviewHeader}>
                      <View style={styles.questionBadge}>
                        <Text style={styles.questionBadgeText}>Q{index + 1}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeQuestion(index)} hitSlop={10}>
                        <X size={18} color={colors.error[600]} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.questionPreviewText}>{question.question_text}</Text>
                    <View style={styles.optionsContainer}>
                      {question.options.map((option, optIndex) => (
                        <View
                          key={optIndex}
                          style={[
                            styles.optionPreview,
                            optIndex === question.correct_index && styles.optionPreviewCorrect,
                          ]}
                        >
                          <View
                            style={[
                              styles.optionBadge,
                              optIndex === question.correct_index && styles.optionBadgeCorrect,
                            ]}
                          >
                            <Text
                              style={[
                                styles.optionBadgeText,
                                optIndex === question.correct_index && styles.optionBadgeTextCorrect,
                              ]}
                            >
                              {String.fromCharCode(65 + optIndex)}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.optionPreviewText,
                              optIndex === question.correct_index && styles.optionPreviewTextCorrect,
                            ]}
                          >
                            {option}
                          </Text>
                          {optIndex === question.correct_index && (
                            <CheckCircle2 size={16} color={colors.success[600]} />
                          )}
                        </View>
                      ))}
                    </View>
                    {question.explanation && (
                      <View style={styles.explanationCard}>
                        <Text style={styles.explanationLabel}>Explanation</Text>
                        <Text style={styles.explanationText}>{question.explanation}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSaveAsTest}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.text.inverse} />
                ) : (
                  <Text style={styles.buttonText}>Save as Test</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  gradientHeader: {
    backgroundColor: colors.primary[600],
    paddingBottom: spacing.lg,
  },
  headerContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.inverse,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  stepCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
  },
  stepTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  stepDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    minHeight: 200,
    justifyContent: 'center',
  },
  uploadIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  uploadTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  uploadSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  imagePreview: {
    width: '100%',
    height: 280,
    backgroundColor: colors.neutral[100],
  },
  removeImageButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.error[600],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  imageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.success[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.md,
  },
  imageBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  configSection: {
    marginBottom: spacing.lg,
  },
  configLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  questionCountGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countOption: {
    flex: 1,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  countOptionActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  countOptionNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  countOptionNumberActive: {
    color: colors.primary[600],
  },
  countOptionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  countOptionLabelActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  contextInput: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.inverse,
  },
  aiStreamingCard: {
    marginTop: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    padding: spacing.md,
    maxHeight: 250,
  },
  aiStreamingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  aiStreamingTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  aiStreamingContent: {
    maxHeight: 200,
  },
  aiStreamingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  chipContainer: {
    flexGrow: 0,
  },
  selectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginRight: spacing.sm,
  },
  selectionChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  selectionChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  selectionChipTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  questionsSection: {
    marginTop: spacing.md,
  },
  questionsSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  questionPreviewCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  questionPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  questionBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  questionBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  questionPreviewText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: spacing.xs,
  },
  optionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
  },
  optionPreviewCorrect: {
    backgroundColor: colors.success[50],
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeCorrect: {
    backgroundColor: colors.success[600],
  },
  optionBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  optionBadgeTextCorrect: {
    color: colors.text.inverse,
  },
  optionPreviewText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  optionPreviewTextCorrect: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[700],
  },
  explanationCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[600],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  explanationLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: 4,
  },
  explanationText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: colors.success[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadows.md,
  },
});
