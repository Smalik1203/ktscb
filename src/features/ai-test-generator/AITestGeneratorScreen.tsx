/**
 * AITestGeneratorScreen - Premium Redesign
 * 
 * A wizard-based AI test generation experience with:
 * - 3-step flow (Upload → Configure → Review)
 * - Premium animations and glassmorphism
 * - Collapsible questions
 * - Bottom sheet for saving
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Hooks and services
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { useCreateTest } from '../../hooks/tests';
import { generateQuestionsFromImage, GeneratedQuestion } from '../../services/aiTestGeneratorFetch';
import { TestInput } from '../../types/test.types';
import { api } from '../../services/api';

// UI Components
import { Heading, Body } from '../../ui';
import {
  StepIndicator,
  UploadStep,
  ConfigureStep,
  AIGenerationOverlay,
  ReviewStep,
  SaveTestSheet,
} from './components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STEP_LABELS = ['Upload', 'Configure', 'Review'];

export default function AITestGeneratorScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();

  // Data hooks
  const { data: classes = [] } = useClasses(profile?.school_code || '');
  const { data: subjectsResult } = useSubjects(profile?.school_code || '');
  const subjects = subjectsResult?.data || [];
  const createTest = useCreateTest();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Step 1: Upload
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Step 2: Configure
  const [questionCount, setQuestionCount] = useState(10);
  const [additionalContext, setAdditionalContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // Step 3: Review & Save
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);

  // Request permissions on mount
  React.useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images.');
      }
    })();
  }, []);

  // Step navigation with animation
  const goToStep = useCallback((step: number) => {
    const direction = step > currentStep ? -1 : 1;

    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: direction * SCREEN_WIDTH,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();

    setCurrentStep(step);
  }, [currentStep, slideAnim]);

  // Image picker
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setGeneratedQuestions([]); // Reset if new image
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Generate questions
  const handleGenerate = async () => {
    if (!selectedImage) {
      Alert.alert('No Image', 'Please select an image first');
      return;
    }

    try {
      setGenerating(true);
      setGeneratedQuestions([]);
      setStreamingText('🧠 Sage is preparing your image...');

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
        Alert.alert('No Questions', 'No questions were generated. Try a clearer image.');
        return;
      }

      setGeneratedQuestions(result.questions);
      setStreamingText('');
      goToStep(2); // Move to review step
    } catch (error: any) {
      console.error('Error generating:', error);
      // Check for network errors
      if (error.message?.includes('network') || error.message?.includes('Network') || error.name === 'TypeError') {
        Alert.alert(
          'Connection Error',
          'Unable to reach Sage. Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Sage Error', error.message || 'Failed to generate questions. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  // Remove question
  const removeQuestion = (index: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Open save sheet
  const openSaveSheet = () => {
    setSaveSheetVisible(true);
  };

  // Save test
  const handleSaveTest = async () => {
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

      await api.testQuestions.createBulk(questionsToCreate);

      setSaveSheetVisible(false);

      Alert.alert(
        '\ud83c\udf89 Sage Created Your Test!',
        `"${testTitle}" is ready with ${generatedQuestions.length} AI-generated questions!`,
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
      console.error('Error saving test:', error);
      // Check for network errors
      if (error.message?.includes('network') || error.message?.includes('Network') || error.name === 'TypeError') {
        Alert.alert(
          'Connection Error',
          'Unable to save test. Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Save Failed', error.message || 'Failed to save test. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <UploadStep
            selectedImage={selectedImage}
            onPickImage={pickImage}
            onRemoveImage={() => setSelectedImage(null)}
            onContinue={() => goToStep(1)}
          />
        );
      case 1:
        return (
          <ConfigureStep
            selectedImage={selectedImage}
            questionCount={questionCount}
            onQuestionCountChange={setQuestionCount}
            additionalContext={additionalContext}
            onContextChange={setAdditionalContext}
            onBack={() => goToStep(0)}
            onGenerate={handleGenerate}
            isGenerating={generating}
          />
        );
      case 2:
        return (
          <ReviewStep
            questions={generatedQuestions}
            onRemoveQuestion={removeQuestion}
            onBack={() => goToStep(1)}
            onSave={openSaveSheet}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.app }]} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary[600], colors.primary[700]]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          >
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <View style={styles.headerTitle}>
              <Sparkles size={20} color="#fff" />
              <Heading level={4} style={{ color: '#fff', marginLeft: 8 }}>
                Sage Test Generator
              </Heading>
            </View>
          </View>
        </View>

        {/* Step Indicator */}
        <StepIndicator
          currentStep={currentStep}
          totalSteps={3}
          labels={STEP_LABELS}
        />
      </LinearGradient>

      {/* Step Content with slide animation */}
      <Animated.View
        style={[
          styles.stepContent,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {renderStep()}
      </Animated.View>

      {/* AI Generation Overlay */}
      <AIGenerationOverlay
        visible={generating}
        streamingText={streamingText}
      />

      {/* Save Test Sheet */}
      <SaveTestSheet
        visible={saveSheetVisible}
        onClose={() => setSaveSheetVisible(false)}
        testTitle={testTitle}
        onTitleChange={setTestTitle}
        selectedClassId={selectedClassId}
        onClassSelect={setSelectedClassId}
        selectedSubjectId={selectedSubjectId}
        onSubjectSelect={setSelectedSubjectId}
        classes={classes}
        subjects={subjects}
        questionCount={generatedQuestions.length}
        onSave={handleSaveTest}
        saving={saving}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepContent: {
    flex: 1,
  },
});
