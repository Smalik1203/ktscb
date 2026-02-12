import React, { useState, useMemo } from 'react';
import {
    View,
    Text as RNText,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Modal,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    TextInput,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { FAB } from '../../../ui';
import {
    useAllSchoolFeedback,
    useAddManagementNote,
    useArchiveFeedback,
    useFeedbackRecipients,
    useFeedbackToStudents,
    useStudentsForFeedback,
    useSendStudentFeedback,
    SENTIMENT_OPTIONS,
    CATEGORY_LABELS,
    MANAGEMENT_NOTE_CATEGORIES,
    STUDENT_REMARK_CATEGORIES,
    Feedback,
    Sentiment,
    FeedbackCategory
} from '../../../hooks/useFeedback';
import { useClasses } from '../../../hooks/useClasses';

/**
 * SuperAdminFeedbackDashboard - Full visibility of all school feedback
 * Can add management notes, send feedback to students, and archive feedback
 */
export function SuperAdminFeedbackDashboard() {
    const { colors, spacing, borderRadius, shadows } = useTheme();
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();

    const [showAddNoteModal, setShowAddNoteModal] = useState(false);
    const [showStudentFeedbackModal, setShowStudentFeedbackModal] = useState(false);
    const [viewingFeedback, setViewingFeedback] = useState<Feedback | null>(null);
    const [filterType, setFilterType] = useState<'student' | 'management' | 'toStudents'>('student');

    const { data: feedback, isLoading, refetch, isRefetching } = useAllSchoolFeedback(profile?.school_code);
    const { data: toStudentsFeedback, isLoading: loadingToStudents, refetch: refetchToStudents } = useFeedbackToStudents(profile?.school_code);
    const archiveMutation = useArchiveFeedback();

    // Filter options - 3 tabs
    const FILTER_OPTIONS = [
        { key: 'student', label: 'From Students' },
        { key: 'management', label: 'Management' },
        { key: 'toStudents', label: 'To Students' },
    ] as const;

    // Get data based on active tab
    const displayData = useMemo((): any[] => {
        if (filterType === 'toStudents') {
            return (toStudentsFeedback || []) as any[];
        }
        if (!feedback) return [];
        if (filterType === 'student') return feedback.filter(f => f.feedback_type === 'student_to_admin');
        if (filterType === 'management') return feedback.filter(f => f.feedback_type === 'management_note' || f.feedback_type === 'superadmin_to_admin');
        return feedback;
    }, [feedback, toStudentsFeedback, filterType]);

    const getSentimentStyle = (sentiment: Sentiment | null) => {
        const option = SENTIMENT_OPTIONS.find(o => o.value === sentiment);
        return {
            color: option?.color || colors.text.tertiary,
            label: option?.label || 'Unknown',
        };
    };

    const getSourceLabel = (type: string) => {
        switch (type) {
            case 'student_to_admin': return 'Student Feedback';
            case 'management_note': return 'Management Note';
            case 'superadmin_to_admin': return 'SuperAdmin Note';
            default: return type;
        }
    };

    const handleArchive = async (feedbackId: string) => {
        Alert.alert(
            'Archive Feedback',
            'Are you sure you want to archive this feedback? It will be hidden from the main list.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Archive',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await archiveMutation.mutateAsync({ feedbackId, userId: profile?.auth_id! });
                        } catch (error) {
                            Alert.alert('Error', 'Failed to archive feedback.');
                        }
                    },
                },
            ]
        );
    };

    const renderFeedbackCard = ({ item }: { item: Feedback }) => {
        const sentimentStyle = getSentimentStyle(item.sentiment);
        const isAcknowledged = !!item.acknowledged_at;

        return (
            <TouchableOpacity
                onPress={() => setViewingFeedback(item)}
                activeOpacity={0.7}
                style={{
                    backgroundColor: colors.surface.primary,
                    borderRadius: borderRadius.lg,
                    padding: spacing.lg,
                    marginBottom: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.border.light,
                    ...shadows.sm,
                }}
            >
                {/* Header Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                    {/* Teacher Name */}
                    <RNText style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary, flex: 1 }}>
                        {item.to_user?.full_name || 'Unknown Teacher'}
                    </RNText>

                    {/* Status Badge */}
                    {isAcknowledged ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <MaterialIcons name="check" size={12} color={colors.success[600]} />
                            <RNText style={{ fontSize: 11, color: colors.success[600], fontWeight: '600' }}>
                                Acknowledged
                            </RNText>
                        </View>
                    ) : item.requires_acknowledgement ? (
                        <View style={{
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2,
                            backgroundColor: colors.warning[100],
                            borderRadius: borderRadius.sm,
                        }}>
                            <RNText style={{ fontSize: 11, color: colors.warning[700], fontWeight: '600' }}>
                                Pending
                            </RNText>
                        </View>
                    ) : null}
                </View>

                {/* Tags Row */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm }}>
                    {/* Category */}
                    <View style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        backgroundColor: colors.neutral[100],
                        borderRadius: borderRadius.sm,
                    }}>
                        <RNText style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>
                            {CATEGORY_LABELS[item.category as FeedbackCategory] || item.category}
                        </RNText>
                    </View>

                    {/* Sentiment */}
                    {item.sentiment && (
                        <View style={{
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2,
                            backgroundColor: sentimentStyle.color + '15',
                            borderRadius: borderRadius.sm,
                        }}>
                            <RNText style={{ fontSize: 11, fontWeight: '600', color: sentimentStyle.color }}>
                                {sentimentStyle.label}
                            </RNText>
                        </View>
                    )}

                    {/* Source */}
                    <View style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        backgroundColor: item.feedback_type === 'student_to_admin' ? colors.info[100] : colors.primary[100],
                        borderRadius: borderRadius.sm,
                    }}>
                        <RNText style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: item.feedback_type === 'student_to_admin' ? colors.info[700] : colors.primary[700]
                        }}>
                            {getSourceLabel(item.feedback_type)}
                        </RNText>
                    </View>
                </View>

                {/* Content Preview */}
                <RNText
                    style={{ fontSize: 14, color: colors.text.secondary, lineHeight: 20 }}
                    numberOfLines={2}
                >
                    {item.content}
                </RNText>

                {/* Footer */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.md }}>
                    {item.feedback_type === 'student_to_admin' && item.from_user && (
                        <RNText style={{ fontSize: 12, color: colors.text.tertiary }}>
                            👤 {item.from_user.full_name}
                        </RNText>
                    )}
                    <RNText style={{ fontSize: 12, color: colors.text.tertiary }}>
                        📅 {new Date(item.created_at).toLocaleDateString()}
                    </RNText>
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => {
        if (isLoading) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
                    <ActivityIndicator size="large" color={colors.primary[600]} />
                    <RNText style={{ marginTop: spacing.lg, color: colors.text.secondary }}>
                        Loading feedback...
                    </RNText>
                </View>
            );
        }

        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
                <View
                    style={{
                        width: 100,
                        height: 100,
                        borderRadius: 50,
                        backgroundColor: colors.neutral[100],
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: spacing.xl,
                    }}
                >
                    <MaterialIcons name="assignment" size={48} color={colors.neutral[400]} />
                </View>
                <RNText style={{ fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm }}>
                    No Feedback Records
                </RNText>
                <RNText style={{ fontSize: 15, color: colors.text.secondary, textAlign: 'center', paddingHorizontal: spacing.xl }}>
                    No feedback has been submitted yet. Students can share feedback about their teachers.
                </RNText>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background.secondary }}>
            {/* Segmented Control */}
            <View style={{
                backgroundColor: colors.surface.primary,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
            }}>
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: colors.neutral[100],
                    borderRadius: borderRadius.md,
                    padding: 3,
                }}>
                    {FILTER_OPTIONS.map(option => (
                        <TouchableOpacity
                            key={option.key}
                            onPress={() => setFilterType(option.key)}
                            style={{
                                flex: 1,
                                paddingVertical: spacing.sm,
                                borderRadius: borderRadius.md - 2,
                                backgroundColor: filterType === option.key ? colors.surface.primary : 'transparent',
                                alignItems: 'center',
                                ...(filterType === option.key ? shadows.sm : {}),
                            }}
                        >
                            <RNText style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: filterType === option.key ? colors.text.primary : colors.text.tertiary,
                            }}>
                                {option.label}
                            </RNText>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Feedback List */}
            <FlatList
                data={displayData}
                keyExtractor={(item) => item.id}
                renderItem={renderFeedbackCard}
                contentContainerStyle={{
                    padding: spacing.lg,
                    paddingBottom: insets.bottom + spacing.xl,
                    flexGrow: 1,
                }}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={colors.primary[600]}
                        colors={[colors.primary[600]]}
                    />
                }
                showsVerticalScrollIndicator={false}
            />

            {/* Add Management Note Modal */}
            <AddManagementNoteModal
                visible={showAddNoteModal}
                onClose={() => setShowAddNoteModal(false)}
            />

            {/* Add Student Feedback Modal */}
            <AddStudentFeedbackModal
                visible={showStudentFeedbackModal}
                onClose={() => setShowStudentFeedbackModal(false)}
            />

            {/* View Feedback Detail Modal */}
            <FeedbackDetailModal
                feedback={viewingFeedback}
                onClose={() => setViewingFeedback(null)}
                onArchive={handleArchive}
            />

            {/* Floating Action Button - show only on management/toStudents tabs */}
            <FAB
                icon="add"
                onPress={() => filterType === 'toStudents' ? setShowStudentFeedbackModal(true) : setShowAddNoteModal(true)}
                visible={filterType === 'management' || filterType === 'toStudents'}
            />
        </View>
    );
}

// ============================================================================
// ADD MANAGEMENT NOTE MODAL
// ============================================================================

function AddManagementNoteModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { colors, spacing, borderRadius, shadows } = useTheme();
    const { profile } = useAuth();
    const addNoteMutation = useAddManagementNote();
    const { data: teachers } = useFeedbackRecipients(profile?.school_code);

    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [category, setCategory] = useState<'observation' | 'improvement_required' | 'appreciation' | null>(null);
    const [content, setContent] = useState('');
    const [requiresAck, setRequiresAck] = useState(false);
    const [showTeacherPicker, setShowTeacherPicker] = useState(false);

    const selectedTeacher = teachers?.find(t => t.id === selectedTeacherId);
    const selectedCategory = MANAGEMENT_NOTE_CATEGORIES.find(c => c.value === category);

    const resetForm = () => {
        setSelectedTeacherId('');
        setCategory(null);
        setContent('');
        setRequiresAck(false);
    };

    const handleSubmit = async () => {
        if (!selectedTeacherId || !category || !content.trim()) {
            Alert.alert('Missing Information', 'Please fill in all required fields.');
            return;
        }

        try {
            await addNoteMutation.mutateAsync({
                to_user_id: selectedTeacherId,
                category,
                content: content.trim(),
                requires_acknowledgement: requiresAck,
                school_code: profile?.school_code!,
                from_user_id: profile?.auth_id!,
            });

            Alert.alert('Note Added', 'Management note has been saved.');
            resetForm();
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to save note. Please try again.');
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: colors.background.primary }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.light,
                        backgroundColor: colors.surface.primary,
                    }}
                >
                    <TouchableOpacity onPress={onClose} style={{ padding: spacing.xs }}>
                        <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                    </TouchableOpacity>

                    <RNText style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                        Add Management Note
                    </RNText>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={addNoteMutation.isPending || !selectedTeacherId || !category || !content.trim()}
                        style={{
                            backgroundColor: addNoteMutation.isPending || !selectedTeacherId || !category || !content.trim()
                                ? colors.neutral[300]
                                : colors.primary[600],
                            paddingHorizontal: spacing.lg,
                            paddingVertical: spacing.sm,
                            borderRadius: borderRadius.full,
                        }}
                    >
                        {addNoteMutation.isPending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <RNText style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Save</RNText>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: spacing.lg }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Teacher Selector */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                            Select Teacher *
                        </RNText>
                        <TouchableOpacity
                            onPress={() => setShowTeacherPicker(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: spacing.md,
                                borderRadius: borderRadius.lg,
                                backgroundColor: colors.background.secondary,
                                borderWidth: 1,
                                borderColor: selectedTeacherId ? colors.primary[500] : colors.border.DEFAULT,
                            }}
                        >
                            <RNText style={{
                                fontSize: 15,
                                color: selectedTeacherId ? colors.text.primary : colors.text.tertiary
                            }}>
                                {selectedTeacher?.full_name || 'Select a teacher...'}
                            </RNText>
                            <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Category Selector */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                            Category *
                        </RNText>
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            {MANAGEMENT_NOTE_CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.value}
                                    onPress={() => setCategory(cat.value as any)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: spacing.md,
                                        borderRadius: borderRadius.lg,
                                        backgroundColor: category === cat.value ? colors.primary[50] : colors.background.secondary,
                                        borderWidth: 2,
                                        borderColor: category === cat.value ? colors.primary[500] : colors.border.light,
                                        alignItems: 'center',
                                    }}
                                >
                                    <RNText
                                        style={{
                                            fontSize: 12,
                                            fontWeight: '600',
                                            color: category === cat.value ? colors.primary[600] : colors.text.secondary,
                                            textAlign: 'center',
                                        }}
                                        numberOfLines={2}
                                    >
                                        {cat.label}
                                    </RNText>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Content */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                            Note Content *
                        </RNText>
                        <TextInput
                            value={content}
                            onChangeText={setContent}
                            placeholder="Write professional feedback for the teacher..."
                            multiline
                            numberOfLines={5}
                            textAlignVertical="top"
                            style={{
                                backgroundColor: colors.surface.primary,
                                minHeight: 120,
                                borderWidth: 1,
                                borderColor: colors.border.DEFAULT,
                                borderRadius: borderRadius.lg,
                                padding: spacing.md,
                                fontSize: 15,
                                color: colors.text.primary,
                            }}
                            placeholderTextColor={colors.text.tertiary}
                        />
                    </View>

                    {/* Requires Acknowledgement Toggle */}
                    <TouchableOpacity
                        onPress={() => setRequiresAck(!requiresAck)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: spacing.md,
                            borderRadius: borderRadius.lg,
                            backgroundColor: colors.background.secondary,
                            borderWidth: 1,
                            borderColor: colors.border.light,
                            gap: spacing.md,
                        }}
                    >
                        <View
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                borderWidth: 2,
                                borderColor: requiresAck ? colors.primary[500] : colors.border.DEFAULT,
                                backgroundColor: requiresAck ? colors.primary[500] : 'transparent',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            {requiresAck && <MaterialIcons name="check" size={14} color="#fff" />}
                        </View>
                        <View style={{ flex: 1 }}>
                            <RNText style={{ fontSize: 15, fontWeight: '600', color: colors.text.primary }}>
                                Requires Acknowledgement
                            </RNText>
                            <RNText style={{ fontSize: 13, color: colors.text.tertiary }}>
                                Teacher must acknowledge this note
                            </RNText>
                        </View>
                    </TouchableOpacity>
                </ScrollView>

                {/* Teacher Picker Modal */}
                {showTeacherPicker && (
                    <View
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            justifyContent: 'flex-end',
                        }}
                    >
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowTeacherPicker(false)} />
                        <View
                            style={{
                                backgroundColor: colors.surface.primary,
                                borderTopLeftRadius: borderRadius.xl,
                                borderTopRightRadius: borderRadius.xl,
                                maxHeight: '60%',
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: spacing.lg,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border.light,
                                }}
                            >
                                <RNText style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                                    Select Teacher
                                </RNText>
                                <TouchableOpacity onPress={() => setShowTeacherPicker(false)}>
                                    <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ padding: spacing.md }}>
                                {teachers?.map((teacher) => (
                                    <TouchableOpacity
                                        key={teacher.id}
                                        onPress={() => {
                                            setSelectedTeacherId(teacher.id);
                                            setShowTeacherPicker(false);
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: spacing.md,
                                            borderRadius: borderRadius.lg,
                                            backgroundColor: selectedTeacherId === teacher.id ? colors.primary[50] : colors.background.secondary,
                                            marginBottom: spacing.sm,
                                            borderWidth: 2,
                                            borderColor: selectedTeacherId === teacher.id ? colors.primary[500] : 'transparent',
                                        }}
                                    >
                                        <RNText style={{ flex: 1, fontSize: 16, fontWeight: '500', color: colors.text.primary }}>
                                            {teacher.full_name}
                                        </RNText>
                                        {selectedTeacherId === teacher.id && <MaterialIcons name="check" size={20} color={colors.primary[600]} />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ============================================================================
// FEEDBACK DETAIL MODAL
// ============================================================================

function FeedbackDetailModal({
    feedback,
    onClose,
    onArchive
}: {
    feedback: Feedback | null;
    onClose: () => void;
    onArchive: (id: string) => void;
}) {
    const { colors, spacing, borderRadius, shadows } = useTheme();

    if (!feedback) return null;

    const sentimentOption = SENTIMENT_OPTIONS.find(o => o.value === feedback.sentiment);

    return (
        <Modal
            visible={!!feedback}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.light,
                        backgroundColor: colors.surface.primary,
                    }}
                >
                    <TouchableOpacity onPress={onClose} style={{ padding: spacing.xs }}>
                        <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                    </TouchableOpacity>

                    <RNText style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                        Feedback Details
                    </RNText>

                    <TouchableOpacity
                        onPress={() => {
                            onClose();
                            onArchive(feedback.id);
                        }}
                        style={{ padding: spacing.xs }}
                    >
                        <MaterialIcons name="archive" size={22} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
                    {/* To */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.text.tertiary, marginBottom: spacing.xs }}>
                            TO
                        </RNText>
                        <RNText style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                            {feedback.to_user?.full_name || 'Unknown'}
                        </RNText>
                    </View>

                    {/* From (for student feedback) */}
                    {feedback.feedback_type === 'student_to_admin' && feedback.from_user && (
                        <View style={{ marginBottom: spacing.lg }}>
                            <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.text.tertiary, marginBottom: spacing.xs }}>
                                FROM
                            </RNText>
                            <RNText style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary }}>
                                {feedback.from_user.full_name}
                            </RNText>
                        </View>
                    )}

                    {/* Tags */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
                        <View style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.sm,
                            backgroundColor: colors.neutral[100],
                            borderRadius: borderRadius.md,
                        }}>
                            <RNText style={{ fontSize: 13, fontWeight: '600', color: colors.text.secondary }}>
                                {CATEGORY_LABELS[feedback.category as FeedbackCategory] || feedback.category}
                            </RNText>
                        </View>

                        {sentimentOption && (
                            <View style={{
                                paddingHorizontal: spacing.md,
                                paddingVertical: spacing.sm,
                                backgroundColor: sentimentOption.color + '15',
                                borderRadius: borderRadius.md,
                            }}>
                                <RNText style={{ fontSize: 13, fontWeight: '600', color: sentimentOption.color }}>
                                    {sentimentOption.label}
                                </RNText>
                            </View>
                        )}

                        {feedback.acknowledged_at && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: spacing.md,
                                paddingVertical: spacing.sm,
                                backgroundColor: colors.success[100],
                                borderRadius: borderRadius.md,
                                gap: 4,
                            }}>
                                <MaterialIcons name="check" size={14} color={colors.success[700]} />
                                <RNText style={{ fontSize: 13, fontWeight: '600', color: colors.success[700] }}>
                                    Acknowledged
                                </RNText>
                            </View>
                        )}
                    </View>

                    {/* Content */}
                    <View style={{
                        backgroundColor: colors.surface.primary,
                        padding: spacing.lg,
                        borderRadius: borderRadius.lg,
                        marginBottom: spacing.lg,
                        ...shadows.sm,
                    }}>
                        <RNText style={{ fontSize: 16, color: colors.text.primary, lineHeight: 24 }}>
                            {feedback.content}
                        </RNText>
                    </View>

                    {/* Metadata */}
                    <View style={{ gap: spacing.sm }}>
                        {feedback.subject?.subject_name && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                <RNText style={{ fontSize: 14, color: colors.text.tertiary }}>📚 Subject:</RNText>
                                <RNText style={{ fontSize: 14, color: colors.text.primary }}>{feedback.subject.subject_name}</RNText>
                            </View>
                        )}
                        {feedback.class_instance && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                <RNText style={{ fontSize: 14, color: colors.text.tertiary }}>🎓 Class:</RNText>
                                <RNText style={{ fontSize: 14, color: colors.text.primary }}>
                                    {feedback.class_instance.grade}{feedback.class_instance.section ? `-${feedback.class_instance.section}` : ''}
                                </RNText>
                            </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <RNText style={{ fontSize: 14, color: colors.text.tertiary }}>📅 Date:</RNText>
                            <RNText style={{ fontSize: 14, color: colors.text.primary }}>
                                {new Date(feedback.created_at).toLocaleDateString()} at {new Date(feedback.created_at).toLocaleTimeString()}
                            </RNText>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

// ============================================================================
// ADD STUDENT FEEDBACK MODAL
// ============================================================================

function AddStudentFeedbackModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { colors, spacing, borderRadius, shadows } = useTheme();
    const { profile } = useAuth();
    const sendFeedbackMutation = useSendStudentFeedback();
    const { data: allStudents } = useStudentsForFeedback(profile?.school_code);
    const { data: classes = [] } = useClasses(profile?.school_code || '');

    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [category, setCategory] = useState<'observation' | 'behaviour' | 'improvement_required' | 'appreciation' | 'general' | null>(null);
    const [content, setContent] = useState('');
    const [showClassPicker, setShowClassPicker] = useState(false);
    const [showStudentPicker, setShowStudentPicker] = useState(false);

    // Filter students by selected class
    const filteredStudents = selectedClassId
        ? allStudents?.filter(s => s.class_instance_id === selectedClassId)
        : allStudents;

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const selectedStudent = allStudents?.find(s => s.id === selectedStudentId);

    const resetForm = () => {
        setSelectedClassId('');
        setSelectedStudentId('');
        setCategory(null);
        setContent('');
    };

    const handleSubmit = async () => {
        if (!selectedStudentId || !category || !content.trim()) {
            Alert.alert('Missing Information', 'Please fill in all required fields.');
            return;
        }

        try {
            await sendFeedbackMutation.mutateAsync({
                to_user_id: selectedStudentId,
                category,
                content: content.trim(),
                school_code: profile?.school_code!,
                from_user_id: profile?.auth_id!,
            });

            Alert.alert('Feedback Sent', 'Feedback has been sent to the student.');
            resetForm();
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to send feedback. Please try again.');
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: colors.background.primary }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.light,
                        backgroundColor: colors.surface.primary,
                    }}
                >
                    <TouchableOpacity onPress={onClose} style={{ padding: spacing.xs }}>
                        <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                    </TouchableOpacity>

                    <RNText style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                        Send Student Feedback
                    </RNText>

                    <View style={{ width: 40 }} />
                </View>

                {/* Form */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
                    {/* Class Selector */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                            Class *
                        </RNText>
                        <TouchableOpacity
                            onPress={() => setShowClassPicker(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: spacing.md,
                                paddingVertical: spacing.md,
                                backgroundColor: colors.surface.primary,
                                borderRadius: borderRadius.lg,
                                borderWidth: 2,
                                borderColor: selectedClassId ? colors.primary[500] : colors.border.DEFAULT,
                            }}
                        >
                            <RNText style={{
                                fontSize: 15,
                                color: selectedClassId ? colors.text.primary : colors.text.tertiary
                            }}>
                                {selectedClass ? `${selectedClass.grade}${selectedClass.section ? `-${selectedClass.section}` : ''}` : 'Select a class...'}
                            </RNText>
                            <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Student Selector */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                            Student *
                        </RNText>
                        <TouchableOpacity
                            onPress={() => selectedClassId ? setShowStudentPicker(true) : Alert.alert('Select Class', 'Please select a class first.')}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: spacing.md,
                                paddingVertical: spacing.md,
                                backgroundColor: colors.surface.primary,
                                borderRadius: borderRadius.lg,
                                borderWidth: 2,
                                borderColor: selectedStudentId ? colors.primary[500] : colors.border.DEFAULT,
                                opacity: selectedClassId ? 1 : 0.6,
                            }}
                        >
                            <RNText style={{
                                fontSize: 15,
                                color: selectedStudentId ? colors.text.primary : colors.text.tertiary
                            }}>
                                {selectedStudent?.full_name || (selectedClassId ? 'Select a student...' : 'Select class first')}
                            </RNText>
                            <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Category Selector */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                            Category *
                        </RNText>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                            {STUDENT_REMARK_CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.value}
                                    onPress={() => setCategory(cat.value as any)}
                                    style={{
                                        paddingHorizontal: spacing.md,
                                        paddingVertical: spacing.sm,
                                        borderRadius: borderRadius.full,
                                        backgroundColor: category === cat.value ? colors.primary[50] : colors.background.secondary,
                                        borderWidth: 2,
                                        borderColor: category === cat.value ? colors.primary[500] : colors.border.light,
                                    }}
                                >
                                    <RNText
                                        style={{
                                            fontSize: 13,
                                            fontWeight: '600',
                                            color: category === cat.value ? colors.primary[600] : colors.text.secondary,
                                        }}
                                    >
                                        {cat.label}
                                    </RNText>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Content */}
                    <View style={{ marginBottom: spacing.lg }}>
                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                            Feedback *
                        </RNText>
                        <TextInput
                            value={content}
                            onChangeText={setContent}
                            placeholder="Write your feedback..."
                            placeholderTextColor={colors.text.tertiary}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            style={{
                                backgroundColor: colors.surface.primary,
                                borderRadius: borderRadius.lg,
                                padding: spacing.md,
                                fontSize: 15,
                                color: colors.text.primary,
                                minHeight: 150,
                                borderWidth: 2,
                                borderColor: colors.border.DEFAULT,
                            }}
                        />
                    </View>

                    {/* Send Button */}
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={sendFeedbackMutation.isPending || !selectedStudentId || !category || !content.trim()}
                        style={{
                            backgroundColor: (!selectedStudentId || !category || !content.trim()) ? colors.neutral[300] : colors.primary[600],
                            paddingVertical: spacing.md,
                            borderRadius: borderRadius.lg,
                            alignItems: 'center',
                            marginTop: spacing.md,
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: spacing.sm,
                            ...shadows.md,
                        }}
                    >
                        {sendFeedbackMutation.isPending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <RNText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                                    Send Feedback
                                </RNText>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Class Picker Modal */}
            <Modal
                visible={showClassPicker}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowClassPicker(false)}
            >
                <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: spacing.lg,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.light,
                    }}>
                        <RNText style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                            Select Class
                        </RNText>
                        <TouchableOpacity onPress={() => setShowClassPicker(false)}>
                            <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={classes}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedClassId(item.id);
                                    setShowClassPicker(false);
                                    // Reset student selection when class changes
                                    setSelectedStudentId('');
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: spacing.lg,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border.light,
                                    backgroundColor: selectedClassId === item.id ? colors.primary[50] : 'transparent',
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: colors.primary[100],
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: spacing.md,
                                }}>
                                    <MaterialIcons name="assignment" size={20} color={colors.primary[600]} />
                                </View>
                                <RNText style={{ fontSize: 16, color: colors.text.primary, flex: 1 }}>
                                    {item.grade}{item.section ? `-${item.section}` : ''}
                                </RNText>
                                {selectedClassId === item.id && (
                                    <MaterialIcons name="check" size={20} color={colors.primary[600]} />
                                )}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                                <RNText style={{ color: colors.text.tertiary }}>No classes found</RNText>
                            </View>
                        }
                    />
                </View>
            </Modal>

            {/* Student Picker Modal */}
            <Modal
                visible={showStudentPicker}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowStudentPicker(false)}
            >
                <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: spacing.lg,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border.light,
                    }}>
                        <RNText style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
                            Select Student
                        </RNText>
                        <TouchableOpacity onPress={() => setShowStudentPicker(false)}>
                            <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={filteredStudents}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedStudentId(item.id);
                                    setShowStudentPicker(false);
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: spacing.lg,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border.light,
                                    backgroundColor: selectedStudentId === item.id ? colors.primary[50] : 'transparent',
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: colors.primary[100],
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: spacing.md,
                                }}>
                                    <RNText style={{ fontSize: 16, fontWeight: '600', color: colors.primary[600] }}>
                                        {item.full_name?.charAt(0).toUpperCase()}
                                    </RNText>
                                </View>
                                <RNText style={{ fontSize: 16, color: colors.text.primary, flex: 1 }}>
                                    {item.full_name}
                                </RNText>
                                {selectedStudentId === item.id && (
                                    <MaterialIcons name="check" size={20} color={colors.primary[600]} />
                                )}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                                <RNText style={{ color: colors.text.tertiary }}>No students found in this class</RNText>
                            </View>
                        }
                    />
                </View>
            </Modal>
        </Modal>
    );
}

