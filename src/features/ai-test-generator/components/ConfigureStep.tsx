/**
 * ConfigureStep Component
 * 
 * Step 2 of the AI Test Generator wizard.
 * Configure question count and additional context.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { Settings2, ArrowLeft, Zap, ImageIcon } from 'lucide-react-native';
import { Heading, Body, Caption } from '../../../ui';
import { LinearGradient } from 'expo-linear-gradient';

export interface ConfigureStepProps {
    selectedImage: string | null;
    questionCount: number;
    onQuestionCountChange: (count: number) => void;
    additionalContext: string;
    onContextChange: (context: string) => void;
    onBack: () => void;
    onGenerate: () => void;
    isGenerating: boolean;
}

const QUESTION_OPTIONS = [5, 10, 15, 20];

export function ConfigureStep({
    selectedImage,
    questionCount,
    onQuestionCountChange,
    additionalContext,
    onContextChange,
    onBack,
    onGenerate,
    isGenerating,
}: ConfigureStepProps) {
    const { colors, spacing, borderRadius, shadows, isDark } = useTheme();

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: colors.secondary[100] }]}>
                    <Settings2 size={24} color={colors.secondary[600]} />
                </View>
                <Heading level={3} align="center">Configure Sage</Heading>
                <Body color="secondary" align="center" style={{ marginTop: spacing.xs }}>
                    Customize how questions are generated
                </Body>
            </View>

            {/* Image Preview (small) */}
            {selectedImage && (
                <View style={[styles.imagePreviewSmall, { borderRadius: borderRadius.lg, ...shadows.sm }]}>
                    <Image source={{ uri: selectedImage }} style={styles.imageThumb} />
                    <View style={styles.imageInfo}>
                        <View style={[styles.imageBadge, { backgroundColor: colors.success[100] }]}>
                            <ImageIcon size={12} color={colors.success[600]} />
                        </View>
                        <Caption color="secondary">Image ready</Caption>
                    </View>
                </View>
            )}

            {/* Question Count */}
            <View style={styles.section}>
                <Body weight="semibold" style={{ marginBottom: spacing.md }}>
                    Number of Questions
                </Body>
                <View style={styles.countGrid}>
                    {QUESTION_OPTIONS.map((count) => {
                        const isSelected = questionCount === count;
                        return (
                            <TouchableOpacity
                                key={count}
                                onPress={() => onQuestionCountChange(count)}
                                style={[
                                    styles.countOption,
                                    {
                                        backgroundColor: isSelected
                                            ? colors.primary[50]
                                            : colors.surface.secondary,
                                        borderColor: isSelected
                                            ? colors.primary[500]
                                            : colors.border.light,
                                        borderRadius: borderRadius.lg,
                                    },
                                ]}
                            >
                                <Heading
                                    level={4}
                                    style={{ color: isSelected ? colors.primary[600] : colors.text.secondary }}
                                >
                                    {count}
                                </Heading>
                                <Caption
                                    style={{
                                        color: isSelected ? colors.primary[600] : colors.text.tertiary,
                                        marginTop: 2,
                                    }}
                                >
                                    questions
                                </Caption>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Context Input */}
            <View style={styles.section}>
                <Body weight="semibold" style={{ marginBottom: spacing.sm }}>
                    Focus Area (Optional)
                </Body>
                <Caption color="tertiary" style={{ marginBottom: spacing.sm }}>
                    Guide the AI to focus on specific topics
                </Caption>
                <TextInput
                    style={[
                        styles.contextInput,
                        {
                            backgroundColor: colors.surface.secondary,
                            borderColor: colors.border.light,
                            borderRadius: borderRadius.lg,
                            color: colors.text.primary,
                        },
                    ]}
                    placeholder="e.g., Focus on photosynthesis, include definitions..."
                    placeholderTextColor={colors.text.tertiary}
                    value={additionalContext}
                    onChangeText={onContextChange}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                />
            </View>

            {/* Estimated Time */}
            <View
                style={[
                    styles.estimateCard,
                    { backgroundColor: colors.info[50], borderRadius: borderRadius.lg },
                ]}
            >
                <Caption color="secondary" align="center">
                    ⏱️ Estimated time: ~{Math.ceil(questionCount * 3)} seconds
                </Caption>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
                <TouchableOpacity
                    onPress={onBack}
                    style={[
                        styles.backButton,
                        {
                            borderColor: colors.border.DEFAULT,
                            borderRadius: borderRadius.xl,
                        },
                    ]}
                >
                    <ArrowLeft size={20} color={colors.text.secondary} />
                    <Body color="secondary">Back</Body>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onGenerate}
                    disabled={isGenerating}
                    style={{ flex: 1 }}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={
                            isGenerating
                                ? [colors.neutral[400], colors.neutral[500]]
                                : [colors.primary[600], colors.secondary[500]]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.generateButton, { borderRadius: borderRadius.xl }]}
                    >
                        <Zap size={20} color={colors.text.inverse} />
                        <Body weight="semibold" style={{ color: colors.text.inverse }}>
                            {isGenerating ? 'Sage is thinking...' : 'Ask Sage to Generate'}
                        </Body>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    imagePreviewSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.02)',
        marginBottom: 24,
    },
    imageThumb: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
    imageInfo: {
        marginLeft: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    imageBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    section: {
        marginBottom: 24,
    },
    countGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    countOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        borderWidth: 2,
    },
    contextInput: {
        padding: 16,
        minHeight: 100,
        borderWidth: 1,
        fontSize: 15,
    },
    estimateCard: {
        padding: 12,
        marginBottom: 24,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderWidth: 1,
        gap: 8,
    },
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
});

export default ConfigureStep;
