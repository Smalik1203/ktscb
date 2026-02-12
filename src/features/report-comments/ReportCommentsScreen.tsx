/**
 * ReportCommentsScreen - AI-generated report card comments
 * 
 * Features:
 * - Class selection
 * - AI comment generation with quality controls
 * - Review, edit, and approve workflow
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    Animated,
    TextInput,
    Alert,
    RefreshControl,
    Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card, ProgressBar } from '../../ui';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useClasses } from '../../hooks/useClasses';
import { useStudents } from '../../hooks/useStudents';
import type { ThemeColors } from '../../theme/types';
import { spacing, typography, borderRadius, shadows } from '../../../lib/design-system';
import { supabase } from '../../lib/supabase';

// Types
interface CommentSettings {
    tone: 'professional' | 'friendly' | 'encouraging';
    focus: 'academic' | 'behavioral' | 'holistic';
    language: 'english' | 'hindi' | 'bilingual';
}

interface GeneratedComment {
    id: string;
    studentId: string;
    studentName: string;
    studentCode?: string;
    generatedComment: string;
    editedComment?: string;
    inputData: any;
    wordCount: number;
    positivityScore: number;
    status: 'draft' | 'approved' | 'rejected';
    approvedAt?: string;
    createdAt: string;
}

export default function ReportCommentsScreen() {
    const { colors, isDark } = useTheme();
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    // State
    const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
    const [showClassPicker, setShowClassPicker] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
    const [comments, setComments] = useState<GeneratedComment[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingComment, setEditingComment] = useState<GeneratedComment | null>(null);
    const [editedText, setEditedText] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [settings, setSettings] = useState<CommentSettings>({
        tone: 'friendly',
        focus: 'holistic',
        language: 'english',
    });

    // Animation
    const slideAnim = React.useRef(new Animated.Value(0)).current;
    const overlayOpacity = React.useRef(new Animated.Value(0)).current;

    // Fetch classes
    const { data: classes = [] } = useClasses(profile?.school_code || '');

    // Fetch students for selected class
    const { data: studentsData } = useStudents(selectedClassId, profile?.school_code || undefined);
    const students = studentsData?.data || [];

    // Filter comments by search
    const filteredComments = useMemo(() => {
        if (!searchQuery.trim()) return comments;
        const q = searchQuery.toLowerCase();
        return comments.filter(c =>
            c.studentName.toLowerCase().includes(q) ||
            c.studentCode?.toLowerCase().includes(q)
        );
    }, [comments, searchQuery]);

    // Stats
    const stats = useMemo(() => ({
        total: comments.length,
        approved: comments.filter(c => c.status === 'approved').length,
        draft: comments.filter(c => c.status === 'draft').length,
    }), [comments]);

    // Animation effects
    useEffect(() => {
        if (showClassPicker) {
            slideAnim.setValue(0);
            overlayOpacity.setValue(0);
            Animated.parallel([
                Animated.timing(overlayOpacity, {
                    toValue: 1,
                    duration: 280,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 1,
                    tension: 65,
                    friction: 10,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [showClassPicker]);

    // Get selected class name
    const getSelectedClassName = () => {
        if (!selectedClassId) return 'Select Class';
        const cls = classes.find((c: any) => c.id === selectedClassId);
        return cls ? `Grade ${cls.grade}-${cls.section}` : 'Select Class';
    };

    // Generate comments
    const handleGenerateComments = async () => {
        if (!selectedClassId || students.length === 0) {
            Alert.alert('Missing Selection', 'Please select a class first.');
            return;
        }

        setIsGenerating(true);
        setGenerationProgress({ current: 0, total: students.length });
        const generatedComments: GeneratedComment[] = [];

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Not authenticated');
            }

            for (let i = 0; i < students.length; i++) {
                const student = students[i];
                setGenerationProgress({ current: i + 1, total: students.length });

                try {
                    const response = await fetch(
                        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-report-comment`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify({
                                studentId: student.id,
                                classInstanceId: selectedClassId,
                                schoolCode: profile?.school_code,
                                tone: settings.tone,
                                focus: settings.focus,
                                language: settings.language,
                            }),
                        }
                    );

                    if (!response.ok) {
                        const error = await response.json();
                        // Generation failed for this student - continue with next
                        continue;
                    }

                    const data = await response.json();
                    if (data.comment) {
                        generatedComments.push({
                            id: data.comment.id || crypto.randomUUID(),
                            studentId: student.id,
                            studentName: student.full_name,
                            studentCode: student.student_code,
                            generatedComment: data.comment.generatedComment,
                            inputData: data.comment.inputData,
                            wordCount: data.comment.wordCount,
                            positivityScore: data.comment.positivityScore,
                            status: 'draft',
                            createdAt: new Date().toISOString(),
                        });
                    }
                } catch (error) {
                    // Generation error for this student - continue with next
                }
            }

            setComments(generatedComments);
            Alert.alert('Generation Complete', `Generated ${generatedComments.length} comments.`);
        } catch (error) {
            Alert.alert('Error', 'Failed to generate comments. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Approve comment
    const handleApprove = async (comment: GeneratedComment, edited?: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const { error } = await (supabase.rpc as any)('approve_report_comment', {
                p_comment_id: comment.id,
                p_edited_comment: edited || null,
            });

            if (error) throw error;

            setComments(prev => prev.map(c =>
                c.id === comment.id
                    ? { ...c, status: 'approved' as const, editedComment: edited, approvedAt: new Date().toISOString() }
                    : c
            ));
        } catch (error) {
            Alert.alert('Error', 'Failed to approve comment.');
        }
    };

    // Edit modal
    const openEditModal = (comment: GeneratedComment) => {
        setEditingComment(comment);
        setEditedText(comment.editedComment || comment.generatedComment);
    };

    const handleSaveEdit = () => {
        if (!editingComment) return;
        handleApprove(editingComment, editedText);
        setEditingComment(null);
    };

    // Refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    // Render class picker modal
    const renderClassPickerModal = () => (
        <Modal visible={showClassPicker} transparent animationType="none" onRequestClose={() => setShowClassPicker(false)}>
            <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
                <TouchableOpacity style={styles.overlayTouchable} onPress={() => setShowClassPicker(false)} />
                <Animated.View
                    style={[
                        styles.modalContent,
                        {
                            transform: [{
                                translateY: slideAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [500, 0],
                                }),
                            }],
                        },
                    ]}
                >
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle}>Select Class</Text>
                    <ScrollView style={styles.sheetContent}>
                        {classes.map((cls: any) => (
                            <TouchableOpacity
                                key={cls.id}
                                style={[styles.sheetItem, selectedClassId === cls.id && styles.sheetItemActive]}
                                onPress={() => {
                                    setSelectedClassId(cls.id);
                                    setComments([]); // Clear comments when changing class
                                    setShowClassPicker(false);
                                }}
                            >
                                <Text style={[styles.sheetItemText, selectedClassId === cls.id && styles.sheetItemTextActive]}>
                                    Grade {cls.grade} - {cls.section}
                                </Text>
                                {selectedClassId === cls.id && <Text style={styles.checkmark}>✓</Text>}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Animated.View>
            </Animated.View>
        </Modal>
    );

    // Not enough selections - show class picker
    if (!selectedClassId) {
        return (
            <View style={styles.container}>
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* Header */}
                    <View style={styles.headerSection}>
                        <MaterialIcons name="auto-awesome" size={32} color={colors.primary[600]} />
                        <Text style={styles.headerTitle}>AI Report Comments</Text>
                        <Text style={styles.headerSubtitle}>
                            Generate personalized report card comments for your students
                        </Text>
                    </View>

                    {/* Class Selector */}
                    <TouchableOpacity style={styles.selectorCard} onPress={() => setShowClassPicker(true)}>
                        <View style={[styles.selectorIcon, { backgroundColor: colors.primary[100] }]}>
                            <MaterialIcons name="menu-book" size={24} color={colors.primary[600]} />
                        </View>
                        <View style={styles.selectorContent}>
                            <Text style={styles.selectorLabel}>Class</Text>
                            <Text style={styles.selectorValue}>{getSelectedClassName()}</Text>
                        </View>
                        <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.secondary} />
                    </TouchableOpacity>

                    {/* Empty state */}
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="description" size={64} color={colors.text.tertiary} />
                        <Text style={styles.emptyTitle}>Select a Class</Text>
                        <Text style={styles.emptyText}>
                            Choose a class to start generating AI-powered report card comments.
                        </Text>
                    </View>
                </ScrollView>

                {renderClassPickerModal()}
            </View>
        );
    }

    // Main view with comments
    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                {/* Selection Summary */}
                <View style={styles.selectionSummary}>
                    <TouchableOpacity style={styles.selectionChip} onPress={() => setShowClassPicker(true)}>
                        <MaterialIcons name="menu-book" size={16} color={colors.primary[600]} />
                        <Text style={styles.selectionChipText}>{getSelectedClassName()}</Text>
                        <MaterialIcons name="keyboard-arrow-down" size={14} color={colors.text.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.selectionChip, styles.settingsChip]}
                        onPress={() => setShowSettings(!showSettings)}
                    >
                        <MaterialIcons name="settings" size={16} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>

                {/* Settings Panel */}
                {showSettings && (
                    <Card style={styles.settingsCard}>
                        <Text style={styles.settingsTitle}>Comment Settings</Text>

                        <Text style={styles.settingLabel}>Tone</Text>
                        <View style={styles.settingOptions}>
                            {(['professional', 'friendly', 'encouraging'] as const).map((tone) => (
                                <TouchableOpacity
                                    key={tone}
                                    style={[styles.settingOption, settings.tone === tone && styles.settingOptionActive]}
                                    onPress={() => setSettings(s => ({ ...s, tone }))}
                                >
                                    <Text style={[styles.settingOptionText, settings.tone === tone && styles.settingOptionTextActive]}>
                                        {tone.charAt(0).toUpperCase() + tone.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.settingLabel}>Focus</Text>
                        <View style={styles.settingOptions}>
                            {(['academic', 'behavioral', 'holistic'] as const).map((focus) => (
                                <TouchableOpacity
                                    key={focus}
                                    style={[styles.settingOption, settings.focus === focus && styles.settingOptionActive]}
                                    onPress={() => setSettings(s => ({ ...s, focus }))}
                                >
                                    <Text style={[styles.settingOptionText, settings.focus === focus && styles.settingOptionTextActive]}>
                                        {focus.charAt(0).toUpperCase() + focus.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.settingLabel}>Language</Text>
                        <View style={styles.settingOptions}>
                            {(['english', 'hindi', 'bilingual'] as const).map((lang) => (
                                <TouchableOpacity
                                    key={lang}
                                    style={[styles.settingOption, settings.language === lang && styles.settingOptionActive]}
                                    onPress={() => setSettings(s => ({ ...s, language: lang }))}
                                >
                                    <Text style={[styles.settingOptionText, settings.language === lang && styles.settingOptionTextActive]}>
                                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Card>
                )}

                {/* Generate Button or Progress */}
                {isGenerating ? (
                    <Card style={styles.progressCard}>
                        <View style={styles.progressHeader}>
                            <MaterialIcons name="auto-awesome" size={24} color={colors.primary[600]} />
                            <Text style={styles.progressTitle}>Generating Comments...</Text>
                        </View>
                        <ProgressBar
                            progress={generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0}
                            fillColor={colors.primary[600]}
                            style={styles.progressBar}
                        />
                        <Text style={styles.progressText}>
                            {generationProgress.current} of {generationProgress.total} students
                        </Text>
                    </Card>
                ) : comments.length === 0 ? (
                    <TouchableOpacity style={styles.generateButton} onPress={handleGenerateComments}>
                        <MaterialIcons name="auto-awesome" size={24} color={colors.text.inverse} />
                        <Text style={styles.generateButtonText}>
                            Generate Comments for {students.length} Students
                        </Text>
                    </TouchableOpacity>
                ) : null}

                {/* Stats */}
                {comments.length > 0 && (
                    <View style={styles.statsRow}>
                        <View style={[styles.statCard, { backgroundColor: colors.primary[50] }]}>
                            <Text style={[styles.statValue, { color: colors.primary[600] }]}>{stats.total}</Text>
                            <Text style={styles.statLabel}>Total</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.success[50] }]}>
                            <Text style={[styles.statValue, { color: colors.success[600] }]}>{stats.approved}</Text>
                            <Text style={styles.statLabel}>Approved</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.warning[50] }]}>
                            <Text style={[styles.statValue, { color: colors.warning[600] }]}>{stats.draft}</Text>
                            <Text style={styles.statLabel}>Drafts</Text>
                        </View>
                    </View>
                )}

                {/* Search */}
                {comments.length > 0 && (
                    <View style={styles.searchContainer}>
                        <MaterialIcons name="search" size={20} color={colors.text.secondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search students..."
                            placeholderTextColor={colors.text.tertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <MaterialIcons name="close" size={18} color={colors.text.secondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Comment Cards */}
                {filteredComments.map((comment) => (
                    <Card key={comment.id} style={styles.commentCard}>
                        <View style={styles.commentHeader}>
                            <View style={styles.studentInfo}>
                                <View style={styles.studentAvatar}>
                                    <Text style={styles.studentAvatarText}>
                                        {comment.studentName.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={styles.studentName}>{comment.studentName}</Text>
                                    {comment.studentCode && (
                                        <Text style={styles.studentCode}>{comment.studentCode}</Text>
                                    )}
                                </View>
                            </View>
                            <View style={[
                                styles.statusBadge,
                                { backgroundColor: comment.status === 'approved' ? colors.success[100] : colors.warning[100] }
                            ]}>
                                {comment.status === 'approved' ? (
                                    <MaterialIcons name="check-circle" size={14} color={colors.success[600]} />
                                ) : (
                                    <MaterialIcons name="edit" size={14} color={colors.warning[600]} />
                                )}
                                <Text style={[
                                    styles.statusText,
                                    { color: comment.status === 'approved' ? colors.success[700] : colors.warning[700] }
                                ]}>
                                    {comment.status === 'approved' ? 'Approved' : 'Draft'}
                                </Text>
                            </View>
                        </View>

                        {/* Input Data Summary */}
                        <View style={styles.inputDataRow}>
                            <View style={styles.inputDataItem}>
                                <MaterialIcons name="trending-up" size={14} color={colors.text.secondary} />
                                <Text style={styles.inputDataText}>
                                    {comment.inputData?.subjects?.length || 0} subjects
                                </Text>
                            </View>
                            <View style={styles.inputDataItem}>
                                <MaterialIcons name="person" size={14} color={colors.text.secondary} />
                                <Text style={styles.inputDataText}>
                                    {comment.inputData?.attendance?.percentage?.toFixed(0) || 0}% attendance
                                </Text>
                            </View>
                        </View>

                        {/* Comment Text */}
                        <View style={styles.commentTextContainer}>
                            <Text style={styles.commentText}>
                                {comment.editedComment || comment.generatedComment}
                            </Text>
                        </View>

                        {/* Quality Metrics */}
                        <View style={styles.qualityRow}>
                            <Text style={styles.qualityText}>
                                {comment.wordCount} words • Positivity: {(comment.positivityScore * 100).toFixed(0)}%
                            </Text>
                        </View>

                        {/* Actions */}
                        {comment.status === 'draft' && (
                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.editButton]}
                                    onPress={() => openEditModal(comment)}
                                >
                                    <MaterialIcons name="edit" size={16} color={colors.primary[600]} />
                                    <Text style={[styles.actionButtonText, { color: colors.primary[600] }]}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.approveButton]}
                                    onPress={() => handleApprove(comment)}
                                >
                                    <MaterialIcons name="check-circle" size={16} color={colors.success[600]} />
                                    <Text style={[styles.actionButtonText, { color: colors.success[600] }]}>Approve</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Card>
                ))}
            </ScrollView>

            {/* Bottom Action Bar */}
            {comments.length > 0 && stats.draft > 0 && (
                <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
                    <Text style={styles.bottomBarText}>{stats.draft} drafts remaining</Text>
                    <TouchableOpacity
                        style={styles.approveAllButton}
                        onPress={() => {
                            Alert.alert(
                                'Approve All',
                                `Approve all ${stats.draft} draft comments?`,
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Approve All',
                                        onPress: () => {
                                            comments.filter(c => c.status === 'draft').forEach(c => handleApprove(c));
                                        }
                                    }
                                ]
                            );
                        }}
                    >
                        <MaterialIcons name="check-circle" size={18} color={colors.text.inverse} />
                        <Text style={styles.approveAllText}>Approve All</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Edit Modal */}
            <Modal
                visible={!!editingComment}
                transparent
                animationType="slide"
                onRequestClose={() => setEditingComment(null)}
            >
                <View style={styles.editModalOverlay}>
                    <View style={[styles.editModalContent, { paddingBottom: insets.bottom + spacing.lg }]}>
                        <View style={styles.editModalHeader}>
                            <Text style={styles.editModalTitle}>
                                Edit Comment - {editingComment?.studentName}
                            </Text>
                            <TouchableOpacity onPress={() => setEditingComment(null)}>
                                <MaterialIcons name="close" size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>

                        {editingComment && (
                            <View style={styles.editInputDataRow}>
                                <Text style={styles.editInputDataText}>
                                    Subjects: {editingComment.inputData?.subjects?.map((s: any) =>
                                        `${s.subject_name}: ${s.average_percentage}%`
                                    ).join(' | ') || 'N/A'}
                                </Text>
                            </View>
                        )}

                        <TextInput
                            style={styles.editTextInput}
                            value={editedText}
                            onChangeText={setEditedText}
                            multiline
                            textAlignVertical="top"
                            placeholder="Enter comment..."
                            placeholderTextColor={colors.text.tertiary}
                        />

                        <Text style={styles.editWordCount}>
                            Words: {editedText.trim().split(/\s+/).filter(w => w).length} / 100
                        </Text>

                        <View style={styles.editModalActions}>
                            <TouchableOpacity
                                style={styles.editResetButton}
                                onPress={() => setEditedText(editingComment?.generatedComment || '')}
                            >
                                <MaterialIcons name="refresh" size={16} color={colors.text.secondary} />
                                <Text style={styles.editResetText}>Reset to AI</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.editSaveButton} onPress={handleSaveEdit}>
                                <MaterialIcons name="check-circle" size={18} color={colors.text.inverse} />
                                <Text style={styles.editSaveText}>Save & Approve</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {renderClassPickerModal()}
        </View>
    );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background.app,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            padding: spacing.lg,
        },
        // Header
        headerSection: {
            alignItems: 'center',
            paddingVertical: spacing.xl,
        },
        headerTitle: {
            fontSize: typography.fontSize['2xl'],
            fontWeight: typography.fontWeight.bold,
            color: colors.text.primary,
            marginTop: spacing.md,
        },
        headerSubtitle: {
            fontSize: typography.fontSize.base,
            color: colors.text.secondary,
            textAlign: 'center',
            marginTop: spacing.sm,
            paddingHorizontal: spacing.lg,
        },
        // Selectors
        selectorCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface.primary,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            ...shadows.sm,
        },
        selectorIcon: {
            width: 48,
            height: 48,
            borderRadius: borderRadius.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        selectorContent: {
            flex: 1,
            marginLeft: spacing.md,
        },
        selectorLabel: {
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
        },
        selectorValue: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.primary,
        },
        // Empty state
        emptyContainer: {
            alignItems: 'center',
            paddingVertical: spacing['2xl'],
        },
        emptyTitle: {
            fontSize: typography.fontSize.xl,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.primary,
            marginTop: spacing.lg,
        },
        emptyText: {
            fontSize: typography.fontSize.base,
            color: colors.text.secondary,
            textAlign: 'center',
            marginTop: spacing.sm,
            paddingHorizontal: spacing.xl,
        },
        // Selection summary
        selectionSummary: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        selectionChip: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface.primary,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.full,
            gap: spacing.xs,
            ...shadows.sm,
        },
        selectionChipText: {
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            color: colors.text.primary,
        },
        settingsChip: {
            paddingHorizontal: spacing.sm,
        },
        // Settings card
        settingsCard: {
            padding: spacing.md,
            marginBottom: spacing.md,
            backgroundColor: colors.surface.primary,
            borderRadius: borderRadius.lg,
        },
        settingsTitle: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.primary,
            marginBottom: spacing.md,
        },
        settingLabel: {
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            color: colors.text.secondary,
            marginTop: spacing.sm,
            marginBottom: spacing.xs,
        },
        settingOptions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
        },
        settingOption: {
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.full,
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.light,
        },
        settingOptionActive: {
            backgroundColor: colors.primary[100],
            borderColor: colors.primary[500],
        },
        settingOptionText: {
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
        },
        settingOptionTextActive: {
            color: colors.primary[700],
            fontWeight: typography.fontWeight.medium,
        },
        // Generate button
        generateButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary[600],
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            borderRadius: borderRadius.lg,
            gap: spacing.sm,
            marginBottom: spacing.lg,
            ...shadows.md,
        },
        generateButtonText: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.inverse,
        },
        // Progress card
        progressCard: {
            padding: spacing.lg,
            marginBottom: spacing.lg,
            backgroundColor: colors.surface.primary,
            borderRadius: borderRadius.lg,
            alignItems: 'center',
        },
        progressHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        progressTitle: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.primary,
        },
        progressBar: {
            width: '100%',
            height: 8,
            borderRadius: 4,
        },
        progressText: {
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
            marginTop: spacing.sm,
        },
        // Stats
        statsRow: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        statCard: {
            flex: 1,
            alignItems: 'center',
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
        },
        statValue: {
            fontSize: typography.fontSize['2xl'],
            fontWeight: typography.fontWeight.bold,
        },
        statLabel: {
            fontSize: typography.fontSize.xs,
            color: colors.text.secondary,
            marginTop: spacing.xs,
        },
        // Search
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface.primary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.lg,
            gap: spacing.sm,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: colors.border.light,
        },
        searchInput: {
            flex: 1,
            fontSize: typography.fontSize.base,
            color: colors.text.primary,
        },
        // Comment card
        commentCard: {
            padding: spacing.md,
            marginBottom: spacing.md,
            backgroundColor: colors.surface.primary,
            borderRadius: borderRadius.lg,
        },
        commentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.sm,
        },
        studentInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        studentAvatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.primary[100],
            alignItems: 'center',
            justifyContent: 'center',
        },
        studentAvatarText: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.bold,
            color: colors.primary[600],
        },
        studentName: {
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.primary,
        },
        studentCode: {
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
            borderRadius: borderRadius.full,
        },
        statusText: {
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.medium,
        },
        inputDataRow: {
            flexDirection: 'row',
            gap: spacing.md,
            marginBottom: spacing.sm,
        },
        inputDataItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
        },
        inputDataText: {
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
        },
        commentTextContainer: {
            backgroundColor: colors.background.secondary,
            padding: spacing.md,
            borderRadius: borderRadius.md,
            marginBottom: spacing.sm,
        },
        commentText: {
            fontSize: typography.fontSize.base,
            color: colors.text.primary,
            lineHeight: 22,
        },
        qualityRow: {
            marginBottom: spacing.sm,
        },
        qualityText: {
            fontSize: typography.fontSize.xs,
            color: colors.text.tertiary,
        },
        actionsRow: {
            flexDirection: 'row',
            gap: spacing.sm,
        },
        actionButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            gap: spacing.xs,
        },
        editButton: {
            backgroundColor: colors.primary[50],
        },
        approveButton: {
            backgroundColor: colors.success[50],
        },
        actionButtonText: {
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
        },
        // Bottom bar
        bottomBar: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface.primary,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border.light,
            ...shadows.lg,
        },
        bottomBarText: {
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
        },
        approveAllButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: colors.success[600],
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
        },
        approveAllText: {
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.inverse,
        },
        // Modal
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
        },
        overlayTouchable: {
            flex: 1,
        },
        modalContent: {
            backgroundColor: colors.surface.primary,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
            maxHeight: '70%',
        },
        sheetHandle: {
            width: 40,
            height: 4,
            backgroundColor: colors.border.DEFAULT,
            borderRadius: 2,
            alignSelf: 'center',
            marginTop: spacing.sm,
        },
        sheetTitle: {
            fontSize: typography.fontSize.xl,
            fontWeight: typography.fontWeight.bold,
            color: colors.text.primary,
            textAlign: 'center',
            marginVertical: spacing.md,
        },
        sheetContent: {
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
        },
        sheetItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            marginBottom: spacing.xs,
        },
        sheetItemActive: {
            backgroundColor: colors.primary[50],
        },
        sheetItemText: {
            fontSize: typography.fontSize.base,
            color: colors.text.primary,
        },
        sheetItemTextActive: {
            color: colors.primary[600],
            fontWeight: typography.fontWeight.semibold,
        },
        checkmark: {
            fontSize: typography.fontSize.lg,
            color: colors.primary[600],
        },
        // Edit modal
        editModalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
        },
        editModalContent: {
            backgroundColor: colors.surface.primary,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
            padding: spacing.lg,
            maxHeight: '80%',
        },
        editModalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
        },
        editModalTitle: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.primary,
        },
        editInputDataRow: {
            backgroundColor: colors.background.secondary,
            padding: spacing.sm,
            borderRadius: borderRadius.md,
            marginBottom: spacing.md,
        },
        editInputDataText: {
            fontSize: typography.fontSize.xs,
            color: colors.text.secondary,
        },
        editTextInput: {
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            fontSize: typography.fontSize.base,
            color: colors.text.primary,
            minHeight: 150,
            borderWidth: 1,
            borderColor: colors.border.light,
        },
        editWordCount: {
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
            textAlign: 'right',
            marginTop: spacing.xs,
            marginBottom: spacing.md,
        },
        editModalActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: spacing.md,
        },
        editResetButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.secondary,
        },
        editResetText: {
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
        },
        editSaveButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.success[600],
        },
        editSaveText: {
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.inverse,
        },
    });
