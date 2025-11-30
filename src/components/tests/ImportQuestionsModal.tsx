import React, { useState , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { Portal, Modal } from 'react-native-paper';
import { X, Upload, FileText, Download, CheckCircle, AlertCircle } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { parseCSV, parseExcel, parseTXT, parseJSON, ParsedQuestion, ParseResult } from '../../utils/questionParsers';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';

interface ImportQuestionsModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (questions: ParsedQuestion[]) => void;
}

type FileFormat = 'csv' | 'xlsx' | 'txt' | 'json';

export function ImportQuestionsModal({ visible, onClose, onImport }: ImportQuestionsModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const [selectedFormat, setSelectedFormat] = useState<FileFormat>('csv');
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const formats: { value: FileFormat; label: string; ext: string }[] = [
    { value: 'csv', label: 'CSV', ext: '.csv' },
    { value: 'xlsx', label: 'Excel', ext: '.xlsx' },
    { value: 'txt', label: 'Text', ext: '.txt' },
    { value: 'json', label: 'JSON', ext: '.json' },
  ];

  const getTemplateContent = (format: FileFormat): string => {
    switch (format) {
      case 'csv':
        return `question_text,question_type,points,option_a,option_b,option_c,option_d,correct_answer
What is the capital of France?,mcq,5,Paris,London,Berlin,Madrid,Paris
Solve: 2 + 2 = ?,one_word,3,,,,, 4
Explain the process of photosynthesis in detail.,long_answer,10,,,,,Plants use sunlight to convert CO2 and water into glucose and oxygen
Which planet is known as the Red Planet?,mcq,5,Mars,Venus,Jupiter,Saturn,Mars
What is the chemical symbol for water?,one_word,2,,,,,H2O`;

      case 'txt':
        return `# Question Template - TXT Format
# Instructions:
# - Each question block must be separated by "---"
# - First line: [MCQ|ONE_WORD|LONG_ANSWER] Points: X
# - Second line: Your question text
# - For MCQ: Add options as A) B) C) D) and Answer: X
# - For ONE_WORD and LONG_ANSWER: Add Answer: on the last line

[MCQ] Points: 5
What is the capital of France?
A) Paris
B) London
C) Berlin
D) Madrid
Answer: A
---
[ONE_WORD] Points: 3
Solve: 2 + 2 = ?
Answer: 4
---
[LONG_ANSWER] Points: 10
Explain the process of photosynthesis in detail.
Answer: Plants use sunlight to convert CO2 and water into glucose and oxygen
---
[MCQ] Points: 5
Which planet is known as the Red Planet?
A) Mars
B) Venus
C) Jupiter
D) Saturn
Answer: A
---
[ONE_WORD] Points: 2
What is the chemical symbol for water?
Answer: H2O
---`;

      case 'json':
        return JSON.stringify({
          questions: [
            {
              question_text: "What is the capital of France?",
              question_type: "mcq",
              points: 5,
              options: ["Paris", "London", "Berlin", "Madrid"],
              correct_answer: "Paris"
            },
            {
              question_text: "Solve: 2 + 2 = ?",
              question_type: "one_word",
              points: 3,
              correct_answer: "4"
            },
            {
              question_text: "Explain the process of photosynthesis in detail.",
              question_type: "long_answer",
              points: 10,
              correct_answer: "Plants use sunlight to convert CO2 and water into glucose and oxygen"
            },
            {
              question_text: "Which planet is known as the Red Planet?",
              question_type: "mcq",
              points: 5,
              options: ["Mars", "Venus", "Jupiter", "Saturn"],
              correct_answer: "Mars"
            },
            {
              question_text: "What is the chemical symbol for water?",
              question_type: "one_word",
              points: 2,
              correct_answer: "H2O"
            }
          ]
        }, null, 2);

      default:
        return '';
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const format = selectedFormat;
      const fileName = `questions_template.${format}`;

      // For Excel files, suggest CSV instead
      if (format === 'xlsx') {
        Alert.alert(
          'Excel Template',
          'For Excel format, please download the CSV template instead. CSV files can be opened in Excel, Google Sheets, and other spreadsheet applications.\n\nWould you like to download the CSV template?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Download CSV',
              onPress: () => {
                setSelectedFormat('csv');
                setTimeout(() => handleDownloadTemplate(), 100);
              },
            },
          ]
        );
        return;
      }

      // Generate template content
      const content = getTemplateContent(format);

      // Create file in cache directory
      const file = new File(Paths.cache, fileName);

      // Write content to file
      await file.write(content);

      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: format === 'json'
            ? 'application/json'
            : format === 'csv'
            ? 'text/csv'
            : 'text/plain',
          dialogTitle: 'Save Template File',
          UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'public.text',
        });
      } else {
        Alert.alert('Success', `Template saved to: ${file.uri}\n\nYou can find it in the app's cache folder.`);
      }
    } catch (error: any) {
      console.error('Download template error:', error);
      Alert.alert('Error', error.message || 'Failed to save template');
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: selectedFormat === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : selectedFormat === 'json'
          ? 'application/json'
          : selectedFormat === 'csv'
          ? 'text/csv'
          : 'text/plain',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setParsing(true);
      setParseResult(null);

      try {
        let parseResult: ParseResult;

        // Read file using fetch
        const response = await fetch(file.uri);

        if (selectedFormat === 'xlsx') {
          // For Excel files, read as array buffer
          const arrayBuffer = await response.arrayBuffer();
          parseResult = await parseExcel(arrayBuffer);
        } else {
          // For text-based files (CSV, TXT, JSON), read as text
          const content = await response.text();

          switch (selectedFormat) {
            case 'csv':
              parseResult = await parseCSV(content);
              break;
            case 'txt':
              parseResult = await parseTXT(content);
              break;
            case 'json':
              parseResult = await parseJSON(content);
              break;
            default:
              throw new Error('Unsupported format');
          }
        }

        setParseResult(parseResult);

        if (!parseResult.success) {
          Alert.alert(
            'Validation Errors',
            `Found ${parseResult.errors.length} errors:\n\n${parseResult.errors.slice(0, 5).join('\n')}${
              parseResult.errors.length > 5 ? `\n\n...and ${parseResult.errors.length - 5} more` : ''
            }`
          );
        } else if (parseResult.questions.length === 0) {
          Alert.alert('No Questions', 'No valid questions found in the file');
        }
      } catch (error: any) {
        Alert.alert('Parse Error', error.message || 'Failed to parse file');
      } finally {
        setParsing(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to pick file');
      setParsing(false);
    }
  };

  const handleImport = () => {
    if (!parseResult || !parseResult.success || parseResult.questions.length === 0) {
      Alert.alert('Error', 'No valid questions to import');
      return;
    }

    Alert.alert(
      'Confirm Import',
      `Import ${parseResult.questions.length} questions?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: () => {
            onImport(parseResult.questions);
            setParseResult(null);
            onClose();
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setParseResult(null);
    onClose();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Import Questions</Text>
            <Text style={styles.subtitle}>Upload questions from a file</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Format Selection */}
          <Text style={styles.sectionTitle}>Select Format</Text>
          <View style={styles.formatGrid}>
            {formats.map((format) => (
              <TouchableOpacity
                key={format.value}
                style={[
                  styles.formatCard,
                  selectedFormat === format.value && styles.formatCardActive,
                ]}
                onPress={() => setSelectedFormat(format.value)}
              >
                <FileText
                  size={24}
                  color={selectedFormat === format.value ? colors.primary[600] : colors.text.secondary}
                />
                <Text
                  style={[
                    styles.formatLabel,
                    selectedFormat === format.value && styles.formatLabelActive,
                  ]}
                >
                  {format.label}
                </Text>
                <Text style={styles.formatExt}>{format.ext}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Download Template Button */}
          <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadTemplate}>
            <Download size={20} color={colors.primary[600]} />
            <Text style={styles.downloadButtonText}>Download Template</Text>
          </TouchableOpacity>

          {/* Upload Button */}
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handlePickFile}
            disabled={parsing}
          >
            <Upload size={20} color={colors.text.inverse} />
            <Text style={styles.uploadButtonText}>
              {parsing ? 'Processing...' : 'Upload File'}
            </Text>
          </TouchableOpacity>

          {/* Parsing Indicator */}
          {parsing && (
            <View style={styles.parsingContainer}>
              <ActivityIndicator size="large" color={colors.primary[600]} />
              <Text style={styles.parsingText}>Parsing file...</Text>
            </View>
          )}

          {/* Parse Result */}
          {parseResult && !parsing && (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}>
                {parseResult.success ? (
                  <CheckCircle size={24} color={colors.success[600]} />
                ) : (
                  <AlertCircle size={24} color={colors.error[600]} />
                )}
                <Text
                  style={[
                    styles.resultTitle,
                    parseResult.success ? styles.resultTitleSuccess : styles.resultTitleError,
                  ]}
                >
                  {parseResult.success
                    ? `${parseResult.questions.length} Questions Ready`
                    : `${parseResult.errors.length} Errors Found`}
                </Text>
              </View>

              {parseResult.success && parseResult.questions.length > 0 && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewTitle}>Preview:</Text>
                  {parseResult.questions.slice(0, 3).map((q, index) => (
                    <View key={index} style={styles.previewQuestion}>
                      <View style={styles.previewHeader}>
                        <Text style={styles.previewQuestionType}>
                          {q.question_type.toUpperCase()}
                        </Text>
                        <Text style={styles.previewPoints}>{q.points} pts</Text>
                      </View>
                      <Text style={styles.previewQuestionText} numberOfLines={2}>
                        {q.question_text}
                      </Text>
                      {q.options && (
                        <Text style={styles.previewOptions}>
                          {q.options.length} options
                        </Text>
                      )}
                    </View>
                  ))}
                  {parseResult.questions.length > 3 && (
                    <Text style={styles.moreText}>
                      +{parseResult.questions.length - 3} more questions
                    </Text>
                  )}
                </View>
              )}

              {!parseResult.success && parseResult.errors.length > 0 && (
                <View style={styles.errorsContainer}>
                  {parseResult.errors.slice(0, 5).map((error, index) => (
                    <Text key={index} style={styles.errorText}>
                      • {error}
                    </Text>
                  ))}
                  {parseResult.errors.length > 5 && (
                    <Text style={styles.moreErrorsText}>
                      +{parseResult.errors.length - 5} more errors
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Import Button */}
        {parseResult?.success && parseResult.questions.length > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.importButton} onPress={handleImport}>
              <CheckCircle size={20} color={colors.text.inverse} />
              <Text style={styles.importButtonText}>
                Import {parseResult.questions.length} Questions
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </Portal>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  modal: {
    backgroundColor: colors.surface.primary,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    maxHeight: '90%',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  formatCard: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.secondary,
  },
  formatCardActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  formatLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  formatLabelActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
  formatExt: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[600],
    backgroundColor: colors.surface.primary,
    marginBottom: spacing.md,
  },
  downloadButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[600],
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  uploadButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
  },
  parsingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  parsingText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  resultContainer: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resultTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  resultTitleSuccess: {
    color: colors.success[600],
  },
  resultTitleError: {
    color: colors.error[600],
  },
  previewContainer: {
    gap: spacing.sm,
  },
  previewTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  previewQuestion: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[600],
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  previewQuestionType: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    textTransform: 'uppercase',
  },
  previewPoints: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  previewQuestionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  previewOptions: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  moreText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  errorsContainer: {
    gap: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
  },
  moreErrorsText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.success[600],
    ...shadows.md,
  },
  importButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
  },
});
