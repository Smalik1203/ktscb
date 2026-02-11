/**
 * ResourcesScreen
 *
 * Production-quality learning resources browser.
 * Students see only their class resources; admins see all with class filter.
 * Modern card-based UI with pill tabs, animated bottom sheets, and clear hierarchy.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Pressable,
  Linking,
  Animated,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import {
  BookOpen,
  FileText,
  Video as VideoIcon,
  Plus,
  Edit2,
  Trash2,
  Download,
  ChevronDown,
  Filter,
  Library,
  PlayCircle,
  File,
  Search,
  GraduationCap,
  Check,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  downloadAsync,
  cacheDirectory,
  StorageAccessFramework,
  readAsStringAsync,
  EncodingType,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { useInfiniteResources, useClassResources } from '../../hooks/useResources';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { LoadingView, ErrorView } from '../../components/ui';
import { EmptyStateIllustration } from '../../components/ui/EmptyStateIllustration';
import { VideoPlayer } from '../../components/resources/VideoPlayer';
import { PDFViewer } from '../../components/resources/PDFViewer';
import { AddResourceModal } from '../../components/resources/AddResourceModal';
import { LearningResource } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Type-safe tab config ──────────────────────────────────────────
type TabKey = 'all' | 'lectures' | 'study_materials';
interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}
const TABS: TabConfig[] = [
  { key: 'all', label: 'All', icon: Library },
  { key: 'lectures', label: 'Videos', icon: PlayCircle },
  { key: 'study_materials', label: 'Documents', icon: File },
];

export default function ResourcesScreen() {
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
  const { can } = useCapabilities();
  const queryClient = useQueryClient();
  const schoolCode = profile?.school_code ?? undefined;
  const studentClassId = profile?.class_instance_id ?? undefined;

  // ── Data fetching ──────────────────────────────────────────────
  const {
    data: infiniteData,
    isLoading: infiniteLoading,
    error: infiniteError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteResources(!studentClassId ? schoolCode : undefined, 10);

  const {
    data: classResourcesData,
    isLoading: classLoading,
    error: classError,
  } = useClassResources(studentClassId, schoolCode);

  const isLoading = studentClassId ? classLoading : infiniteLoading;
  const error = studentClassId ? classError : infiniteError;

  const resources = useMemo(() => {
    if (studentClassId) return classResourcesData || [];
    return infiniteData?.pages.flatMap((page) => page) || [];
  }, [studentClassId, classResourcesData, infiniteData]);

  const { data: classes = [] } = useClasses(schoolCode);
  const { data: subjectsResult } = useSubjects(schoolCode);
  const subjects = subjectsResult?.data || [];

  // ── State ──────────────────────────────────────────────────────
  const canManage = can('resources.manage');
  const isStudentView = !canManage && !!profile?.class_instance_id;

  const [selectedResource, setSelectedResource] = useState<LearningResource | null>(null);
  const [viewerType, setViewerType] = useState<'video' | 'pdf' | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(
    profile?.class_instance_id ?? null,
  );
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabKey>('all');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<LearningResource | null>(null);

  // Bottom-sheet animations
  const classSlideAnim = React.useRef(new Animated.Value(0)).current;
  const subjectSlideAnim = React.useRef(new Animated.Value(0)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, typography, shadows, isDark),
    [colors, spacing, borderRadius, typography, shadows, isDark],
  );

  // ── Helpers ────────────────────────────────────────────────────
  const getResourceAccent = useCallback(
    (type: string) => {
      switch (type.toLowerCase()) {
        case 'pdf':
        case 'document':
          return { color: colors.error.main, bg: colors.error[100], label: 'PDF' };
        case 'video':
          return { color: colors.primary.main, bg: colors.primary[100], label: 'Video' };
        default:
          return { color: colors.info.main, bg: colors.info[100], label: 'File' };
      }
    },
    [colors],
  );

  const getResourceIcon = useCallback(
    (type: string, size = 22) => {
      const { color } = getResourceAccent(type);
      switch (type.toLowerCase()) {
        case 'pdf':
        case 'document':
          return <FileText size={size} color={color} />;
        case 'video':
          return <PlayCircle size={size} color={color} />;
        default:
          return <BookOpen size={size} color={color} />;
      }
    },
    [getResourceAccent],
  );

  const getClassDisplay = useCallback(
    (classId: string | null | undefined) => {
      if (!classId) return undefined;
      const match = classes.find((cls) => cls.id === classId);
      return match ? `${match.grade}-${match.section}` : undefined;
    },
    [classes],
  );

  const formatDate = useCallback((dateString?: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  const studentClassName = useMemo(() => {
    if (!isStudentView || !profile?.class_instance_id) return '';
    const cls = classes.find((c) => c.id === profile.class_instance_id);
    return cls ? `${cls.grade}-${cls.section}` : '';
  }, [isStudentView, profile?.class_instance_id, classes]);

  // ── Filtered data ──────────────────────────────────────────────
  const filteredResources = useMemo(() => {
    return (
      resources?.filter((resource) => {
        if (selectedClass && selectedClass !== 'all' && resource.class_instance_id !== selectedClass)
          return false;
        if (selectedSubject && selectedSubject !== 'all' && resource.subject_id !== selectedSubject)
          return false;
        switch (selectedTab) {
          case 'lectures':
            return resource.resource_type.toLowerCase() === 'video';
          case 'study_materials':
            return ['pdf', 'document'].includes(resource.resource_type.toLowerCase());
          default:
            return true;
        }
      }) || []
    );
  }, [resources, selectedClass, selectedSubject, selectedTab]);

  // ── Resource counts by tab ─────────────────────────────────────
  const tabCounts = useMemo(() => {
    const baseFiltered =
      resources?.filter((r) => {
        if (selectedClass && selectedClass !== 'all' && r.class_instance_id !== selectedClass) return false;
        if (selectedSubject && selectedSubject !== 'all' && r.subject_id !== selectedSubject) return false;
        return true;
      }) || [];
    return {
      all: baseFiltered.length,
      lectures: baseFiltered.filter((r) => r.resource_type.toLowerCase() === 'video').length,
      study_materials: baseFiltered.filter((r) =>
        ['pdf', 'document'].includes(r.resource_type.toLowerCase()),
      ).length,
    };
  }, [resources, selectedClass, selectedSubject]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleOpenResource = useCallback((resource: LearningResource) => {
    if (!resource.content_url) return;
    const type = resource.resource_type.toLowerCase();
    if (type === 'video') {
      setSelectedResource(resource);
      setViewerType('video');
    } else if (type === 'pdf' || type === 'document') {
      setSelectedResource(resource);
      setViewerType('pdf');
    }
  }, []);

  const handleCloseViewer = useCallback(() => {
    setSelectedResource(null);
    setViewerType(null);
  }, []);

  const handleAddResource = useCallback(() => {
    setEditingResource(null);
    setShowAddModal(true);
  }, []);

  const handleResourceSuccess = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['resources'] });
  }, [queryClient]);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const getMimeType = useCallback((resourceType: string) => {
    switch (resourceType.toLowerCase()) {
      case 'pdf':
      case 'document':
        return 'application/pdf';
      case 'video':
        return 'video/mp4';
      default:
        return 'application/octet-stream';
    }
  }, []);

  const handleDownloadResource = useCallback(async (resource: LearningResource) => {
    if (!resource.content_url) {
      Alert.alert('Unavailable', 'No downloadable content yet.');
      return;
    }

    if (Platform.OS === 'web') {
      await Linking.openURL(resource.content_url);
      return;
    }

    // Build a safe local cache path
    const urlParts = resource.content_url.split('/');
    const rawName = urlParts[urlParts.length - 1] || `${resource.title}.pdf`;
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const cachePath = `${cacheDirectory}${safeName}`;

    setDownloadingId(resource.id);
    try {
      // Step 1: Download to cache
      const result = await downloadAsync(resource.content_url, cachePath);
      if (result.status !== 200) {
        // Download returned non-200 status
        Alert.alert('Download Failed', 'Could not download the file. Please try again.');
        return;
      }

      // Step 2: Save to device
      if (Platform.OS === 'android') {
        // Android: Save directly to user-chosen folder (usually Downloads)
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          // User cancelled -- file is still in cache, no error
          Alert.alert('Cancelled', 'Download was cancelled.');
          return;
        }

        const mimeType = getMimeType(resource.resource_type);
        const fileUri = await StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          safeName,
          mimeType,
        );
        // Read from cache and write to the chosen location
        const fileContent = await readAsStringAsync(cachePath, {
          encoding: EncodingType.Base64,
        });
        await writeAsStringAsync(fileUri, fileContent, {
          encoding: EncodingType.Base64,
        });

        Alert.alert('Saved', `"${resource.title}" has been saved to your device.`);
      } else {
        // iOS: Use share sheet so user can save to Files app
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(result.uri, {
            mimeType: getMimeType(resource.resource_type),
            dialogTitle: `Save ${resource.title}`,
          });
        } else {
          Alert.alert('Downloaded', `"${resource.title}" saved to app cache.`);
        }
      }
    } catch (err) {
      // Download error - alert shown below
      Alert.alert('Error', 'Something went wrong while downloading. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }, [getMimeType]);

  const handleEditResource = useCallback((resource: LearningResource) => {
    setEditingResource(resource);
    setShowAddModal(true);
  }, []);

  const handleDeleteResource = useCallback(
    (resource: LearningResource) => {
      Alert.alert('Delete Resource', `Delete "${resource.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { api } = await import('../../services/api');
              await api.resources.delete(resource.id);
              await queryClient.invalidateQueries({ queryKey: ['resources'] });
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete resource');
            }
          },
        },
      ]);
    },
    [queryClient],
  );

  // ── Bottom-sheet animation helpers ─────────────────────────────
  const openSheet = useCallback(
    (slideAnim: Animated.Value) => {
      slideAnim.setValue(0);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    },
    [overlayOpacity],
  );

  const closeSheet = useCallback(
    (slideAnim: Animated.Value, cb: () => void) => {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(cb);
    },
    [overlayOpacity],
  );

  React.useEffect(() => {
    if (showClassDropdown) openSheet(classSlideAnim);
  }, [showClassDropdown, openSheet, classSlideAnim]);

  React.useEffect(() => {
    if (showSubjectDropdown) openSheet(subjectSlideAnim);
  }, [showSubjectDropdown, openSheet, subjectSlideAnim]);

  // ── Loading / Error states ─────────────────────────────────────
  if (isLoading) return <LoadingView message="Loading resources..." />;
  if (error) return <ErrorView message={error.message} />;

  // ── Render helpers ─────────────────────────────────────────────

  const selectedClassName =
    !selectedClass || selectedClass === 'all'
      ? 'All Classes'
      : getClassDisplay(selectedClass) || 'Class';

  const selectedSubjectName =
    !selectedSubject || selectedSubject === 'all'
      ? 'All Subjects'
      : subjects.find((s) => s.id === selectedSubject)?.subject_name || 'Subject';

  // ── Header ─────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Hero area */}
      <View style={styles.heroSection}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroTitle}>
              {isStudentView ? 'My Resources' : 'Resources'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isStudentView && studentClassName
                ? `Class ${studentClassName}`
                : `${filteredResources.length} learning material${filteredResources.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
          <View style={styles.heroIconContainer}>
            <GraduationCap size={28} color={colors.primary.main} />
          </View>
        </View>

        {/* Quick stats row */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{tabCounts.all}</Text>
            <Text style={styles.quickStatLabel}>Total</Text>
          </View>
          <View style={[styles.quickStatDivider, { backgroundColor: colors.border.light }]} />
          <View style={styles.quickStat}>
            <Text style={[styles.quickStatValue, { color: colors.primary.main }]}>
              {tabCounts.lectures}
            </Text>
            <Text style={styles.quickStatLabel}>Videos</Text>
          </View>
          <View style={[styles.quickStatDivider, { backgroundColor: colors.border.light }]} />
          <View style={styles.quickStat}>
            <Text style={[styles.quickStatValue, { color: colors.error.main }]}>
              {tabCounts.study_materials}
            </Text>
            <Text style={styles.quickStatLabel}>Documents</Text>
          </View>
        </View>
      </View>

      {/* Filter chips (admin only: class + subject, student: subject only) */}
      <View style={styles.filterChipsRow}>
        {!isStudentView && (
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedClass && selectedClass !== 'all' && styles.filterChipActive,
            ]}
            onPress={() => setShowClassDropdown(true)}
            activeOpacity={0.7}
          >
            <BookOpen
              size={14}
              color={
                selectedClass && selectedClass !== 'all'
                  ? colors.primary.main
                  : colors.text.secondary
              }
            />
            <Text
              style={[
                styles.filterChipText,
                selectedClass && selectedClass !== 'all' && styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {selectedClassName}
            </Text>
            <ChevronDown
              size={14}
              color={
                selectedClass && selectedClass !== 'all'
                  ? colors.primary.main
                  : colors.text.tertiary
              }
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedSubject && selectedSubject !== 'all' && styles.filterChipActive,
          ]}
          onPress={() => setShowSubjectDropdown(true)}
          activeOpacity={0.7}
        >
          <Filter
            size={14}
            color={
              selectedSubject && selectedSubject !== 'all'
                ? colors.primary.main
                : colors.text.secondary
            }
          />
          <Text
            style={[
              styles.filterChipText,
              selectedSubject && selectedSubject !== 'all' && styles.filterChipTextActive,
            ]}
            numberOfLines={1}
          >
            {selectedSubjectName}
          </Text>
          <ChevronDown
            size={14}
            color={
              selectedSubject && selectedSubject !== 'all'
                ? colors.primary.main
                : colors.text.tertiary
            }
          />
        </TouchableOpacity>
      </View>

      {/* Pill tabs */}
      <View style={styles.tabBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
          {TABS.map((tab) => {
            const isActive = selectedTab === tab.key;
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => setSelectedTab(tab.key)}
                activeOpacity={0.7}
              >
                <Icon
                  size={15}
                  color={isActive ? colors.text.inverse : colors.text.secondary}
                />
                <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabCountBadge,
                    {
                      backgroundColor: isActive
                        ? 'rgba(255,255,255,0.25)'
                        : colors.background.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      { color: isActive ? colors.text.inverse : colors.text.tertiary },
                    ]}
                  >
                    {tabCounts[tab.key]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  // ── Resource Card ──────────────────────────────────────────────
  const renderResourceCard = ({ item: resource }: { item: LearningResource }) => {
    const accent = getResourceAccent(resource.resource_type);
    const className = getClassDisplay(resource.class_instance_id);
    const date = formatDate(resource.created_at);

    return (
      <Pressable
        onPress={() => handleOpenResource(resource)}
        style={({ pressed }) => [styles.resourceCard, pressed && styles.resourceCardPressed]}
        disabled={!resource.content_url}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accent.color }]} />

        <View style={styles.cardBody}>
          {/* Icon */}
          <View style={[styles.resourceIconBox, { backgroundColor: accent.bg }]}>
            {getResourceIcon(resource.resource_type, 22)}
          </View>

          {/* Content */}
          <View style={styles.resourceContent}>
            <Text style={styles.resourceTitle} numberOfLines={2}>
              {resource.title}
            </Text>
            {resource.description ? (
              <Text style={styles.resourceDescription} numberOfLines={1}>
                {resource.description}
              </Text>
            ) : null}
            <View style={styles.resourceMeta}>
              {/* Type badge */}
              <View style={[styles.typeBadge, { backgroundColor: accent.bg }]}>
                <Text style={[styles.typeBadgeText, { color: accent.color }]}>{accent.label}</Text>
              </View>
              {className && !isStudentView ? (
                <>
                  <View style={styles.dot} />
                  <Text style={styles.metaText}>{className}</Text>
                </>
              ) : null}
              {date ? (
                <>
                  <View style={styles.dot} />
                  <Text style={styles.metaText}>{date}</Text>
                </>
              ) : null}
            </View>
          </View>

          {/* Actions */}
          <View style={styles.cardActions}>
            {resource.content_url && (
              <TouchableOpacity
                onPress={() => handleDownloadResource(resource)}
                style={styles.actionButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={downloadingId === resource.id}
              >
                {downloadingId === resource.id ? (
                  <ActivityIndicator size={18} color={colors.primary.main} />
                ) : (
                  <Download size={20} color={colors.text.secondary} />
                )}
              </TouchableOpacity>
            )}
            {canManage && (
              <>
                <TouchableOpacity
                  onPress={() => handleEditResource(resource)}
                  style={styles.actionButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Edit2 size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteResource(resource)}
                  style={styles.actionButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color={colors.error.main} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  // ── Bottom sheet renderer ──────────────────────────────────────
  const renderBottomSheet = (
    visible: boolean,
    slideAnim: Animated.Value,
    title: string,
    onClose: () => void,
    children: React.ReactNode,
  ) => (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [500, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView
            style={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );

  const renderSheetOption = (
    label: string,
    isActive: boolean,
    onPress: () => void,
    subtitle?: string,
  ) => (
    <TouchableOpacity
      style={[styles.sheetOption, isActive && styles.sheetOptionActive]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.sheetOptionText, isActive && styles.sheetOptionTextActive]}>
          {label}
        </Text>
        {subtitle ? <Text style={styles.sheetOptionSubtitle}>{subtitle}</Text> : null}
      </View>
      {isActive && (
        <View style={styles.sheetCheck}>
          <Check size={16} color={colors.text.inverse} />
        </View>
      )}
    </TouchableOpacity>
  );

  // ── No class selected (admin only) ────────────────────────────
  const needsClassSelection = !isStudentView && !selectedClass;

  // ── Main render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {needsClassSelection ? (
        <View style={{ flex: 1 }}>
          {renderHeader()}
          <View style={styles.emptyContainer}>
            <EmptyStateIllustration
              type="search"
              title="Select a Class"
              description="Choose a class from the filter above to view resources"
            />
          </View>
        </View>
      ) : filteredResources.length === 0 ? (
        <View style={{ flex: 1 }}>
          {renderHeader()}
          <View style={styles.emptyContainer}>
            <EmptyStateIllustration
              type="resources"
              title="No Resources Yet"
              description={
                isStudentView
                  ? 'No learning materials available for your class yet'
                  : 'No resources match the selected filters'
              }
              action={
                canManage ? (
                  <TouchableOpacity style={styles.addButton} onPress={handleAddResource}>
                    <Plus size={18} color={colors.text.inverse} />
                    <Text style={styles.addButtonText}>Add Resource</Text>
                  </TouchableOpacity>
                ) : undefined
              }
            />
          </View>
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={renderHeader}
          data={filteredResources}
          renderItem={renderResourceCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={colors.primary.main} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      {canManage && (
        <TouchableOpacity onPress={handleAddResource} style={styles.fab} activeOpacity={0.85}>
          <Plus size={24} color={colors.text.inverse} strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* Class bottom sheet */}
      {renderBottomSheet(
        showClassDropdown,
        classSlideAnim,
        'Select Class',
        () => {
          closeSheet(classSlideAnim, () => setShowClassDropdown(false));
        },
        <>
          {renderSheetOption('All Classes', selectedClass === 'all' || !selectedClass, () => {
            setSelectedClass('all');
            closeSheet(classSlideAnim, () => setShowClassDropdown(false));
          })}
          {classes.map((cls) =>
            renderSheetOption(
              `${cls.grade}-${cls.section}`,
              selectedClass === cls.id,
              () => {
                setSelectedClass(cls.id);
                closeSheet(classSlideAnim, () => setShowClassDropdown(false));
              },
            ),
          )}
        </>,
      )}

      {/* Subject bottom sheet */}
      {renderBottomSheet(
        showSubjectDropdown,
        subjectSlideAnim,
        'Select Subject',
        () => {
          closeSheet(subjectSlideAnim, () => setShowSubjectDropdown(false));
        },
        <>
          {renderSheetOption('All Subjects', selectedSubject === 'all' || !selectedSubject, () => {
            setSelectedSubject('all');
            closeSheet(subjectSlideAnim, () => setShowSubjectDropdown(false));
          })}
          {subjects.map((s) =>
            renderSheetOption(
              s.subject_name,
              selectedSubject === s.id,
              () => {
                setSelectedSubject(s.id);
                closeSheet(subjectSlideAnim, () => setShowSubjectDropdown(false));
              },
            ),
          )}
        </>,
      )}

      {/* Resource viewer */}
      <Modal
        visible={!!selectedResource && !!viewerType}
        animationType="slide"
        onRequestClose={handleCloseViewer}
      >
        {selectedResource && viewerType === 'video' && selectedResource.content_url && (
          <VideoPlayer
            uri={selectedResource.content_url}
            title={selectedResource.title}
            onClose={handleCloseViewer}
          />
        )}
        {selectedResource && viewerType === 'pdf' && selectedResource.content_url && (
          <PDFViewer
            uri={selectedResource.content_url}
            title={selectedResource.title}
            onClose={handleCloseViewer}
          />
        )}
      </Modal>

      {/* Add / edit modal */}
      {canManage && (
        <AddResourceModal
          visible={showAddModal}
          onDismiss={() => {
            setShowAddModal(false);
            setEditingResource(null);
          }}
          onSuccess={handleResourceSuccess}
          editingResource={editingResource}
        />
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════

const createStyles = (
  colors: ThemeColors,
  spacing: any,
  borderRadius: any,
  typography: any,
  shadows: any,
  isDark: boolean,
) =>
  StyleSheet.create({
    // ── Layout ─────────────────────────────────────────────────
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    listContent: {
      paddingBottom: 100,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },

    // ── Hero Header ────────────────────────────────────────────
    headerContainer: {
      paddingBottom: spacing.xs,
    },
    heroSection: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      ...shadows.sm,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border.DEFAULT,
    },
    heroTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: colors.text.primary,
      letterSpacing: -0.3,
    },
    heroSubtitle: {
      fontSize: typography.fontSize.sm,
      fontWeight: '500' as const,
      color: colors.text.secondary,
      marginTop: 2,
    },
    heroIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary[100],
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ── Quick Stats ────────────────────────────────────────────
    quickStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.lg,
      paddingVertical: 12,
      paddingHorizontal: spacing.sm,
    },
    quickStat: {
      flex: 1,
      alignItems: 'center',
    },
    quickStatValue: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.text.primary,
    },
    quickStatLabel: {
      fontSize: 11,
      fontWeight: '500' as const,
      color: colors.text.tertiary,
      marginTop: 1,
    },
    quickStatDivider: {
      width: 1,
      height: 28,
      borderRadius: 0.5,
    },

    // ── Filter Chips ───────────────────────────────────────────
    filterChipsRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      gap: spacing.sm,
    },
    filterChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.full,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    filterChipActive: {
      borderColor: colors.primary.main,
      backgroundColor: isDark ? colors.primary[100] : `${colors.primary.main}08`,
    },
    filterChipText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500' as const,
      color: colors.text.secondary,
    },
    filterChipTextActive: {
      color: colors.primary.main,
      fontWeight: '600' as const,
    },

    // ── Pill Tabs ──────────────────────────────────────────────
    tabBarContainer: {
      paddingTop: spacing.sm,
    },
    tabBarScroll: {
      paddingHorizontal: spacing.md,
      gap: 8,
    },
    tabPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    tabPillActive: {
      backgroundColor: colors.primary.main,
      borderColor: colors.primary.main,
    },
    tabPillText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.text.secondary,
    },
    tabPillTextActive: {
      color: colors.text.inverse,
    },
    tabCountBadge: {
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: 10,
      minWidth: 22,
      alignItems: 'center',
    },
    tabCountText: {
      fontSize: 11,
      fontWeight: '700' as const,
    },

    // ── Resource Card ──────────────────────────────────────────
    resourceCard: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      ...shadows.sm,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border.DEFAULT,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    resourceCardPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.985 }],
    },
    accentBar: {
      width: 4,
    },
    cardBody: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    resourceIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    resourceContent: {
      flex: 1,
      minWidth: 0,
    },
    resourceTitle: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.text.primary,
      lineHeight: 20,
    },
    resourceDescription: {
      fontSize: 13,
      fontWeight: '400' as const,
      color: colors.text.secondary,
      marginTop: 2,
    },
    resourceMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      flexWrap: 'wrap',
      gap: 4,
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: '700' as const,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.text.tertiary,
      marginHorizontal: 2,
    },
    metaText: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: colors.text.tertiary,
    },
    cardActions: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
    },
    actionButton: {
      padding: 6,
      borderRadius: 8,
    },

    // ── FAB ────────────────────────────────────────────────────
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.primary.main,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.lg,
      // Subtle elevation boost on iOS
      ...(Platform.OS === 'ios' && {
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        shadowOpacity: 0.2,
      }),
    },

    // ── Add button (empty state) ───────────────────────────────
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary.main,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: borderRadius.full,
    },
    addButtonText: {
      color: colors.text.inverse,
      fontSize: 15,
      fontWeight: '600' as const,
    },

    // ── Bottom Sheet ───────────────────────────────────────────
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface.primary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl + 16,
      maxHeight: '65%',
    },
    sheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border.DEFAULT,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: colors.text.primary,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    sheetScroll: {
      paddingHorizontal: spacing.md,
      maxHeight: 380,
    },
    sheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      marginBottom: 4,
      backgroundColor: 'transparent',
    },
    sheetOptionActive: {
      backgroundColor: isDark ? colors.primary[100] : `${colors.primary.main}0A`,
    },
    sheetOptionText: {
      fontSize: 15,
      fontWeight: '500' as const,
      color: colors.text.primary,
    },
    sheetOptionTextActive: {
      color: colors.primary.main,
      fontWeight: '600' as const,
    },
    sheetOptionSubtitle: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    sheetCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary.main,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
