import React, { useState, useEffect , useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Modal as RNModal, Animated, ActivityIndicator } from 'react-native';
import { Text, Button, Portal, Modal, TextInput, SegmentedButtons, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Upload, X, FileText, Video, HelpCircle, Loader2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { typography, spacing, borderRadius, colors } from '../../../lib/design-system';
import { useAuth } from '../../contexts/AuthContext';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { supabase } from '../../lib/supabase'; // Kept for storage and auth only
import { api } from '../../services/api';

interface AddResourceModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
  editingResource?: any;
}

const STORAGE_BUCKET = 'Lms';

// Modern file picker without size restrictions
const pickFile = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['video/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return null;
    
    const file = result.assets[0];
    return file;
  } catch (error) {
    console.error('Error picking file:', error);
    throw error;
  }
};

/**
 * Memory-efficient file upload using streaming (no base64, no blob, no ArrayBuffer)
 * Uses uploadAsync with multipart/form-data to avoid loading file into JS memory
 */
const uploadToSupabase = async (
  file: any,
  pathPrefix: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${pathPrefix}/${fileName}`;

  try {
    // Get Supabase session for authorization
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Get Supabase project URL and construct upload endpoint
    // Runtime-safe: validate env var exists
    const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseProjectUrl || supabaseProjectUrl.trim() === '') {
      throw new Error('Supabase configuration is missing. Please restart the app.');
    }
    const uploadUrl = `${supabaseProjectUrl}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`;

    // Use uploadAsync - streams file directly without loading into memory
    const uploadResult = await uploadAsync(
      uploadUrl,
      file.uri,
      {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': session.access_token,
        },
      }
    );

    if (uploadResult.status !== 200 && uploadResult.status !== 201) {
      throw new Error(`Upload failed: HTTP ${uploadResult.status}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    throw error;
  }
};

export const AddResourceModal: React.FC<AddResourceModalProps> = ({
  visible,
  onDismiss,
  onSuccess,
  editingResource
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors, typography, spacing, borderRadius, shadows), [colors, typography, spacing, borderRadius, shadows]);
  const { profile } = useAuth();
  const { data: classes = [] } = useClasses(profile?.school_code ?? undefined);
  const { data: subjectsResult } = useSubjects(profile?.school_code ?? undefined);
  const subjects = subjectsResult?.data || [];
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    resource_type: 'video',
    subject_id: '',
    class_instance_id: '',
    content_url: ''
  });
  
  const [useFileUpload, setUseFileUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingStatus, setUploadingStatus] = useState('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      if (editingResource) {
        setFormData({
          title: editingResource.title || '',
          description: editingResource.description || '',
          resource_type: editingResource.resource_type || 'video',
          subject_id: editingResource.subject_id || '',
          class_instance_id: editingResource.class_instance_id || '',
          content_url: editingResource.content_url || ''
        });
      } else {
        setFormData({
          title: '',
          description: '',
          resource_type: 'video',
          subject_id: '',
          class_instance_id: '',
          content_url: ''
        });
      }
      setUseFileUpload(false);
      setSelectedFile(null);
      setUploadProgress(0);
      setUploadingStatus('');
    }
  }, [visible, editingResource]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFilePick = async () => {
    try {
      const file = await pickFile();
      if (file) {
        setSelectedFile(file);
        setFormData(prev => ({ ...prev, content_url: file.uri }));
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', error.message || 'Failed to pick file');
    }
  };

  // Modern file upload using helper function with progress tracking
  const uploadFileToStorage = async (file: any): Promise<string> => {
    if (!profile?.school_code) {
      throw new Error('School code not found');
    }

    if (!formData.class_instance_id || !formData.subject_id) {
      throw new Error('Please select both class and subject before uploading');
    }

    // Reset progress
    setUploadProgress(0);
    setUploadingStatus('Preparing upload...');
    
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
      const pathPrefix = `${profile.school_code}/${formData.class_instance_id}/${formData.subject_id}`;
      setUploadingStatus('Uploading to cloud storage...');
      const url = await uploadToSupabase(file, pathPrefix);
      
      // Complete progress
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadingStatus('Upload complete!');
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return url;
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setUploadingStatus('');
      throw error;
    }
  };

  const handleSubmit = async () => {
    try {
      // Validation
      if (!formData.title.trim()) {
        Alert.alert('Error', 'Please enter a title');
        return;
      }
      if (!formData.description.trim()) {
        Alert.alert('Error', 'Please enter a description');
        return;
      }
      if (!formData.subject_id) {
        Alert.alert('Error', 'Please select a subject');
        return;
      }
      if (!formData.class_instance_id) {
        Alert.alert('Error', 'Please select a class');
        return;
      }
      if (!formData.content_url.trim()) {
        Alert.alert('Error', 'Please provide content URL or upload a file');
        return;
      }

      setUploading(true);

      let contentUrl = formData.content_url;

      // Upload file if selected
      if (useFileUpload && selectedFile) {
        contentUrl = await uploadFileToStorage(selectedFile);
      }

      if (!profile?.school_code) {
        Alert.alert('Error', 'School code is required');
        return;
      }

      const resourceData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        resource_type: formData.resource_type,
        content_url: contentUrl,
        school_code: profile.school_code,
        subject_id: formData.subject_id,
        class_instance_id: formData.class_instance_id,
        uploaded_by: profile?.auth_id
      };

      if (editingResource) {
        // Update existing resource via service (capability assertion happens there)
        await api.resources.update(editingResource.id, resourceData);
        Alert.alert('Success', 'Resource updated successfully');
      } else {
        // Create new resource via service (capability assertion happens there)
        await api.resources.create(resourceData as any);
        Alert.alert('Success', 'Resource created successfully');
      }

      onSuccess();
      onDismiss();
    } catch (error) {
      console.error('Error saving resource:', error);
      Alert.alert('Error', error.message || 'Failed to save resource');
    } finally {
      setUploading(false);
    }
  };

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video size={20} color={colors.primary[600]} />;
      case 'pdf':
        return <FileText size={20} color={colors.primary[600]} />;
      case 'quiz':
        return <HelpCircle size={20} color={colors.primary[600]} />;
      default:
        return <FileText size={20} color={colors.primary[600]} />;
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {editingResource ? 'Edit Resource' : 'Add New Resource'}
          </Text>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <X size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Resource Title *</Text>
              <TextInput
                value={formData.title}
                onChangeText={(text) => handleInputChange('title', text)}
                placeholder="Enter resource title"
                style={styles.input}
                mode="outlined"
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                value={formData.description}
                onChangeText={(text) => handleInputChange('description', text)}
                placeholder="Enter resource description"
                style={styles.input}
                mode="outlined"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Resource Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Resource Type *</Text>
              <SegmentedButtons
                value={formData.resource_type}
                onValueChange={(value) => handleInputChange('resource_type', value)}
                buttons={[
                  {
                    value: 'video',
                    label: 'Video',
                    icon: 'video',
                  },
                  {
                    value: 'pdf',
                    label: 'PDF',
                    icon: 'file-pdf-box',
                  },
                ]}
                style={styles.segmentedButtons}
              />
            </View>

            {/* Subject Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Subject *</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowSubjectDropdown(true)}
              >
                <Text style={styles.dropdownText}>
                  {formData.subject_id 
                    ? subjects.find(s => s.id === formData.subject_id)?.subject_name || 'Select Subject'
                    : 'Select Subject'
                  }
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Class Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Class *</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowClassDropdown(true)}
              >
                <Text style={styles.dropdownText}>
                  {formData.class_instance_id 
                    ? classes.find(c => c.id === formData.class_instance_id) 
                        ? `Grade ${classes.find(c => c.id === formData.class_instance_id)?.grade} - ${classes.find(c => c.id === formData.class_instance_id)?.section}`
                        : 'Select Class'
                    : 'Select Class'
                  }
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Content Source Toggle */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Content Source</Text>
              <SegmentedButtons
                value={useFileUpload ? 'upload' : 'url'}
                onValueChange={(value) => setUseFileUpload(value === 'upload')}
                buttons={[
                  { value: 'url', label: 'Use URL' },
                  { value: 'upload', label: 'Upload File' },
                ]}
                style={styles.segmentedButtons}
              />
            </View>

            {/* Content URL or File Upload */}
            {!useFileUpload ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Content URL *</Text>
                <TextInput
                  value={formData.content_url}
                  onChangeText={(text) => handleInputChange('content_url', text)}
                  placeholder="Enter URL to video or PDF content"
                  style={styles.input}
                  mode="outlined"
                />
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Upload File *</Text>
                <TouchableOpacity 
                  style={styles.fileUploadButton} 
                  onPress={handleFilePick}
                  disabled={uploading}
                >
                  <Upload size={20} color={colors.primary[600]} />
                  <Text style={styles.fileUploadText}>
                    {selectedFile ? selectedFile.name : 'Choose File'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.fileUploadHint}>
                  Supported: Videos (mp4, etc.), PDFs. Will be stored in Supabase Storage.
                </Text>
                
                {/* Upload Progress Indicator */}
                {uploading && (
                  <View style={styles.uploadProgressContainer}>
                    <View style={styles.uploadProgressHeader}>
                      <Loader2 size={16} color={colors.primary[600]} style={{ animationDuration: '1s' }} />
                      <Text style={styles.uploadStatusText}>{uploadingStatus}</Text>
                      <Text style={styles.uploadProgressText}>{Math.round(uploadProgress)}%</Text>
                    </View>
                    <ProgressBar 
                      progress={uploadProgress / 100} 
                      color={colors.primary[600]} 
                      style={styles.progressBar}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={onDismiss}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={uploading}
                disabled={uploading}
                style={styles.submitButton}
              >
                {editingResource ? 'Update Resource' : 'Create Resource'}
              </Button>
            </View>
          </View>
        </ScrollView>

        {/* Subject Dropdown Modal */}
        <RNModal
          visible={showSubjectDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSubjectDropdown(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowSubjectDropdown(false)}
            />
            <View style={styles.dropdownModal}>
              <Text style={styles.dropdownTitle}>Select Subject</Text>
              <ScrollView style={styles.dropdownList}>
                {subjects.map((subject) => (
                  <TouchableOpacity
                    key={subject.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      handleInputChange('subject_id', subject.id);
                      setShowSubjectDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{subject.subject_name}</Text>
                    {formData.subject_id === subject.id && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </RNModal>

        {/* Class Dropdown Modal */}
        <RNModal
          visible={showClassDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowClassDropdown(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowClassDropdown(false)}
            />
            <View style={styles.dropdownModal}>
              <Text style={styles.dropdownTitle}>Select Class</Text>
              <ScrollView style={styles.dropdownList}>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      handleInputChange('class_instance_id', cls.id);
                      setShowClassDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>
                      Grade {cls.grade} - Section {cls.section}
                    </Text>
                    {formData.class_instance_id === cls.id && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </RNModal>
      </Modal>
    </Portal>
  );
};

const createStyles = (colors: ThemeColors, typography: any, spacing: any, borderRadius: any, shadows: any) =>
  StyleSheet.create({
  modal: {
    backgroundColor: colors.surface.primary,
    margin: spacing.lg,
    borderRadius: borderRadius.lg,
    maxHeight: '90%',
  },
  scrollView: {
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
  form: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface.primary,
  },
  segmentedButtons: {
    marginTop: spacing.xs,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  dropdownText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
  },
  dropdownArrow: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  fileUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderStyle: 'dashed',
  },
  fileUploadText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  fileUploadHint: {
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
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    margin: spacing.lg,
    maxHeight: '60%',
    minWidth: 300,
  },
  dropdownTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  dropdownItemText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
  },
  checkmark: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
});
