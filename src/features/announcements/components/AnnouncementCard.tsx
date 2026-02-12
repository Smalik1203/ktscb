import React, { useState } from 'react';
import { View, Text as RNText, TouchableOpacity, Alert, Image, Dimensions, Modal } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { Menu, IconButton } from '../../../ui';
import type { Announcement } from '../../../hooks/useAnnouncements';
import { useDeleteAnnouncement, useTogglePin, useSendReminder } from '../../../hooks/useAnnouncements';
import { useAuth } from '../../../contexts/AuthContext';
import { useCapabilities } from '../../../hooks/useCapabilities';

interface AnnouncementCardProps {
    announcement: Announcement;
    onEdit?: (announcement: Announcement) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function AnnouncementCard({ announcement, onEdit }: AnnouncementCardProps) {
    const { colors, spacing, borderRadius, shadows } = useTheme();
    const { profile } = useAuth();
    const { can } = useCapabilities();
    const deleteMutation = useDeleteAnnouncement();
    const togglePinMutation = useTogglePin();
    const sendReminderMutation = useSendReminder();
    const [showMenu, setShowMenu] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);

    const isCreator = profile?.auth_id === announcement.created_by;
    const canManage = can('announcements.manage');

    // Priority styling
    const getPriorityConfig = () => {
        switch (announcement.priority) {
            case 'urgent':
                return { 
                    emoji: '🚨', 
                    color: colors.error[600], 
                    bg: colors.error[50], 
                    label: 'URGENT',
                    borderColor: colors.error[400],
                };
            case 'high':
                return { 
                    emoji: '⚠️', 
                    color: colors.warning[600], 
                    bg: colors.warning[50], 
                    label: 'Important',
                    borderColor: colors.warning[400],
                };
            case 'medium':
                return { 
                    emoji: '📢', 
                    color: colors.primary[600], 
                    bg: colors.primary[50], 
                    label: 'Announcement',
                    borderColor: colors.primary[400],
                };
            case 'low':
                return { 
                    emoji: 'ℹ️', 
                    color: colors.info[600], 
                    bg: colors.info[50], 
                    label: 'Info',
                    borderColor: colors.info[400],
                };
        }
    };

    const priorityConfig = getPriorityConfig();

    // Time ago formatting
    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleEdit = () => {
        setShowMenu(false);
        if (onEdit) {
            onEdit(announcement);
        }
    };

    const handleDelete = () => {
        setShowMenu(false);
        Alert.alert(
            'Delete Announcement',
            'Are you sure you want to delete this announcement? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteMutation.mutate(announcement.id),
                },
            ]
        );
    };

    const handleTogglePin = () => {
        setShowMenu(false);
        togglePinMutation.mutate({
            id: announcement.id,
            pinned: !announcement.pinned,
        });
    };

    const handleSendReminder = () => {
        setShowMenu(false);
        Alert.alert(
            'Send Reminder',
            'This will resend the notification to all originally targeted users. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: () => {
                        sendReminderMutation.mutate(announcement.id, {
                            onSuccess: (data) => {
                                Alert.alert(
                                    'Reminder Sent',
                                    data?.message || `Notification sent to ${data?.notified || 0} user(s)`
                                );
                            },
                            onError: (error) => {
                                Alert.alert(
                                    'Failed to Send Reminder',
                                    error instanceof Error ? error.message : 'An error occurred'
                                );
                            },
                        });
                    },
                },
            ]
        );
    };

    return (
        <>
            <View
                style={{
                    backgroundColor: colors.surface.primary,
                    paddingBottom: spacing.md,
                }}
            >
                {/* Header */}
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    padding: spacing.md,
                    paddingBottom: spacing.sm,
                }}>
                    {/* Profile Avatar */}
                    <View
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: priorityConfig.bg,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 2,
                            borderColor: announcement.pinned ? colors.primary[500] : 'transparent',
                        }}
                    >
                        <RNText style={{ fontSize: 18, fontWeight: '700', color: priorityConfig.color }}>
                            {announcement.creator?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </RNText>
                    </View>

                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        {/* Name and pinned indicator */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <RNText style={{ 
                                fontSize: 15, 
                                fontWeight: '700', 
                                color: colors.text.primary,
                            }}>
                                {announcement.creator?.full_name || 'Unknown'}
                            </RNText>
                            {announcement.pinned && (
                                <MaterialIcons name="push-pin" size={14} color={colors.primary[500]} />
                            )}
                        </View>

                        {/* Target and time */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {announcement.target_type === 'all' ? (
                                <RNText style={{ fontSize: 13, color: colors.text.tertiary }}>
                                    To everyone
                                </RNText>
                            ) : (
                                <RNText style={{ fontSize: 13, color: colors.text.tertiary }}>
                                    To {announcement.class ? `Class ${announcement.class.grade}-${announcement.class.section || ''}` : 'Class'}
                                </RNText>
                            )}
                            <RNText style={{ fontSize: 13, color: colors.text.tertiary }}>•</RNText>
                            <RNText style={{ fontSize: 13, color: colors.text.tertiary }}>
                                {getTimeAgo(announcement.created_at)}
                            </RNText>
                        </View>
                    </View>

                    {/* Priority Badge - shows for all posts */}
                    <View style={{
                        backgroundColor: priorityConfig.bg,
                        paddingVertical: 4,
                        paddingHorizontal: spacing.sm,
                        borderRadius: borderRadius.full,
                        marginRight: spacing.sm,
                    }}>
                        <RNText style={{ 
                            fontSize: 11, 
                            fontWeight: '700', 
                            color: priorityConfig.color,
                            textTransform: 'uppercase',
                        }}>
                            {priorityConfig.emoji} {priorityConfig.label}
                        </RNText>
                    </View>

                    {/* Overflow menu */}
                    {canManage && isCreator && (
                        <Menu
                            visible={showMenu}
                            onDismiss={() => setShowMenu(false)}
                            anchor={
                                <IconButton
                                    icon="more-vert"
                                    variant="ghost"
                                    size="sm"
                                    onPress={() => setShowMenu(true)}
                                />
                            }
                        >
                            <Menu.Item title="Edit" icon="edit" onPress={handleEdit} />
                            <Menu.Item
                                title="Send Reminder"
                                icon="notifications"
                                onPress={handleSendReminder}
                                disabled={sendReminderMutation.isPending}
                            />
                            <Menu.Item
                                title={announcement.pinned ? 'Unpin' : 'Pin to top'}
                                icon="push-pin"
                                onPress={handleTogglePin}
                            />
                            <Menu.Divider />
                            <Menu.Item title="Delete" icon="delete" onPress={handleDelete} destructive />
                        </Menu>
                    )}
                </View>

                {/* Content Text */}
                <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
                    <RNText
                        style={{
                            fontSize: 16,
                            fontWeight: '500',
                            color: colors.text.primary,
                            lineHeight: 24,
                        }}
                    >
                        {announcement.message}
                    </RNText>
                </View>

                {/* Image - Full width */}
                {announcement.image_url && (
                    <TouchableOpacity 
                        activeOpacity={0.95} 
                        onPress={() => setShowImageModal(true)}
                        style={{ marginTop: spacing.xs }}
                    >
                        <Image
                            source={{ uri: announcement.image_url }}
                            style={{
                                width: SCREEN_WIDTH,
                                height: SCREEN_WIDTH * 0.75,
                                backgroundColor: colors.background.secondary,
                            }}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>
                )}
            </View>

            {/* Image Fullscreen Modal */}
            <Modal
                visible={showImageModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowImageModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => setShowImageModal(false)}
                        style={{
                            position: 'absolute',
                            top: 50,
                            right: 16,
                            zIndex: 10,
                            padding: spacing.sm,
                        }}
                    >
                        <MaterialIcons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    {announcement.image_url && (
                        <Image
                            source={{ uri: announcement.image_url }}
                            style={{
                                width: SCREEN_WIDTH,
                                height: SCREEN_WIDTH,
                            }}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </>
    );
}
