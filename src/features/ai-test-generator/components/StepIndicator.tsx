/**
 * StepIndicator Component
 * 
 * Horizontal step progress indicator with animations.
 * Shows current step with animated line/dot transitions.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { Check } from 'lucide-react-native';

export interface StepIndicatorProps {
    currentStep: number;
    totalSteps: number;
    labels?: string[];
}

export function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
    const { colors, spacing, borderRadius } = useTheme();
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(progressAnim, {
            toValue: currentStep,
            tension: 50,
            friction: 8,
            useNativeDriver: false,
        }).start();
    }, [currentStep, progressAnim]);

    const renderStep = (stepIndex: number) => {
        const isCompleted = stepIndex < currentStep;
        const isCurrent = stepIndex === currentStep;
        const isUpcoming = stepIndex > currentStep;

        // Animated scale for current step
        const scaleAnim = useRef(new Animated.Value(1)).current;

        useEffect(() => {
            if (isCurrent) {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(scaleAnim, {
                            toValue: 1.1,
                            duration: 800,
                            useNativeDriver: true,
                        }),
                        Animated.timing(scaleAnim, {
                            toValue: 1,
                            duration: 800,
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
            } else {
                scaleAnim.setValue(1);
            }
        }, [isCurrent, scaleAnim]);

        return (
            <View key={stepIndex} style={styles.stepContainer}>
                <Animated.View
                    style={[
                        styles.stepDot,
                        {
                            backgroundColor: isCompleted
                                ? colors.success[500]
                                : isCurrent
                                    ? colors.primary[600]
                                    : colors.neutral[200],
                            transform: [{ scale: isCurrent ? scaleAnim : 1 }],
                            borderWidth: isCurrent ? 3 : 0,
                            borderColor: colors.primary[200],
                        },
                    ]}
                >
                    {isCompleted ? (
                        <Check size={14} color={colors.text.inverse} strokeWidth={3} />
                    ) : (
                        <View
                            style={[
                                styles.stepDotInner,
                                {
                                    backgroundColor: isCurrent ? colors.text.inverse : 'transparent',
                                },
                            ]}
                        />
                    )}
                </Animated.View>
                {labels && labels[stepIndex] && (
                    <Animated.Text
                        style={[
                            styles.stepLabel,
                            {
                                color: isCurrent
                                    ? colors.primary[600]
                                    : isCompleted
                                        ? colors.success[600]
                                        : colors.text.tertiary,
                                fontWeight: isCurrent ? '600' : '400',
                            },
                        ]}
                    >
                        {labels[stepIndex]}
                    </Animated.Text>
                )}
            </View>
        );
    };

    const renderConnector = (index: number) => {
        const isCompleted = index < currentStep;

        // Calculate progress for this connector (0 to 1)
        const connectorProgress = progressAnim.interpolate({
            inputRange: [index, index + 1],
            outputRange: ['0%', '100%'],
            extrapolate: 'clamp',
        });

        return (
            <View key={`connector-${index}`} style={styles.connectorContainer}>
                <View
                    style={[
                        styles.connector,
                        { backgroundColor: colors.neutral[200] },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.connectorFill,
                        {
                            backgroundColor: colors.success[500],
                            width: isCompleted ? '100%' : connectorProgress,
                        },
                    ]}
                />
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {Array.from({ length: totalSteps }).map((_, index) => (
                <React.Fragment key={index}>
                    {renderStep(index)}
                    {index < totalSteps - 1 && renderConnector(index)}
                </React.Fragment>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    stepContainer: {
        alignItems: 'center',
        minWidth: 60,
    },
    stepDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepDotInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    stepLabel: {
        fontSize: 11,
        marginTop: 6,
        textAlign: 'center',
    },
    connectorContainer: {
        flex: 1,
        height: 28,
        justifyContent: 'center',
        marginHorizontal: -4,
    },
    connector: {
        height: 3,
        borderRadius: 1.5,
    },
    connectorFill: {
        position: 'absolute',
        height: 3,
        borderRadius: 1.5,
        left: 0,
    },
});

export default StepIndicator;
