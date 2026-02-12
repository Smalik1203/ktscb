/**
 * QuestionAccordion Component
 * 
 * Collapsible question cards for the review step.
 * Tap to expand/collapse, swipe to delete.
 */

import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Body, Caption, Heading } from '../../../ui';
import { GeneratedQuestion } from '../../../services/aiTestGeneratorFetch';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface QuestionAccordionProps {
    questions: GeneratedQuestion[];
    onRemoveQuestion: (index: number) => void;
}

interface QuestionItemProps {
    question: GeneratedQuestion;
    index: number;
    onRemove: () => void;
}

function QuestionItem({ question, index, onRemove }: QuestionItemProps) {
    const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const rotateAnim = useRef(new Animated.Value(0)).current;

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);

        Animated.spring(rotateAnim, {
            toValue: isExpanded ? 0 : 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
        }).start();
    };

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    // Get first 50 chars of question for preview
    const questionPreview = question.question_text.length > 50
        ? question.question_text.substring(0, 50) + '...'
        : question.question_text;

    return (
        <View
            style={[
                styles.questionCard,
                {
                    backgroundColor: colors.surface.primary,
                    borderRadius: borderRadius.lg,
                    borderLeftWidth: 4,
                    borderLeftColor: isExpanded ? colors.primary[500] : colors.neutral[300],
                    ...shadows.sm,
                },
            ]}
        >
            {/* Header (always visible) */}
            <TouchableOpacity
                onPress={toggleExpand}
                style={styles.questionHeader}
                activeOpacity={0.7}
            >
                <View style={styles.questionMeta}>
                    <View
                        style={[
                            styles.questionBadge,
                            { backgroundColor: colors.primary[100] },
                        ]}
                    >
                        <Caption weight="semibold" style={{ color: colors.primary[700] }}>
                            Q{index + 1}
                        </Caption>
                    </View>
                    {!isExpanded && (
                        <Caption color="secondary" numberOfLines={1} style={{ flex: 1 }}>
                            {questionPreview}
                        </Caption>
                    )}
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        onPress={onRemove}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={[styles.removeButton, { backgroundColor: colors.error[50] }]}
                    >
                        <MaterialIcons name="close" size={16} color={colors.error[500]} />
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                        <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
                    </Animated.View>
                </View>
            </TouchableOpacity>

            {/* Expanded content */}
            {isExpanded && (
                <View style={styles.expandedContent}>
                    {/* Full question text */}
                    <Body weight="medium" style={{ marginBottom: spacing.md, lineHeight: 24 }}>
                        {question.question_text}
                    </Body>

                    {/* Options */}
                    <View style={styles.optionsContainer}>
                        {question.options.map((option, optIndex) => {
                            const isCorrect = optIndex === question.correct_index;
                            return (
                                <View
                                    key={optIndex}
                                    style={[
                                        styles.optionRow,
                                        {
                                            backgroundColor: isCorrect
                                                ? colors.success[50]
                                                : colors.surface.secondary,
                                            borderRadius: borderRadius.md,
                                        },
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.optionBadge,
                                            {
                                                backgroundColor: isCorrect
                                                    ? colors.success[500]
                                                    : colors.neutral[200],
                                            },
                                        ]}
                                    >
                                        <Caption
                                            weight="semibold"
                                            style={{
                                                color: isCorrect ? colors.text.inverse : colors.text.secondary,
                                            }}
                                        >
                                            {String.fromCharCode(65 + optIndex)}
                                        </Caption>
                                    </View>
                                    <Body
                                        style={{
                                            flex: 1,
                                            color: isCorrect ? colors.success[700] : colors.text.primary,
                                        }}
                                    >
                                        {option}
                                    </Body>
                                    {isCorrect && (
                                        <MaterialIcons name="check" size={18} color={colors.success[600]} />
                                    )}
                                </View>
                            );
                        })}
                    </View>

                    {/* Explanation */}
                    {question.explanation && (
                        <View
                            style={[
                                styles.explanationBox,
                                {
                                    backgroundColor: colors.info[50],
                                    borderRadius: borderRadius.md,
                                    borderLeftWidth: 3,
                                    borderLeftColor: colors.info[500],
                                },
                            ]}
                        >
                            <View style={styles.explanationHeader}>
                                <MaterialIcons name="lightbulb" size={14} color={colors.info[600]} />
                                <Caption weight="semibold" style={{ color: colors.info[700], marginLeft: 6 }}>
                                    Explanation
                                </Caption>
                            </View>
                            <Caption color="secondary" style={{ marginTop: 4, lineHeight: 18 }}>
                                {question.explanation}
                            </Caption>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

export function QuestionAccordion({ questions, onRemoveQuestion }: QuestionAccordionProps) {
    const { colors, spacing } = useTheme();

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.listHeader}>
                <Heading level={5}>Generated Questions</Heading>
                <View style={[styles.countBadge, { backgroundColor: colors.primary[100] }]}>
                    <Caption weight="semibold" style={{ color: colors.primary[700] }}>
                        {questions.length}
                    </Caption>
                </View>
            </View>

            {/* Questions list */}
            {questions.map((question, index) => (
                <QuestionItem
                    key={index}
                    question={question}
                    index={index}
                    onRemove={() => onRemoveQuestion(index)}
                />
            ))}

            {/* Tip */}
            <View style={[styles.tipContainer, { backgroundColor: colors.neutral[100] }]}>
                <Caption color="tertiary" align="center">
                    Tap a question to expand • Tap ✕ to remove
                </Caption>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    countBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    questionCard: {
        marginBottom: 12,
        overflow: 'hidden',
    },
    questionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
    },
    questionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    questionBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    removeButton: {
        padding: 6,
        borderRadius: 8,
    },
    expandedContent: {
        paddingHorizontal: 14,
        paddingBottom: 14,
    },
    optionsContainer: {
        gap: 8,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
    },
    optionBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    explanationBox: {
        marginTop: 12,
        padding: 12,
    },
    explanationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tipContainer: {
        marginTop: 8,
        padding: 12,
        borderRadius: 8,
    },
});

export default QuestionAccordion;
