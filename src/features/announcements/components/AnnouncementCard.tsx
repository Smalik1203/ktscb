import React from 'react';
import { View, Text as RNText, TouchableOpacity, Alert } from 'react-native';
import { MessageSquare, Pin, Trash2, Users, GraduationCap, Bell } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import type { Announcement } from '../../../hooks/useAnnouncements';
import { useDeleteAnnouncement, useTogglePin, useSendReminder } from '../../../hooks/useAnnouncements';
import { useAuth } from '../../../contexts/AuthContext';

interface AnnouncementCardProps {
    announcement: Announcement;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
    const { colors, spacing, borderRadius, typography, shadows } = useTheme();
    const { profile } = useAuth();
    const deleteMutation = useDeleteAnnouncement();
    const togglePinMutation = useTogglePin();
    const sendReminderMutation = useSendReminder();

    const isCreator = profile?.auth_id === announcement.created_by;
    const canManage = profile?.role === 'admin' || profile?.role === 'superadmin';

    // Priority styling
    const getPriorityConfig = () => {
        switch (announcement.priority) {
            case 'urgent':
                return { emoji: '🚨', color: colors.error[600], bg: colors.error[50], label: 'URGENT' };
            case 'high':
                return { emoji: '⚠️', color: colors.warning[600], bg: colors.warning[50], label: 'Important' };
            case 'medium':
                return { emoji: '📢', color: colors.primary[600], bg: colors.primary[50], label: 'Announcement' };
            case 'low':
                return { emoji: 'ℹ️', color: colors.text.tertiary, bg: colors.background.secondary, label: 'Info' };
        }
    };

    const priorityConfig = getPriorityConfig();

    // Time ago formatting
    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Announcement',
            'Are you sure you want to delete this announcement?',
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
        togglePinMutation.mutate({
            id: announcement.id,
            pinned: !announcement.pinned,
        });
    };

    const handleSendReminder = () => {
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
        <View
            style={{
                backgroundColor: colors.background.primary,
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: announcement.pinned ? 2 : 1,
                borderColor: announcement.pinned ? colors.primary[500] : colors.border.primary,
                ...shadows.sm,
            }}
        >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm }}>
                {/* Priority Badge */}
                <View
                    style={{
                        backgroundColor: priorityConfig.bg,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: borderRadius.md,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                        flex: 1,
                    }}
                >
                    <RNText style={{ fontSize: 16 }}>{priorityConfig.emoji}</RNText>
                    <RNText
                        style={{
                            fontSize: typography.fontSize.sm,
                            fontWeight: typography.fontWeight.semibold,
                            color: priorityConfig.color,
                        }}
                    >
                        {priorityConfig.label}
                    </RNText>
                </View>

                {/* Actions */}
                {canManage && (
                    <View style={{ flexDirection: 'row', gap: spacing.xs, marginLeft: spacing.sm }}>
                        {isCreator && (
                            <>
                                <TouchableOpacity
                                    onPress={handleSendReminder}
                                    disabled={sendReminderMutation.isPending}
                                    style={{
                                        padding: spacing.xs,
                                        borderRadius: borderRadius.md,
                                        backgroundColor: colors.background.secondary,
                                        opacity: sendReminderMutation.isPending ? 0.5 : 1,
                                    }}
                                >
                                    <Bell size={18} color={colors.primary[600]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleTogglePin}
                                    style={{
                                        padding: spacing.xs,
                                        borderRadius: borderRadius.md,
                                        backgroundColor: announcement.pinned ? colors.primary[100] : colors.background.secondary,
                                    }}
                                >
                                    <Pin
                                        size={18}
                                        color={announcement.pinned ? colors.primary[600] : colors.text.secondary}
                                        fill={announcement.pinned ? colors.primary[600] : 'none'}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleDelete}
                                    style={{
                                        padding: spacing.xs,
                                        borderRadius: borderRadius.md,
                                        backgroundColor: colors.background.secondary,
                                    }}
                                >
                                    <Trash2 size={18} color={colors.error[600]} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>

            {/* Title */}
            <RNText
                style={{
                    fontSize: typography.fontSize.lg,
                    fontWeight: typography.fontWeight.bold,
                    color: colors.text.primary,
                    marginBottom: spacing.xs,
                }}
            >
                {announcement.title}
            </RNText>

            {/* Message */}
            <RNText
                style={{
                    fontSize: typography.fontSize.base,
                    color: colors.text.secondary,
                    lineHeight: 22,
                    marginBottom: spacing.sm,
                }}
            >
                {announcement.message}
            </RNText>

            {/* Footer */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Author & Time */}
                <View style={{ flex: 1 }}>
                    <RNText style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary }}>
                        Posted by {announcement.creator?.full_name || 'Unknown'} • {getTimeAgo(announcement.created_at)}
                    </RNText>
                </View>

                {/* Target Audience */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                        backgroundColor: colors.background.secondary,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: borderRadius.md,
                    }}
                >
                    {announcement.target_type === 'all' ? (
                        <>
                            <Users size={14} color={colors.text.tertiary} />
                            <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary }}>
                                All Students
                            </RNText>
                        </>
                    ) : (
                        <>
                            <GraduationCap size={14} color={colors.text.tertiary} />
                            <RNText style={{ fontSize: typography.fontSize.xs, color: colors.text.tertiary }}>
                                {announcement.class
                                    ? `Grade ${announcement.class.grade}${announcement.class.section ? `-${announcement.class.section}` : ''}`
                                    : 'Class'
                                }
                            </RNText>
                        </>
                    )}
                </View>
            </View>

            {/* Pinned Indicator */}
            {announcement.pinned && (
                <View
                    style={{
                        position: 'absolute',
                        top: -8,
                        right: spacing.md,
                        backgroundColor: colors.primary[600],
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 4,
                        borderRadius: borderRadius.full,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        ...shadows.md,
                    }}
                >
                    <Pin size={12} color={colors.text.inverse} fill={colors.text.inverse} />
                    <RNText
                        style={{
                            fontSize: typography.fontSize.xs,
                            fontWeight: typography.fontWeight.bold,
                            color: colors.text.inverse,
                        }}
                    >
                        PINNED
                    </RNText>
                </View>
            )}
        </View>
    );
}
