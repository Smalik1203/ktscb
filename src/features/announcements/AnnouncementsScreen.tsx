import React, { useState } from 'react';
import {
    View,
    Text as RNText,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { useAnnouncementsFeed } from '../../hooks/useAnnouncements';
import { AnnouncementCard } from './components/AnnouncementCard';
import { CreateAnnouncementModal } from './components/CreateAnnouncementModal';
import { FAB } from '../../ui';

export default function AnnouncementsScreen() {
    const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
    const { profile } = useAuth();
    const { can } = useCapabilities();
    const insets = useSafeAreaInsets();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
        isRefetching,
        isLoading,
    } = useAnnouncementsFeed(profile?.school_code || undefined);

    const handleEdit = (announcement: any) => {
        setEditingAnnouncement(announcement);
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setEditingAnnouncement(null);
    };

    const canPost = can('announcements.create');
    const announcements = data?.pages.flatMap((page: any) => page.announcements) || [];

    const renderEmpty = () => {
        if (isLoading) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
                    <ActivityIndicator size="large" color={colors.primary[600]} />
                    <RNText style={{ marginTop: spacing.lg, color: colors.text.secondary, fontSize: 15 }}>
                        Loading announcements...
                    </RNText>
                </View>
            );
        }

        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
                {/* Empty State Illustration */}
                <View
                    style={{
                        width: 120,
                        height: 120,
                        borderRadius: 60,
                        backgroundColor: colors.primary[50],
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: spacing.xl,
                    }}
                >
                    <MaterialIcons name="campaign" size={56} color={colors.primary[400]} />
                </View>

                <RNText
                    style={{
                        fontSize: 24,
                        fontWeight: '700',
                        color: colors.text.primary,
                        marginBottom: spacing.sm,
                        textAlign: 'center',
                    }}
                >
                    No Announcements Yet
                </RNText>

                <RNText
                    style={{
                        fontSize: 16,
                        color: colors.text.secondary,
                        textAlign: 'center',
                        marginBottom: spacing.xl,
                        paddingHorizontal: spacing.xl,
                        lineHeight: 24,
                    }}
                >
                    {canPost
                        ? 'Be the first to share news with your school community!'
                        : 'Check back later for updates from your school.'}
                </RNText>

                {canPost && (
                    <TouchableOpacity
                        onPress={() => setShowCreateModal(true)}
                        activeOpacity={0.8}
                    >
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: spacing.sm,
                                paddingHorizontal: spacing.xl,
                                paddingVertical: spacing.md,
                                borderRadius: borderRadius.full,
                                backgroundColor: colors.primary[600],
                                ...shadows.md,
                            }}
                        >
                            <MaterialIcons name="add" size={20} color="#fff" />
                            <RNText style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                                Create First Announcement
                            </RNText>
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderFooter = () => {
        if (!isFetchingNextPage) return null;

        return (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
                <RNText style={{ marginTop: spacing.sm, fontSize: 13, color: colors.text.tertiary }}>
                    Loading more...
                </RNText>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.surface.primary }}>
            {/* Feed - Instagram/Twitter style */}
            <FlatList
                data={announcements}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <AnnouncementCard announcement={item} onEdit={handleEdit} />}
                contentContainerStyle={{
                    paddingBottom: spacing.xl + (canPost ? 80 : 0),
                    flexGrow: 1,
                }}
                ItemSeparatorComponent={() => (
                    <View style={{ 
                        height: 12, 
                        backgroundColor: colors.background.secondary,
                        borderTopWidth: 1,
                        borderBottomWidth: 1,
                        borderColor: colors.border.light,
                    }} />
                )}
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
                showsVerticalScrollIndicator={false}
            />

            {/* Floating Action Button */}
            <FAB
                icon="add"
                onPress={() => setShowCreateModal(true)}
                visible={canPost && announcements.length > 0}
            />

            {/* Create/Edit Modal */}
            <CreateAnnouncementModal
                visible={showCreateModal}
                onClose={handleCloseModal}
                editingAnnouncement={editingAnnouncement}
            />
        </View>
    );
}
