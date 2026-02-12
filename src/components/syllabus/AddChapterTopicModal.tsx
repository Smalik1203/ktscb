import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal } from '../../ui';
import { colors, spacing, typography, borderRadius } from '../../../lib/design-system';

interface AddChapterTopicModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (title: string, description: string) => Promise<void>;
  mode: 'chapter' | 'topic';
  busy: boolean;
}

export function AddChapterTopicModal({
  visible,
  onDismiss,
  onSubmit,
  mode,
  busy,
}: AddChapterTopicModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    try {
      await onSubmit(title.trim(), description.trim());
      onDismiss();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save');
    }
  };

  return (
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIconCircle}>
              <MaterialIcons name="bookmark" size={24} color={colors.primary[600]} />
            </View>
            <View>
              <Text style={styles.headerTitle}>
                {mode === 'chapter' ? 'Add New Chapter' : 'Add New Topic'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {mode === 'chapter' 
                  ? 'Create a new chapter for your syllabus'
                  : 'Create a new topic within this chapter'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Information Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {mode === 'chapter' ? 'Chapter' : 'Topic'} Information
            </Text>
          </View>

          {/* Title */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={`Enter ${mode === 'chapter' ? 'chapter' : 'topic'} title`}
              placeholderTextColor={colors.text.secondary}
              style={styles.input}
            />
          </View>

          {/* Description */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={`Enter ${mode === 'chapter' ? 'chapter' : 'topic'} description (optional)`}
              placeholderTextColor={colors.text.secondary}
              style={styles.textArea}
              multiline
              numberOfLines={4}
            />
            <Text style={styles.charCount}>
              {description.length} / 500
            </Text>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.cancelButton}
            disabled={busy}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.submitButton, (busy || !title.trim()) && styles.submitButtonDisabled]}
            disabled={busy || !title.trim()}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.surface.primary} />
            ) : (
              <Text style={styles.submitButtonLabel}>Create</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: colors.surface.primary,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  headerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error[600],
  },
  input: {
    backgroundColor: colors.surface.primary,
    fontSize: typography.fontSize.base,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
  },
  textArea: {
    backgroundColor: colors.surface.primary,
    minHeight: 100,
    fontSize: typography.fontSize.base,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
  },
  charCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  cancelButton: {
    flex: 1,
    borderColor: colors.border.DEFAULT,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.text.primary,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonLabel: {
    color: colors.surface.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
  },
});

