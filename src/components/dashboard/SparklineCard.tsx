/**
 * SparklineCard - Enhanced stat card with embedded mini trend chart
 * 
 * Displays key metrics with visual trend indicators and sparkline
 */

import React, { ComponentProps, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Text as RNText } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { safeImpact } from '../../utils/haptics';
import { useTheme } from '../../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SparklineCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: { direction: 'up' | 'down' | 'neutral'; percentage: number };
    sparklineData?: number[];
    color: string;
    bgColor: string;
    icon: ComponentProps<typeof MaterialIcons>['name'];
    onPress?: () => void;
    smartLabel?: string;
    animationDelay?: number;
    fullWidth?: boolean;
}

const Sparkline = React.memo<{
    data: number[];
    color: string;
    width: number;
    height: number;
}>(({ data, color, width, height }) => {
    const path = useMemo(() => {
        if (!data || data.length < 2) return '';

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const padding = 4;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const points = data.map((value, index) => {
            const x = padding + (index / (data.length - 1)) * chartWidth;
            const y = padding + chartHeight - ((value - min) / range) * chartHeight;
            return { x, y };
        });

        let pathD = `M ${points[0].x} ${points[0].y}`;

        // Create smooth curve using cubic bezier
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpx1 = prev.x + (curr.x - prev.x) / 3;
            const cpx2 = prev.x + (2 * (curr.x - prev.x)) / 3;
            pathD += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
        }

        return pathD;
    }, [data, width, height]);

    if (!data || data.length < 2) return null;

    return (
        <Svg width={width} height={height}>
            <Defs>
                <SvgGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <Stop offset="100%" stopColor={color} stopOpacity={0.05} />
                </SvgGradient>
            </Defs>
            <Path
                d={path}
                stroke={color}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
});

Sparkline.displayName = 'Sparkline';

export const SparklineCard = React.memo<SparklineCardProps>(({
    title,
    value,
    subtitle,
    trend,
    sparklineData,
    color,
    bgColor,
    icon,
    onPress,
    smartLabel,
    animationDelay = 0,
    fullWidth = false,
}) => {
    const { colors, spacing, borderRadius, typography, shadows } = useTheme();

    const handlePress = () => {
        if (onPress) {
            safeImpact(Haptics.ImpactFeedbackStyle.Light);
            onPress();
        }
    };

    const getTrendIcon = () => {
        if (!trend) return null;

        const trendColor = trend.direction === 'up'
            ? colors.success[600]
            : trend.direction === 'down'
                ? colors.error[600]
                : colors.neutral[500];

        const trendIconName: ComponentProps<typeof MaterialIcons>['name'] = trend.direction === 'up'
            ? 'trending-up'
            : trend.direction === 'down'
                ? 'trending-down'
                : 'remove';

        return (
            <View style={[styles.trendContainer, { backgroundColor: `${trendColor}15`, borderRadius: borderRadius.sm }]}>
                <MaterialIcons name={trendIconName} size={12} color={trendColor} />
                <RNText style={[styles.trendText, { color: trendColor, marginLeft: 2 }]}>
                    {trend.percentage > 0 ? '+' : ''}{trend.percentage}%
                </RNText>
            </View>
        );
    };

    const content = (
        <Animated.View
            entering={FadeInUp.delay(animationDelay).springify()}
            style={[
                styles.card,
                {
                    flex: 1,
                    backgroundColor: colors.surface.primary,
                    borderRadius: borderRadius.lg,
                    padding: spacing.md,
                    ...shadows.sm,
                    borderWidth: 0.5,
                    borderColor: colors.border.light,
                },
            ]}
        >
            {/* Header with Icon */}
            <View style={styles.header}>
                <View
                    style={[
                        styles.iconContainer,
                        {
                            backgroundColor: bgColor,
                            borderRadius: borderRadius.md,
                            width: 44,
                            height: 44,
                        },
                    ]}
                >
                    <MaterialIcons name={icon} size={22} color={color} />
                </View>
                {getTrendIcon()}
            </View>

            {/* Value */}
            <RNText
                style={[
                    styles.value,
                    {
                        color: colors.text.primary,
                        fontWeight: typography.fontWeight.bold,
                        marginTop: spacing.md,
                        marginBottom: spacing.xs,
                    },
                ]}
            >
                {value}
            </RNText>

            {/* Title */}
            <RNText
                style={[
                    styles.title,
                    {
                        color: colors.text.secondary,
                        fontWeight: typography.fontWeight.medium,
                    },
                ]}
            >
                {title}
            </RNText>

            {/* Subtitle or Smart Label */}
            {(subtitle || smartLabel) && (
                <View
                    style={[
                        styles.labelContainer,
                        {
                            backgroundColor: color,
                            borderRadius: borderRadius.sm,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 4,
                            marginTop: spacing.sm,
                            alignSelf: 'flex-start',
                        },
                    ]}
                >
                    <RNText
                        style={[
                            styles.labelText,
                            {
                                color: colors.text.inverse,
                                fontSize: 11,
                                fontWeight: typography.fontWeight.semibold,
                            },
                        ]}
                    >
                        {smartLabel || subtitle}
                    </RNText>
                </View>
            )}
        </Animated.View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
                {content}
            </TouchableOpacity>
        );
    }

    return content;
});

SparklineCard.displayName = 'SparklineCard';

const styles = StyleSheet.create({
    card: {
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    iconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    trendText: {
        fontSize: 11,
        fontWeight: '600',
    },
    sparklineContainer: {
        overflow: 'hidden',
    },
    value: {
        fontSize: 28,
    },
    title: {
        fontSize: 13,
    },
    labelContainer: {
        alignSelf: 'flex-start',
    },
    labelText: {
        textAlign: 'center',
    },
});
