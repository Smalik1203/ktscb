/**
 * ActionRequiredBanner - Prominent banner for urgent items
 * 
 * Displays collapsible list of items requiring user attention
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    FadeInDown,
    FadeOutUp,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import {
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Clock,
    CreditCard,
    BookOpen,
    TrendingDown,
    LucideIcon,
} from 'lucide-react-native';
import { safeImpact } from '../../utils/haptics';
import { useTheme } from '../../contexts/ThemeContext';

export type ActionItemType = 'overdue_task' | 'fee_due' | 'test_tomorrow' | 'low_attendance' | 'custom';

export interface ActionItem {
    id: string;
    type: ActionItemType;
    title: string;
    subtitle?: string;
    action?: { label: string; onPress: () => void };
    icon?: LucideIcon;
    priority?: 'high' | 'medium' | 'low';
}

export interface ActionRequiredBannerProps {
    items: ActionItem[];
    onDismiss?: (id: string) => void;
    maxVisible?: number;
    animationDelay?: number;
}

const getDefaultIcon = (type: ActionItemType): LucideIcon => {
    switch (type) {
        case 'overdue_task':
            return Clock;
        case 'fee_due':
            return CreditCard;
        case 'test_tomorrow':
            return BookOpen;
        case 'low_attendance':
            return TrendingDown;
        default:
            return AlertTriangle;
    }
};

const getItemColor = (type: ActionItemType, priority: string | undefined, colors: any) => {
    if (priority === 'high') {
        return {
            bg: colors.error[50],
            icon: colors.error[600],
            text: colors.error[700],
            border: colors.error[200],
        };
    }

    switch (type) {
        case 'overdue_task':
            return {
                bg: colors.error[50],
                icon: colors.error[600],
                text: colors.error[700],
                border: colors.error[200],
            };
        case 'fee_due':
            return {
                bg: colors.warning[50],
                icon: colors.warning[600],
                text: colors.warning[700],
                border: colors.warning[200],
            };
        case 'test_tomorrow':
            return {
                bg: colors.info[50],
                icon: colors.info[600],
                text: colors.info[700],
                border: colors.info[200],
            };
        case 'low_attendance':
            return {
                bg: colors.warning[50],
                icon: colors.warning[600],
                text: colors.warning[700],
                border: colors.warning[200],
            };
        default:
            return {
                bg: colors.neutral[50],
                icon: colors.neutral[600],
                text: colors.neutral[700],
                border: colors.neutral[200],
            };
    }
};

const ActionItemRow = React.memo<{
    item: ActionItem;
    colors: any;
    spacing: any;
    borderRadius: any;
    typography: any;
    isLast: boolean;
}>(({ item, colors, spacing, borderRadius, typography, isLast }) => {
    const Icon = item.icon || getDefaultIcon(item.type);
    const itemColors = getItemColor(item.type, item.priority, colors);

    const handlePress = () => {
        if (item.action?.onPress) {
            safeImpact('Light');
            item.action.onPress();
        }
    };

    return (
        <Animated.View
            entering={FadeInDown.springify()}
            exiting={FadeOutUp.springify()}
            layout={Layout.springify()}
        >
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={item.action ? 0.7 : 1}
                style={[
                    styles.itemRow,
                    {
                        backgroundColor: itemColors.bg,
                        borderRadius: borderRadius.md,
                        padding: spacing.sm,
                        marginBottom: isLast ? 0 : spacing.xs,
                        borderWidth: 1,
                        borderColor: itemColors.border,
                    },
                ]}
            >
                <View
                    style={[
                        styles.itemIconContainer,
                        {
                            backgroundColor: `${itemColors.icon}20`,
                            borderRadius: borderRadius.sm,
                            width: 32,
                            height: 32,
                            marginRight: spacing.sm,
                        },
                    ]}
                >
                    <Icon size={16} color={itemColors.icon} strokeWidth={2.5} />
                </View>
                <View style={styles.itemTextContainer}>
                    <Text
                        variant="bodyMedium"
                        style={[
                            styles.itemTitle,
                            { color: itemColors.text, fontWeight: typography.fontWeight.semibold },
                        ]}
                        numberOfLines={1}
                    >
                        {item.title}
                    </Text>
                    {item.subtitle && (
                        <Text
                            variant="bodySmall"
                            style={[styles.itemSubtitle, { color: itemColors.text, opacity: 0.8 }]}
                            numberOfLines={1}
                        >
                            {item.subtitle}
                        </Text>
                    )}
                </View>
                {item.action && (
                    <View
                        style={[
                            styles.actionButton,
                            {
                                backgroundColor: itemColors.icon,
                                borderRadius: borderRadius.sm,
                                paddingHorizontal: spacing.sm,
                                paddingVertical: 6,
                            },
                        ]}
                    >
                        <Text style={[styles.actionButtonText, { color: colors.text.inverse }]}>
                            {item.action.label}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
});

ActionItemRow.displayName = 'ActionItemRow';

export const ActionRequiredBanner = React.memo<ActionRequiredBannerProps>(({
    items,
    onDismiss,
    maxVisible = 2,
    animationDelay = 0,
}) => {
    const { colors, spacing, borderRadius, typography, shadows } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);

    if (!items || items.length === 0) return null;

    const visibleItems = isExpanded ? items : items.slice(0, maxVisible);
    const hasMore = items.length > maxVisible;

    const toggleExpanded = () => {
        safeImpact('Light');
        setIsExpanded(!isExpanded);
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(animationDelay).springify()}
            style={[
                styles.container,
                {
                    backgroundColor: colors.surface.primary,
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                    ...shadows.sm,
                    borderWidth: 0.5,
                    borderColor: colors.border.light,
                },
            ]}
        >
            {/* Header */}
            <View style={[styles.header, { marginBottom: spacing.sm }]}>
                <View style={styles.headerLeft}>
                    <AlertTriangle size={18} color={colors.warning[600]} strokeWidth={2.5} />
                    <Text
                        variant="titleSmall"
                        style={[
                            styles.headerTitle,
                            {
                                color: colors.text.primary,
                                fontWeight: typography.fontWeight.bold,
                                marginLeft: spacing.xs,
                            },
                        ]}
                    >
                        Needs Attention
                    </Text>
                </View>
                <View
                    style={[
                        styles.countBadge,
                        {
                            backgroundColor: colors.warning[100],
                            borderRadius: borderRadius.full,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.countText,
                            { color: colors.warning[700], fontWeight: typography.fontWeight.bold },
                        ]}
                    >
                        {items.length}
                    </Text>
                </View>
            </View>

            {/* Items */}
            <View style={styles.itemsContainer}>
                {visibleItems.map((item, index) => (
                    <ActionItemRow
                        key={item.id}
                        item={item}
                        colors={colors}
                        spacing={spacing}
                        borderRadius={borderRadius}
                        typography={typography}
                        isLast={index === visibleItems.length - 1 && !hasMore}
                    />
                ))}
            </View>

            {/* Expand/Collapse Button */}
            {hasMore && (
                <TouchableOpacity
                    onPress={toggleExpanded}
                    style={[
                        styles.expandButton,
                        {
                            marginTop: spacing.sm,
                            paddingVertical: spacing.xs,
                        },
                    ]}
                >
                    <Text
                        style={[
                            styles.expandButtonText,
                            { color: colors.primary[600], fontWeight: typography.fontWeight.medium },
                        ]}
                    >
                        {isExpanded ? 'Show less' : `+${items.length - maxVisible} more`}
                    </Text>
                    {isExpanded ? (
                        <ChevronUp size={16} color={colors.primary[600]} />
                    ) : (
                        <ChevronDown size={16} color={colors.primary[600]} />
                    )}
                </TouchableOpacity>
            )}
        </Animated.View>
    );
});

ActionRequiredBanner.displayName = 'ActionRequiredBanner';

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 15,
    },
    countBadge: {
        minWidth: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countText: {
        fontSize: 12,
    },
    itemsContainer: {},
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemIconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemTextContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 14,
    },
    itemSubtitle: {
        fontSize: 12,
        marginTop: 1,
    },
    actionButton: {},
    actionButtonText: {
        fontSize: 11,
        fontWeight: '600',
    },
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    expandButtonText: {
        fontSize: 13,
        marginRight: 4,
    },
});
