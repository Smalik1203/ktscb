/**
 * Dashboard Skeleton Component
 * 
 * A beautiful loading skeleton that matches the Dashboard layout.
 * Shows placeholder UI while data is loading.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Skeleton, SkeletonCard, SkeletonAvatar } from '../../ui';
import { Stack, Container } from '../../ui';

export interface DashboardSkeletonProps {
    /** Show header section */
    showHeader?: boolean;
    /** Number of stat cards */
    statCardCount?: number;
    /** Number of quick actions */
    quickActionCount?: number;
    /** Show tasks section */
    showTasks?: boolean;
}

export function DashboardSkeleton({
    showHeader = true,
    statCardCount = 4,
    quickActionCount = 4,
    showTasks = true,
}: DashboardSkeletonProps) {
    const { colors, spacing, borderRadius, shadows, isDark } = useTheme();

    // Card style
    const cardStyle = {
        backgroundColor: colors.surface.primary,
        borderRadius: borderRadius.card,
        padding: spacing.lg,
        ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.sm),
    };

    // Stat card style
    const statCardStyle = {
        ...cardStyle,
        width: '48%' as const,
        marginBottom: spacing.md,
    };

    return (
        <Container padding="lg" background="primary" flex>
            {/* Header Section */}
            {showHeader && (
                <View style={styles.headerSection}>
                    <View style={styles.headerLeft}>
                        <Skeleton width={180} height={28} variant="rounded" />
                        <View style={{ height: spacing.xs }} />
                        <Skeleton width={120} height={16} variant="rounded" />
                    </View>
                    <SkeletonAvatar size="lg" />
                </View>
            )}

            {/* Stat Cards Grid */}
            <View style={[styles.statsGrid, { marginTop: spacing.lg }]}>
                {Array.from({ length: statCardCount }).map((_, index) => (
                    <View key={`stat-${index}`} style={statCardStyle}>
                        <Skeleton width={40} height={40} variant="rounded" />
                        <View style={{ height: spacing.sm }} />
                        <Skeleton width="60%" height={24} variant="rounded" />
                        <View style={{ height: spacing.xs }} />
                        <Skeleton width="40%" height={14} variant="rounded" />
                    </View>
                ))}
            </View>

            {/* Quick Actions Section */}
            <View style={[cardStyle, { marginTop: spacing.md }]}>
                <Skeleton width={120} height={20} variant="rounded" />
                <View style={{ height: spacing.md }} />
                <View style={styles.quickActionsGrid}>
                    {Array.from({ length: quickActionCount }).map((_, index) => (
                        <View key={`action-${index}`} style={styles.quickAction}>
                            <Skeleton variant="circle" size={48} />
                            <View style={{ height: spacing.xs }} />
                            <Skeleton width={60} height={12} variant="rounded" />
                        </View>
                    ))}
                </View>
            </View>

            {/* Tasks Section */}
            {showTasks && (
                <View style={[cardStyle, { marginTop: spacing.md }]}>
                    <View style={styles.sectionHeader}>
                        <Skeleton width={100} height={20} variant="rounded" />
                        <Skeleton width={60} height={16} variant="rounded" />
                    </View>
                    <View style={{ height: spacing.md }} />
                    {[1, 2, 3].map((i) => (
                        <View key={`task-${i}`} style={[styles.taskItem, { marginBottom: i < 3 ? spacing.sm : 0 }]}>
                            <Skeleton variant="circle" size={24} />
                            <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                <Skeleton width="80%" height={16} variant="rounded" />
                                <View style={{ height: 4 }} />
                                <Skeleton width="50%" height={12} variant="rounded" />
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </Container>
    );
}

/**
 * List Skeleton Component
 * 
 * A reusable skeleton for list-based screens.
 */
export interface ListSkeletonProps {
    /** Number of items to show */
    itemCount?: number;
    /** Show avatars */
    showAvatar?: boolean;
    /** Show secondary text */
    showSecondaryText?: boolean;
}

export function ListSkeleton({
    itemCount = 5,
    showAvatar = true,
    showSecondaryText = true,
}: ListSkeletonProps) {
    const { colors, spacing, borderRadius, shadows, isDark } = useTheme();

    const itemStyle = {
        backgroundColor: colors.surface.primary,
        borderRadius: borderRadius.card,
        padding: spacing.md,
        marginBottom: spacing.sm,
        ...(isDark ? { borderWidth: 1, borderColor: colors.border.light } : shadows.sm),
    };

    return (
        <Container padding="lg" background="primary" flex>
            {Array.from({ length: itemCount }).map((_, index) => (
                <View key={`list-item-${index}`} style={itemStyle}>
                    <View style={styles.listItemContent}>
                        {showAvatar && <SkeletonAvatar size="md" />}
                        <View style={{ flex: 1, marginLeft: showAvatar ? spacing.md : 0 }}>
                            <Skeleton width="70%" height={18} variant="rounded" />
                            {showSecondaryText && (
                                <>
                                    <View style={{ height: spacing.xs }} />
                                    <Skeleton width="50%" height={14} variant="rounded" />
                                </>
                            )}
                        </View>
                        <Skeleton width={60} height={24} variant="rounded" />
                    </View>
                </View>
            ))}
        </Container>
    );
}

const styles = StyleSheet.create({
    headerSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flex: 1,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    quickAction: {
        width: '23%',
        alignItems: 'center',
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    listItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default DashboardSkeleton;
