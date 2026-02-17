import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput as RNTextInput } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Button, IconButton, Modal as ThemedModal, ProgressBar } from '../../ui';
import * as DocumentPicker from 'expo-document-picker';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { spacing, typography, borderRadius, colors } from '../../../lib/design-system';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { Task } from '../../hooks/useTasks';
import { DatePickerModal } from '../common/DatePickerModal';
import { supabase } from '../../lib/supabase'; // Kept for storage (reads) and auth session
import { tasksService } from '../../services/tasks';

interface TaskFormModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (taskData: any) => Promise<string>;
  task?: Task | null;
  schoolCode: string;
  userId: string;
  academicYearId?: string;
}

export function TaskFormModal({
  visible,
  onDismiss,
  onSubmit,
  task,
  schoolCode,
  userId,
  academicYearId,
}: TaskFormModalProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);

  const PRIORITIES = [
    { value: 'low', label: 'Low', color: colors.success[500] },
    { value: 'medium', label: 'Medium', color: colors.warning[500] },
    { value: 'high', label: 'High', color: colors.error[500] },
    { value: 'urgent', label: 'Urgent', color: colors.error[600] },
  ];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [assignedDate, setAssignedDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000)); // Tomorrow
  const [showAssignedDatePicker, setShowAssignedDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingStatus, setUploadingStatus] = useState('');
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  // Defer list render so modal open doesn't block the main thread (fixes freeze when tapping Class)
  const [classListReady, setClassListReady] = useState(false);
  const [subjectListReady, setSubjectListReady] = useState(false);
  const classModalOpenedRef = useRef(false);
  const subjectModalOpenedRef = useRef(false);

  const { data: classes } = useClasses(schoolCode);
  const { data: subjectsResult } = useSubjects(schoolCode);
  const subjects = subjectsResult?.data || [];

  // Filter subjects by selected class (optional - you can remove this if subjects aren't class-specific)
  const filteredSubjects = subjects;

  // Populate form when editing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setInstructions(task.instructions || '');
      setPriority(task.priority);
      setSelectedClassId(task.class_instance_id || '');
      setSelectedSubjectId(task.subject_id || '');
      setAssignedDate(new Date(task.assigned_date));
      setDueDate(new Date(task.due_date));
      setAttachments(task.attachments || []);
    } else {
      resetForm();
    }
  }, [task, visible]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setInstructions('');
    setPriority('medium');
    setSelectedClassId('');
    setSelectedSubjectId('');
    setAssignedDate(new Date());
    setDueDate(new Date(Date.now() + 86400000));
    setAttachments([]);
    setUploadProgress(0);
    setUploadingStatus('');
  };

  // Defer class list render until after modal is visible to avoid UI freeze when tapping Class
  useEffect(() => {
    if (showClassModal) {
      if (!classModalOpenedRef.current) {
        classModalOpenedRef.current = true;
        setClassListReady(false);
        const id = requestAnimationFrame(() => {
          requestAnimationFrame(() => setClassListReady(true));
        });
        return () => cancelAnimationFrame(id);
      }
    } else {
      classModalOpenedRef.current = false;
      setClassListReady(false);
    }
  }, [showClassModal]);

  useEffect(() => {
    if (showSubjectModal) {
      if (!subjectModalOpenedRef.current) {
        subjectModalOpenedRef.current = true;
        setSubjectListReady(false);
        const id = requestAnimationFrame(() => {
          requestAnimationFrame(() => setSubjectListReady(true));
        });
        return () => cancelAnimationFrame(id);
      }
    } else {
      subjectModalOpenedRef.current = false;
      setSubjectListReady(false);
    }
  }, [showSubjectModal]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];

        setAttachments([...attachments, {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
          size: file.size,
        }]);
      }
    } catch (error) {
      // Document picker failed
      alert('Failed to pick document');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const uploadFileToStorage = async (file: any, taskId: string): Promise<any> => {
    try {
      // Create file path: school_code/task_id/timestamp_filename
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = `${schoolCode}/${taskId}/${fileName}`;

      // Simulate progress since Supabase doesn't expose upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 300);

      try {
        setUploadingStatus(`Uploading ${file.name}...`);

        // Get Supabase session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session. Please log in again.');
        }

        // Construct Supabase Storage upload URL
        // Runtime-safe: validate env var exists
        const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!supabaseProjectUrl || supabaseProjectUrl.trim() === '') {
          throw new Error('Supabase configuration is missing. Please restart the app.');
        }
        const uploadUrl = `${supabaseProjectUrl}/storage/v1/object/task-attachments/${filePath}`;

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

        // Complete progress
        clearInterval(progressInterval);
        setUploadProgress(100);
        setUploadingStatus('Upload complete!');

        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 300));

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(filePath);

        return {
          name: file.name,
          size: file.size,
          type: file.type,
          url: publicUrl,
          path: filePath,
        };
      } catch (error) {
        clearInterval(progressInterval);
        setUploadProgress(0);
        setUploadingStatus('');
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      alert('Please enter a task title');
      return;
    }
    if (!selectedClassId) {
      alert('Please select a class');
      return;
    }
    if (!selectedSubjectId) {
      alert('Please select a subject');
      return;
    }
    if (dueDate < assignedDate) {
      alert('Due date must be on or after assigned date');
      return;
    }

    setSubmitting(true);
    try {
      let uploadedAttachments: any[] = [];

      // First create/update the task without attachments
      const tempTaskData = {
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        priority,
        class_instance_id: selectedClassId || null,
        subject_id: selectedSubjectId || null,
        assigned_date: assignedDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        attachments: [], // Will update after upload
        school_code: schoolCode,
        academic_year_id: academicYearId || null,
        created_by: userId,
        is_active: true,
      };

      // Submit task and get the task ID
      const taskId = await onSubmit(tempTaskData);
      const isEdit = !!task;

      // Upload attachments if any
      if (attachments.length > 0) {
        try {
          const uploadPromises = attachments.map(file =>
            uploadFileToStorage(file, taskId)
          );

          uploadedAttachments = await Promise.all(uploadPromises) as any[];

          // Update task with attachment URLs via service (capability assertion happens there)
          try {
            await tasksService.updateAttachments(taskId, uploadedAttachments);
            Alert.alert('Success', isEdit ? `Task updated with ${uploadedAttachments.length} file(s)!` : `Task created with ${uploadedAttachments.length} file(s)!`);
          } catch (updateError: any) {
            Alert.alert(
              'Warning',
              isEdit ? `Task updated but failed to save attachments: ${updateError.message}. Please try editing again.` : `Task created but failed to save attachments: ${updateError.message}. Please try editing the task to add files.`
            );
          }
        } catch (uploadError: any) {
          Alert.alert(
            'Warning',
            isEdit ? `Task updated but file upload failed: ${uploadError.message || 'Unknown error'}.` : `Task created but file upload failed: ${uploadError.message || 'Unknown error'}. Please try editing the task to add files.`
          );
        }
      } else {
        Alert.alert('Success', isEdit ? 'Task updated successfully!' : 'Task created successfully!');
      }

      resetForm();
      setUploadProgress(0);
      setUploadingStatus('');
      onDismiss();
    } catch (error) {
      // Task submission failed
      setUploadProgress(0);
      setUploadingStatus('');
      alert('Failed to save task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <>
      <ThemedModal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
        title={task ? 'Edit Task' : 'Create New Task'}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Basic Information Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
          </View>

          {/* Task Title */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Task Title <Text style={styles.required}>*</Text>
            </Text>
            <RNTextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Enter task title"
              placeholderTextColor={colors.text.tertiary}
              style={[styles.input, { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, paddingHorizontal: 12, color: colors.text.primary }]}
            />
          </View>

          {/* Assignment Details Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assignment Details</Text>
          </View>

          {/* Priority */}
          <View style={styles.fieldContainer}>
            <TouchableOpacity onPress={() => setShowPriorityModal(true)}>
              <View style={[styles.input, { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 2 }}>Priority</Text>
                  <Text style={{ fontSize: 14, color: colors.text.primary }}>{priority ? PRIORITIES.find(p => p.value === priority)?.label : ''}</Text>
                </View>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.secondary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Class */}
          <View style={styles.fieldContainer}>
            <TouchableOpacity onPress={() => setShowClassModal(true)}>
              <View style={[styles.input, { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 2 }}>Class</Text>
                  <Text style={{ fontSize: 14, color: colors.text.primary }}>{selectedClassId
                    ? `Grade ${classes?.find(c => c.id === selectedClassId)?.grade} - Section ${classes?.find(c => c.id === selectedClassId)?.section}`
                    : ''}</Text>
                </View>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.secondary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Subject */}
          <View style={styles.fieldContainer}>
            <TouchableOpacity
              onPress={() => selectedClassId && setShowSubjectModal(true)}
              disabled={!selectedClassId}
            >
              <View style={[styles.input, { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', opacity: !selectedClassId ? 0.5 : 1 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 2 }}>Subject</Text>
                  <Text style={{ fontSize: 14, color: colors.text.primary }}>{selectedSubjectId
                    ? subjects?.find(s => s.id === selectedSubjectId)?.subject_name
                    : (!selectedClassId ? 'Select a class first' : '')}</Text>
                </View>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.secondary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Schedule Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Schedule</Text>
          </View>

          {/* Date Row */}
          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfWidth]}>
              <TouchableOpacity onPress={() => setShowAssignedDatePicker(true)}>
                <View style={[styles.input, { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 2 }}>Assigned Date</Text>
                    <Text style={{ fontSize: 14, color: colors.text.primary }}>{formatDate(assignedDate)}</Text>
                  </View>
                  <MaterialIcons name="event" size={20} color={colors.text.secondary} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.fieldContainer, styles.halfWidth]}>
              <TouchableOpacity onPress={() => setShowDueDatePicker(true)}>
                <View style={[styles.input, { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 2 }}>Due Date</Text>
                    <Text style={{ fontSize: 14, color: colors.text.primary }}>{formatDate(dueDate)}</Text>
                  </View>
                  <MaterialIcons name="event" size={20} color={colors.text.secondary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Additional Information Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
          </View>

          {/* File Attachments */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>File Attachments</Text>
            <Button
              variant="outline"
              icon={<MaterialIcons name="upload" size={16} color={colors.primary[600]} />}
              onPress={handlePickDocument}
              style={styles.uploadButton}
              textStyle={styles.uploadButtonLabel}
            >
              Upload
            </Button>
            <Text style={styles.helperText}>
              Supported: Images, PDF, DOC, DOCX, TXT
            </Text>

            {/* Upload Progress Indicator */}
            {submitting && uploadingStatus && (
              <View style={styles.uploadProgressContainer}>
                <View style={styles.uploadProgressHeader}>
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                  <Text style={styles.uploadStatusText}>{uploadingStatus}</Text>
                  <Text style={styles.uploadProgressText}>{Math.round(uploadProgress)}%</Text>
                </View>
                <ProgressBar
                  progress={uploadProgress}
                  color={colors.primary[600]}
                  style={styles.progressBar}
                />
              </View>
            )}

            {attachments.length > 0 && (
              <View style={styles.attachmentsList}>
                {attachments.map((file, index) => (
                  <View key={index} style={styles.attachmentItem}>
                    <MaterialIcons name="description" size={16} color={colors.text.secondary} />
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <IconButton
                      icon={<MaterialIcons name="close" size={16} color={colors.error[600]} />}
                      onPress={() => handleRemoveAttachment(index)}
                      accessibilityLabel="Remove attachment"
                      size="sm"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Description</Text>
            <RNTextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Enter task description (optional)"
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              style={[styles.textArea, { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.text.primary, textAlignVertical: 'top' }]}
            />
            <Text style={styles.charCount}>{description.length} / 1000</Text>
          </View>

          {/* Instructions */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Instructions</Text>
            <RNTextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Enter specific instructions for students (optional)"
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={3}
              style={[styles.textArea, { borderWidth: 1, borderColor: colors.border.light, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.text.primary, textAlignVertical: 'top' }]}
            />
            <Text style={styles.charCount}>{instructions.length} / 1000</Text>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <Button
            variant="outline"
            onPress={onDismiss}
            style={styles.cancelButton}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onPress={handleSubmit}
            style={styles.submitButton}
            loading={submitting}
            disabled={submitting}
          >
            {task ? 'Update Task' : 'Create Task'}
          </Button>
        </View>
      </ThemedModal>

      {/* Priority Selection Modal */}
      <ThemedModal
        visible={showPriorityModal}
        onDismiss={() => setShowPriorityModal(false)}
        contentContainerStyle={styles.selectionModal}
      >
        <Text style={styles.selectionModalTitle}>Select Priority</Text>
        <View style={styles.selectionList}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[
                styles.selectionItem,
                priority === p.value && styles.selectionItemSelected,
              ]}
              onPress={() => {
                setPriority(p.value as any);
                setShowPriorityModal(false);
              }}
            >
              <View style={styles.selectionItemContent}>
                <View style={[styles.priorityIndicator, { backgroundColor: p.color }]} />
                <Text style={[
                  styles.selectionItemText,
                  priority === p.value && styles.selectionItemTextSelected,
                ]}>
                  {p.label}
                </Text>
              </View>
              {priority === p.value && (
                <MaterialIcons name="check" size={18} color={colors.primary[600]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        <Button variant="outline" onPress={() => setShowPriorityModal(false)} style={styles.selectionModalButton}>
          Close
        </Button>
      </ThemedModal>

      {/* Class Selection Modal - list deferred so opening it doesn't freeze the UI */}
      <ThemedModal
        visible={showClassModal}
        onDismiss={() => setShowClassModal(false)}
        contentContainerStyle={styles.selectionModal}
      >
        <Text style={styles.selectionModalTitle}>Select Class</Text>
        {classListReady ? (
          <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={true}>
            {classes?.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={[
                  styles.selectionItem,
                  selectedClassId === cls.id && styles.selectionItemSelected,
                ]}
                onPress={() => {
                  setSelectedClassId(cls.id);
                  setShowClassModal(false);
                }}
              >
                <Text style={[
                  styles.selectionItemText,
                  selectedClassId === cls.id && styles.selectionItemTextSelected,
                ]}>
                  Grade {cls.grade} - Section {cls.section}
                </Text>
                {selectedClassId === cls.id && (
                  <MaterialIcons name="check" size={18} color={colors.primary[600]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.selectionList, { justifyContent: 'center', alignItems: 'center', minHeight: 80 }]}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
          </View>
        )}
        <Button variant="outline" onPress={() => setShowClassModal(false)} style={styles.selectionModalButton}>
          Close
        </Button>
      </ThemedModal>

      {/* Subject Selection Modal - list deferred so opening doesn't freeze */}
      <ThemedModal
        visible={showSubjectModal}
        onDismiss={() => setShowSubjectModal(false)}
        contentContainerStyle={styles.selectionModal}
      >
        <Text style={styles.selectionModalTitle}>Select Subject</Text>
        {subjectListReady ? (
          <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={true}>
            {filteredSubjects?.map((subject) => (
              <TouchableOpacity
                key={subject.id}
                style={[
                  styles.selectionItem,
                  selectedSubjectId === subject.id && styles.selectionItemSelected,
                ]}
                onPress={() => {
                  setSelectedSubjectId(subject.id);
                  setShowSubjectModal(false);
                }}
              >
                <Text style={[
                  styles.selectionItemText,
                  selectedSubjectId === subject.id && styles.selectionItemTextSelected,
                ]}>
                  {subject.subject_name}
                </Text>
                {selectedSubjectId === subject.id && (
                  <MaterialIcons name="check" size={18} color={colors.primary[600]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.selectionList, { justifyContent: 'center', alignItems: 'center', minHeight: 80 }]}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
          </View>
        )}
        <Button variant="outline" onPress={() => setShowSubjectModal(false)} style={styles.selectionModalButton}>
          Close
        </Button>
      </ThemedModal>

      {/* Date Picker Modals */}
      <DatePickerModal
        visible={showAssignedDatePicker}
        onDismiss={() => setShowAssignedDatePicker(false)}
        onConfirm={(date) => {
          setAssignedDate(date);
          setShowAssignedDatePicker(false);
        }}
        initialDate={assignedDate}
        title="Select Assigned Date"
      />

      <DatePickerModal
        visible={showDueDatePicker}
        onDismiss={() => setShowDueDatePicker(false)}
        onConfirm={(date) => {
          setDueDate(date);
          setShowDueDatePicker(false);
        }}
        initialDate={dueDate}
        minimumDate={assignedDate}
        title="Select Due Date"
      />
    </>
  );
}

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
    modal: {
      backgroundColor: colors.surface.primary,
      margin: spacing.md,
      borderRadius: borderRadius.lg,
      maxHeight: '90%',
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
      marginBottom: spacing.sm,
    },
    label: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium as any,
      color: colors.text.primary,
      marginBottom: 4, // Reduced
    },
    required: {
      color: colors.error[600],
    },
    input: {
      backgroundColor: colors.surface.primary,
      fontSize: typography.fontSize.sm,
      height: 48,
    },
    textArea: {
      backgroundColor: colors.surface.primary,
      fontSize: typography.fontSize.sm,
    },

    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    halfWidth: {
      flex: 1,
    },

    priorityIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    helperText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: spacing.xs,
    },

    uploadProgressContainer: {
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.primary[50],
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.primary[200],
    },
    uploadProgressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    uploadStatusText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.primary,
      flex: 1,
      fontWeight: typography.fontWeight.medium,
    },
    uploadProgressText: {
      fontSize: typography.fontSize.sm,
      color: colors.primary[700],
      fontWeight: typography.fontWeight.bold,
    },
    progressBar: {
      height: 6,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary[100],
    },
    selectionModal: {
      backgroundColor: colors.surface.primary,
      margin: spacing.lg,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      maxHeight: '70%',
    },
    selectionModalTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold as any,
      color: colors.text.primary,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    selectionList: {
      maxHeight: 300,
      marginBottom: spacing.md,
    },
    selectionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.DEFAULT,
    },
    selectionItemSelected: {
      backgroundColor: colors.primary[50],
    },
    selectionItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    selectionItemText: {
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
    },
    selectionItemTextSelected: {
      color: colors.primary[600],
      fontWeight: typography.fontWeight.semibold as any,
    },
    selectionModalButton: {
      borderColor: colors.border.DEFAULT,
    },

    uploadButton: {
      borderColor: colors.primary[600],
      borderStyle: 'dashed',
    },
    uploadButtonLabel: {
      color: colors.primary[600],
    },
    attachmentsList: {
      marginTop: spacing.sm,
    },
    attachmentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      marginBottom: spacing.xs,
    },
    attachmentName: {
      flex: 1,
      fontSize: typography.fontSize.sm,
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
    },
    cancelButton: {
      flex: 1,
      borderColor: colors.border.DEFAULT,
    },
    submitButton: {
      flex: 1,
      backgroundColor: colors.primary[600],
      elevation: 2,
    },
  });

