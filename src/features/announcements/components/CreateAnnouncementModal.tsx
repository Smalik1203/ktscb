import React, { useState, useEffect } from 'react';
import {
    View,
    Text as RNText,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Image,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Input, Modal } from '../../../ui';
import * as ImagePicker from 'expo-image-picker';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCreateAnnouncement, useUpdateAnnouncement, Announcement } from '../../../hooks/useAnnouncements';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

const STORAGE_BUCKET = 'Lms';

interface CreateAnnouncementModalProps {
    visible: boolean;
    onClose: () => void;
    editingAnnouncement?: Announcement | null;
}

const PRIORITIES = [
    { key: 'low', label: 'Info', emoji: 'ℹ️', color: '#3B82F6', description: 'General information' },
    { key: 'medium', label: 'Normal', emoji: '📢', color: '#8B5CF6', description: 'Standard announcement' },
    { key: 'high', label: 'Important', emoji: '⚠️', color: '#F59E0B', description: 'Needs attention' },
    { key: 'urgent', label: 'Urgent', emoji: '🚨', color: '#EF4444', description: 'Immediate action required' },
] as const;

export function CreateAnnouncementModal({ visible, onClose, editingAnnouncement }: CreateAnnouncementModalProps) {
    const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
    const { profile } = useAuth();
    const createMutation = useCreateAnnouncement();
    const updateMutation = useUpdateAnnouncement();

    const isEditing = !!editingAnnouncement;

    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [targetType, setTargetType] = useState<'all' | 'class'>('all');
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showClassPicker, setShowClassPicker] = useState(false);

    // Populate form when editing
    useEffect(() => {
        if (editingAnnouncement && visible) {
            setTitle(editingAnnouncement.title);
            setMessage(editingAnnouncement.message);
            setPriority(editingAnnouncement.priority);
            setTargetType(editingAnnouncement.target_type === 'role' ? 'all' : editingAnnouncement.target_type);
            setSelectedClassId(editingAnnouncement.class_instance_id || '');
            setSelectedImage(editingAnnouncement.image_url);
        }
    }, [editingAnnouncement, visible]);

    // Fetch classes for selection
    const { data: classes } = useQuery({
        queryKey: ['classes', profile?.school_code],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('class_instances')
                .select('id, grade, section')
                .eq('school_code', profile?.school_code!)
                .order('grade')
                .order('section');

            if (error) throw error;
            return (data || []) as { id: string; grade: number | null; section: string | null }[];
        },
        enabled: !!profile?.school_code && visible,
    });

    const selectedClass = classes?.find(c => c.id === selectedClassId);

    const resetForm = () => {
        setTitle('');
        setMessage('');
        setPriority('medium');
        setTargetType('all');
        setSelectedClassId('');
        setSelectedImage(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const pickImage = async (useCamera: boolean) => {
        try {
            const permission = useCamera 
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permission.status !== 'granted') {
                Alert.alert('Permission Required', `Please allow access to your ${useCamera ? 'camera' : 'photo library'} to add images.`);
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [16, 9],
                    quality: 0.8,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [16, 9],
                    quality: 0.8,
                });

            if (!result.canceled && result.assets[0]) {
                setSelectedImage(result.assets[0].uri);
            }
        } catch (error) {
            // Image picker failed
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const uploadImage = async (uri: string): Promise<string | null> => {
        try {
            setUploadingImage(true);

            // Get auth session for upload
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Not authenticated');
            }

            // Determine file extension from URI
            const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
            
            // Generate unique filename
            const fileName = `announcements/${profile?.school_code}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            // Get Supabase project URL
            const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            if (!supabaseProjectUrl) {
                throw new Error('Supabase configuration is missing');
            }

            const uploadUrl = `${supabaseProjectUrl}/storage/v1/object/${STORAGE_BUCKET}/${fileName}`;

            // Use uploadAsync - streams file directly without loading into memory
            const uploadResult = await uploadAsync(
                uploadUrl,
                uri,
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
            const { data: urlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(fileName);

            return urlData.publicUrl;
        } catch (error) {
            // Upload failed - caller handles
            return null;
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim() || !message.trim()) {
            Alert.alert('Missing Information', 'Please fill in both title and message');
            return;
        }

        if (targetType === 'class' && !selectedClassId) {
            Alert.alert('Select a Class', 'Please select which class should receive this announcement');
            return;
        }

        try {
            let imageUrl: string | null | undefined;

            // Check if image needs uploading (new local image that's not a URL)
            const isNewImage = selectedImage && !selectedImage.startsWith('http');
            const imageRemoved = !selectedImage && editingAnnouncement?.image_url;
            
            if (isNewImage) {
                const uploadedUrl = await uploadImage(selectedImage);
                if (!uploadedUrl) {
                    Alert.alert('Image Upload Failed', 'Failed to upload image. Would you like to post without the image?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Post Without Image', onPress: () => submitAnnouncement(null) },
                    ]);
                    return;
                }
                imageUrl = uploadedUrl;
            } else if (imageRemoved) {
                imageUrl = null;
            } else if (selectedImage) {
                imageUrl = selectedImage; // Keep existing URL
            }

            await submitAnnouncement(imageUrl);
        } catch (error) {
            Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'post'} announcement. Please try again.`);
        }
    };

    const submitAnnouncement = async (imageUrl?: string | null) => {
        if (isEditing && editingAnnouncement) {
            // Update existing announcement
            await updateMutation.mutateAsync({
                id: editingAnnouncement.id,
                title: title.trim(),
                message: message.trim(),
                priority,
                image_url: imageUrl,
            });
            handleClose();
            Alert.alert('Updated! ✓', 'Your announcement has been updated.');
        } else {
            // Create new announcement
            await createMutation.mutateAsync({
                title: title.trim(),
                message: message.trim(),
                priority,
                target_type: targetType,
                class_instance_id: targetType === 'class' ? selectedClassId : undefined,
                school_code: profile?.school_code!,
                created_by: profile?.auth_id!,
                image_url: imageUrl || undefined,
            });
            handleClose();
            Alert.alert('Success! 🎉', 'Your announcement has been posted and notifications sent.');
        }
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending || uploadingImage;
    const selectedPriority = PRIORITIES.find(p => p.key === priority)!;

    return (
        <Modal
            visible={visible}
            onDismiss={handleClose}
            title={isEditing ? 'Edit Announcement' : 'New Announcement'}
            size="full"
        >
                <ScrollView 
                    style={{ flex: 1 }} 
                    contentContainerStyle={{ paddingBottom: spacing.lg }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Image Section */}
                    <View style={{ marginBottom: spacing.lg }}>
                        {selectedImage ? (
                            <View style={{ borderRadius: borderRadius.lg, overflow: 'hidden', ...shadows.md }}>
                                <Image
                                    source={{ uri: selectedImage }}
                                    style={{ width: '100%', height: 180 }}
                                    resizeMode="cover"
                                />
                                <TouchableOpacity
                                    onPress={() => setSelectedImage(null)}
                                    style={{
                                        position: 'absolute',
                                        top: spacing.sm,
                                        right: spacing.sm,
                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                        borderRadius: borderRadius.full,
                                        padding: spacing.xs,
                                    }}
                                >
                                    <MaterialIcons name="delete" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                <TouchableOpacity
                                    onPress={() => pickImage(false)}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: spacing.sm,
                                        paddingVertical: spacing.lg,
                                        borderRadius: borderRadius.lg,
                                        borderWidth: 2,
                                        borderStyle: 'dashed',
                                        borderColor: colors.border.DEFAULT,
                                        backgroundColor: colors.background.secondary,
                                    }}
                                >
                                    <MaterialIcons name="image" size={24} color={colors.primary[600]} />
                                    <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.primary[600] }}>
                                        Gallery
                                    </RNText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => pickImage(true)}
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: spacing.sm,
                                        paddingVertical: spacing.lg,
                                        borderRadius: borderRadius.lg,
                                        borderWidth: 2,
                                        borderStyle: 'dashed',
                                        borderColor: colors.border.DEFAULT,
                                        backgroundColor: colors.background.secondary,
                                    }}
                                >
                                    <MaterialIcons name="camera-alt" size={24} color={colors.primary[600]} />
                                    <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.primary[600] }}>
                                        Camera
                                    </RNText>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Title Input */}
                    <View style={{ marginBottom: spacing.md }}>
                        <Input
                            label="Title"
                            value={title}
                            onChangeText={setTitle}
                            placeholder="What's this about?"
                            variant="outlined"
                        />
                    </View>

                    {/* Message Input */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <Input
                            label="Message"
                            value={message}
                            onChangeText={setMessage}
                            placeholder="Share the details..."
                            variant="outlined"
                            multiline
                            numberOfLines={4}
                        />
                    </View>

                    {/* Priority Selection */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                            Priority Level
                        </RNText>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                            {PRIORITIES.map((p) => (
                                <TouchableOpacity
                                    key={p.key}
                                    onPress={() => setPriority(p.key)}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: spacing.md,
                                        paddingVertical: spacing.sm,
                                        borderRadius: borderRadius.lg,
                                        backgroundColor: priority === p.key ? p.color + '15' : colors.background.secondary,
                                        borderWidth: 2,
                                        borderColor: priority === p.key ? p.color : colors.border.light,
                                        gap: spacing.xs,
                                    }}
                                >
                                    <RNText style={{ fontSize: 16 }}>{p.emoji}</RNText>
                                    <RNText
                                        style={{
                                            fontSize: 14,
                                            fontWeight: '600',
                                            color: priority === p.key ? p.color : colors.text.secondary,
                                        }}
                                    >
                                        {p.label}
                                    </RNText>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Target Audience */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                            Send To
                        </RNText>

                        <View style={{ gap: spacing.sm }}>
                            {/* All Students Option */}
                            <TouchableOpacity
                                onPress={() => {
                                    setTargetType('all');
                                    setSelectedClassId('');
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: spacing.md,
                                    borderRadius: borderRadius.lg,
                                    backgroundColor: targetType === 'all' ? colors.primary[50] : colors.background.secondary,
                                    borderWidth: 2,
                                    borderColor: targetType === 'all' ? colors.primary[500] : colors.border.light,
                                    gap: spacing.md,
                                }}
                            >
                                <View
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: targetType === 'all' ? colors.primary[500] : colors.border.DEFAULT,
                                        backgroundColor: targetType === 'all' ? colors.primary[500] : 'transparent',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    {targetType === 'all' && <MaterialIcons name="check" size={14} color="#fff" />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <RNText style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary }}>
                                        👥 All Students
                                    </RNText>
                                    <RNText style={{ fontSize: 13, color: colors.text.tertiary }}>
                                        Everyone in the school will see this
                                    </RNText>
                                </View>
                            </TouchableOpacity>

                            {/* Specific Class Option */}
                            <TouchableOpacity
                                onPress={() => setTargetType('class')}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: spacing.md,
                                    borderRadius: borderRadius.lg,
                                    backgroundColor: targetType === 'class' ? colors.primary[50] : colors.background.secondary,
                                    borderWidth: 2,
                                    borderColor: targetType === 'class' ? colors.primary[500] : colors.border.light,
                                    gap: spacing.md,
                                }}
                            >
                                <View
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: targetType === 'class' ? colors.primary[500] : colors.border.DEFAULT,
                                        backgroundColor: targetType === 'class' ? colors.primary[500] : 'transparent',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    {targetType === 'class' && <MaterialIcons name="check" size={14} color="#fff" />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <RNText style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary }}>
                                        🎓 Specific Class
                                    </RNText>
                                    <RNText style={{ fontSize: 13, color: colors.text.tertiary }}>
                                        Only students in selected class
                                    </RNText>
                                </View>
                            </TouchableOpacity>

                            {/* Class Picker */}
                            {targetType === 'class' && (
                                <TouchableOpacity
                                    onPress={() => setShowClassPicker(true)}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: spacing.md,
                                        marginLeft: spacing.xl + spacing.md,
                                        borderRadius: borderRadius.lg,
                                        backgroundColor: colors.surface.primary,
                                        borderWidth: 1,
                                        borderColor: selectedClassId ? colors.primary[500] : colors.border.DEFAULT,
                                    }}
                                >
                                    <RNText style={{ 
                                        fontSize: 15, 
                                        color: selectedClassId ? colors.text.primary : colors.text.tertiary,
                                        fontWeight: selectedClassId ? '600' : '400',
                                    }}>
                                        {selectedClass 
                                            ? `Class ${selectedClass.grade} - ${selectedClass.section}`
                                            : 'Select a class...'
                                        }
                                    </RNText>
                                    <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Preview Note */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: spacing.md,
                            backgroundColor: colors.info[50],
                            borderRadius: borderRadius.lg,
                            gap: spacing.sm,
                        }}
                    >
                        <MaterialIcons name="error" size={20} color={colors.info[600]} />
                        <RNText style={{ flex: 1, fontSize: 13, color: colors.info[700], lineHeight: 18 }}>
                            Push notifications will be sent to {targetType === 'all' ? 'all students and parents' : 'students in the selected class'} immediately after posting.
                        </RNText>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={isSubmitting || !title.trim() || !message.trim()}
                        style={{
                            backgroundColor: isSubmitting || !title.trim() || !message.trim()
                                ? colors.neutral[300]
                                : colors.primary[600],
                            paddingVertical: spacing.md,
                            borderRadius: borderRadius.full,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: spacing.lg,
                        }}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <RNText style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                                {isEditing ? 'Update Announcement' : 'Post Announcement'}
                            </RNText>
                        )}
                    </TouchableOpacity>
                </ScrollView>

                {/* Class Picker Modal */}
                <Modal
                    visible={showClassPicker}
                    onDismiss={() => setShowClassPicker(false)}
                    title="Select Class"
                    size="md"
                >
                    <ScrollView>
                        {classes?.map((cls) => (
                            <TouchableOpacity
                                key={cls.id}
                                onPress={() => {
                                    setSelectedClassId(cls.id);
                                    setShowClassPicker(false);
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: spacing.md,
                                    borderRadius: borderRadius.lg,
                                    backgroundColor: selectedClassId === cls.id ? colors.primary[50] : colors.background.secondary,
                                    marginBottom: spacing.sm,
                                    borderWidth: 2,
                                    borderColor: selectedClassId === cls.id ? colors.primary[500] : 'transparent',
                                }}
                            >
                                <View
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: colors.primary[100],
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginRight: spacing.md,
                                    }}
                                >
                                    <RNText style={{ fontSize: 16, fontWeight: '700', color: colors.primary[600] }}>
                                        {cls.grade}
                                    </RNText>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <RNText style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary }}>
                                        Class {cls.grade} - {cls.section}
                                    </RNText>
                                </View>
                                {selectedClassId === cls.id && (
                                    <MaterialIcons name="check" size={20} color={colors.primary[600]} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Modal>
        </Modal>
    );
}
