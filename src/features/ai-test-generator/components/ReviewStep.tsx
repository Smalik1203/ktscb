/**
 * ReviewStep Component
 * 
 * Step 3 of the AI Test Generator wizard.
 * Review generated questions and save as test.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { CheckCircle2, ArrowLeft, Save, Sparkles } from 'lucide-react-native';
import { Heading, Body, Caption } from '../../../ui';
import { QuestionAccordion } from './QuestionAccordion';
import { GeneratedQuestion } from '../../../services/aiTestGeneratorFetch';
import { LinearGradient } from 'expo-linear-gradient';

export interface ReviewStepProps {
    questions: GeneratedQuestion[];
    onRemoveQuestion: (index: number) => void;
    onBack: () => void;
    onSave: () => void;
}

export function ReviewStep({
    questions,
    onRemoveQuestion,
    onBack,
    onSave,
}: ReviewStepProps) {
    const { colors, spacing, borderRadius, shadows } = useTheme();

    return (
        <View style={styles.container}>
            {/* Success Header */}
            <View style={styles.header}>
                <View style={[styles.successIcon, { backgroundColor: colors.success[100] }]}>
                    <CheckCircle2 size={32} color={colors.success[600]} />
                </View>
                <Heading level={3} align="center">Questions Ready!</Heading>
                <Body color="secondary" align="center" style={{ marginTop: spacing.xs }}>
                    Review your AI-generated questions below
                </Body>
            </View>

            {/* Stats Card */}
            <View
                style={[
                    styles.statsCard,
                    {
                        backgroundColor: colors.primary[50],
                        borderRadius: borderRadius.xl,
                        borderWidth: 1,
                        borderColor: colors.primary[100],
                    },
                ]}
            >
                <View style={styles.statItem}>
                    <Heading level={2} style={{ color: colors.primary[600] }}>
                        {questions.length}
                    </Heading>
                    <Caption color="secondary">Questions</Caption>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.primary[200] }]} />
                <View style={styles.statItem}>
                    <Heading level={2} style={{ color: colors.primary[600] }}>
                        {questions.length}
                    </Heading>
                    <Caption color="secondary">Minutes</Caption>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.primary[200] }]} />
                <View style={styles.statItem}>
                    <Sparkles size={24} color={colors.primary[600]} />
                    <Caption color="secondary">AI Generated</Caption>
                </View>
            </View>

            {/* Questions List */}
            <ScrollView style={styles.questionsScroll} showsVerticalScrollIndicator={false}>
                <QuestionAccordion
                    questions={questions}
                    onRemoveQuestion={onRemoveQuestion}
                />
            </ScrollView>

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
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onSave}
                    style={{ flex: 1 }}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[colors.success[500], colors.success[600]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.saveButton, { borderRadius: borderRadius.xl }]}
                    >
                        <Save size={20} color={colors.text.inverse} />
                        <Body weight="semibold" style={{ color: colors.text.inverse }}>
                            Save Sage Assessment
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
        paddingTop: 16,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    successIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    statsCard: {
        flexDirection: 'row',
        padding: 16,
        marginBottom: 20,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        marginVertical: 4,
    },
    questionsScroll: {
        flex: 1,
        marginBottom: 12,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
    },
    backButton: {
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        gap: 8,
    },
});

export default ReviewStep;
