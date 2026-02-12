/**
 * InsightCard - Contextual insight cards with visual emphasis
 * 
 * Used to display smart, actionable information on dashboards
 */

import React, { ComponentProps } from 'react';
import { View, TouchableOpacity, StyleSheet, Text as RNText } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';

export interface InsightCardProps {
    type: 'success' | 'warning' | 'info' | 'urgent' | 'neutral';
    title: string;
    message: string;
    action?: { label: string; onPress: () => void };
    icon?: ComponentProps<typeof MaterialIcons>['name'];
    animationDelay?: number;
}

export const InsightCard = React.memo<InsightCardProps>(({
    type,
    title,
    message,
    action,
    icon,
    animationDelay = 0,
}) => {
    const { colors, spacing, borderRadius, typography, shadows } = useTheme();

    const getTypeColors = () => {
        switch (type) {
            case 'success':
                return {
                    gradient: [colors.success[50], colors.success[100]],
                    iconBg: colors.success[100],
                    iconColor: colors.success[600],
                    textColor: colors.success[700],
                    borderColor: colors.success[200],
                };
            case 'warning':
                return {
                    gradient: [colors.warning[50], colors.warning[100]],
                    iconBg: colors.warning[100],
                    iconColor: colors.warning[600],
                    textColor: colors.warning[700],
                    borderColor: colors.warning[200],
                };
            case 'urgent':
                return {
                    gradient: [colors.error[50], colors.error[100]],
                    iconBg: colors.error[100],
                    iconColor: colors.error[600],
                    textColor: colors.error[700],
                    borderColor: colors.error[200],
                };
            case 'info':
                return {
                    gradient: [colors.info[50], colors.info[100]],
                    iconBg: colors.info[100],
                    iconColor: colors.info[600],
                    textColor: colors.info[700],
                    borderColor: colors.info[200],
                };
            default:
                return {
                    gradient: [colors.neutral[50], colors.neutral[100]],
                    iconBg: colors.neutral[100],
                    iconColor: colors.neutral[600],
                    textColor: colors.neutral[700],
                    borderColor: colors.neutral[200],
                };
        }
    };

    const typeColors = getTypeColors();

    const content = (
        <LinearGradient
            colors={typeColors.gradient as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
                styles.container,
                {
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: typeColors.borderColor,
                },
            ]}
        >
            <View style={styles.contentRow}>
                {icon && (
                    <View
                        style={[
                            styles.iconContainer,
                            {
                                backgroundColor: typeColors.iconBg,
                                borderRadius: borderRadius.md,
                                width: 40,
                                height: 40,
                                marginRight: spacing.sm,
                            },
                        ]}
                    >
                        <MaterialIcons name={icon} size={20} color={typeColors.iconColor} />
                    </View>
                )}
                <View style={styles.textContainer}>
                    <RNText
                        style={[
                            styles.title,
                            { color: typeColors.textColor, fontWeight: typography.fontWeight.bold },
                        ]}
                    >
                        {title}
                    </RNText>
                    <RNText
                        style={[styles.message, { color: typeColors.textColor, opacity: 0.85 }]}
                        numberOfLines={2}
                    >
                        {message}
                    </RNText>
                </View>
                {action && (
                    <View style={[styles.actionContainer, { marginLeft: spacing.sm }]}>
                        <MaterialIcons name="chevron-right" size={20} color={typeColors.iconColor} />
                    </View>
                )}
            </View>
        </LinearGradient>
    );

    const animatedContent = (
        <Animated.View entering={FadeInUp.delay(animationDelay).springify()}>
            {content}
        </Animated.View>
    );

    if (action) {
        return (
            <TouchableOpacity onPress={action.onPress} activeOpacity={0.8}>
                {animatedContent}
            </TouchableOpacity>
        );
    }

    return animatedContent;
});

InsightCard.displayName = 'InsightCard';

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        marginBottom: 2,
    },
    message: {
        lineHeight: 18,
    },
    actionContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
