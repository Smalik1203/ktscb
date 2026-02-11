import React, { useState, useEffect } from 'react';
import {
    View,
    Text as RNText,
    TouchableOpacity,
    Modal,
    ScrollView,
    Alert,
    ActivityIndicator,
    Image,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { X, ImagePlus, Camera, Image as ImageIcon, Trash2, ChevronDown, Check, AlertCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCreateAnnouncement, useUpdateAnnouncement, Announcement } from '../../../hooks/useAnnouncements';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const STORAGE_BUCKET = 'Lms';

interface CreateAnnouncementModalProps {
    visible: boolean;
    onClose: () => void;
    editingAnnouncement?: Announcement | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    const { data: classes } = useQuery<{ id: string; grade: string; section: string }[]>({
        queryKey: ['classes', profile?.school_code],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('class_instances')
                .select('id, grade, section')
                .eq('school_code', profile?.school_code!)
                .order('grade')
                .order('section');

            if (error) throw error;
            return data || [];
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
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView 
                style={{ flex: 1, backgroundColor: colors.background.primary }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.light,
                        backgroundColor: colors.surface.primary,
                    }}
                >
                    <TouchableOpacity onPress={handleClose} style={{ padding: spacing.xs }}>
                        <X size={24} color={colors.text.secondary} />
                    </TouchableOpacity>
                    
                    <RNText style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                        {isEditing ? 'Edit Announcement' : 'New Announcement'}
                    </RNText>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={isSubmitting || !title.trim() || !message.trim()}
                        style={{
                            backgroundColor: isSubmitting || !title.trim() || !message.trim() 
                                ? colors.neutral[300] 
                                : colors.primary[600],
                            paddingHorizontal: spacing.lg,
                            paddingVertical: spacing.sm,
                            borderRadius: borderRadius.full,
                        }}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <RNText style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                                {isEditing ? 'Update' : 'Post'}
                            </RNText>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView 
                    style={{ flex: 1 }} 
                    contentContainerStyle={{ padding: spacing.lg }}
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
                                    <Trash2 size={18} color="#fff" />
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
                                        borderColor: colors.border.primary,
                                        backgroundColor: colors.background.secondary,
                                    }}
                                >
                                    <ImageIcon size={24} color={colors.primary[600]} />
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
                                        borderColor: colors.border.primary,
                                        backgroundColor: colors.background.secondary,
                                    }}
                                >
                                    <Camera size={24} color={colors.primary[600]} />
                                    <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.primary[600] }}>
                                        Camera
                                    </RNText>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Title Input */}
                    <View style={{ marginBottom: spacing.md }}>
                        <TextInput
                            label="Title"
                            value={title}
                            onChangeText={setTitle}
                            placeholder="What's this about?"
                            mode="outlined"
                            style={{ backgroundColor: colors.surface.primary }}
                            outlineColor={colors.border.primary}
                            activeOutlineColor={colors.primary[600]}
                            textColor={colors.text.primary}
                            placeholderTextColor={colors.text.tertiary}
                        />
                    </View>

                    {/* Message Input */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <TextInput
                            label="Message"
                            value={message}
                            onChangeText={setMessage}
                            placeholder="Share the details..."
                            mode="outlined"
                            multiline
                            numberOfLines={4}
                            style={{ backgroundColor: colors.surface.primary, minHeight: 120 }}
                            outlineColor={colors.border.primary}
                            activeOutlineColor={colors.primary[600]}
                            textColor={colors.text.primary}
                            placeholderTextColor={colors.text.tertiary}
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
                                        borderColor: targetType === 'all' ? colors.primary[500] : colors.border.primary,
                                        backgroundColor: targetType === 'all' ? colors.primary[500] : 'transparent',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    {targetType === 'all' && <Check size={14} color="#fff" strokeWidth={3} />}
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
                                        borderColor: targetType === 'class' ? colors.primary[500] : colors.border.primary,
                                        backgroundColor: targetType === 'class' ? colors.primary[500] : 'transparent',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    {targetType === 'class' && <Check size={14} color="#fff" strokeWidth={3} />}
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
                                        borderColor: selectedClassId ? colors.primary[500] : colors.border.primary,
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
                                    <ChevronDown size={20} color={colors.text.tertiary} />
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
                        <AlertCircle size={20} color={colors.info[600]} />
                        <RNText style={{ flex: 1, fontSize: 13, color: colors.info[700], lineHeight: 18 }}>
                            Push notifications will be sent to {targetType === 'all' ? 'all students and parents' : 'students in the selected class'} immediately after posting.
                        </RNText>
                    </View>
                </ScrollView>

                {/* Class Picker Modal */}
                <Modal
                    visible={showClassPicker}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowClassPicker(false)}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <View
                            style={{
                                backgroundColor: colors.surface.primary,
                                borderTopLeftRadius: borderRadius.xl,
                                borderTopRightRadius: borderRadius.xl,
                                maxHeight: '60%',
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: spacing.lg,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border.light,
                                }}
                            >
                                <RNText style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                                    Select Class
                                </RNText>
                                <TouchableOpacity onPress={() => setShowClassPicker(false)}>
                                    <X size={24} color={colors.text.secondary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ padding: spacing.md }}>
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
                                            <Check size={20} color={colors.primary[600]} strokeWidth={3} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </Modal>
    );
}
