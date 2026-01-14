import React, { useState } from 'react';
import {
    View,
    Text as RNText,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCreateAnnouncement } from '../../../hooks/useAnnouncements';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

interface CreateAnnouncementModalProps {
    visible: boolean;
    onClose: () => void;
}

export function CreateAnnouncementModal({ visible, onClose }: CreateAnnouncementModalProps) {
    const { colors, spacing, borderRadius, typography, shadows } = useTheme();
    const { profile } = useAuth();
    const createMutation = useCreateAnnouncement();

    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [targetType, setTargetType] = useState<'all' | 'class'>('all');
    const [selectedClassId, setSelectedClassId] = useState<string>('');

    // Fetch classes for selection
    const { data: classes } = useQuery({
        queryKey: ['classes', profile?.school_code],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('class_instances')
                .select('id, class_name')
                .eq('school_code', profile?.school_code!)
                .order('class_name');

            if (error) throw error;
            return data || [];
        },
        enabled: !!profile?.school_code && visible,
    });

    const handleSubmit = async () => {
        if (!title.trim() || !message.trim()) {
            Alert.alert('Error', 'Please fill in title and message');
            return;
        }

        if (targetType === 'class' && !selectedClassId) {
            Alert.alert('Error', 'Please select a class');
            return;
        }

        try {
            await createMutation.mutateAsync({
                title: title.trim(),
                message: message.trim(),
                priority,
                target_type: targetType,
                class_instance_id: targetType === 'class' ? selectedClassId : undefined,
                school_code: profile?.school_code!,
                created_by: profile?.auth_id!,
            });

            // Reset form
            setTitle('');
            setMessage('');
            setPriority('medium');
            setTargetType('all');
            setSelectedClassId('');

            onClose();
            Alert.alert('Success', 'Announcement posted successfully! 📢');
        } catch (error) {
            Alert.alert('Error', 'Failed to post announcement');
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'flex-end',
                }}
            >
                <View
                    style={{
                        backgroundColor: colors.background.primary,
                        borderTopLeftRadius: borderRadius.xl,
                        borderTopRightRadius: borderRadius.xl,
                        maxHeight: '90%',
                        ...shadows.lg,
                    }}
                >
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: spacing.lg,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border.primary,
                        }}
                    >
                        <RNText
                            style={{
                                fontSize: typography.fontSize.xl,
                                fontWeight: typography.fontWeight.bold,
                                color: colors.text.primary,
                            }}
                        >
                            📢 New Announcement
                        </RNText>
                        <TouchableOpacity onPress={onClose} style={{ padding: spacing.xs }}>
                            <X size={24} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ padding: spacing.lg }}>
                        {/* Title Input */}
                        <View style={{ marginBottom: spacing.lg }}>
                            <RNText
                                style={{
                                    fontSize: typography.fontSize.sm,
                                    fontWeight: typography.fontWeight.semibold,
                                    color: colors.text.secondary,
                                    marginBottom: spacing.xs,
                                }}
                            >
                                Title
                            </RNText>
                            <TextInput
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Enter announcement title..."
                                placeholderTextColor={colors.text.tertiary}
                                style={{
                                    backgroundColor: colors.background.secondary,
                                    borderRadius: borderRadius.md,
                                    padding: spacing.md,
                                    fontSize: typography.fontSize.base,
                                    color: colors.text.primary,
                                    borderWidth: 1,
                                    borderColor: colors.border.primary,
                                }}
                            />
                        </View>

                        {/* Message Input */}
                        <View style={{ marginBottom: spacing.lg }}>
                            <RNText
                                style={{
                                    fontSize: typography.fontSize.sm,
                                    fontWeight: typography.fontWeight.semibold,
                                    color: colors.text.secondary,
                                    marginBottom: spacing.xs,
                                }}
                            >
                                Message
                            </RNText>
                            <TextInput
                                value={message}
                                onChangeText={setMessage}
                                placeholder="What's happening?"
                                placeholderTextColor={colors.text.tertiary}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                style={{
                                    backgroundColor: colors.background.secondary,
                                    borderRadius: borderRadius.md,
                                    padding: spacing.md,
                                    fontSize: typography.fontSize.base,
                                    color: colors.text.primary,
                                    borderWidth: 1,
                                    borderColor: colors.border.primary,
                                    minHeight: 120,
                                }}
                            />
                        </View>

                        {/* Priority Selection */}
                        <View style={{ marginBottom: spacing.lg }}>
                            <RNText
                                style={{
                                    fontSize: typography.fontSize.sm,
                                    fontWeight: typography.fontWeight.semibold,
                                    color: colors.text.secondary,
                                    marginBottom: spacing.sm,
                                }}
                            >
                                Priority
                            </RNText>
                            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                                {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                                    <TouchableOpacity
                                        key={p}
                                        onPress={() => setPriority(p)}
                                        style={{
                                            paddingHorizontal: spacing.md,
                                            paddingVertical: spacing.sm,
                                            borderRadius: borderRadius.full,
                                            backgroundColor: priority === p ? colors.primary[600] : colors.background.secondary,
                                            borderWidth: 1,
                                            borderColor: priority === p ? colors.primary[600] : colors.border.primary,
                                        }}
                                    >
                                        <RNText
                                            style={{
                                                fontSize: typography.fontSize.sm,
                                                fontWeight: typography.fontWeight.medium,
                                                color: priority === p ? colors.text.inverse : colors.text.secondary,
                                                textTransform: 'capitalize',
                                            }}
                                        >
                                            {p === 'urgent' && '🚨 '}
                                            {p === 'high' && '⚠️ '}
                                            {p === 'medium' && '📢 '}
                                            {p === 'low' && 'ℹ️ '}
                                            {p}
                                        </RNText>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Target Audience */}
                        <View style={{ marginBottom: spacing.lg }}>
                            <RNText
                                style={{
                                    fontSize: typography.fontSize.sm,
                                    fontWeight: typography.fontWeight.semibold,
                                    color: colors.text.secondary,
                                    marginBottom: spacing.sm,
                                }}
                            >
                                Target Audience
                            </RNText>
                            <View style={{ gap: spacing.sm }}>
                                <TouchableOpacity
                                    onPress={() => setTargetType('all')}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: spacing.md,
                                        borderRadius: borderRadius.md,
                                        backgroundColor: targetType === 'all' ? colors.primary[50] : colors.background.secondary,
                                        borderWidth: 2,
                                        borderColor: targetType === 'all' ? colors.primary[600] : colors.border.primary,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 10,
                                            borderWidth: 2,
                                            borderColor: targetType === 'all' ? colors.primary[600] : colors.border.primary,
                                            backgroundColor: targetType === 'all' ? colors.primary[600] : 'transparent',
                                            marginRight: spacing.sm,
                                        }}
                                    />
                                    <RNText
                                        style={{
                                            fontSize: typography.fontSize.base,
                                            fontWeight: typography.fontWeight.medium,
                                            color: targetType === 'all' ? colors.primary[700] : colors.text.primary,
                                        }}
                                    >
                                        👥 All Students
                                    </RNText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setTargetType('class')}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: spacing.md,
                                        borderRadius: borderRadius.md,
                                        backgroundColor: targetType === 'class' ? colors.primary[50] : colors.background.secondary,
                                        borderWidth: 2,
                                        borderColor: targetType === 'class' ? colors.primary[600] : colors.border.primary,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 10,
                                            borderWidth: 2,
                                            borderColor: targetType === 'class' ? colors.primary[600] : colors.border.primary,
                                            backgroundColor: targetType === 'class' ? colors.primary[600] : 'transparent',
                                            marginRight: spacing.sm,
                                        }}
                                    />
                                    <RNText
                                        style={{
                                            fontSize: typography.fontSize.base,
                                            fontWeight: typography.fontWeight.medium,
                                            color: targetType === 'class' ? colors.primary[700] : colors.text.primary,
                                        }}
                                    >
                                        🎓 Specific Class
                                    </RNText>
                                </TouchableOpacity>

                                {/* Class Selection */}
                                {targetType === 'class' && (
                                    <View style={{ marginTop: spacing.sm, paddingLeft: spacing.lg }}>
                                        <ScrollView style={{ maxHeight: 200 }}>
                                            {classes?.map((cls) => (
                                                <TouchableOpacity
                                                    key={cls.id}
                                                    onPress={() => setSelectedClassId(cls.id)}
                                                    style={{
                                                        padding: spacing.md,
                                                        borderRadius: borderRadius.md,
                                                        backgroundColor: selectedClassId === cls.id ? colors.primary[100] : colors.background.secondary,
                                                        marginBottom: spacing.xs,
                                                        borderWidth: 1,
                                                        borderColor: selectedClassId === cls.id ? colors.primary[600] : colors.border.primary,
                                                    }}
                                                >
                                                    <RNText
                                                        style={{
                                                            fontSize: typography.fontSize.base,
                                                            fontWeight: selectedClassId === cls.id ? typography.fontWeight.semibold : typography.fontWeight.normal,
                                                            color: selectedClassId === cls.id ? colors.primary[700] : colors.text.primary,
                                                        }}
                                                    >
                                                        {cls.class_name}
                                                    </RNText>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer Buttons */}
                    <View
                        style={{
                            flexDirection: 'row',
                            gap: spacing.md,
                            padding: spacing.lg,
                            borderTopWidth: 1,
                            borderTopColor: colors.border.primary,
                        }}
                    >
                        <TouchableOpacity
                            onPress={onClose}
                            style={{
                                flex: 1,
                                padding: spacing.md,
                                borderRadius: borderRadius.lg,
                                backgroundColor: colors.background.secondary,
                                alignItems: 'center',
                            }}
                        >
                            <RNText
                                style={{
                                    fontSize: typography.fontSize.base,
                                    fontWeight: typography.fontWeight.semibold,
                                    color: colors.text.secondary,
                                }}
                            >
                                Cancel
                            </RNText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={createMutation.isPending}
                            style={{
                                flex: 1,
                                padding: spacing.md,
                                borderRadius: borderRadius.lg,
                                backgroundColor: createMutation.isPending ? colors.primary[400] : colors.primary[600],
                                alignItems: 'center',
                                ...shadows.md,
                            }}
                        >
                            {createMutation.isPending ? (
                                <ActivityIndicator color={colors.text.inverse} />
                            ) : (
                                <RNText
                                    style={{
                                        fontSize: typography.fontSize.base,
                                        fontWeight: typography.fontWeight.bold,
                                        color: colors.text.inverse,
                                    }}
                                >
                                    Post 📢
                                </RNText>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
