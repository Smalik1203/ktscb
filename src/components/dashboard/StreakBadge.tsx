/**
 * StreakBadge - Gamification element showing consecutive achievements
 * 
 * Displays streaks for attendance, tasks, or login
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withSpring,
    withRepeat,
    withTiming,
    FadeIn,
} from 'react-native-reanimated';
import { Flame, Calendar, CheckCircle2, Star } from 'lucide-react-native';
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
                    icon: Calendar,
                    color: colors.success[600],
                    bgColor: colors.success[50],
                    borderColor: colors.success[200],
                    defaultLabel: 'Day Streak',
                };
            case 'tasks':
                return {
                    icon: CheckCircle2,
                    color: colors.primary[600],
                    bgColor: colors.primary[50],
                    borderColor: colors.primary[200],
                    defaultLabel: 'On-Time Streak',
                };
            case 'login':
                return {
                    icon: Star,
                    color: colors.warning[600],
                    bgColor: colors.warning[50],
                    borderColor: colors.warning[200],
                    defaultLabel: 'Day Streak',
                };
            default:
                return {
                    icon: Flame,
                    color: colors.error[600],
                    bgColor: colors.error[50],
                    borderColor: colors.error[200],
                    defaultLabel: 'Streak',
                };
        }
    };

    const config = getTypeConfig();
    const Icon = config.icon;
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
                <Flame size={14} color={colors.error[500]} strokeWidth={2.5} />
                <Text
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
                </Text>
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
                    <Flame size={28} color={colors.error[500]} strokeWidth={2} />
                    <Text
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
                    </Text>
                </View>
                <Text
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
                </Text>
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
                    <Text style={[styles.milestoneText, { color: colors.text.inverse }]}>
                        🎉 Milestone!
                    </Text>
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
