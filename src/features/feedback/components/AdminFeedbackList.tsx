import React, { useState, useMemo } from 'react';
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
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
    useFeedbackReceived,
    useAcknowledgeFeedback,
    SENTIMENT_OPTIONS,
    CATEGORY_LABELS,
    Sentiment,
    FeedbackCategory
} from '../../../hooks/useFeedback';

type FilterType = 'all' | 'positive' | 'needs_improvement';

/**
 * AdminFeedbackList - Shows feedback received by admin/teacher
 * Student identity is hidden (uses admin-safe view)
 */
export function AdminFeedbackList() {
    const { colors, spacing, borderRadius, shadows } = useTheme();
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();
    const [filter, setFilter] = useState<FilterType>('all');

    const { data: feedback, isLoading, refetch, isRefetching } = useFeedbackReceived(profile?.auth_id);
    const acknowledgeMutation = useAcknowledgeFeedback();

    // Filter feedback based on selected filter
    const filteredFeedback = useMemo(() => {
        if (!feedback) return [];
        if (filter === 'all') return feedback;
        return feedback.filter((f: any) => f.sentiment === filter);
    }, [feedback, filter]);

    const handleAcknowledge = async (feedbackId: string) => {
        try {
            await acknowledgeMutation.mutateAsync(feedbackId);
        } catch (error) {
            // Acknowledge failed - alert shown
        }
    };

    const getSentimentStyle = (sentiment: Sentiment | null) => {
        const option = SENTIMENT_OPTIONS.find(o => o.value === sentiment);
        return {
            color: option?.color || colors.text.tertiary,
            label: option?.label || 'Unknown',
        };
    };

    const renderFilterChip = (type: FilterType, label: string) => {
        const isActive = filter === type;
        return (
            <TouchableOpacity
                onPress={() => setFilter(type)}
                style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: borderRadius.full,
                    backgroundColor: isActive ? colors.primary[600] : colors.background.secondary,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary[600] : colors.border.light,
                }}
            >
                <RNText style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isActive ? '#fff' : colors.text.secondary,
                }}>
                    {label}
                </RNText>
            </TouchableOpacity>
        );
    };

    const renderFeedbackCard = ({ item }: { item: any }) => {
        const sentimentStyle = getSentimentStyle(item.sentiment);
        const isAcknowledged = !!item.acknowledged_at;

        return (
            <View
                style={{
                    backgroundColor: colors.surface.primary,
                    borderRadius: borderRadius.lg,
                    padding: spacing.lg,
                    marginBottom: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.border.light,
                    ...shadows.sm,
                }}
            >
                {/* Header Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                    {/* Category Badge */}
                    <View
                        style={{
                            paddingHorizontal: spacing.sm,
                            paddingVertical: spacing.xs,
                            backgroundColor: colors.neutral[100],
                            borderRadius: borderRadius.sm,
                        }}
                    >
                        <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.text.secondary }}>
                            {CATEGORY_LABELS[item.category as FeedbackCategory] || item.category}
                        </RNText>
                    </View>

                    {/* Sentiment Indicator */}
                    <View
                        style={{
                            marginLeft: spacing.sm,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: spacing.xs,
                            backgroundColor: sentimentStyle.color + '15',
                            borderRadius: borderRadius.sm,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                        }}
                    >
                        <View
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: sentimentStyle.color,
                            }}
                        />
                        <RNText style={{ fontSize: 12, fontWeight: '600', color: sentimentStyle.color }}>
                            {sentimentStyle.label}
                        </RNText>
                    </View>

                    {/* Spacer */}
                    <View style={{ flex: 1 }} />

                    {/* Acknowledged Status */}
                    {isAcknowledged && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <MaterialIcons name="check" size={14} color={colors.success[600]} />
                            <RNText style={{ fontSize: 11, color: colors.success[600], fontWeight: '600' }}>
                                Acknowledged
                            </RNText>
                        </View>
                    )}
                </View>

                {/* Feedback Content */}
                <RNText style={{ fontSize: 15, color: colors.text.primary, lineHeight: 22, marginBottom: spacing.md }}>
                    {item.content}
                </RNText>

                {/* Metadata Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                    {item.subject_name && (
                        <RNText style={{ fontSize: 12, color: colors.text.tertiary }}>
                            📚 {item.subject_name}
                        </RNText>
                    )}
                    {item.grade && (
                        <RNText style={{ fontSize: 12, color: colors.text.tertiary }}>
                            🎓 Class {item.grade}{item.section ? `-${item.section}` : ''}
                        </RNText>
                    )}
                    <RNText style={{ fontSize: 12, color: colors.text.tertiary }}>
                        📅 {new Date(item.created_at).toLocaleDateString()}
                    </RNText>
                </View>

                {/* Acknowledge Button */}
                {!isAcknowledged && (
                    <TouchableOpacity
                        onPress={() => handleAcknowledge(item.id)}
                        disabled={acknowledgeMutation.isPending}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: spacing.xs,
                            paddingVertical: spacing.sm,
                            borderRadius: borderRadius.md,
                            backgroundColor: colors.primary[50],
                            borderWidth: 1,
                            borderColor: colors.primary[200],
                        }}
                    >
                        {acknowledgeMutation.isPending ? (
                            <ActivityIndicator size="small" color={colors.primary[600]} />
                        ) : (
                            <>
                                <MaterialIcons name="check" size={16} color={colors.primary[600]} />
                                <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.primary[600] }}>
                                    Acknowledge
                                </RNText>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderEmpty = () => {
        if (isLoading) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
                    <ActivityIndicator size="large" color={colors.primary[600]} />
                    <RNText style={{ marginTop: spacing.lg, color: colors.text.secondary }}>
                        Loading feedback...
                    </RNText>
                </View>
            );
        }

        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
                <View
                    style={{
                        width: 100,
                        height: 100,
                        borderRadius: 50,
                        backgroundColor: colors.neutral[100],
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: spacing.xl,
                    }}
                >
                    <MaterialIcons name="chat" size={48} color={colors.neutral[400]} />
                </View>
                <RNText style={{ fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm }}>
                    No Feedback Yet
                </RNText>
                <RNText style={{ fontSize: 15, color: colors.text.secondary, textAlign: 'center', paddingHorizontal: spacing.xl }}>
                    You haven't received any student feedback. Check back later!
                </RNText>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background.secondary }}>
            {/* Filter Bar */}
            <View style={{ backgroundColor: colors.surface.primary, padding: spacing.lg, paddingTop: spacing.md }}>
                {/* Filter Chips */}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {renderFilterChip('all', 'All')}
                    {renderFilterChip('positive', 'Positive')}
                    {renderFilterChip('needs_improvement', 'Needs Improvement')}
                </View>
            </View>

            {/* Feedback List */}
            <FlatList
                data={filteredFeedback}
                keyExtractor={(item, index) => item.id ?? `feedback-${index}`}
                renderItem={renderFeedbackCard}
                contentContainerStyle={{
                    padding: spacing.lg,
                    paddingBottom: insets.bottom + spacing.xl,
                    flexGrow: 1,
                }}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={colors.primary[600]}
                        colors={[colors.primary[600]]}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}
