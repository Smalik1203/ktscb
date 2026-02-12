import React, { useState, useEffect , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, TextInput as RNTextInput } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Button, Modal as ThemedModal } from '../../ui';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { Task } from '../../hooks/useTasks';
import { supabase } from '../../lib/supabase';
import { spacing, typography, borderRadius, shadows, colors } from '../../../lib/design-system';
import { SuccessAnimation } from '../../ui';

const STORAGE_BUCKET = 'task-submissions';

interface TaskSubmissionModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (submissionData: {
    task_id: string;
    student_id: string;
    submission_text: string | null;
    attachments: any[];
  }) => Promise<void>;
  task: Task | null;
  studentId: string;
  existingSubmission?: any;
}

export function TaskSubmissionModal({
  visible,
  onDismiss,
  onSubmit,
  task,
  studentId,
  existingSubmission,
}: TaskSubmissionModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const [submissionText, setSubmissionText] = useState('');
  const [images, setImages] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  useEffect(() => {
    if (visible && existingSubmission) {
      setSubmissionText(existingSubmission.submission_text || '');
      const existingAttachments = existingSubmission.attachments || [];
      // Separate images from documents
      const existingImages = existingAttachments.filter((a: any) => 
        a.mimeType?.startsWith('image/') || a.type?.startsWith('image/')
      );
      const existingDocs = existingAttachments.filter((a: any) => 
        !a.mimeType?.startsWith('image/') && !a.type?.startsWith('image/')
      );
      setImages(existingImages);
      setAttachments(existingDocs);
    } else if (visible && !existingSubmission) {
      setSubmissionText('');
      setImages([]);
      setAttachments([]);
    }
  }, [visible, existingSubmission]);

  const handlePickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to select images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((image) => ({
          name: image.fileName || `image_${Date.now()}.jpg`,
          uri: image.uri,
          size: image.fileSize || 0,
          mimeType: 'image/jpeg',
          width: image.width,
          height: image.height,
        }));
        setImages([...images, ...newImages]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newAttachments = result.assets.map((file) => ({
          name: file.name,
          uri: file.uri,
          size: file.size,
          mimeType: file.mimeType || 'application/octet-stream',
        }));
        setAttachments([...attachments, ...newAttachments]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  const handleRemoveAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
  };

  const uploadFileToStorage = async (file: any, taskId: string, isImage: boolean = false): Promise<any> => {
    // If file already has a URL (existing submission), return it
    if (file.url) {
      return {
        name: file.name,
        url: file.url,
        size: file.size,
        mimeType: file.mimeType,
      };
    }

    try {
      // Create file path: task_id/student_id/timestamp_filename
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop() || (isImage ? 'jpg' : 'bin');
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${taskId}/${studentId}/${fileName}`;

      // Get Supabase session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session. Please log in again.');
      }

      // Construct Supabase Storage upload URL
      // Runtime-safe: use supabase client's URL (already validated at startup)
      const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseProjectUrl || supabaseProjectUrl.trim() === '') {
        throw new Error('Supabase configuration is missing. Please restart the app.');
      }
      const uploadUrl = `${supabaseProjectUrl}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`;

      // Use uploadAsync for streaming upload (no memory overhead)
      const uploadResult = await uploadAsync(uploadUrl, file.uri, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': session.access_token,
        },
      });

      if (uploadResult.status !== 200) {
        let errorMessage = `Upload failed with status ${uploadResult.status}`;
        if (uploadResult.body) {
          try {
            const errorBody = JSON.parse(uploadResult.body);
            errorMessage = errorBody.message || errorMessage;
          } catch (parseError) {
            // Non-JSON error body - use raw text
            errorMessage = `Upload failed: ${uploadResult.body.substring(0, 200)}`;
          }
        }
        throw new Error(errorMessage);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      return {
        name: file.name,
        url: publicUrl,
        size: file.size,
        mimeType: file.mimeType,
      };
    } catch (error: any) {
      throw new Error(`Failed to upload ${file.name}: ${error.message}`);
    }
  };

  const uploadAttachments = async (taskId: string): Promise<any[]> => {
    if (images.length === 0 && attachments.length === 0) return [];

    const uploadedFiles: any[] = [];
    setUploading(true);

    try {
      // Upload images
      for (const image of images) {
        const uploaded = await uploadFileToStorage(image, taskId, true);
        uploadedFiles.push(uploaded as any);
      }

      // Upload documents
      for (const attachment of attachments) {
        const uploaded = await uploadFileToStorage(attachment, taskId, false);
        uploadedFiles.push(uploaded as any);
      }
    } catch (error) {
      throw error;
    } finally {
      setUploading(false);
    }

    return uploadedFiles;
  };

  const handleSubmit = () => {
    if (!task) {
      return;
    }

    // Show confirmation dialog
    const hasContent = submissionText.trim().length > 0 || images.length > 0 || attachments.length > 0;
    const confirmationMessage = hasContent
      ? 'Are you sure you want to submit this task?'
      : 'You are submitting this task without any content. Are you sure you want to continue?';

    Alert.alert(
      'Confirm Submission',
      confirmationMessage,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              const uploadedAttachments = await uploadAttachments(task.id);

              await onSubmit({
                task_id: task.id,
                student_id: studentId,
                submission_text: submissionText.trim() || null,
                attachments: uploadedAttachments,
              });

              // Show success animation
              setShowSuccessAnimation(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to submit task');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleAnimationEnd = () => {
    setShowSuccessAnimation(false);
    setSubmitting(false);
    setSubmissionText('');
    setImages([]);
    setAttachments([]);
    onDismiss();
  };

  return (
    <ThemedModal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.modalContainer}
      title="Submit Task"
    >
        <View style={styles.modalContent}>
          {task && (
            <View style={styles.taskInfo}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              {task.subjects && (
                <Text style={styles.taskSubject}>{task.subjects.subject_name}</Text>
              )}
            </View>
          )}

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Submission Text (Optional) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Submission Text (Optional)</Text>
              <RNTextInput
                multiline
                numberOfLines={6}
                value={submissionText}
                onChangeText={setSubmissionText}
                placeholder="Enter your submission text here (optional)..."
                placeholderTextColor={colors.text.tertiary}
                style={[styles.textInput, { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.text.primary, textAlignVertical: 'top', minHeight: 120 }]}
              />
            </View>

            {/* Images Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Images (Optional)</Text>
                <TouchableOpacity
                  style={[styles.attachButton, styles.imageButton]}
                  onPress={handlePickImage}
                  disabled={uploading}
                >
                  <MaterialIcons name="image" size={16} color={colors.primary[600]} />
                  <Text style={styles.attachButtonText}>Add Image</Text>
                </TouchableOpacity>
              </View>

              {images.length > 0 && (
                <View style={styles.imagesGrid}>
                  {images.map((image, index) => (
                    <View key={index} style={styles.imageItem}>
                      <Image 
                        source={{ uri: image.uri || image.url }} 
                        style={styles.imagePreview}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                      <TouchableOpacity
                        onPress={() => handleRemoveImage(index)}
                        style={styles.imageRemoveButton}
                      >
                        <MaterialIcons name="close" size={16} color={colors.text.inverse} />
                      </TouchableOpacity>
                      {image.name && (
                        <Text style={styles.imageName} numberOfLines={1}>
                          {image.name}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Documents Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Documents (Optional)</Text>
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={handlePickDocument}
                  disabled={uploading}
                >
                  <MaterialIcons name="attach-file" size={16} color={colors.primary[600]} />
                  <Text style={styles.attachButtonText}>Add Files</Text>
                </TouchableOpacity>
              </View>

              {uploading && (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                  <Text style={styles.uploadingText}>Uploading files...</Text>
                </View>
              )}

              {attachments.length > 0 && (
                <View style={styles.attachmentsList}>
                  {attachments.map((attachment, index) => (
                    <View key={index} style={styles.attachmentItem}>
                      <MaterialIcons name="description" size={20} color={colors.primary[600]} />
                      <View style={styles.attachmentInfo}>
                        <Text style={styles.attachmentName} numberOfLines={1}>
                          {attachment.name}
                        </Text>
                        {attachment.size && (
                          <Text style={styles.attachmentSize}>
                            {formatFileSize(attachment.size)}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveAttachment(index)}
                        style={styles.removeButton}
                      >
                        <MaterialIcons name="close" size={16} color={colors.error[600]} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Info Message */}
            <View style={styles.infoSection}>
              <Text style={styles.infoText}>
                You can submit without adding anything, or add text, images, or documents - all optional.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              variant="outline"
              onPress={onDismiss}
              style={styles.cancelButton}
              disabled={submitting || uploading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={handleSubmit}
              style={styles.submitButton}
              loading={submitting || uploading}
              disabled={submitting || uploading}
            >
              {existingSubmission ? 'Update Submission' : 'Submit'}
            </Button>
          </View>
        </View>

        {/* Success Animation */}
        <SuccessAnimation
          visible={showSuccessAnimation}
          onAnimationEnd={handleAnimationEnd}
        />
    </ThemedModal>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  modalContainer: {
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    ...shadows.lg,
  },
  taskInfo: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  taskTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  taskSubject: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  scrollView: {
    maxHeight: 400,
  },
  section: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  textInput: {
    backgroundColor: colors.surface.primary,
  },
  textInputContent: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  attachButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
  },
  uploadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
  attachmentsList: {
    gap: spacing.sm,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  attachmentSize: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  removeButton: {
    padding: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  imageButton: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[200],
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  imageItem: {
    width: '48%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  imageRemoveButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.error[600],
    borderRadius: borderRadius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageName: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  infoSection: {
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    margin: spacing.lg,
    marginTop: 0,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    textAlign: 'center',
    lineHeight: 20,
  },
});

