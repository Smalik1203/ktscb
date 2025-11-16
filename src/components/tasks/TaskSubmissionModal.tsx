import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { Modal, Portal, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { X, Upload, FileText, Paperclip, Image as ImageIcon } from 'lucide-react-native';
import { Task } from '../../hooks/useTasks';
import { supabase } from '../../data/supabaseClient';
import { colors, spacing, typography, borderRadius, shadows } from '../../../lib/design-system';
import { SuccessAnimation } from '../ui/SuccessAnimation';

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
      console.error('Error picking image:', error);
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
      console.error('Error picking document:', error);
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

      console.log('Uploading file to Supabase Storage:', file.name, 'Path:', filePath);

      // Get file as ArrayBuffer for React Native compatibility
      const fileResponse = await fetch(file.uri);
      if (!fileResponse.ok) {
        throw new Error(`Failed to read file: ${fileResponse.status} ${fileResponse.statusText}`);
      }

      const fileArrayBuffer = await fileResponse.arrayBuffer();
      if (fileArrayBuffer.byteLength === 0) {
        throw new Error('File appears to be empty');
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, fileArrayBuffer, {
          contentType: file.mimeType || (isImage ? 'image/jpeg' : 'application/octet-stream'),
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      console.log('✅ File uploaded successfully:', publicUrl);

      return {
        name: file.name,
        url: publicUrl,
        size: file.size,
        mimeType: file.mimeType,
      };
    } catch (error: any) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload ${file.name}: ${error.message}`);
    }
  };

  const uploadAttachments = async (taskId: string): Promise<any[]> => {
    if (images.length === 0 && attachments.length === 0) return [];

    const uploadedFiles = [];
    setUploading(true);

    try {
      // Upload images
      for (const image of images) {
        const uploaded = await uploadFileToStorage(image, taskId, true);
        uploadedFiles.push(uploaded);
      }

      // Upload documents
      for (const attachment of attachments) {
        const uploaded = await uploadFileToStorage(attachment, taskId, false);
        uploadedFiles.push(uploaded);
      }
    } catch (error) {
      console.error('Error uploading attachments:', error);
      throw error;
    } finally {
      setUploading(false);
    }

    return uploadedFiles;
  };

  const handleSubmit = () => {
    if (!task) {
      console.log('No task provided');
      return;
    }

    console.log('handleSubmit called - showing confirmation dialog');

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
          onPress: () => {
            console.log('Submission cancelled');
          },
        },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            console.log('User confirmed submission - starting upload');
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
              console.error('Error submitting task:', error);
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
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Submit Task</Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

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
              <TextInput
                mode="outlined"
                multiline
                numberOfLines={6}
                value={submissionText}
                onChangeText={setSubmissionText}
                placeholder="Enter your submission text here (optional)..."
                style={styles.textInput}
                contentStyle={styles.textInputContent}
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
                  <ImageIcon size={16} color={colors.primary[600]} />
                  <Text style={styles.attachButtonText}>Add Image</Text>
                </TouchableOpacity>
              </View>

              {images.length > 0 && (
                <View style={styles.imagesGrid}>
                  {images.map((image, index) => (
                    <View key={index} style={styles.imageItem}>
                      <Image source={{ uri: image.uri || image.url }} style={styles.imagePreview} />
                      <TouchableOpacity
                        onPress={() => handleRemoveImage(index)}
                        style={styles.imageRemoveButton}
                      >
                        <X size={16} color={colors.text.inverse} />
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
                  <Paperclip size={16} color={colors.primary[600]} />
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
                      <FileText size={20} color={colors.primary[600]} />
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
                        <X size={16} color={colors.error[600]} />
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
              mode="outlined"
              onPress={onDismiss}
              style={styles.cancelButton}
              disabled={submitting || uploading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
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
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
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

