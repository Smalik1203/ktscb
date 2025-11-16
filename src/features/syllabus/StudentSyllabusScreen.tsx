import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import {
  BookOpen,
  CheckCircle2,
  Circle as CircleIcon,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography, spacing, borderRadius } from '../../../lib/design-system';
import { EmptyState } from '../../components/ui';
import { 
  fetchSyllabusTree, 
  fetchProgress, 
  computeProgress, 
  type SyllabusTree 
} from '../../services/syllabus';
import { supabase } from '../../lib/supabase';
import Svg, { Circle } from 'react-native-svg';

export default function StudentSyllabusTab() {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<{ id: string; subject_name: string }[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [tree, setTree] = useState<SyllabusTree>({ chapters: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [taught, setTaught] = useState<{ taughtChapters: Set<string>; taughtTopics: Set<string> }>({ taughtChapters: new Set(), taughtTopics: new Set() });
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

  const classInstanceId = profile?.class_instance_id;
  const schoolCode = profile?.school_code;

  // Animated values for bottom sheet
  const subjectSlideAnim = React.useRef(new Animated.Value(0)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  // Load subjects for the student's class
  useEffect(() => {
    const loadSubjects = async () => {
      if (!schoolCode || !classInstanceId) return;
      
      setLoading(true);
      try {
        // Fetch subjects from timetable for this class
        const { data, error } = await supabase
          .from('timetable_slots')
          .select('subject_id, subjects!inner(subject_name, id)')
          .eq('class_instance_id', classInstanceId)
          .order('subjects(subject_name)', { ascending: true });

        if (error) throw error;
        
        // Extract unique subjects
        const uniqueSubjects = new Map();
        data?.forEach((item: any) => {
          if (item.subjects) {
            uniqueSubjects.set(item.subjects.id, {
              id: item.subjects.id,
              subject_name: item.subjects.subject_name,
            });
          }
        });
        
        setSubjects(Array.from(uniqueSubjects.values()));
        
        // Auto-select first subject if available
        if (uniqueSubjects.size > 0 && !selectedSubjectId) {
          const firstSubject = Array.from(uniqueSubjects.values())[0];
          setSelectedSubjectId(firstSubject.id);
        }
      } catch (error) {
        console.error('Error loading subjects:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSubjects();
  }, [schoolCode, classInstanceId, selectedSubjectId]);

  // Load syllabus and progress when subject is selected
  const loadSyllabus = React.useCallback(async () => {
    if (!selectedSubjectId || !classInstanceId) return;
    
    setRefreshing(true);
    try {
      const [treeRes, progressRes] = await Promise.all([
        fetchSyllabusTree(classInstanceId, selectedSubjectId),
        fetchProgress(classInstanceId, selectedSubjectId),
      ]);
      
      setTree(treeRes);
      setTaught(progressRes);
    } catch (error) {
      console.error('Error loading syllabus:', error);
    } finally {
      setRefreshing(false);
    }
  }, [selectedSubjectId, classInstanceId]);

  useEffect(() => {
    loadSyllabus();
  }, [loadSyllabus]);

  // Animation effects for dropdown
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

  const progress = useMemo(() => computeProgress(tree, taught), [tree, taught]);

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

  const selectedSubjectName = useMemo(() => {
    return subjects.find(s => s.id === selectedSubjectId)?.subject_name || 'Subject';
  }, [subjects, selectedSubjectId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Subject Filter */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterItem} onPress={() => setShowSubjectDropdown(true)}>
            <View style={styles.filterIcon}>
              <FileText size={16} color={colors.text.inverse} />
            </View>
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

      {/* Loading State */}
      {(loading || refreshing) && tree.chapters.length === 0 && (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading syllabus...</Text>
        </View>
      )}

      {/* Empty State - No subjects */}
      {!loading && !refreshing && subjects.length === 0 && (
        <View style={styles.emptyFill}>
          <View style={styles.largeEmptyCard}>
            <EmptyState
              title="No subjects available"
              message="Your class hasn't been assigned any subjects yet."
              icon={<BookOpen size={64} color={colors.neutral[300]} />}
              variant="card"
            />
          </View>
        </View>
      )}

      {/* Empty State - No syllabus */}
      {!loading && !refreshing && subjects.length > 0 && selectedSubjectId && tree.chapters.length === 0 && (
        <View style={styles.emptyFill}>
          <View style={styles.largeEmptyCard}>
            <EmptyState
              title="No syllabus yet"
              message={`No syllabus has been created for ${selectedSubjectName} yet.`}
              icon={<BookOpen size={64} color={colors.neutral[300]} />}
              variant="card"
            />
          </View>
        </View>
      )}

      {/* Syllabus Content */}
      {subjects.length > 0 && selectedSubjectId && tree.chapters.length > 0 && (
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadSyllabus} />}
        >
          {/* Progress Indicators */}
          <View style={styles.progressIndicatorsContainer}>
            <View style={styles.progressIndicator}>
              <CircularRing 
                progress={(progress.overallPct || 0) / 100} 
                label={`${Math.round(progress.overallPct || 0)}%`} 
              />
              <Text style={styles.progressLabel}>Overall</Text>
            </View>
            
            <View style={styles.progressIndicator}>
              <CircularRing 
                progress={progress.totalTopics > 0 ? (progress.completedTopics / progress.totalTopics) : 0} 
                label={`${progress.completedTopics}/${progress.totalTopics}`} 
              />
              <Text style={styles.progressLabel}>Topics</Text>
            </View>
            
            <View style={styles.progressIndicator}>
              <CircularRing 
                progress={progress.totalChapters > 0 ? (progress.startedChapters / progress.totalChapters) : 0} 
                label={`${progress.startedChapters}/${progress.totalChapters}`} 
              />
              <Text style={styles.progressLabel}>Chapters</Text>
            </View>
          </View>

          {/* Syllabus Chapters and Topics */}
          <View style={styles.cardList}>
            {tree.chapters.map((node) => (
              <Card key={node.chapter.id} style={styles.card}>
                <TouchableOpacity 
                  style={styles.chapterCardHeader}
                  onPress={() => setExpandedChapterId(prev => prev === node.chapter.id ? null : node.chapter.id)}
                >
                  <View style={styles.chapterCardContent}>
                    <View style={styles.chapterInfo}>
                      <View style={styles.chapterIconContainer}>
                        <BookOpen size={20} color={colors.primary[600]} />
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
                    <View style={styles.chevronContainer}>
                      {expandedChapterId === node.chapter.id ? (
                        <ChevronUp size={24} color={colors.primary[600]} />
                      ) : (
                        <ChevronDown size={24} color={colors.neutral[300]} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {expandedChapterId === node.chapter.id && (
                  <View style={styles.expandedContent}>
                    {node.topics.length > 0 ? (
                      node.topics.map((t) => (
                        <View key={t.id} style={styles.topicItem}>
                          <View style={styles.topicIcon}>
                            {taught.taughtTopics.has(t.id) ? (
                              <CheckCircle2 size={20} color={colors.success[600]} />
                            ) : (
                              <CircleIcon size={20} color={colors.neutral[400]} />
                            )}
                          </View>
                          <View style={styles.topicContent}>
                            <Text style={styles.topicTitle}>{t.title}</Text>
                            {t.description && (
                              <Text style={styles.topicDescription}>{t.description}</Text>
                            )}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noTopicsText}>No topics added yet</Text>
                    )}
                  </View>
                )}
              </Card>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Subject Selector Modal */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.app },
  center: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary
  },
  filterSection: { 
    paddingHorizontal: spacing.lg, 
    paddingTop: spacing.md, 
    paddingBottom: spacing.lg,
  },
  filterRow: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterItem: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    minWidth: 0 
  },
  filterIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: colors.primary[600], 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: spacing.sm, 
    flexShrink: 0 
  },
  filterContent: { 
    flex: 1, 
    minWidth: 0, 
    alignItems: 'flex-start' 
  },
  filterLabel: { 
    fontSize: typography.fontSize.xs, 
    fontWeight: typography.fontWeight.medium, 
    color: colors.text.secondary, 
    marginBottom: spacing.xs 
  },
  filterValue: { 
    fontSize: typography.fontSize.sm, 
    fontWeight: typography.fontWeight.semibold, 
    color: colors.text.primary 
  },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  progressIndicator: {
    alignItems: 'center',
    flex: 1,
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
    marginTop: spacing.xs,
  },
  contentContainer: { paddingBottom: 140 },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    backgroundColor: colors.surface.primary,
  },
  chapterCardHeader: { 
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
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
  chevronContainer: {
    paddingLeft: spacing.sm,
  },
  expandedContent: { 
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  topicIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  topicContent: {
    flex: 1,
  },
  topicTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  topicDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  noTopicsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.sm,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    flex: 1,
  },
  // Bottom Sheet Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetTitle: { 
    fontSize: typography.fontSize.lg, 
    fontWeight: typography.fontWeight.bold as any, 
    color: colors.text.primary, 
    marginBottom: 8, 
    paddingHorizontal: spacing.lg 
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    maxHeight: 400,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: 2,
    backgroundColor: '#F9FAFB',
  },
  sheetItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium as any,
    flex: 1,
  },
  sheetItemActive: {
    backgroundColor: '#EEF2FF',
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
});