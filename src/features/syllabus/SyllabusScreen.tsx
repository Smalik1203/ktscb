/**
 * SyllabusScreen
 *
 * Academic syllabus workspace for teachers/admins.
 * Clean hierarchy: Filters → Progress summary → Chapter accordion with inline topics.
 * Overflow menus for destructive actions, meaningful progress labels.
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity,
  Modal, Dimensions, Animated, Text, ActivityIndicator, Pressable, Platform,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Svg, { Circle } from 'react-native-svg';
import StudentSyllabusTab from './StudentSyllabusScreen';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { EmptyState, Input, Modal as CustomModal, Button, FAB } from '../../ui';
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import {
  computeProgress, fetchClassesForSchool, fetchProgress, fetchSubjectsForSchool,
  fetchSyllabusTree, ensureSyllabusId, addChapter, updateChapter, deleteChapter,
  addTopic, updateTopic, deleteTopic, type SyllabusTree,
} from '../../services/syllabus';
import { AddChapterTopicModal } from '../../components/syllabus';

// ─── Initial data hook ─────────────────────────────────────────────
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

// ─── Circular Progress Ring ────────────────────────────────────────
function CircularRing({
  size = 64,
  strokeWidth = 5,
  progress = 0,
  label = '',
  color,
  trackColor,
}: {
  size?: number;
  strokeWidth?: number;
  progress: number;
  label: string;
  color: string;
  trackColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, isFinite(progress) ? progress : 0));
  const dashOffset = circumference * (1 - clamped);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset} strokeLinecap="round" fill="none"
          rotation={-90} origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{
        position: 'absolute', fontSize: 14, fontWeight: '700', color,
        textAlign: 'center',
      }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Teacher Syllabus Screen ───────────────────────────────────────
function TeacherSyllabusScreen() {
  const { colors, spacing, borderRadius, shadows, isDark } = useTheme();
  const { subjects, classes, loading: metaLoading } = useInitialData();
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [tree, setTree] = useState<SyllabusTree>({ chapters: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taught, setTaught] = useState<{ taughtChapters: Set<string>; taughtTopics: Set<string> }>({
    taughtChapters: new Set(), taughtTopics: new Set(),
  });
  const [editingTopic, setEditingTopic] = useState<{ id: string; title: string; description: string | null } | null>(null);
  const [editingChapter, setEditingChapter] = useState<{ id: string; title: string } | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'chapter' | 'topic'>('chapter');
  const [targetChapterId, setTargetChapterId] = useState<string | null>(null);
  const [overflowMenuId, setOverflowMenuId] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(colors, isDark, spacing, borderRadius, shadows), [colors, isDark, spacing, borderRadius, shadows]);

  // ── Data loading ────────────────────────────────────────────────
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

  const selectedSubjectName = useMemo(() => {
    return subjects.find(s => s.id === selectedSubjectId)?.subject_name || 'this subject';
  }, [subjects, selectedSubjectId]);

  // ── CRUD handlers ───────────────────────────────────────────────
  const onAddChapter = async (title: string, description: string) => {
    setBusy(true);
    const sid = await ensureSyllabusId(selectedClassId, selectedSubjectId);
    await addChapter(sid, { title, description: description || '' });
    await loadDetails();
    setBusy(false);
  };

  const onUpdateChapter = async (chapterId: string, next: { title?: string; description?: string }) => {
    try { setBusy(true); await updateChapter(chapterId, next); await loadDetails(); }
    catch (e: any) { Alert.alert('Update Failed', e?.message || ''); }
    finally { setBusy(false); }
  };

  const onDeleteChapter = (chapterId: string) => {
    Alert.alert('Delete Chapter', 'This will remove the chapter and all its topics. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { setBusy(true); await deleteChapter(chapterId); await loadDetails(); }
          catch (e: any) { Alert.alert('Delete Failed', e?.message || ''); }
          finally { setBusy(false); }
        },
      },
    ]);
  };

  const onAddTopic = async (title: string, description: string) => {
    if (!targetChapterId) throw new Error('No chapter selected');
    setBusy(true);
    await addTopic(targetChapterId, { title, description: description || '' });
    await loadDetails();
    setBusy(false);
  };

  const onUpdateTopic = async (topicId: string, next: { title?: string; description?: string }) => {
    try { setBusy(true); await updateTopic(topicId, next); await loadDetails(); }
    catch (e: any) { Alert.alert('Update Failed', e?.message || ''); }
    finally { setBusy(false); }
  };

  const onDeleteTopic = (topicId: string) => {
    Alert.alert('Delete Topic', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { setBusy(true); await deleteTopic(topicId); await loadDetails(); }
          catch (e: any) { Alert.alert('Delete Failed', e?.message || ''); }
          finally { setBusy(false); }
        },
      },
    ]);
  };

  // ── Bottom sheet animations ─────────────────────────────────────
  const classSlideAnim = useRef(new Animated.Value(0)).current;
  const subjectSlideAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openSheet = useCallback((anim: Animated.Value) => {
    anim.setValue(0);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
    ]).start();
  }, [overlayOpacity]);

  const closeSheet = useCallback((anim: Animated.Value, cb: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(cb);
  }, [overlayOpacity]);

  useEffect(() => { if (showClassDropdown) openSheet(classSlideAnim); }, [showClassDropdown, openSheet, classSlideAnim]);
  useEffect(() => { if (showSubjectDropdown) openSheet(subjectSlideAnim); }, [showSubjectDropdown, openSheet, subjectSlideAnim]);

  // ── Per-chapter progress ────────────────────────────────────────
  const getChapterProgress = useCallback((node: SyllabusTree['chapters'][0]) => {
    const total = node.topics.length;
    const completed = node.topics.filter(t => taught.taughtTopics.has(t.id)).length;
    return { total, completed, pct: total > 0 ? completed / total : 0 };
  }, [taught]);

  // ── Bottom sheet renderer ───────────────────────────────────────
  const renderBottomSheet = (
    visible: boolean, slideAnim: Animated.Value, title: string,
    onClose: () => void, children: React.ReactNode,
  ) => (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, {
          transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }],
        }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );

  const renderSheetOption = (key: string, label: string, isActive: boolean, onPress: () => void) => (
    <TouchableOpacity key={key} style={[styles.sheetOption, isActive && styles.sheetOptionActive]} onPress={onPress} activeOpacity={0.6}>
      <Text style={[styles.sheetOptionText, isActive && styles.sheetOptionTextActive]}>{label}</Text>
      {isActive && (
        <View style={styles.sheetCheck}>
          <MaterialIcons name="check" size={16} color={colors.text.inverse} />
        </View>
      )}
    </TouchableOpacity>
  );

  // ── Main render ─────────────────────────────────────────────────
  const hasData = !!selectedClassId && !!selectedSubjectId && !refreshing && tree.chapters.length > 0;

  return (
    <View style={styles.container}>
      {/* Dismiss overflow menu */}
      {overflowMenuId && <Pressable style={StyleSheet.absoluteFill} onPress={() => setOverflowMenuId(null)} />}

      {/* Filter chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterChip} onPress={() => setShowClassDropdown(true)} activeOpacity={0.7}>
          <Text style={[styles.filterChipText, selectedClassId ? styles.filterChipTextActive : undefined]} numberOfLines={1}>
            {selectedClassId
              ? `${classes.find(c => c.id === selectedClassId)?.grade}-${classes.find(c => c.id === selectedClassId)?.section}`
              : 'Select Class'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={16} color={selectedClassId ? colors.primary[600] : colors.text.tertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip} onPress={() => setShowSubjectDropdown(true)} activeOpacity={0.7}>
          <Text style={[styles.filterChipText, selectedSubjectId ? styles.filterChipTextActive : undefined]} numberOfLines={1}>
            {selectedSubjectId ? (subjects.find(s => s.id === selectedSubjectId)?.subject_name || 'Subject') : 'Select Subject'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={16} color={selectedSubjectId ? colors.primary[600] : colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Loading state */}
      {(metaLoading || refreshing) && (
        <View style={styles.centerFill}><ActivityIndicator color={colors.primary[600]} /></View>
      )}

      {/* Empty states */}
      {!metaLoading && !refreshing && (!classes?.length || !subjects?.length) && (
        <View style={styles.centerFill}>
          <EmptyState
            title="No classes or subjects yet"
            message="Create classes and subjects to start building your syllabus."
            icon={<MaterialIcons name="menu-book" size={56} color={colors.neutral[300]} />}
            variant="card"
          />
        </View>
      )}

      {!metaLoading && !refreshing && (classes?.length ?? 0) > 0 && (subjects?.length ?? 0) > 0 && (!selectedClassId || !selectedSubjectId) && (
        <View style={styles.centerFill}>
          <EmptyState
            title="Select a Class & Subject"
            message="Choose from the filters above to view and manage the syllabus."
            icon={<MaterialIcons name="menu-book" size={56} color={colors.neutral[300]} />}
            variant="card"
          />
        </View>
      )}

      {!!selectedClassId && !!selectedSubjectId && !refreshing && tree.chapters.length === 0 && (
        <View style={styles.centerFill}>
          <EmptyState
            title="No syllabus yet"
            message={`Tap the + button to start building chapters for ${selectedSubjectName}.`}
            icon={<MaterialIcons name="menu-book" size={56} color={colors.neutral[300]} />}
            variant="card"
          />
        </View>
      )}

      {/* Main content */}
      {hasData && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDetails} tintColor={colors.primary[600]} colors={[colors.primary[600]]} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress summary */}
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <View style={styles.progressItem}>
                <CircularRing
                  progress={(progress.overallPct || 0) / 100}
                  label={`${Math.round(progress.overallPct || 0)}%`}
                  color={colors.primary[600]}
                  trackColor={isDark ? colors.neutral[700] : colors.neutral[100]}
                  size={60} strokeWidth={5}
                />
                <Text style={styles.progressTitle}>Overall</Text>
                <Text style={styles.progressSubtitle}>syllabus taught</Text>
              </View>
              <View style={[styles.progressDivider, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]} />
              <View style={styles.progressItem}>
                <CircularRing
                  progress={progress.totalTopics > 0 ? progress.completedTopics / progress.totalTopics : 0}
                  label={`${progress.completedTopics}/${progress.totalTopics}`}
                  color={colors.success[600]}
                  trackColor={isDark ? colors.neutral[700] : colors.neutral[100]}
                  size={60} strokeWidth={5}
                />
                <Text style={styles.progressTitle}>Topics</Text>
                <Text style={styles.progressSubtitle}>completed</Text>
              </View>
              <View style={[styles.progressDivider, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]} />
              <View style={styles.progressItem}>
                <CircularRing
                  progress={progress.totalChapters > 0 ? progress.startedChapters / progress.totalChapters : 0}
                  label={`${progress.startedChapters}/${progress.totalChapters}`}
                  color={colors.warning[600]}
                  trackColor={isDark ? colors.neutral[700] : colors.neutral[100]}
                  size={60} strokeWidth={5}
                />
                <Text style={styles.progressTitle}>Chapters</Text>
                <Text style={styles.progressSubtitle}>{progress.startedChapters} of {progress.totalChapters} started</Text>
              </View>
            </View>
          </View>

          {/* Chapter cards */}
          <View style={styles.chapterList}>
            {tree.chapters.map((node) => {
              const cp = getChapterProgress(node);
              const isExpanded = expandedChapterId === node.chapter.id;
              const isMenuOpen = overflowMenuId === `ch-${node.chapter.id}`;

              return (
                <View key={node.chapter.id} style={styles.chapterCard}>
                  {/* Chapter header */}
                  <TouchableOpacity
                    style={styles.chapterHeader}
                    onPress={() => setExpandedChapterId(prev => prev === node.chapter.id ? null : node.chapter.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.chapterLeft}>
                      <View style={[styles.chapterIcon, { backgroundColor: colors.primary[50] }]}>
                        <MaterialIcons name="menu-book" size={20} color={colors.primary[600]} />
                      </View>
                      <View style={styles.chapterInfo}>
                        <Text style={styles.chapterTitle} numberOfLines={2}>{node.chapter.title}</Text>
                        {node.chapter.description ? (
                          <Text style={styles.chapterDesc} numberOfLines={1}>{node.chapter.description}</Text>
                        ) : null}
                        {/* Inline topic count + progress bar */}
                        <View style={styles.chapterMeta}>
                          <Text style={styles.chapterMetaText}>
                            {cp.completed}/{cp.total} topics
                          </Text>
                          <View style={styles.miniProgressBar}>
                            <View style={[styles.miniProgressFill, {
                              width: `${cp.pct * 100}%`,
                              backgroundColor: cp.pct === 1 ? colors.success[500] : colors.primary[500],
                            }]} />
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.chapterRight}>
                      {/* Overflow menu */}
                      <View style={{ position: 'relative', zIndex: 10 }}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setOverflowMenuId(isMenuOpen ? null : `ch-${node.chapter.id}`);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.overflowBtn}
                        >
                          <MaterialIcons name="more-vert" size={20} color={colors.text.tertiary} />
                        </TouchableOpacity>
                        {isMenuOpen && (
                          <View style={styles.overflowMenu}>
                            <TouchableOpacity style={styles.menuItem} onPress={() => {
                              setOverflowMenuId(null);
                              setAddMode('topic'); setTargetChapterId(node.chapter.id); setShowAddForm(true);
                            }}>
                              <MaterialIcons name="add" size={18} color={colors.text.secondary} />
                              <Text style={styles.menuItemText}>Add Topic</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={() => {
                              setOverflowMenuId(null);
                              setEditingChapter({ id: node.chapter.id, title: node.chapter.title });
                            }}>
                              <MaterialIcons name="edit" size={18} color={colors.text.secondary} />
                              <Text style={styles.menuItemText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={() => {
                              setOverflowMenuId(null);
                              onDeleteChapter(node.chapter.id);
                            }}>
                              <MaterialIcons name="delete-outline" size={18} color={colors.error[600]} />
                              <Text style={[styles.menuItemText, { color: colors.error[600] }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      {/* Expand chevron */}
                      <MaterialIcons
                        name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                        size={22} color={colors.text.tertiary}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded: topics list */}
                  {isExpanded && (
                    <View style={styles.topicsContainer}>
                      <View style={styles.topicsHeader}>
                        <Text style={styles.topicsLabel}>Topics ({node.topics.length})</Text>
                        <TouchableOpacity onPress={() => { setAddMode('topic'); setTargetChapterId(node.chapter.id); setShowAddForm(true); }}>
                          <Text style={styles.addTopicLink}>+ Add Topic</Text>
                        </TouchableOpacity>
                      </View>

                      {node.topics.length === 0 && (
                        <Text style={styles.emptyTopics}>No topics yet. Tap "+ Add Topic" to create one.</Text>
                      )}

                      {node.topics.map(t => {
                        const isTaught = taught.taughtTopics.has(t.id);
                        const isTopicMenu = overflowMenuId === `tp-${t.id}`;

                        return (
                          <View key={t.id} style={styles.topicRow}>
                            <MaterialIcons
                              name={isTaught ? 'check-circle' : 'radio-button-unchecked'}
                              size={20}
                              color={isTaught ? colors.success[500] : colors.neutral[300]}
                            />
                            <View style={styles.topicContent}>
                              <Text style={[styles.topicTitle, isTaught && styles.topicTitleDone]}>{t.title}</Text>
                              {t.description ? <Text style={styles.topicDesc} numberOfLines={1}>{t.description}</Text> : null}
                            </View>
                            {/* Topic overflow */}
                            <View style={{ position: 'relative', zIndex: 10 }}>
                              <TouchableOpacity
                                onPress={() => setOverflowMenuId(isTopicMenu ? null : `tp-${t.id}`)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.overflowBtn}
                              >
                                <MaterialIcons name="more-vert" size={18} color={colors.text.tertiary} />
                              </TouchableOpacity>
                              {isTopicMenu && (
                                <View style={[styles.overflowMenu, { right: 0, top: 28 }]}>
                                  <TouchableOpacity style={styles.menuItem} onPress={() => {
                                    setOverflowMenuId(null);
                                    setEditingTopic({ id: t.id, title: t.title, description: t.description || '' });
                                  }}>
                                    <MaterialIcons name="edit" size={18} color={colors.text.secondary} />
                                    <Text style={styles.menuItemText}>Edit</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={() => {
                                    setOverflowMenuId(null);
                                    onDeleteTopic(t.id);
                                  }}>
                                    <MaterialIcons name="delete-outline" size={18} color={colors.error[600]} />
                                    <Text style={[styles.menuItemText, { color: colors.error[600] }]}>Delete</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* FAB */}
      <FAB
        icon="add"
        onPress={() => { setAddMode('chapter'); setTargetChapterId(null); setShowAddForm(true); }}
        visible={!!selectedClassId && !!selectedSubjectId}
        disabled={busy}
      />

      {/* ── Modals ──────────────────────────────────────────────── */}

      {/* Topic Edit */}
      <CustomModal visible={!!editingTopic} onDismiss={() => setEditingTopic(null)}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit Topic</Text>
          <TouchableOpacity onPress={() => setEditingTopic(null)}><MaterialIcons name="close" size={24} color={colors.text.secondary} /></TouchableOpacity>
        </View>
        {editingTopic && (
          <>
            <ScrollView style={{ maxHeight: 300 }}>
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>Title *</Text>
                <Input value={editingTopic.title} onChangeText={(v: string) => setEditingTopic({ ...editingTopic, title: v })} placeholder="Topic title" />
                <View style={{ height: spacing.md }} />
                <Text style={styles.modalLabel}>Description</Text>
                <Input value={editingTopic.description || ''} onChangeText={(v: string) => setEditingTopic({ ...editingTopic, description: v })} placeholder="Optional description" multiline numberOfLines={3} />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={() => setEditingTopic(null)} style={{ flex: 1 }} />
              <Button title="Save" onPress={async () => {
                if (!editingTopic) return;
                await onUpdateTopic(editingTopic.id, { title: editingTopic.title, description: editingTopic.description || '' });
                setEditingTopic(null);
              }} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </CustomModal>

      {/* Chapter Edit */}
      <CustomModal visible={!!editingChapter} onDismiss={() => setEditingChapter(null)}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit Chapter</Text>
          <TouchableOpacity onPress={() => setEditingChapter(null)}><MaterialIcons name="close" size={24} color={colors.text.secondary} /></TouchableOpacity>
        </View>
        {editingChapter && (
          <>
            <ScrollView style={{ maxHeight: 300 }}>
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>Title *</Text>
                <Input value={editingChapter.title} onChangeText={(v: string) => setEditingChapter({ ...editingChapter, title: v })} placeholder="Chapter title" />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={() => setEditingChapter(null)} style={{ flex: 1 }} />
              <Button title="Save" onPress={async () => {
                if (!editingChapter) return;
                await onUpdateChapter(editingChapter.id, { title: editingChapter.title });
                setEditingChapter(null);
              }} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </CustomModal>

      {/* Add Chapter/Topic */}
      <AddChapterTopicModal
        visible={showAddForm}
        onDismiss={() => setShowAddForm(false)}
        mode={addMode}
        busy={busy}
        onSubmit={async (title, description) => {
          if (addMode === 'chapter') await onAddChapter(title, description);
          else await onAddTopic(title, description);
        }}
      />

      {/* Class selector */}
      {renderBottomSheet(showClassDropdown, classSlideAnim, 'Select Class',
        () => closeSheet(classSlideAnim, () => setShowClassDropdown(false)),
        classes.map(c => renderSheetOption(
          c.id, `${c.grade}-${c.section}`, selectedClassId === c.id,
          () => { setSelectedClassId(c.id); closeSheet(classSlideAnim, () => setShowClassDropdown(false)); },
        )),
      )}

      {/* Subject selector */}
      {renderBottomSheet(showSubjectDropdown, subjectSlideAnim, 'Select Subject',
        () => closeSheet(subjectSlideAnim, () => setShowSubjectDropdown(false)),
        subjects.map(s => renderSheetOption(
          s.id, s.subject_name, selectedSubjectId === s.id,
          () => { setSelectedSubjectId(s.id); closeSheet(subjectSlideAnim, () => setShowSubjectDropdown(false)); },
        )),
      )}
    </View>
  );
}

// ─── Entrypoint: Role router ───────────────────────────────────────
export default function SyllabusTab() {
  const { can } = useCapabilities();
  if (!can('syllabus.manage')) return <StudentSyllabusTab />;
  return <TeacherSyllabusScreen />;
}

// ═════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════

const createStyles = (
  colors: ThemeColors, isDark: boolean, spacing: any, borderRadius: any, shadows: any,
) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  scrollContent: { paddingBottom: 120 },

  // ── Filters ──────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
    gap: spacing.sm,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: 9,
    paddingHorizontal: 14,
    ...shadows.xs,
  },
  filterChipText: { fontSize: 13, fontWeight: '500' as const, color: colors.text.secondary },
  filterChipTextActive: { color: colors.primary[600], fontWeight: '600' as const },

  // ── Progress card ────────────────────────────────────────────
  progressCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    ...shadows.sm,
  },
  progressRow: { flexDirection: 'row', alignItems: 'flex-start' },
  progressItem: { flex: 1, alignItems: 'center', gap: 6 },
  progressDivider: { width: 1, height: 80, marginTop: 4 },
  progressTitle: { fontSize: 13, fontWeight: '600' as const, color: colors.text.primary, textAlign: 'center' },
  progressSubtitle: { fontSize: 11, fontWeight: '400' as const, color: colors.text.tertiary, textAlign: 'center', lineHeight: 14, maxWidth: 90 },

  // ── Chapter list ─────────────────────────────────────────────
  chapterList: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 10 },
  chapterCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    overflow: 'visible',
    ...shadows.sm,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  chapterLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  chapterIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  chapterInfo: { flex: 1, minWidth: 0 },
  chapterTitle: { fontSize: 16, fontWeight: '600' as const, color: colors.text.primary, lineHeight: 22, letterSpacing: -0.2 },
  chapterDesc: { fontSize: 13, color: colors.text.tertiary, marginTop: 1, lineHeight: 18 },
  chapterMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  chapterMetaText: { fontSize: 11, fontWeight: '500' as const, color: colors.text.tertiary },
  miniProgressBar: {
    flex: 1, height: 4, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
    borderRadius: 2, maxWidth: 80, overflow: 'hidden',
  },
  miniProgressFill: { height: '100%', borderRadius: 2 },
  chapterRight: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8 },

  // ── Overflow menu ────────────────────────────────────────────
  overflowBtn: { padding: 4 },
  overflowMenu: {
    position: 'absolute', top: 32, right: 0,
    backgroundColor: colors.surface.primary, borderRadius: borderRadius.lg,
    paddingVertical: 4, minWidth: 150,
    ...shadows.lg,
    ...(isDark && { borderWidth: 1, borderColor: colors.border.DEFAULT }),
    zIndex: 100, elevation: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  menuItemDanger: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.light },
  menuItemText: { fontSize: 14, fontWeight: '500' as const, color: colors.text.primary },

  // ── Topics (expanded) ────────────────────────────────────────
  topicsContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? colors.neutral[700] : colors.neutral[100],
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
  },
  topicsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  topicsLabel: { fontSize: 13, fontWeight: '600' as const, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  addTopicLink: { fontSize: 13, fontWeight: '600' as const, color: colors.primary[600] },
  emptyTopics: { fontSize: 13, color: colors.text.tertiary, fontStyle: 'italic', paddingVertical: 8 },
  topicRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[50],
  },
  topicContent: { flex: 1, minWidth: 0 },
  topicTitle: { fontSize: 15, fontWeight: '500' as const, color: colors.text.primary, lineHeight: 20 },
  topicTitleDone: { color: colors.text.tertiary },
  topicDesc: { fontSize: 12, color: colors.text.tertiary, marginTop: 1 },

  // ── Bottom sheet ─────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: spacing.sm, paddingBottom: spacing.xl + 16, maxHeight: '65%',
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: colors.border.DEFAULT, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '700' as const, color: colors.text.primary, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sheetScroll: { paddingHorizontal: spacing.md, maxHeight: 380 },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: spacing.md,
    borderRadius: 12, marginBottom: 4,
  },
  sheetOptionActive: { backgroundColor: isDark ? colors.primary[100] : `${colors.primary[600]}0A` },
  sheetOptionText: { flex: 1, fontSize: 15, fontWeight: '500' as const, color: colors.text.primary },
  sheetOptionTextActive: { color: colors.primary[600], fontWeight: '600' as const },
  sheetCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary[600], justifyContent: 'center', alignItems: 'center' },

  // ── Modals ───────────────────────────────────────────────────
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border.light,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: colors.text.primary },
  modalBody: { padding: spacing.lg },
  modalLabel: { fontSize: 13, fontWeight: '600' as const, color: colors.text.secondary, marginBottom: 6 },
  modalActions: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.border.light,
  },
});
