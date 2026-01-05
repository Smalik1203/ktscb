import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, Modal, Dimensions, Animated } from 'react-native';
import { Card, List, ActivityIndicator, Button, Text, IconButton, TextInput, Portal } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { BookOpen, FileText, X, ChevronDown } from 'lucide-react-native';
import StudentSyllabusTab from './StudentSyllabusScreen';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { spacing, borderRadius, typography, colors } from '../../../lib/design-system';
import { EmptyState } from '../../components/ui';
// removed import/export UI
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { computeProgress, fetchClassesForSchool, fetchProgress, fetchSubjectsForSchool, fetchSyllabusTree, ensureSyllabusId, addChapter, updateChapter, deleteChapter, addTopic, updateTopic, deleteTopic, type SyllabusTree } from '../../services/syllabus';
import { AddChapterTopicModal } from '../../components/syllabus';

function useInitialData() {
    const { profile } = useAuth();
    const [subjects, setSubjects] = useState<{ id: string; subject_name: string }[]>([]);
    const [classes, setClasses] = useState<{ id: string; grade: number | null; section: string | null }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const reload = useCallback(async () => {
        if (!profile?.school_code) return;
        setLoading(true);
        setError(null);
        try {
            const [subs, cls] = await Promise.all([
                fetchSubjectsForSchool(profile.school_code),
                fetchClassesForSchool(profile.school_code),
            ]);
            setSubjects(subs);
            setClasses(cls);
        } catch (e: any) {
            setError(e?.message || 'Failed loading data');
        } finally {
            setLoading(false);
        }
    }, [profile?.school_code]);
    useEffect(() => { reload(); }, [reload]);
    return { subjects, classes, loading, error, reload };
}

function TeacherSyllabusScreen() {
    const { colors, isDark } = useTheme();
    const { subjects, classes, loading: metaLoading } = useInitialData();
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [showClassDropdown, setShowClassDropdown] = useState(false);
    const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
    const [tree, setTree] = useState<SyllabusTree>({ chapters: [] });
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [taught, setTaught] = useState<{ taughtChapters: Set<string>; taughtTopics: Set<string> }>({ taughtChapters: new Set(), taughtTopics: new Set() });
    const [editingTopic, setEditingTopic] = useState<{ id: string; title: string; description: string | null } | null>(null);
    
    // Create dynamic styles based on theme
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
    const [editingChapter, setEditingChapter] = useState<{ id: string; title: string } | null>(null);
    const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
    // Add form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [addMode, setAddMode] = useState<'chapter' | 'topic'>('chapter');
    const [targetChapterId, setTargetChapterId] = useState<string | null>(null);

    const loadDetails = useCallback(async () => {
        if (!selectedSubjectId || !selectedClassId) return;
        setRefreshing(true);
        try {
            const [treeRes, progressRes] = await Promise.all([
                fetchSyllabusTree(selectedClassId, selectedSubjectId),
                fetchProgress(selectedClassId, selectedSubjectId),
            ]);
            setTree(treeRes);
            setTaught(progressRes);
        } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to load syllabus');
        } finally {
            setRefreshing(false);
        }
    }, [selectedClassId, selectedSubjectId]);

    useEffect(() => { loadDetails(); }, [loadDetails]);

    const progress = useMemo(() => computeProgress(tree, taught), [tree, taught]);
    const emptyCardMinHeight = useMemo(() => {
        const h = Dimensions.get('window').height;
        return Math.max(280, Math.round(h * 0.35));
    }, []);
    const selectedSubjectName = useMemo(() => {
        return subjects.find(s => s.id === selectedSubjectId)?.subject_name || 'this subject';
    }, [subjects, selectedSubjectId]);

    const CircularRing = ({ size = 70, strokeWidth = 6, progress = 0, label = '' }: { size?: number; strokeWidth?: number; progress: number; label: string }) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const clamped = Math.max(0, Math.min(1, isFinite(progress) ? progress : 0));
        const dashOffset = circumference * (1 - clamped);
        return (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={size} height={size}>
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={colors.neutral[200]}
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={colors.primary[600]}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        fill="none"
                        rotation={-90}
                        origin={`${size / 2}, ${size / 2}`}
                    />
                </Svg>
                <Text style={[styles.progressValue, { position: 'absolute' }]}>{label}</Text>
            </View>
        );
    };

    const onAddChapter = async (title: string, description: string) => {
        setBusy(true);
        const sid = await ensureSyllabusId(selectedClassId, selectedSubjectId);
        await addChapter(sid, { title, description: description || '' });
        await loadDetails();
        setBusy(false);
    };

    const onUpdateChapter = async (chapterId: string, next: { title?: string; description?: string }) => {
        try {
            setBusy(true);
            await updateChapter(chapterId, next);
            await loadDetails();
        } catch (e: any) {
            Alert.alert('Update Chapter Failed', e?.message || '');
        } finally { setBusy(false); }
    };

    const onDeleteChapter = async (chapterId: string) => {
        Alert.alert('Delete Chapter', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try { setBusy(true); await deleteChapter(chapterId); await loadDetails(); }
                catch (e: any) { Alert.alert('Delete Failed', e?.message || ''); }
                finally { setBusy(false); }
            }},
        ]);
    };

    const onAddTopic = async (title: string, description: string) => {
        if (!targetChapterId) {
            throw new Error('No chapter selected');
        }
        setBusy(true);
        await addTopic(targetChapterId, { title, description: description || '' });
        await loadDetails();
        setBusy(false);
    };

    const onUpdateTopic = async (topicId: string, next: { title?: string; description?: string }) => {
        try {
            setBusy(true);
            await updateTopic(topicId, next);
            await loadDetails();
        } catch (e: any) {
            Alert.alert('Update Topic Failed', e?.message || '');
        } finally { setBusy(false); }
    };

    const onDeleteTopic = async (topicId: string) => {
        Alert.alert('Delete Topic', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try { setBusy(true); await deleteTopic(topicId); await loadDetails(); }
                catch (e: any) { Alert.alert('Delete Failed', e?.message || ''); }
                finally { setBusy(false); }
            }},
        ]);
    };

    // removed CSV import/export actions per request

    // Animated values for bottom sheet animations (match resources implementation)
    const classSlideAnim = React.useRef(new Animated.Value(0)).current;
    const subjectSlideAnim = React.useRef(new Animated.Value(0)).current;
    const overlayOpacity = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (showClassDropdown) {
            classSlideAnim.setValue(0);
            overlayOpacity.setValue(0);
            Animated.parallel([
                Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
                Animated.spring(classSlideAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
                Animated.timing(classSlideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
            ]).start();
        }
    }, [showClassDropdown, classSlideAnim, overlayOpacity]);

    useEffect(() => {
        if (showSubjectDropdown) {
            subjectSlideAnim.setValue(0);
            overlayOpacity.setValue(0);
            Animated.parallel([
                Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
                Animated.spring(subjectSlideAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
                Animated.timing(subjectSlideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
            ]).start();
        }
    }, [showSubjectDropdown, subjectSlideAnim, overlayOpacity]);

    return (
        <View style={styles.container}>
            <View style={styles.filterSection}>
                <View style={styles.filterRow}>
                    <TouchableOpacity style={styles.filterItem} onPress={() => setShowClassDropdown(true)}>
                        <View style={styles.filterIcon}><BookOpen size={16} color={colors.text.inverse} /></View>
                        <View style={styles.filterContent}>
                            <Text style={styles.filterLabel}>Class</Text>
                            <Text style={styles.filterValue}>
                                {selectedClassId ? `${classes.find(c => c.id === selectedClassId)?.grade}-${classes.find(c => c.id === selectedClassId)?.section}` : 'Select'}
                            </Text>
                        </View>
                        <ChevronDown size={14} color={colors.text.secondary} style={{ marginLeft: spacing.xs, flexShrink: 0 }} />
                    </TouchableOpacity>
                    <View style={styles.filterDivider} />
                    <TouchableOpacity style={styles.filterItem} onPress={() => setShowSubjectDropdown(true)}>
                        <View style={styles.filterIcon}><FileText size={16} color={colors.text.inverse} /></View>
                        <View style={styles.filterContent}>
                            <Text style={styles.filterLabel}>Subject</Text>
                            <Text style={styles.filterValue}>
                                {selectedSubjectId ? (subjects.find(s => s.id === selectedSubjectId)?.subject_name || 'Subject') : 'Select'}
                            </Text>
                        </View>
                        <ChevronDown size={14} color={colors.text.secondary} style={{ marginLeft: spacing.xs, flexShrink: 0 }} />
                    </TouchableOpacity>
                </View>
            </View>

            {(metaLoading || refreshing) && (
                <View style={styles.center}><ActivityIndicator /></View>
            )}

            {/* Empty meta data states */}
            {!metaLoading && !refreshing && (!classes?.length || !subjects?.length) && (
                <View style={styles.emptyFill}>
                <View style={[styles.largeEmptyCard, styles.largeEmptyCardFill]}>
                    <EmptyState
                        title="No classes or subjects yet"
                        message="Create classes and subjects to start building your syllabus."
                        icon={<BookOpen size={64} color={colors.neutral[300]} />}
                        variant="card"
                    />
                </View>
                </View>
            )}

            {/* Prompt to choose filters */}
            {!metaLoading && !refreshing && (classes?.length ?? 0) > 0 && (subjects?.length ?? 0) > 0 && (!selectedClassId || !selectedSubjectId) && (
                <View style={styles.emptyFill}>
                <View style={[styles.largeEmptyCard, styles.largeEmptyCardFill]}>
                    <EmptyState
                        title="Select a Class"
                        message="Choose a class and subject from the list above to view and manage its syllabus."
                        icon={<BookOpen size={64} color={colors.neutral[300]} />}
                        variant="card"
                    />
                </View>
                </View>
            )}

            {!!selectedClassId && !!selectedSubjectId && !refreshing && tree.chapters.length === 0 && (
                <View style={styles.emptyFill}>
                <View style={[styles.largeEmptyCard, styles.largeEmptyCardFill]}>
                    <EmptyState
                        title="No syllabus yet"
                        message={`Tap '+ Add Chapter' to start building your syllabus for ${selectedSubjectName}.`}
                        actionLabel="Add Chapter"
                        onAction={() => { setAddMode('chapter'); setShowAddForm(true); }}
                        icon={<BookOpen size={64} color={colors.neutral[300]} />}
                        variant="card"
                    />
                </View>
                </View>
            )}

            {!!selectedClassId && !!selectedSubjectId && !refreshing && tree.chapters.length > 0 && (
                <ScrollView 
                    contentContainerStyle={styles.contentContainer}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDetails} />}
                > 
            {/* Circular Progress Indicators */}
            <View style={styles.progressIndicatorsContainer}>
                <View style={styles.progressIndicator}>
                    <CircularRing progress={(progress.overallPct || 0) / 100} label={`${Math.round(progress.overallPct || 0)}%`} />
                    <Text style={styles.progressLabel}>Overall</Text>
                </View>
                
                <View style={styles.progressIndicator}>
                    <CircularRing progress={progress.totalTopics > 0 ? (progress.completedTopics / progress.totalTopics) : 0} label={`${progress.completedTopics}/${progress.totalTopics}`} />
                    <Text style={styles.progressLabel}>Topics</Text>
                </View>
                
                <View style={styles.progressIndicator}>
                    <CircularRing progress={progress.totalChapters > 0 ? (progress.startedChapters / progress.totalChapters) : 0} label={`${progress.startedChapters}/${progress.totalChapters}`} />
                    <Text style={styles.progressLabel}>Chapters</Text>
                </View>
            </View>

                    <View style={styles.cardList}>
                    {tree.chapters.map(node => (
                        <Card 
                            key={node.chapter.id} 
                            style={styles.card}
                        >
                            <TouchableOpacity 
                                style={styles.chapterCardHeader}
                                onPress={() => setExpandedChapterId(prev => prev === node.chapter.id ? null : node.chapter.id)}
                            >
                                <View style={styles.chapterCardContent}>
                                    <View style={styles.chapterInfo}>
                                        <View style={styles.chapterIconContainer}>
                                            <List.Icon
                                                icon="book-outline"
                                                color={colors.primary[600]}
                                            />
                                        </View>
                                        <View style={styles.chapterTextContainer}>
                                            <Text style={styles.chapterTitle} numberOfLines={2}>
                                                {node.chapter.title}
                                            </Text>
                                            {node.chapter.description && (
                                                <Text style={styles.chapterDescription} numberOfLines={1}>
                                                    {node.chapter.description}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.chapterActionsRow}>
                                        <IconButton
                                            icon="pencil"
                                            size={18}
                                            onPress={() => setEditingChapter({ id: node.chapter.id, title: node.chapter.title })}
                                            accessibilityLabel="Edit Chapter"
                                        />
                                        <IconButton
                                            icon="delete"
                                            size={18}
                                            onPress={() => onDeleteChapter(node.chapter.id)}
                                            accessibilityLabel="Delete Chapter"
                                            iconColor={colors.error[600]}
                                        />
                                        <List.Icon 
                                            icon={expandedChapterId === node.chapter.id ? "chevron-up" : "chevron-down"} 
                                            color={colors.text.secondary}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>
                            {expandedChapterId === node.chapter.id && (
                                <View style={styles.expandedContent}>
                                    <View style={styles.topicHeader}>
                                        <View style={styles.topicHeaderWithButton}>
                                            <Text style={styles.topicHeaderTitle}>Topics</Text>
                                            <TouchableOpacity
                                                onPress={() => { setAddMode('topic'); setTargetChapterId(node.chapter.id); setShowAddForm(true); }}
                                                style={styles.addTopicButton}
                                            >
                                                <Text style={styles.addTopicButtonText}>Add Topic</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {node.topics.map(t => (
                                        <List.Item
                                            key={t.id}
                                            title={t.title}
                                            description={t.description || undefined}
                                            onPress={() => {
                                                Alert.alert('Progress Tracking', 'Marking as taught is managed from the Timetable. This view shows progress only.');
                                            }}
                                            left={props => (
                                                <TouchableOpacity onPress={() => {
                                                    Alert.alert('Progress Tracking', 'Mark/Unmark taught from the Timetable screen.');
                                                }}>
                                                    <List.Icon
                                                        {...props}
                                                        icon={taught.taughtTopics.has(t.id) ? 'checkbox-marked-circle-outline' : 'checkbox-blank-circle-outline'}
                                                        color={taught.taughtTopics.has(t.id) ? '#16a34a' : props.color}
                                                    />
                                                </TouchableOpacity>
                                            )}
                                            right={() => (
                                                <View style={styles.topicActions}>
                                                    <IconButton icon="pencil" onPress={() => setEditingTopic({ id: t.id, title: t.title, description: t.description || '' })} />
                                                    <IconButton icon="delete" onPress={() => onDeleteTopic(t.id)} />
                                                </View>
                                            )}
                                        />
                                    ))}
                                </View>
                            )}
                        </Card>
                    ))}
                    </View>
                </ScrollView>
            )}
            
            {/* Floating Action Button */}
            <View style={styles.fabContainer}>
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => { setAddMode('chapter'); setTargetChapterId(null); setShowAddForm(true); }}
                    disabled={busy}
                >
                    <List.Icon icon="plus" color="white" />
                </TouchableOpacity>
            </View>
            
            {/* Topic Edit Modal */}
            <Portal>
                <Modal visible={!!editingTopic} onDismiss={() => setEditingTopic(null)}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderTitle}>Edit Topic</Text>
                            <TouchableOpacity onPress={() => setEditingTopic(null)} style={styles.modalCloseButton}>
                                <X size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        {editingTopic && (
                            <>
                                <ScrollView style={styles.modalScrollView}>
                                    <View style={styles.modalForm}>
                                        <View style={styles.modalInputGroup}>
                                            <Text style={styles.modalInputLabel}>Title *</Text>
                                            <TextInput 
                                                mode="outlined" 
                                                value={editingTopic.title} 
                                                onChangeText={(v) => setEditingTopic({ ...editingTopic, title: v })} 
                                                placeholder="Enter topic title"
                                                style={styles.modalInput} 
                                            />
                                        </View>
                                        <View style={styles.modalInputGroup}>
                                            <Text style={styles.modalInputLabel}>Description</Text>
                                            <TextInput 
                                                mode="outlined" 
                                                value={editingTopic.description || ''} 
                                                onChangeText={(v) => setEditingTopic({ ...editingTopic, description: v })} 
                                                placeholder="Enter topic description (optional)"
                                                style={styles.modalInput} 
                                                multiline 
                                                numberOfLines={3}
                                            />
                                        </View>
                                    </View>
                                </ScrollView>
                                <View style={styles.modalActions}>
                                    <Button 
                                        mode="outlined" 
                                        onPress={() => setEditingTopic(null)}
                                        style={styles.modalCancelButton}
                                        textColor={colors.neutral[700]}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        mode="contained" 
                                        onPress={async () => {
                                            try {
                                                if (!editingTopic) return;
                                                await onUpdateTopic(editingTopic.id, { title: editingTopic.title, description: editingTopic.description || '' });
                                                setEditingTopic(null);
                                                await loadDetails();
                                            } catch (e: any) {
                                                Alert.alert('Save Failed', e?.message || '');
                                            }
                                        }}
                                        style={styles.modalSubmitButton}
                                    >
                                        Save
                                    </Button>
                                </View>
                            </>
                        )}
                    </View>
                </Modal>
            </Portal>

            {/* Add Chapter/Topic Modal */}
            <AddChapterTopicModal
                visible={showAddForm}
                onDismiss={() => setShowAddForm(false)}
                mode={addMode}
                busy={busy}
                onSubmit={async (title, description) => {
                    if (addMode === 'chapter') {
                        await onAddChapter(title, description);
                    } else {
                        await onAddTopic(title, description);
                    }
                }}
            />
            {/* Chapter Edit Modal */}
            <Portal>
                <Modal visible={!!editingChapter} onDismiss={() => setEditingChapter(null)}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderTitle}>Edit Chapter</Text>
                            <TouchableOpacity onPress={() => setEditingChapter(null)} style={styles.modalCloseButton}>
                                <X size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        {editingChapter && (
                            <>
                                <ScrollView style={styles.modalScrollView}>
                                    <View style={styles.modalForm}>
                                        <View style={styles.modalInputGroup}>
                                            <Text style={styles.modalInputLabel}>Title *</Text>
                                            <TextInput
                                                mode="outlined"
                                                value={editingChapter.title}
                                                onChangeText={(v) => setEditingChapter({ ...editingChapter, title: v })}
                                                placeholder="Enter chapter title"
                                                style={styles.modalInput}
                                            />
                                        </View>
                                    </View>
                                </ScrollView>
                                <View style={styles.modalActions}>
                                    <Button 
                                        mode="outlined" 
                                        onPress={() => setEditingChapter(null)}
                                        style={styles.modalCancelButton}
                                        textColor={colors.neutral[700]}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        mode="contained" 
                                        onPress={async () => {
                                            try {
                                                if (!editingChapter) return;
                                                await onUpdateChapter(editingChapter.id, { title: editingChapter.title });
                                                setEditingChapter(null);
                                                await loadDetails();
                                            } catch (e: any) {
                                                Alert.alert('Save Failed', e?.message || '');
                                            }
                                        }}
                                        style={styles.modalSubmitButton}
                                    >
                                        Save
                                    </Button>
                                </View>
                            </>
                        )}
                    </View>
                </Modal>
            </Portal>
            {/* Class Selector Modal - Animated Bottom Sheet (matching resources) */}
            <Modal
                visible={showClassDropdown}
                transparent
                animationType="none"
                onRequestClose={() => setShowClassDropdown(false)}
            >
                <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={() => setShowClassDropdown(false)}
                    />
                    <Animated.View
                        style={[
                            styles.bottomSheet,
                            {
                                transform: [
                                    {
                                        translateY: classSlideAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [500, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Select Class</Text>
                        <ScrollView style={styles.sheetContent}>
                            {classes.map(c => (
                                <TouchableOpacity
                                    key={c.id}
                                    style={[styles.sheetItem, selectedClassId === c.id && styles.sheetItemActive]}
                                    onPress={() => {
                                        setSelectedClassId(c.id);
                                        setShowClassDropdown(false);
                                    }}
                                >
                                    <Text style={[styles.sheetItemText, selectedClassId === c.id && styles.sheetItemTextActive]}>
                                        {c.grade}-{c.section}
                                    </Text>
                                    {selectedClassId === c.id && <Text style={styles.checkmark}>✓</Text>}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Animated.View>
                </Animated.View>
            </Modal>

            {/* Subject Selector Modal - Animated Bottom Sheet (matching resources) */}
            <Modal
                visible={showSubjectDropdown}
                transparent
                animationType="none"
                onRequestClose={() => setShowSubjectDropdown(false)}
            >
                <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={() => setShowSubjectDropdown(false)}
                    />
                    <Animated.View
                        style={[
                            styles.bottomSheet,
                            {
                                transform: [
                                    {
                                        translateY: subjectSlideAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [500, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Select Subject</Text>
                        <ScrollView style={styles.sheetContent}>
                            {subjects.map(s => (
                                <TouchableOpacity
                                    key={s.id}
                                    style={[styles.sheetItem, selectedSubjectId === s.id && styles.sheetItemActive]}
                                    onPress={() => {
                                        setSelectedSubjectId(s.id);
                                        setShowSubjectDropdown(false);
                                    }}
                                >
                                    <Text style={[styles.sheetItemText, selectedSubjectId === s.id && styles.sheetItemTextActive]}>
                                        {s.subject_name}
                                    </Text>
                                    {selectedSubjectId === s.id && <Text style={styles.checkmark}>✓</Text>}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Animated.View>
                </Animated.View>
            </Modal>
        </View>
    );
}

export default function SyllabusTab() {
    const { can } = useCapabilities();
    
    // Capability-based check - show staff view if user can manage syllabus
    const canManageSyllabus = can('syllabus.manage');
    
    if (!canManageSyllabus) {
        return <StudentSyllabusTab />;
    }
    return <TeacherSyllabusScreen />;
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.app },
    center: { padding: 24, alignItems: 'center', justifyContent: 'center' },
    filterSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
    filterRow: {
        backgroundColor: colors.surface.primary,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        paddingHorizontal: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 4,
        borderWidth: isDark ? 1 : 0,
        borderColor: colors.border.DEFAULT,
    },
    filterItem: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, overflow: 'hidden' },
    filterIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary[600], alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, flexShrink: 0 },
    filterContent: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
    filterLabel: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.text.secondary, marginBottom: spacing.xs },
    filterValue: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.text.primary },
    filterDivider: { width: 1, height: 40, backgroundColor: colors.border.DEFAULT, marginHorizontal: spacing.sm, flexShrink: 0 },
    summaryCard: { margin: 12 },
    progressIndicatorsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.lg,
        backgroundColor: colors.surface.primary,
        marginHorizontal: spacing.md,
        marginVertical: spacing.sm,
        borderRadius: 12,
        elevation: 1,
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    progressIndicator: {
        alignItems: 'center',
        flex: 1,
    },
    progressCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: colors.neutral[100],
        borderWidth: 4,
        borderColor: colors.primary[600],
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
        position: 'relative',
    },
    progressValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
        color: colors.text.primary,
        textAlign: 'center',
    },
    progressLabel: { 
        fontSize: typography.fontSize.xs, 
        color: colors.text.secondary, 
        textAlign: 'center',
        fontWeight: '500',
    },
    selectButtonContainer: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    selectButton: { 
        borderRadius: 24,
        width: '60%',
        elevation: 2,
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    selectButtonContent: { height: 48 },
    fabContainer: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 1000,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary[600],
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    contentContainer: {
        paddingBottom: 140,
    },
    cardList: {
        paddingHorizontal: spacing.md,
        gap: spacing.md,
        paddingTop: spacing.sm,
    },
    card: { 
        marginHorizontal: 0, 
        marginBottom: 0, 
        borderRadius: 16, 
        overflow: 'hidden',
        elevation: 1,
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        backgroundColor: colors.surface.primary,
    },
    cardDone: { borderColor: '#22c55e', borderWidth: 2 },
    chapterCardHeader: { 
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        minHeight: 88,
    },
    chapterCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    chapterInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    chapterIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary[50],
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    chapterTextContainer: {
        flex: 1,
    },
    chapterTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
        color: colors.text.primary,
        marginBottom: 2,
    },
    chapterDescription: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        lineHeight: 16,
    },
    chapterActions: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: spacing.sm,
    },
    chapterActionsRow: { flexDirection: 'row', alignItems: 'center' },
    selectedCard: { borderColor: colors.primary[600], borderWidth: 2 },
    selectionIndicator: { paddingRight: spacing.sm },
    selectedChapterActions: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.md, gap: spacing.sm },
    selectionModeActions: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: spacing.sm,
        width: '100%',
        justifyContent: 'center'
    },
    actionButton: { 
        borderRadius: 20,
        elevation: 1,
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    inlineEdit: { padding: 12, gap: 4 },
    inputLabel: { fontSize: typography.fontSize.xs, color: colors.text.secondary },
    input: { marginBottom: 4 },
    expandedContent: { padding: spacing.md },
    topicHeader: { marginBottom: spacing.sm },
    topicHeaderWithButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topicHeaderTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary },
    addTopicButton: { 
        paddingVertical: spacing.xs, 
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
    },
    addTopicButtonText: { 
        fontSize: typography.fontSize.sm, 
        fontWeight: typography.fontWeight.semibold, 
        color: colors.primary[600],
    },
    addTopicButtonContent: { height: 36 },
    deleteButton: { borderRadius: 20 },
    addTopicFab: { borderRadius: 18, marginRight: -4 },
    topicActions: { flexDirection: 'row', alignItems: 'center' },
    segmented: { padding: 12 },
    modalOverlay: { flex: 1, backgroundColor: colors.surface.overlay, justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.surface.primary, borderRadius: 16, padding: 16, maxHeight: '70%' },
    sheetTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold as any, color: colors.text.primary, marginBottom: 8, paddingHorizontal: spacing.lg },
    sheetList: { maxHeight: 400, marginBottom: 8 },
    sheetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        marginVertical: 2,
        backgroundColor: colors.surface.secondary,
    },
    sheetItemText: {
        fontSize: typography.fontSize.base,
        color: colors.text.primary,
        fontWeight: typography.fontWeight.medium as any,
        flex: 1,
    },
    // Bottom Sheet Styles
    bottomSheet: {
        backgroundColor: colors.surface.primary,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xl,
        maxHeight: '70%',
    },
    sheetHandle: {
        width: 36,
        height: 4,
        backgroundColor: colors.border.DEFAULT,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: spacing.sm,
    },
    sheetContent: {
        paddingHorizontal: spacing.lg,
        maxHeight: 400,
    },
    sheetItemActive: {
        backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
    },
    sheetItemTextActive: {
        color: colors.primary[600],
        fontWeight: typography.fontWeight.semibold as any,
    },
    checkmark: {
        fontSize: typography.fontSize.lg,
        color: colors.primary[600],
        fontWeight: typography.fontWeight.bold as any,
    },
    emptyFill: { flex: 1 },
    largeEmptyCard: {
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        backgroundColor: colors.surface.primary,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border.light,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.xl,
        justifyContent: 'center',
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    largeEmptyCardFill: { flex: 1 },
    // Modern Modal Styles
    modalContainer: {
        backgroundColor: colors.surface.primary,
        borderRadius: borderRadius.lg,
        margin: spacing.md,
        maxHeight: '90%',
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    modalHeaderTitle: {
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
        color: colors.text.primary,
    },
    modalCloseButton: {
        padding: spacing.xs,
    },
    modalScrollView: {
        maxHeight: 300,
    },
    modalForm: {
        padding: spacing.lg,
    },
    modalInputGroup: {
        marginBottom: spacing.md,
    },
    modalInputLabel: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    modalInput: {
        backgroundColor: colors.surface.primary,
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
    },
    modalCancelButton: {
        flex: 1,
    },
    modalSubmitButton: {
        flex: 1,
    },
});



