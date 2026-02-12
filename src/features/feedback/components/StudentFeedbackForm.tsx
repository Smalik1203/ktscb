import React, { useState } from 'react';
import {
    View,
    Text as RNText,
    ScrollView,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    FlatList,
    RefreshControl,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
    useSubmitFeedback,
    useFeedbackRecipients,
    useFeedbackForStudent,
    SENTIMENT_OPTIONS,
    STUDENT_FEEDBACK_CATEGORIES,
    CATEGORY_LABELS,
    Sentiment,
    FeedbackCategory
} from '../../../hooks/useFeedback';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

const MAX_CONTENT_LENGTH = 300;

interface Subject {
    id: string;
    subject_name: string;
}

/**
 * StudentFeedbackForm - Form for students to submit and view feedback
 */
export function StudentFeedbackForm() {
    const { colors, spacing, borderRadius, shadows } = useTheme();
    const { profile } = useAuth();
    const insets = useSafeAreaInsets();

    // Tab state
    const [activeTab, setActiveTab] = useState<'send' | 'received'>('send');

    // Form state
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [sentiment, setSentiment] = useState<Sentiment | null>(null);
    const [category, setCategory] = useState<FeedbackCategory | null>(null);
    const [content, setContent] = useState('');
    const [showTeacherPicker, setShowTeacherPicker] = useState(false);
    const [showSubjectPicker, setShowSubjectPicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    // Data hooks
    const submitMutation = useSubmitFeedback();
    const { data: teachers, isLoading: loadingTeachers } = useFeedbackRecipients(profile?.school_code);
    const { data: receivedFeedback, isLoading: loadingReceived, refetch: refetchReceived, isRefetching } = useFeedbackForStudent(profile?.auth_id);

    // Fetch subjects for the student's class
    const { data: subjects, isLoading: loadingSubjects } = useQuery<Subject[]>({
        queryKey: ['subjects', profile?.class_instance_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('subjects')
                .select('id, subject_name')
                .eq('school_code', profile?.school_code!)
                .order('subject_name');

            if (error) throw error;
            return (data || []) as Subject[];
        },
        enabled: !!profile?.school_code,
    });

    const selectedTeacher = teachers?.find(t => t.id === selectedTeacherId);
    const selectedSubject = subjects?.find(s => s.id === selectedSubjectId);
    const selectedCategory = STUDENT_FEEDBACK_CATEGORIES.find(c => c.value === category);

    const resetForm = () => {
        setSelectedTeacherId('');
        setSelectedSubjectId('');
        setSentiment(null);
        setCategory(null);
        setContent('');
    };

    const handleSubmit = async () => {
        if (!selectedTeacherId) {
            Alert.alert('Missing Information', 'Please select a teacher to provide feedback for.');
            return;
        }
        if (!sentiment) {
            Alert.alert('Missing Information', 'Please select the sentiment of your feedback.');
            return;
        }
        if (!category) {
            Alert.alert('Missing Information', 'Please select a feedback category.');
            return;
        }
        if (!content.trim()) {
            Alert.alert('Missing Information', 'Please write your feedback.');
            return;
        }

        try {
            await submitMutation.mutateAsync({
                to_user_id: selectedTeacherId,
                subject_id: selectedSubjectId || undefined,
                class_instance_id: profile?.class_instance_id || undefined,
                sentiment,
                category,
                content: content.trim(),
                school_code: profile?.school_code!,
                from_user_id: profile?.auth_id!,
            });

            Alert.alert(
                'Feedback Submitted',
                'Thank you for your feedback. It helps improve teaching quality.',
                [{ text: 'OK', onPress: resetForm }]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to submit feedback. Please try again.');
        }
    };

    const isLoading = loadingTeachers || loadingSubjects;
    const isSubmitting = submitMutation.isPending;

    // Render received feedback card
    const renderReceivedCard = ({ item }: { item: any }) => {
        const categoryLabel = CATEGORY_LABELS[item.category as FeedbackCategory] || item.category;

        return (
            <View style={{
                backgroundColor: colors.surface.primary,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginBottom: spacing.md,
                ...shadows.sm,
            }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                    <RNText style={{ fontSize: 15, fontWeight: '600', color: colors.text.primary }}>
                        {item.from_user?.full_name || 'Teacher'}
                    </RNText>
                    <View style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        backgroundColor: colors.neutral[100],
                        borderRadius: borderRadius.md,
                    }}>
                        <RNText style={{ fontSize: 12, fontWeight: '600', color: colors.text.secondary }}>
                            {categoryLabel}
                        </RNText>
                    </View>
                </View>

                {/* Content */}
                <RNText style={{ fontSize: 15, color: colors.text.primary, lineHeight: 22, marginBottom: spacing.sm }}>
                    {item.content}
                </RNText>

                {/* Date */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <MaterialIcons name="event" size={14} color={colors.text.tertiary} />
                    <RNText style={{ fontSize: 13, color: colors.text.tertiary }}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </RNText>
                </View>
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
                    <TouchableOpacity
                        onPress={() => setActiveTab('send')}
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: spacing.sm,
                            borderRadius: borderRadius.md - 2,
                            backgroundColor: activeTab === 'send' ? colors.surface.primary : 'transparent',
                            gap: spacing.xs,
                            ...(activeTab === 'send' ? shadows.sm : {}),
                        }}
                    >
                        <MaterialIcons name="send" size={16} color={activeTab === 'send' ? colors.primary[600] : colors.text.tertiary} />
                        <RNText style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: activeTab === 'send' ? colors.text.primary : colors.text.tertiary,
                        }}>
                            Send
                        </RNText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('received')}
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: spacing.sm,
                            borderRadius: borderRadius.md - 2,
                            backgroundColor: activeTab === 'received' ? colors.surface.primary : 'transparent',
                            gap: spacing.xs,
                            ...(activeTab === 'received' ? shadows.sm : {}),
                        }}
                    >
                        <MaterialIcons name="inbox" size={16} color={activeTab === 'received' ? colors.primary[600] : colors.text.tertiary} />
                        <RNText style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: activeTab === 'received' ? colors.text.primary : colors.text.tertiary,
                        }}>
                            Received
                        </RNText>
                        {receivedFeedback && receivedFeedback.length > 0 && (
                            <View style={{
                                backgroundColor: colors.primary[600],
                                borderRadius: 10,
                                minWidth: 20,
                                height: 20,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <RNText style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>
                                    {receivedFeedback.length}
                                </RNText>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Received Tab */}
            {activeTab === 'received' ? (
                <FlatList
                    data={receivedFeedback || []}
                    keyExtractor={(item, index) => item.id ?? `received-${index}`}
                    renderItem={renderReceivedCard}
                    contentContainerStyle={{
                        padding: spacing.lg,
                        paddingBottom: insets.bottom + spacing.xl,
                        flexGrow: 1,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={refetchReceived}
                            tintColor={colors.primary[600]}
                            colors={[colors.primary[600]]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            paddingTop: spacing.xl * 2,
                        }}>
                            <MaterialIcons name="inbox" size={48} color={colors.neutral[300]} />
                            <RNText style={{
                                marginTop: spacing.md,
                                fontSize: 16,
                                color: colors.text.secondary,
                                textAlign: 'center',
                            }}>
                                No feedback received yet
                            </RNText>
                            <RNText style={{
                                marginTop: spacing.xs,
                                fontSize: 14,
                                color: colors.text.tertiary,
                                textAlign: 'center',
                            }}>
                                Feedback from teachers will appear here
                            </RNText>
                        </View>
                    }
                />
            ) : (
                /* Send Tab */
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Description */}
                        <View style={{ marginBottom: spacing.xl }}>
                            <RNText style={{ fontSize: 15, color: colors.text.secondary, lineHeight: 22 }}>
                                Your feedback helps improve teaching quality and learning experience.
                            </RNText>
                        </View>

                        {isLoading ? (
                            <View style={{ paddingTop: spacing.xl * 2, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={colors.primary[600]} />
                                <RNText style={{ marginTop: spacing.md, color: colors.text.secondary }}>Loading...</RNText>
                            </View>
                        ) : (
                            <>
                                {/* Subject Selector (Optional) */}
                                <View style={{ marginBottom: spacing.lg }}>
                                    <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                                        Subject (Optional)
                                    </RNText>
                                    <TouchableOpacity
                                        onPress={() => setShowSubjectPicker(true)}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: spacing.md,
                                            borderRadius: borderRadius.lg,
                                            backgroundColor: colors.background.secondary,
                                            borderWidth: 1,
                                            borderColor: selectedSubjectId ? colors.primary[500] : colors.border.DEFAULT,
                                        }}
                                    >
                                        <RNText style={{
                                            fontSize: 15,
                                            color: selectedSubjectId ? colors.text.primary : colors.text.tertiary,
                                            fontWeight: selectedSubjectId ? '600' : '400',
                                        }}>
                                            {selectedSubject?.subject_name || 'Select a subject...'}
                                        </RNText>
                                        <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Teacher Selector */}
                                <View style={{ marginBottom: spacing.lg }}>
                                    <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                                        Teacher / Admin *
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
                                            color: selectedTeacherId ? colors.text.primary : colors.text.tertiary,
                                            fontWeight: selectedTeacherId ? '600' : '400',
                                        }}>
                                            {selectedTeacher?.full_name || 'Select a teacher...'}
                                        </RNText>
                                        <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Sentiment Selector */}
                                <View style={{ marginBottom: spacing.lg }}>
                                    <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                                        Feedback Type *
                                    </RNText>
                                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                        {SENTIMENT_OPTIONS.map((option) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                onPress={() => setSentiment(option.value as Sentiment)}
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: spacing.md,
                                                    paddingHorizontal: spacing.sm,
                                                    borderRadius: borderRadius.lg,
                                                    backgroundColor: sentiment === option.value ? option.color + '15' : colors.background.secondary,
                                                    borderWidth: 2,
                                                    borderColor: sentiment === option.value ? option.color : colors.border.light,
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: 6,
                                                        backgroundColor: option.color,
                                                        marginBottom: spacing.xs,
                                                    }}
                                                />
                                                <RNText
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: '600',
                                                        color: sentiment === option.value ? option.color : colors.text.secondary,
                                                        textAlign: 'center',
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {option.label}
                                                </RNText>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Category Selector */}
                                <View style={{ marginBottom: spacing.lg }}>
                                    <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>
                                        Category *
                                    </RNText>
                                    <TouchableOpacity
                                        onPress={() => setShowCategoryPicker(true)}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: spacing.md,
                                            borderRadius: borderRadius.lg,
                                            backgroundColor: colors.background.secondary,
                                            borderWidth: 1,
                                            borderColor: category ? colors.primary[500] : colors.border.DEFAULT,
                                        }}
                                    >
                                        <RNText style={{
                                            fontSize: 15,
                                            color: category ? colors.text.primary : colors.text.tertiary,
                                            fontWeight: category ? '600' : '400',
                                        }}>
                                            {selectedCategory?.label || 'Select a category...'}
                                        </RNText>
                                        <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Content TextArea */}
                                <View style={{ marginBottom: spacing.lg }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                                        <RNText style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary }}>
                                            Your Feedback *
                                        </RNText>
                                        <RNText style={{
                                            fontSize: 12,
                                            color: content.length > MAX_CONTENT_LENGTH ? colors.error[600] : colors.text.tertiary
                                        }}>
                                            {content.length} / {MAX_CONTENT_LENGTH}
                                        </RNText>
                                    </View>
                                    <TextInput
                                        value={content}
                                        onChangeText={(text: string) => text.length <= MAX_CONTENT_LENGTH && setContent(text)}
                                        placeholder="Write constructive feedback..."
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

                                {/* Info Note */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        padding: spacing.md,
                                        backgroundColor: colors.neutral[100],
                                        borderRadius: borderRadius.lg,
                                        gap: spacing.sm,
                                        marginBottom: spacing.xl,
                                    }}
                                >
                                    <MaterialIcons name="info" size={18} color={colors.text.tertiary} style={{ marginTop: 2 }} />
                                    <RNText style={{ flex: 1, fontSize: 13, color: colors.text.secondary, lineHeight: 18 }}>
                                        This feedback is visible to school management for quality assurance purposes.
                                    </RNText>
                                </View>

                                {/* Submit Button */}
                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={isSubmitting}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: spacing.sm,
                                        paddingVertical: spacing.md,
                                        borderRadius: borderRadius.lg,
                                        backgroundColor: isSubmitting ? colors.neutral[400] : colors.primary[600],
                                        ...shadows.md,
                                    }}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="send" size={20} color="#fff" />
                                            <RNText style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                                                Submit Feedback
                                            </RNText>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </ScrollView>

                    {/* Subject Picker Modal */}
                    <PickerModal
                        visible={showSubjectPicker}
                        title="Select Subject"
                        items={subjects?.map(s => ({ id: s.id, label: s.subject_name })) || []}
                        selectedId={selectedSubjectId}
                        onSelect={(id) => {
                            setSelectedSubjectId(id);
                            setShowSubjectPicker(false);
                        }}
                        onClose={() => setShowSubjectPicker(false)}
                    />

                    {/* Teacher Picker Modal */}
                    <PickerModal
                        visible={showTeacherPicker}
                        title="Select Teacher"
                        items={teachers?.map(t => ({ id: t.id, label: t.full_name })) || []}
                        selectedId={selectedTeacherId}
                        onSelect={(id) => {
                            setSelectedTeacherId(id);
                            setShowTeacherPicker(false);
                        }}
                        onClose={() => setShowTeacherPicker(false)}
                    />

                    {/* Category Picker Modal */}
                    <PickerModal
                        visible={showCategoryPicker}
                        title="Select Category"
                        items={STUDENT_FEEDBACK_CATEGORIES.map(c => ({ id: c.value, label: c.label }))}
                        selectedId={category || ''}
                        onSelect={(id) => {
                            setCategory(id as FeedbackCategory);
                            setShowCategoryPicker(false);
                        }}
                        onClose={() => setShowCategoryPicker(false)}
                    />
                </KeyboardAvoidingView>
            )}
        </View>
    );
}

// ============================================================================
// PICKER MODAL COMPONENT
// ============================================================================

interface PickerModalProps {
    visible: boolean;
    title: string;
    items: { id: string; label: string }[];
    selectedId: string;
    onSelect: (id: string) => void;
    onClose: () => void;
}

function PickerModal({ visible, title, items, selectedId, onSelect, onClose }: PickerModalProps) {
    const { colors, spacing, borderRadius } = useTheme();

    if (!visible) return null;

    return (
        <View
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'flex-end',
            }}
        >
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
            <View
                style={{
                    backgroundColor: colors.surface.primary,
                    borderTopLeftRadius: borderRadius.xl,
                    borderTopRightRadius: borderRadius.xl,
                    maxHeight: '60%',
                }}
            >
                {/* Header */}
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
                        {title}
                    </RNText>
                    <TouchableOpacity onPress={onClose}>
                        <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>

                {/* Items */}
                <ScrollView style={{ padding: spacing.md }}>
                    {items.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => onSelect(item.id)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: spacing.md,
                                borderRadius: borderRadius.lg,
                                backgroundColor: selectedId === item.id ? colors.primary[50] : colors.background.secondary,
                                marginBottom: spacing.sm,
                                borderWidth: 2,
                                borderColor: selectedId === item.id ? colors.primary[500] : 'transparent',
                            }}
                        >
                            <RNText style={{ flex: 1, fontSize: 16, fontWeight: '500', color: colors.text.primary }}>
                                {item.label}
                            </RNText>
                            {selectedId === item.id && <MaterialIcons name="check" size={20} color={colors.primary[600]} />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}
