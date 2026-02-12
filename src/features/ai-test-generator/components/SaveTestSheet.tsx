/**
 * SaveTestSheet Component
 * 
 * Bottom sheet for saving test with title, class, and subject selection.
 * Uses a simple Modal instead of BottomSheetModal for reliability.
 */

import React from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Heading, Body, Caption } from '../../../ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface SaveTestSheetProps {
    visible: boolean;
    onClose: () => void;
    testTitle: string;
    onTitleChange: (title: string) => void;
    selectedClassId: string;
    onClassSelect: (classId: string) => void;
    selectedSubjectId: string;
    onSubjectSelect: (subjectId: string) => void;
    classes: any[];
    subjects: any[];
    questionCount: number;
    onSave: () => void;
    saving: boolean;
}

export function SaveTestSheet({
    visible,
    onClose,
    testTitle,
    onTitleChange,
    selectedClassId,
    onClassSelect,
    selectedSubjectId,
    onSubjectSelect,
    classes,
    subjects,
    questionCount,
    onSave,
    saving,
}: SaveTestSheetProps) {
    const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const estimatedTime = Math.ceil(questionCount * 1);
    const isValid = testTitle.trim() && selectedClassId && selectedSubjectId;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View
                        style={[
                            styles.sheet,
                            {
                                backgroundColor: colors.surface.primary,
                                paddingBottom: insets.bottom + 16,
                            },
                        ]}
                    >
                        {/* Handle bar */}
                        <View style={styles.handleContainer}>
                            <View style={[styles.handle, { backgroundColor: colors.neutral[300] }]} />
                        </View>

                        {/* Close button */}
                        <TouchableOpacity
                            style={[styles.closeButton, { backgroundColor: colors.neutral[100] }]}
                            onPress={onClose}
                        >
                            <MaterialIcons name="close" size={20} color={colors.text.secondary} />
                        </TouchableOpacity>

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={[styles.iconContainer, { backgroundColor: colors.success[100] }]}>
                                <MaterialIcons name="save" size={24} color={colors.success[600]} />
                            </View>
                            <Heading level={3}>Save Sage Assessment</Heading>
                            <Caption color="secondary" style={{ marginTop: 4 }}>
                                Sage is ready to save {questionCount} questions
                            </Caption>
                        </View>

                        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            {/* Test Title */}
                            <View style={styles.section}>
                                <View style={styles.labelRow}>
                                    <MaterialIcons name="description" size={16} color={colors.text.tertiary} />
                                    <Body weight="semibold" style={{ marginLeft: 8 }}>Test Title *</Body>
                                </View>
                                <TextInput
                                    style={[
                                        styles.textInput,
                                        {
                                            backgroundColor: colors.surface.secondary,
                                            borderColor: testTitle ? colors.primary[300] : colors.border.light,
                                            borderRadius: borderRadius.lg,
                                            color: colors.text.primary,
                                        },
                                    ]}
                                    placeholder="e.g., Biology Chapter 3 Quiz"
                                    placeholderTextColor={colors.text.tertiary}
                                    value={testTitle}
                                    onChangeText={onTitleChange}
                                />
                            </View>

                            {/* Class Selection */}
                            <View style={styles.section}>
                                <View style={styles.labelRow}>
                                    <MaterialIcons name="group" size={16} color={colors.text.tertiary} />
                                    <Body weight="semibold" style={{ marginLeft: 8 }}>Select Class *</Body>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {classes.map((cls: any) => {
                                        const isSelected = selectedClassId === cls.id;
                                        return (
                                            <TouchableOpacity
                                                key={cls.id}
                                                onPress={() => onClassSelect(cls.id)}
                                                style={[
                                                    styles.chip,
                                                    {
                                                        backgroundColor: isSelected ? colors.primary[100] : colors.surface.secondary,
                                                        borderColor: isSelected ? colors.primary[500] : colors.border.light,
                                                        borderRadius: borderRadius.full,
                                                    },
                                                ]}
                                            >
                                                <Caption
                                                    weight={isSelected ? 'semibold' : 'normal'}
                                                    style={{ color: isSelected ? colors.primary[700] : colors.text.secondary }}
                                                >
                                                    Grade {cls.grade}-{cls.section}
                                                </Caption>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Subject Selection */}
                            <View style={styles.section}>
                                <View style={styles.labelRow}>
                                    <MaterialIcons name="menu-book" size={16} color={colors.text.tertiary} />
                                    <Body weight="semibold" style={{ marginLeft: 8 }}>Select Subject *</Body>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {subjects.map((subject: any) => {
                                        const isSelected = selectedSubjectId === subject.id;
                                        return (
                                            <TouchableOpacity
                                                key={subject.id}
                                                onPress={() => onSubjectSelect(subject.id)}
                                                style={[
                                                    styles.chip,
                                                    {
                                                        backgroundColor: isSelected ? colors.secondary[100] : colors.surface.secondary,
                                                        borderColor: isSelected ? colors.secondary[500] : colors.border.light,
                                                        borderRadius: borderRadius.full,
                                                    },
                                                ]}
                                            >
                                                <Caption
                                                    weight={isSelected ? 'semibold' : 'normal'}
                                                    style={{ color: isSelected ? colors.secondary[700] : colors.text.secondary }}
                                                >
                                                    {subject.subject_name}
                                                </Caption>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Time estimate */}
                            <View
                                style={[
                                    styles.infoCard,
                                    { backgroundColor: colors.info[50], borderRadius: borderRadius.lg },
                                ]}
                            >
                                <MaterialIcons name="schedule" size={18} color={colors.info[600]} />
                                <View style={{ marginLeft: 12, flex: 1 }}>
                                    <Caption weight="semibold" style={{ color: colors.info[700] }}>
                                        Estimated Time
                                    </Caption>
                                    <Caption color="secondary">
                                        {estimatedTime} min ({questionCount} questions × 1 min)
                                    </Caption>
                                </View>
                            </View>
                        </ScrollView>

                        {/* Save Button */}
                        <View style={styles.footer}>
                            <TouchableOpacity
                                onPress={onSave}
                                disabled={!isValid || saving}
                                activeOpacity={0.8}
                                style={{ flex: 1 }}
                            >
                                <LinearGradient
                                    colors={
                                        isValid && !saving
                                            ? [colors.success[500], colors.success[600]]
                                            : [colors.neutral[300], colors.neutral[400]]
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.saveButton, { borderRadius: borderRadius.xl }]}
                                >
                                    <MaterialIcons name="save" size={20} color={colors.text.inverse} />
                                    <Body weight="semibold" style={{ color: colors.text.inverse }}>
                                        {saving ? 'Saving...' : 'Create Sage Assessment'}
                                    </Body>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    keyboardView: {
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    section: {
        marginBottom: 20,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    textInput: {
        padding: 16,
        borderWidth: 2,
        fontSize: 16,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 10,
        borderWidth: 2,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 16,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
});

export default SaveTestSheet;
