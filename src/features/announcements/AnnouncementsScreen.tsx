import React, { useState } from 'react';
import {
    View,
    Text as RNText,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { Plus, MessageSquare } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAnnouncementsFeed } from '../../hooks/useAnnouncements';
import { AnnouncementCard } from './components/AnnouncementCard';
import { CreateAnnouncementModal } from './components/CreateAnnouncementModal';

export default function AnnouncementsScreen() {
    const { colors, spacing, borderRadius, typography, shadows } = useTheme();
    const { profile } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
        isRefetching,
        isLoading,
    } = useAnnouncementsFeed(profile?.school_code);

    const canPost = profile?.role === 'admin' || profile?.role === 'superadmin';

    const announcements = data?.pages.flatMap((page) => page.announcements) || [];

    const renderEmpty = () => {
        if (isLoading) {
            return (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary[600]} />
                    <RNText style={{ marginTop: spacing.md, color: colors.text.secondary }}>
                        Loading announcements...
                    </RNText>
                </View>
            );
        }

        return (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <MessageSquare size={64} color={colors.text.tertiary} strokeWidth={1.5} />
                <RNText
                    style={{
                        fontSize: typography.fontSize.xl,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.text.primary,
                        marginTop: spacing.lg,
                        marginBottom: spacing.sm,
                    }}
                >
                    No Announcements Yet
                </RNText>
                <RNText
                    style={{
                        fontSize: typography.fontSize.base,
                        color: colors.text.secondary,
                        textAlign: 'center',
                        marginBottom: spacing.lg,
                    }}
                >
                    {canPost
                        ? 'Be the first to post an announcement!'
                        : 'Check back later for updates from your school.'}
                </RNText>
                {canPost && (
                    <TouchableOpacity
                        onPress={() => setShowCreateModal(true)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.sm,
                            backgroundColor: colors.primary[600],
                            paddingHorizontal: spacing.lg,
                            paddingVertical: spacing.md,
                            borderRadius: borderRadius.lg,
                            ...shadows.md,
                        }}
                    >
                        <Plus size={20} color={colors.text.inverse} />
                        <RNText
                            style={{
                                fontSize: typography.fontSize.base,
                                fontWeight: typography.fontWeight.bold,
                                color: colors.text.inverse,
                            }}
                        >
                            Create Announcement
                        </RNText>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderFooter = () => {
        if (!isFetchingNextPage) return null;

        return (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
            {/* Header with New Post Button */}
            {canPost && announcements.length > 0 && (
                <View
                    style={{
                        padding: spacing.md,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.primary,
                        backgroundColor: colors.background.primary,
                    }}
                >
                    <TouchableOpacity
                        onPress={() => setShowCreateModal(true)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: spacing.sm,
                            backgroundColor: colors.primary[600],
                            paddingVertical: spacing.md,
                            borderRadius: borderRadius.lg,
                            ...shadows.md,
                        }}
                    >
                        <Plus size={20} color={colors.text.inverse} />
                        <RNText
                            style={{
                                fontSize: typography.fontSize.base,
                                fontWeight: typography.fontWeight.bold,
                                color: colors.text.inverse,
                            }}
                        >
                            New Announcement
                        </RNText>
                    </TouchableOpacity>
                </View>
            )}

            {/* Feed */}
            <FlatList
                data={announcements}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <AnnouncementCard announcement={item} />}
                contentContainerStyle={{
                    padding: spacing.md,
                    paddingBottom: spacing.xl,
                }}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={colors.primary[600]}
                        colors={[colors.primary[600]]}
                    />
                }
                onEndReached={() => {
                    if (hasNextPage && !isFetchingNextPage) {
                        fetchNextPage();
                    }
                }}
                onEndReachedThreshold={0.5}
            />

            {/* Create Modal */}
            <CreateAnnouncementModal
                visible={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
        </View>
    );
}
