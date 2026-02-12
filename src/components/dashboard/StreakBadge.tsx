/**
 * StreakBadge - Gamification element showing consecutive achievements
 * 
 * Displays streaks for attendance, tasks, or login
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withSpring,
    withRepeat,
    withTiming,
    FadeIn,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';

export type StreakType = 'attendance' | 'tasks' | 'login';

export interface StreakBadgeProps {
    count: number;
    type: StreakType;
    showCelebration?: boolean;
    compact?: boolean;
    label?: string;
}

const getMilestone = (count: number): number | null => {
    const milestones = [7, 14, 30, 50, 100];
    if (milestones.includes(count)) return count;
    return null;
};

export const StreakBadge = React.memo<StreakBadgeProps>(({
    count,
    type,
    showCelebration = false,
    compact = false,
    label,
}) => {
    const { colors, spacing, borderRadius, typography } = useTheme();
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    const isMilestone = getMilestone(count) !== null;

    useEffect(() => {
        if (showCelebration || isMilestone) {
            scale.value = withSequence(
                withSpring(1.2, { damping: 4 }),
                withSpring(1, { damping: 6 })
            );
        }
    }, [showCelebration, isMilestone, count]);

    useEffect(() => {
        // Subtle pulse animation for active streaks
        if (count > 0) {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 1000 }),
                    withTiming(1, { duration: 1000 })
                ),
                -1,
                true
            );
        }
    }, [count]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const getTypeConfig = () => {
        switch (type) {
            case 'attendance':
                return {
                    icon: 'event' as const,
                    color: colors.success[600],
                    bgColor: colors.success[50],
                    borderColor: colors.success[200],
                    defaultLabel: 'Day Streak',
                };
            case 'tasks':
                return {
                    icon: 'check-circle' as const,
                    color: colors.primary[600],
                    bgColor: colors.primary[50],
                    borderColor: colors.primary[200],
                    defaultLabel: 'On-Time Streak',
                };
            case 'login':
                return {
                    icon: 'star' as const,
                    color: colors.warning[600],
                    bgColor: colors.warning[50],
                    borderColor: colors.warning[200],
                    defaultLabel: 'Day Streak',
                };
            default:
                return {
                    icon: 'local-fire-department' as const,
                    color: colors.error[600],
                    bgColor: colors.error[50],
                    borderColor: colors.error[200],
                    defaultLabel: 'Streak',
                };
        }
    };

    const config = getTypeConfig();
    const displayLabel = label || config.defaultLabel;

    if (count === 0) return null;

    if (compact) {
        return (
            <Animated.View
                entering={FadeIn}
                style={[
                    animatedStyle,
                    styles.compactContainer,
                    {
                        backgroundColor: config.bgColor,
                        borderRadius: borderRadius.full,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 4,
                        borderWidth: 1,
                        borderColor: config.borderColor,
                    },
                ]}
            >
                <MaterialIcons name="local-fire-department" size={14} color={colors.error[500]} />
                <RNText
                    style={[
                        styles.compactText,
                        {
                            color: config.color,
                            fontWeight: typography.fontWeight.bold,
                            marginLeft: 4,
                        },
                    ]}
                >
                    {count}
                </RNText>
            </Animated.View>
        );
    }

    return (
        <Animated.View
            entering={FadeIn}
            style={[
                animatedStyle,
                styles.container,
                {
                    backgroundColor: config.bgColor,
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: config.borderColor,
                },
            ]}
        >
            {/* Fire Icon with Count */}
            <View style={styles.mainContent}>
                <View style={styles.iconRow}>
                    <MaterialIcons name="local-fire-department" size={28} color={colors.error[500]} />
                    <RNText
                        style={[
                            styles.countText,
                            {
                                color: config.color,
                                fontWeight: typography.fontWeight.bold,
                                marginLeft: spacing.xs,
                            },
                        ]}
                    >
                        {count}
                    </RNText>
                </View>
                <RNText
                    style={[
                        styles.labelText,
                        {
                            color: config.color,
                            fontWeight: typography.fontWeight.medium,
                            marginTop: spacing.xs,
                        },
                    ]}
                >
                    {displayLabel}
                </RNText>
            </View>

            {/* Milestone Badge */}
            {isMilestone && (
                <View
                    style={[
                        styles.milestoneBadge,
                        {
                            backgroundColor: config.color,
                            borderRadius: borderRadius.sm,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2,
                            marginTop: spacing.sm,
                        },
                    ]}
                >
                    <RNText style={[styles.milestoneText, { color: colors.text.inverse }]}>
                        🎉 Milestone!
                    </RNText>
                </View>
            )}
        </Animated.View>
    );
});

StreakBadge.displayName = 'StreakBadge';

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    compactText: {
        fontSize: 13,
    },
    mainContent: {
        alignItems: 'center',
    },
    iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    countText: {
        fontSize: 32,
    },
    labelText: {
        fontSize: 13,
    },
    milestoneBadge: {},
    milestoneText: {
        fontSize: 11,
        fontWeight: '600',
    },
});
