import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput as RNTextInput,
    ScrollView,
    Alert,
    Animated,
    Easing,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Button, Modal as ThemedModal } from '../../ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeColors } from '../../theme/types';
import { useVoiceRecording } from '../../hooks/useVoiceRecording';
import {
    useParseTaskInput,
    ParsedTask,
    FieldResult,
    getFieldStatus,
    formatConfidence,
} from '../../hooks/useParseTaskInput';

/**
 * Sage Voice Assistant
 * 
 * Premium AI-powered task creation with voice or text input.
 * Features glassmorphism design, smooth animations, and per-field confidence indicators.
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VoiceTaskCreatorProps {
    visible: boolean;
    onDismiss: () => void;
    onTaskCreated: (taskData: TaskFormData) => Promise<string>;
    schoolCode: string;
    academicYearId: string;
    userId: string;
    availableClasses: Array<{ id: string; label: string; grade?: string; section?: string }>;
    availableSubjects: Array<{ id: string; name: string }>;
}

interface TaskFormData {
    title: string;
    description: string | null;
    class_instance_id: string;
    subject_id: string;
    due_date: string;
    assigned_date: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    instructions: string | null;
    school_code: string;
    academic_year_id: string;
    created_by: string;
}

type ViewState = 'input' | 'recording' | 'processing' | 'preview' | 'editing';

// Animated Recording Rings Component
const RecordingRings = ({ isActive, colors }: { isActive: boolean; colors: ThemeColors }) => {
    const ring1 = useRef(new Animated.Value(1)).current;
    const ring2 = useRef(new Animated.Value(1)).current;
    const ring3 = useRef(new Animated.Value(1)).current;
    const opacity1 = useRef(new Animated.Value(0.6)).current;
    const opacity2 = useRef(new Animated.Value(0.4)).current;
    const opacity3 = useRef(new Animated.Value(0.2)).current;

    useEffect(() => {
        if (isActive) {
            const createRingAnimation = (scale: Animated.Value, opacity: Animated.Value, delay: number) => {
                return Animated.loop(
                    Animated.sequence([
                        Animated.delay(delay),
                        Animated.parallel([
                            Animated.timing(scale, { toValue: 2.2, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                            Animated.timing(opacity, { toValue: 0, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                        ]),
                        Animated.parallel([
                            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
                            Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
                        ]),
                    ])
                );
            };

            const anim1 = createRingAnimation(ring1, opacity1, 0);
            const anim2 = createRingAnimation(ring2, opacity2, 500);
            const anim3 = createRingAnimation(ring3, opacity3, 1000);

            anim1.start();
            anim2.start();
            anim3.start();

            return () => {
                anim1.stop();
                anim2.stop();
                anim3.stop();
            };
        } else {
            ring1.setValue(1);
            ring2.setValue(1);
            ring3.setValue(1);
            opacity1.setValue(0.6);
            opacity2.setValue(0.4);
            opacity3.setValue(0.2);
        }
    }, [isActive]);

    if (!isActive) return null;

    const ringStyle = {
        position: 'absolute' as const,
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: colors.error[400],
    };

    return (
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[ringStyle, { transform: [{ scale: ring1 }], opacity: opacity1 }]} />
            <Animated.View style={[ringStyle, { transform: [{ scale: ring2 }], opacity: opacity2 }]} />
            <Animated.View style={[ringStyle, { transform: [{ scale: ring3 }], opacity: opacity3 }]} />
        </View>
    );
};

// Animated Waveform Bars
const WaveformBars = ({ isActive, colors }: { isActive: boolean; colors: ThemeColors }) => {
    const bars = [
        useRef(new Animated.Value(0.3)).current,
        useRef(new Animated.Value(0.5)).current,
        useRef(new Animated.Value(0.4)).current,
        useRef(new Animated.Value(0.6)).current,
        useRef(new Animated.Value(0.3)).current,
    ];

    useEffect(() => {
        if (isActive) {
            const animations = bars.map((bar, index) => {
                return Animated.loop(
                    Animated.sequence([
                        Animated.timing(bar, {
                            toValue: 0.2 + Math.random() * 0.8,
                            duration: 200 + Math.random() * 300,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                        Animated.timing(bar, {
                            toValue: 0.3 + Math.random() * 0.4,
                            duration: 200 + Math.random() * 300,
                            easing: Easing.inOut(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ])
                );
            });

            animations.forEach(anim => anim.start());

            return () => {
                animations.forEach(anim => anim.stop());
            };
        }
    }, [isActive]);

    if (!isActive) return null;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 20 }}>
            {bars.map((bar, index) => (
                <Animated.View
                    key={index}
                    style={{
                        width: 3,
                        height: 20,
                        borderRadius: 1.5,
                        backgroundColor: '#ef4444',
                        transform: [{ scaleY: bar }],
                    }}
                />
            ))}
        </View>
    );
};

// Processing Sparkles Animation
const ProcessingSparkles = ({ colors }: { colors: ThemeColors }) => {
    const rotation = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.loop(
            Animated.parallel([
                Animated.timing(rotation, {
                    toValue: 1,
                    duration: 3000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.timing(scale, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
                    Animated.timing(scale, { toValue: 0.9, duration: 1000, useNativeDriver: true }),
                ]),
            ])
        ).start();
    }, []);

    const spin = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View style={{ transform: [{ rotate: spin }, { scale }] }}>
            <MaterialIcons name="auto-fix-high" size={48} color={colors.primary[500]} />
        </Animated.View>
    );
};

// Staggered Field Entry Animation
const AnimatedField = ({
    children,
    index,
    visible
}: {
    children: React.ReactNode;
    index: number;
    visible: boolean;
}) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    delay: index * 80,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 300,
                    delay: index * 80,
                    easing: Easing.out(Easing.back(1.5)),
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            opacity.setValue(0);
            translateY.setValue(20);
        }
    }, [visible]);

    return (
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>
            {children}
        </Animated.View>
    );
};

export function VoiceTaskCreator({
    visible,
    onDismiss,
    onTaskCreated,
    schoolCode,
    academicYearId,
    userId,
    availableClasses,
    availableSubjects,
}: VoiceTaskCreatorProps) {
    const { colors, isDark, typography, spacing, borderRadius } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark, typography, spacing, borderRadius), [colors, isDark, typography, spacing, borderRadius]);

    // Animation refs
    const modalScale = useRef(new Animated.Value(0.95)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;

    // State
    const [viewState, setViewState] = useState<ViewState>('input');
    const [textInput, setTextInput] = useState('');
    const [parsedTask, setParsedTask] = useState<ParsedTask | null>(null);
    const [logId, setLogId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedInputMethod, setSelectedInputMethod] = useState<'type' | 'speak'>('type');

    // Editable fields (for when user modifies AI suggestions)
    const [editedFields, setEditedFields] = useState<Partial<TaskFormData>>({});
    const [showClassPicker, setShowClassPicker] = useState(false);
    const [showSubjectPicker, setShowSubjectPicker] = useState(false);

    // Hooks
    const voiceRecording = useVoiceRecording();
    const { parseTaskInput, isParsing, resetParse, updateLog } = useParseTaskInput();

    // Modal animation on visibility change
    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(modalScale, {
                    toValue: 1,
                    tension: 280,
                    friction: 22,
                    useNativeDriver: true,
                }),
                Animated.timing(modalOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            modalScale.setValue(0.95);
            modalOpacity.setValue(0);
            // Reset state
            setViewState('input');
            setTextInput('');
            setParsedTask(null);
            setLogId(null);
            setEditedFields({});
            resetParse();
            voiceRecording.cancelRecording();
        }
    }, [visible]);

    // Format duration for display
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle mic button press
    const handleMicPress = useCallback(async () => {
        if (voiceRecording.state.isRecording) {
            // Stop recording and process
            const result = await voiceRecording.stopRecording();
            if (result) {
                setViewState('processing');
                try {
                    const parseResult = await parseTaskInput({
                        input_type: 'voice',
                        audio_base64: result.audioBase64,
                        school_code: schoolCode,
                        academic_year_id: academicYearId,
                        available_classes: availableClasses,
                        available_subjects: availableSubjects,
                    });
                    setParsedTask(parseResult.parsed_task || null);
                    setLogId(parseResult.log_id || null);
                    setViewState('preview');
                } catch (error) {
                    Alert.alert('Error', (error as Error).message || 'Failed to parse voice input');
                    setViewState('input');
                }
            } else {
                setViewState('input');
            }
        } else {
            // Start recording
            await voiceRecording.startRecording();
            setViewState('recording');
        }
    }, [voiceRecording, parseTaskInput, schoolCode, academicYearId, availableClasses, availableSubjects]);

    // Handle text submission
    const handleTextSubmit = useCallback(async () => {
        if (!textInput.trim()) {
            Alert.alert('Empty Input', 'Please enter a task description');
            return;
        }

        setViewState('processing');
        try {
            const parseResult = await parseTaskInput({
                input_type: 'text',
                text: textInput.trim(),
                school_code: schoolCode,
                academic_year_id: academicYearId,
                available_classes: availableClasses,
                available_subjects: availableSubjects,
            });
            setParsedTask(parseResult.parsed_task || null);
            setLogId(parseResult.log_id || null);
            setViewState('preview');
        } catch (error) {
            Alert.alert('Error', (error as Error).message || 'Failed to parse input');
            setViewState('input');
        }
    }, [textInput, parseTaskInput, schoolCode, academicYearId, availableClasses, availableSubjects]);

    // Cancel recording
    const handleCancelRecording = useCallback(async () => {
        await voiceRecording.cancelRecording();
        setViewState('input');
    }, [voiceRecording]);

    // Get final value for a field (edited or AI-parsed)
    const getFinalValue = <T,>(field: keyof TaskFormData, parsedField: FieldResult<T> | undefined): T | null => {
        if (editedFields[field] !== undefined) {
            return editedFields[field] as T;
        }
        return parsedField?.value ?? null;
    };

    // Check if all required fields are filled
    const canSubmit = useMemo(() => {
        if (!parsedTask) return false;

        const title = getFinalValue('title', parsedTask.title as FieldResult<string>);
        const classId = editedFields.class_instance_id ?? parsedTask.class?.value?.id;
        const subjectId = editedFields.subject_id ?? parsedTask.subject?.value?.id;
        const dueDate = getFinalValue('due_date', parsedTask.due_date as FieldResult<string>);

        return !!(title && classId && subjectId && dueDate);
    }, [parsedTask, editedFields]);

    // Handle task creation
    const handleCreateTask = useCallback(async () => {
        if (!parsedTask || !canSubmit) return;

        setIsSubmitting(true);
        try {
            const taskData: TaskFormData = {
                title: (getFinalValue('title', parsedTask.title as FieldResult<string>) || '').toString(),
                description: getFinalValue('description', parsedTask.description as FieldResult<string>),
                class_instance_id: (editedFields.class_instance_id ?? parsedTask.class?.value?.id) as string,
                subject_id: (editedFields.subject_id ?? parsedTask.subject?.value?.id) as string,
                due_date: (getFinalValue('due_date', parsedTask.due_date as FieldResult<string>) || '').toString(),
                assigned_date: (getFinalValue('assigned_date', parsedTask.assigned_date as FieldResult<string>) || new Date().toISOString().split('T')[0]).toString(),
                priority: (getFinalValue('priority', parsedTask.priority as FieldResult<'low' | 'medium' | 'high' | 'urgent'>) || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
                instructions: getFinalValue('instructions', parsedTask.instructions as FieldResult<string>),
                school_code: schoolCode,
                academic_year_id: academicYearId,
                created_by: userId,
            };

            const taskId = await onTaskCreated(taskData);

            // Update audit log
            if (logId) {
                const editsForLog = Object.keys(editedFields).length > 0
                    ? Object.fromEntries(
                        Object.entries(editedFields).map(([key, value]) => [key, { old: null, new: value }])
                    )
                    : undefined;

                await updateLog({
                    log_id: logId,
                    was_edited: Object.keys(editedFields).length > 0,
                    edits_made: editsForLog,
                    final_task_id: taskId,
                    status: 'confirmed',
                });
            }

            Alert.alert('Success', 'Task created successfully!');
            onDismiss();
        } catch (error) {
            Alert.alert('Error', (error as Error).message || 'Failed to create task');
        } finally {
            setIsSubmitting(false);
        }
    }, [parsedTask, editedFields, canSubmit, schoolCode, academicYearId, userId, logId, onTaskCreated, updateLog, onDismiss]);

    // Get confidence badge color
    const getConfidenceBadgeStyle = (confidence: number) => {
        if (confidence >= 0.8) {
            return { backgroundColor: colors.success[100], color: colors.success[700] };
        } else if (confidence >= 0.5) {
            return { backgroundColor: colors.warning[100], color: colors.warning[700] };
        }
        return { backgroundColor: colors.error[100], color: colors.error[700] };
    };

    // Render field status indicator
    const renderFieldStatus = (status: 'confirmed' | 'needs_review' | 'missing') => {
        if (status === 'confirmed') {
            return (
                <View style={[styles.statusBadge, { backgroundColor: colors.success[100] }]}>
                    <MaterialIcons name="check" size={12} color={colors.success[600]} />
                </View>
            );
        } else if (status === 'needs_review') {
            return (
                <View style={[styles.statusBadge, { backgroundColor: colors.warning[100] }]}>
                    <MaterialIcons name="error" size={12} color={colors.warning[600]} />
                </View>
            );
        } else {
            return (
                <View style={[styles.statusBadge, { backgroundColor: colors.error[100] }]}>
                    <MaterialIcons name="close" size={12} color={colors.error[600]} />
                </View>
            );
        }
    };

    // Render preview field card
    const renderPreviewField = (
        label: string,
        field: FieldResult<unknown> | undefined,
        displayValue: string,
        icon: React.ReactNode,
        index: number,
        onPress?: () => void
    ) => {
        const status = field ? getFieldStatus(field) : 'missing';
        const isEditable = !!onPress;
        const confidenceStyle = field ? getConfidenceBadgeStyle(field.confidence) : null;

        return (
            <AnimatedField index={index} visible={viewState === 'preview'} key={label}>
                <TouchableOpacity
                    style={styles.previewFieldCard}
                    onPress={onPress}
                    disabled={!isEditable}
                    activeOpacity={isEditable ? 0.7 : 1}
                >
                    <View style={styles.previewFieldIconContainer}>
                        {icon}
                    </View>
                    <View style={styles.previewFieldContent}>
                        <Text style={styles.previewFieldLabel}>{label}</Text>
                        <Text style={[
                            styles.previewFieldValue,
                            status === 'missing' && styles.previewFieldMissing,
                        ]}>
                            {displayValue || 'Not specified'}
                        </Text>
                        {field?.source === 'inferred' && field.raw_input && (
                            <Text style={styles.previewFieldHint}>
                                Parsed from: "{field.raw_input}"
                            </Text>
                        )}
                    </View>
                    <View style={styles.previewFieldMeta}>
                        {renderFieldStatus(status)}
                        {field && (
                            <View style={[styles.confidenceBadge, { backgroundColor: confidenceStyle?.backgroundColor }]}>
                                <Text style={[styles.confidenceText, { color: confidenceStyle?.color }]}>
                                    {formatConfidence(field.confidence)}
                                </Text>
                            </View>
                        )}
                        {isEditable && <MaterialIcons name="keyboard-arrow-down" size={16} color={colors.text.tertiary} />}
                    </View>
                </TouchableOpacity>
            </AnimatedField>
        );
    };

    // Render priority badge
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'low': return colors.success[500];
            case 'medium': return colors.warning[500];
            case 'high': return colors.error[500];
            case 'urgent': return colors.error[600];
            default: return colors.text.secondary;
        }
    };

    // Gradient colors
    const primaryGradient = isDark
        ? ['#4c63d2', '#6c4dbd'] as const
        : ['#667eea', '#764ba2'] as const;

    const sageGradient = isDark
        ? ['#059669', '#0d9488'] as const
        : ['#10b981', '#14b8a6'] as const;

    return (
        <>
            <ThemedModal
                visible={visible}
                onDismiss={onDismiss}
                dismissable={false}
                dismissableBackButton={false}
                contentContainerStyle={styles.modalWrapper}
            >
                <Animated.View style={[
                    styles.modal,
                    {
                        transform: [{ scale: modalScale }],
                        opacity: modalOpacity,
                    }
                ]}>
                    {/* Gradient Border Effect */}
                    <LinearGradient
                        colors={primaryGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientBorder}
                    />

                    <View style={styles.modalInner}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerContent}>
                                <LinearGradient
                                    colors={sageGradient}
                                    style={styles.sageIconContainer}
                                >
                                    <MaterialIcons name="auto-awesome" size={20} color="#fff" />
                                </LinearGradient>
                                <View>
                                    <Text style={styles.headerTitle}>Sage Voice Assistant</Text>
                                    <Text style={styles.headerSubtitle}>AI-powered task creation</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
                                <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.content}
                            contentContainerStyle={styles.contentContainer}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Input State - Two Column Layout */}
                            {viewState === 'input' && (
                                <View style={styles.inputContainer}>
                                    {/* Welcome Text */}
                                    <View style={styles.welcomeSection}>
                                        <Text style={styles.welcomeText}>How would you like to create your task?</Text>
                                    </View>

                                    {/* Two Input Cards Side by Side */}
                                    <View style={styles.inputCardsRow}>
                                        {/* Type Card */}
                                        <TouchableOpacity
                                            style={[
                                                styles.inputCard,
                                                selectedInputMethod === 'type' && styles.inputCardActive
                                            ]}
                                            onPress={() => setSelectedInputMethod('type')}
                                        >
                                            <View style={[
                                                styles.inputCardIcon,
                                                {
                                                    backgroundColor: selectedInputMethod === 'type'
                                                        ? colors.primary[100]
                                                        : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                                                }
                                            ]}>
                                                <MaterialIcons name="edit" size={18} color={selectedInputMethod === 'type' ? colors.primary[600] : colors.text.tertiary} />
                                            </View>
                                            <Text style={[styles.inputCardTitle, selectedInputMethod === 'type' && { color: colors.primary[600] }]}>Type</Text>
                                        </TouchableOpacity>

                                        {/* Speak Card */}
                                        <TouchableOpacity
                                            style={[
                                                styles.inputCard,
                                                selectedInputMethod === 'speak' && styles.inputCardActive
                                            ]}
                                            onPress={() => {
                                                setSelectedInputMethod('speak');
                                                if (!voiceRecording.state.permissionDenied) {
                                                    handleMicPress();
                                                }
                                            }}
                                            disabled={voiceRecording.state.isPreparing}
                                        >
                                            <View style={[
                                                styles.inputCardIcon,
                                                {
                                                    backgroundColor: selectedInputMethod === 'speak'
                                                        ? (voiceRecording.state.permissionDenied ? colors.neutral[200] : colors.success[100])
                                                        : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                                                }
                                            ]}>
                                                {voiceRecording.state.isPreparing ? (
                                                    <ActivityIndicator size="small" color={colors.success[600]} />
                                                ) : voiceRecording.state.permissionDenied ? (
                                                    <MaterialIcons name="mic-off" size={18} color={colors.neutral[400]} />
                                                ) : (
                                                    <MaterialIcons name="mic" size={18} color={selectedInputMethod === 'speak' ? colors.success[600] : colors.text.tertiary} />
                                                )}
                                            </View>
                                            <Text style={[styles.inputCardTitle, selectedInputMethod === 'speak' && !voiceRecording.state.permissionDenied && { color: colors.success[600] }]}>
                                                {voiceRecording.state.permissionDenied ? 'Unavailable' : 'Speak'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Text Input Area */}
                                    <View style={styles.textInputWrapper}>
                                        <RNTextInput
                                            style={styles.textInput}
                                            placeholder="Type your task here... e.g., 'Give Grade 8 math homework on fractions due Monday'"
                                            placeholderTextColor={colors.text.tertiary}
                                            multiline
                                            value={textInput}
                                            onChangeText={setTextInput}
                                        />
                                        {textInput.trim() ? (
                                            <TouchableOpacity
                                                style={styles.sendButton}
                                                onPress={handleTextSubmit}
                                            >
                                                <LinearGradient
                                                    colors={primaryGradient}
                                                    style={styles.sendButtonGradient}
                                                >
                                                    <MaterialIcons name="auto-fix-high" size={18} color="#fff" />
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    {voiceRecording.state.permissionDenied && (
                                        <Text style={styles.permissionHint}>
                                            Mic unavailable. Type your task instead.
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Recording State - Compact Design */}
                            {viewState === 'recording' && (
                                <View style={styles.recordingContainer}>
                                    {/* Compact Recording Bar */}
                                    <View style={styles.recordingBar}>
                                        {/* Stop Button */}
                                        <TouchableOpacity
                                            style={styles.stopButton}
                                            onPress={handleMicPress}
                                        >
                                            <MaterialIcons name="stop" size={18} color="#fff" />
                                        </TouchableOpacity>

                                        {/* Recording Info + Waveform */}
                                        <View style={styles.recordingMid}>
                                            <View style={styles.recordingIndicator}>
                                                <View style={styles.recordingDot} />
                                                <Text style={styles.recordingText}>REC</Text>
                                            </View>
                                            <WaveformBars isActive={true} colors={colors} />
                                        </View>

                                        {/* Timer */}
                                        <Text style={styles.durationText}>
                                            {formatDuration(voiceRecording.state.duration)}
                                        </Text>
                                    </View>

                                    {/* Cancel Link */}
                                    <TouchableOpacity onPress={handleCancelRecording}>
                                        <Text style={styles.cancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Processing State */}
                            {viewState === 'processing' && (
                                <View style={styles.processingContainer}>
                                    <ProcessingSparkles colors={colors} />
                                    <Text style={styles.processingText}>
                                        {isParsing ? 'Sage is analyzing...' : 'Transcribing your voice...'}
                                    </Text>
                                    <Text style={styles.processingHint}>
                                        Extracting task details with AI
                                    </Text>
                                    <View style={styles.processingDots}>
                                        <ActivityIndicator size="small" color={colors.primary[500]} />
                                    </View>
                                </View>
                            )}

                            {/* Preview State */}
                            {viewState === 'preview' && parsedTask && (
                                <View style={styles.previewContainer}>
                                    {/* Review Banner */}
                                    <AnimatedField index={0} visible={true}>
                                        <LinearGradient
                                            colors={canSubmit
                                                ? [colors.success[50], colors.success[100]] as const
                                                : [colors.warning[50], colors.warning[100]] as const
                                            }
                                            style={styles.reviewBanner}
                                        >
                                            {canSubmit ? (
                                                <>
                                                    <MaterialIcons name="check" size={18} color={colors.success[600]} />
                                                    <Text style={[styles.reviewBannerText, { color: colors.success[700] }]}>
                                                        All required fields ready. Review and confirm.
                                                    </Text>
                                                </>
                                            ) : (
                                                <>
                                                    <MaterialIcons name="error" size={18} color={colors.warning[600]} />
                                                    <Text style={[styles.reviewBannerText, { color: colors.warning[700] }]}>
                                                        Some fields need your input. Tap to edit.
                                                    </Text>
                                                </>
                                            )}
                                        </LinearGradient>
                                    </AnimatedField>

                                    {/* Task Preview Fields */}
                                    {renderPreviewField(
                                        'Title',
                                        parsedTask.title,
                                        (editedFields.title ?? parsedTask.title?.value) as string || '',
                                        <MaterialIcons name="edit" size={18} color={colors.primary[500]} />,
                                        1
                                    )}

                                    {renderPreviewField(
                                        'Class',
                                        parsedTask.class,
                                        (editedFields.class_instance_id
                                            ? availableClasses.find(c => c.id === editedFields.class_instance_id)?.label
                                            : parsedTask.class?.value?.label) || '',
                                        <MaterialIcons name="group" size={18} color={colors.primary[500]} />,
                                        2,
                                        () => setShowClassPicker(true)
                                    )}

                                    {renderPreviewField(
                                        'Subject',
                                        parsedTask.subject,
                                        (editedFields.subject_id
                                            ? availableSubjects.find(s => s.id === editedFields.subject_id)?.name
                                            : parsedTask.subject?.value?.name) || '',
                                        <MaterialIcons name="menu-book" size={18} color={colors.primary[500]} />,
                                        3,
                                        () => setShowSubjectPicker(true)
                                    )}

                                    {renderPreviewField(
                                        'Due Date',
                                        parsedTask.due_date,
                                        parsedTask.due_date_display || (parsedTask.due_date?.value as string) || '',
                                        <MaterialIcons name="event" size={18} color={colors.primary[500]} />,
                                        4
                                    )}

                                    {renderPreviewField(
                                        'Priority',
                                        parsedTask.priority,
                                        ((editedFields.priority ?? parsedTask.priority?.value) as string || 'medium').toUpperCase(),
                                        <MaterialIcons name="flag" size={18} color={getPriorityColor((editedFields.priority ?? parsedTask.priority?.value) as string || 'medium')} />,
                                        5
                                    )}

                                    {/* Actions */}
                                    <AnimatedField index={6} visible={true}>
                                        <View style={styles.previewActions}>
                                            <Button
                                                variant="outline"
                                                onPress={() => setViewState('input')}
                                                style={styles.backButton}
                                            >
                                                Try Again
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onPress={handleCreateTask}
                                                disabled={!canSubmit || isSubmitting}
                                                loading={isSubmitting}
                                                style={styles.createButton}
                                                icon={<MaterialIcons name="check" size={18} color="#fff" />}
                                            >
                                                Create Task
                                            </Button>
                                        </View>
                                    </AnimatedField>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </Animated.View>
            </ThemedModal>

            {/* Class Picker Modal */}
            <ThemedModal
                visible={showClassPicker}
                onDismiss={() => setShowClassPicker(false)}
                contentContainerStyle={styles.pickerModal}
            >
                <Text style={styles.pickerTitle}>Select Class</Text>
                <ScrollView style={styles.pickerList}>
                    {availableClasses.map(cls => (
                        <TouchableOpacity
                            key={cls.id}
                            style={[
                                styles.pickerItem,
                                (editedFields.class_instance_id ?? parsedTask?.class?.value?.id) === cls.id && styles.pickerItemSelected
                            ]}
                            onPress={() => {
                                setEditedFields(prev => ({ ...prev, class_instance_id: cls.id }));
                                setShowClassPicker(false);
                            }}
                        >
                            <Text style={styles.pickerItemText}>{cls.label}</Text>
                            {(editedFields.class_instance_id ?? parsedTask?.class?.value?.id) === cls.id && (
                                <MaterialIcons name="check" size={18} color={colors.primary[500]} />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <Button variant="outline" onPress={() => setShowClassPicker(false)}>Close</Button>
            </ThemedModal>

            {/* Subject Picker Modal */}
            <ThemedModal
                visible={showSubjectPicker}
                onDismiss={() => setShowSubjectPicker(false)}
                contentContainerStyle={styles.pickerModal}
            >
                <Text style={styles.pickerTitle}>Select Subject</Text>
                <ScrollView style={styles.pickerList}>
                    {availableSubjects.map(subj => (
                        <TouchableOpacity
                            key={subj.id}
                            style={[
                                styles.pickerItem,
                                (editedFields.subject_id ?? parsedTask?.subject?.value?.id) === subj.id && styles.pickerItemSelected
                            ]}
                            onPress={() => {
                                setEditedFields(prev => ({ ...prev, subject_id: subj.id }));
                                setShowSubjectPicker(false);
                            }}
                        >
                            <Text style={styles.pickerItemText}>{subj.name}</Text>
                            {(editedFields.subject_id ?? parsedTask?.subject?.value?.id) === subj.id && (
                                <MaterialIcons name="check" size={18} color={colors.primary[500]} />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <Button variant="outline" onPress={() => setShowSubjectPicker(false)}>Close</Button>
            </ThemedModal>
        </>
    );
}

const createStyles = (colors: ThemeColors, isDark: boolean, typography: any, spacing: any, borderRadius: any) =>
    StyleSheet.create({
        modalWrapper: {
            margin: spacing.md,
            justifyContent: 'center',
            flex: 1,
        },
        modal: {
            width: '100%',
            minHeight: 320,
            borderRadius: borderRadius.xl,
            overflow: 'hidden',
        },
        gradientBorder: {
            ...StyleSheet.absoluteFillObject,
        },
        modalInner: {
            flex: 1,
            backgroundColor: isDark ? 'rgba(22, 22, 28, 0.99)' : '#fff',
            margin: 2,
            borderRadius: borderRadius.xl - 2,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
        headerContent: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        sageIconContainer: {
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerTitle: {
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.semibold as any,
            color: colors.text.primary,
        },
        headerSubtitle: {
            fontSize: typography.fontSize.xs,
            color: colors.text.tertiary,
        },
        closeButton: {
            padding: spacing.xs,
            borderRadius: borderRadius.full,
        },
        content: {
            flex: 1,
        },
        contentContainer: {
            padding: spacing.md,
        },

        // Input State
        inputContainer: {
            gap: spacing.md,
        },
        welcomeSection: {
            alignItems: 'center',
            marginBottom: spacing.xs,
        },
        welcomeText: {
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
            textAlign: 'center',
        },
        inputCardsRow: {
            flexDirection: 'row',
            gap: spacing.sm,
        },
        inputCard: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderWidth: 2,
            borderColor: 'transparent',
            gap: spacing.sm,
        },
        inputCardActive: {
            borderColor: colors.primary[400],
            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)',
        },
        inputCardIcon: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        inputCardIconGradient: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        inputCardTitle: {
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium as any,
            color: colors.text.primary,
        },
        inputCardDesc: {
            fontSize: typography.fontSize.xs,
            color: colors.text.tertiary,
        },
        textInputWrapper: {
            position: 'relative',
        },
        textInput: {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            paddingRight: 48,
            fontSize: typography.fontSize.sm,
            color: colors.text.primary,
            minHeight: 80,
            textAlignVertical: 'top',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        },
        sendButton: {
            position: 'absolute',
            right: spacing.sm,
            bottom: spacing.sm,
            borderRadius: 18,
            overflow: 'hidden',
        },
        sendButtonGradient: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
        },
        permissionHint: {
            fontSize: typography.fontSize.xs,
            color: colors.warning[600],
            textAlign: 'center',
            fontStyle: 'italic',
        },
        // Legacy styles (keep for other states)
        inputLabel: {
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium as any,
            color: colors.text.secondary,
            textAlign: 'center',
        },
        textInputContainer: {
            position: 'relative',
        },
        textInputUnderline: {
            position: 'absolute',
            bottom: 0,
            left: spacing.md,
            right: spacing.md,
            height: 2,
            backgroundColor: colors.primary[500],
            borderRadius: 1,
            opacity: 0,
        },
        dividerContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginVertical: spacing.xs,
        },
        dividerLine: {
            flex: 1,
            height: 1,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        },
        orText: {
            fontSize: typography.fontSize.sm,
            color: colors.text.tertiary,
            fontWeight: typography.fontWeight.medium as any,
        },
        inputActions: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        micButton: {
            borderRadius: 30,
            overflow: 'hidden',
            shadowColor: colors.primary[500],
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 6,
        },
        micButtonDisabled: {
            shadowOpacity: 0.1,
        },
        micButtonGradient: {
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
        },
        submitTextButton: {
            borderRadius: borderRadius.md,
            marginTop: spacing.sm,
        },
        submitTextButtonDisabled: {
            opacity: 0.5,
        },
        submitTextButtonContent: {
            paddingVertical: spacing.xs,
        },
        micLabel: {
            fontSize: typography.fontSize.xs,
            color: colors.text.tertiary,
            marginTop: spacing.xs,
        },
        permissionDeniedBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.warning[50],
            padding: spacing.md,
            borderRadius: borderRadius.md,
        },
        permissionDeniedText: {
            flex: 1,
            fontSize: typography.fontSize.sm,
            color: colors.warning[700],
        },

        // Recording State - Compact Bar
        recordingContainer: {
            alignItems: 'center',
            gap: spacing.sm,
        },
        recordingBar: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fef2f2',
            borderRadius: borderRadius.lg,
            padding: spacing.sm,
            paddingHorizontal: spacing.md,
            gap: spacing.md,
            borderWidth: 1,
            borderColor: '#fecaca',
        },
        stopButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#ef4444',
            alignItems: 'center',
            justifyContent: 'center',
        },
        recordingMid: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        recordingIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        recordingDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#ef4444',
        },
        recordingText: {
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.bold as any,
            color: '#ef4444',
        },
        durationText: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.bold as any,
            color: colors.text.primary,
            fontVariant: ['tabular-nums'],
        },
        cancelText: {
            fontSize: typography.fontSize.sm,
            color: colors.text.tertiary,
            marginTop: spacing.xs,
        },

        // Processing State
        processingContainer: {
            alignItems: 'center',
            gap: spacing.lg,
            paddingVertical: spacing.xl * 2,
        },
        processingText: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold as any,
            color: colors.text.primary,
            marginTop: spacing.md,
        },
        processingHint: {
            fontSize: typography.fontSize.sm,
            color: colors.text.tertiary,
        },
        processingDots: {
            marginTop: spacing.md,
        },

        // Preview State
        previewContainer: {
            gap: spacing.sm,
        },
        reviewBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            marginBottom: spacing.sm,
        },
        reviewBannerText: {
            flex: 1,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium as any,
        },
        previewFieldCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.md,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            gap: spacing.md,
        },
        previewFieldIconContainer: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        previewFieldContent: {
            flex: 1,
        },
        previewFieldLabel: {
            fontSize: typography.fontSize.xs,
            color: colors.text.tertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 2,
        },
        previewFieldValue: {
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.medium as any,
            color: colors.text.primary,
        },
        previewFieldMissing: {
            color: colors.error[500],
            fontStyle: 'italic',
        },
        previewFieldHint: {
            fontSize: typography.fontSize.xs,
            color: colors.text.tertiary,
            fontStyle: 'italic',
            marginTop: 2,
        },
        previewFieldMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
        },
        statusBadge: {
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
        },
        confidenceBadge: {
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: borderRadius.sm,
        },
        confidenceText: {
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.semibold as any,
        },
        previewActions: {
            flexDirection: 'row',
            gap: spacing.md,
            marginTop: spacing.lg,
        },
        backButton: {
            flex: 1,
            borderRadius: borderRadius.lg,
        },
        createButton: {
            flex: 2,
            borderRadius: borderRadius.lg,
        },

        // Picker Modals
        pickerModal: {
            backgroundColor: colors.surface.primary,
            margin: spacing.lg,
            borderRadius: borderRadius.xl,
            padding: spacing.lg,
            maxHeight: '60%',
        },
        pickerTitle: {
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.bold as any,
            color: colors.text.primary,
            marginBottom: spacing.md,
        },
        pickerList: {
            maxHeight: 300,
            marginBottom: spacing.md,
        },
        pickerItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.md,
            borderRadius: borderRadius.md,
        },
        pickerItemSelected: {
            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
        },
        pickerItemText: {
            fontSize: typography.fontSize.base,
            color: colors.text.primary,
        },
    });

export default VoiceTaskCreator;
