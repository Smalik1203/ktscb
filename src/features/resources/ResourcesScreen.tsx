/**
 * ResourcesScreen
 *
 * Intent-driven content workspace for learning resources.
 * Students see only their class resources; admins see all with class filter.
 * Clean hierarchy: Search → Filters → Segmented type → Content cards.
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
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
  TextInput,
} from 'react-native';
import { Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
import { LoadingView, ErrorView, EmptyStateIllustration, FAB, Menu, IconButton } from '../../ui';
import { VideoPlayer } from '../../components/resources/VideoPlayer';
import { PDFViewer } from '../../components/resources/PDFViewer';
import { AddResourceModal } from '../../components/resources/AddResourceModal';
import { LearningResource } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Type-safe tab config ──────────────────────────────────────────
type TabKey = 'all' | 'lectures' | 'study_materials';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'lectures', label: 'Videos' },
  { key: 'study_materials', label: 'Documents' },
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
    profile?.class_instance_id ?? 'all',
  );
  const [selectedSubject, setSelectedSubject] = useState<string | null>('all');
  const [selectedTab, setSelectedTab] = useState<TabKey>('all');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<LearningResource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [overflowMenuId, setOverflowMenuId] = useState<string | null>(null);

  // Bottom-sheet animations
  const classSlideAnim = useRef(new Animated.Value(0)).current;
  const subjectSlideAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

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
          return { color: colors.error[600], bg: colors.error[50], icon: 'picture-as-pdf' as const, label: 'PDF' };
        case 'video':
          return { color: colors.primary[600], bg: colors.primary[50], icon: 'play-circle-filled' as const, label: 'Video' };
        default:
          return { color: colors.info[600], bg: colors.info[50], icon: 'insert-drive-file' as const, label: 'File' };
      }
    },
    [colors],
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

  // ── Filtered data ──────────────────────────────────────────────
  const filteredResources = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return (
      resources?.filter((resource) => {
        // Search filter
        if (query && !resource.title.toLowerCase().includes(query) &&
            !(resource.description || '').toLowerCase().includes(query)) {
          return false;
        }
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
  }, [resources, selectedClass, selectedSubject, selectedTab, searchQuery]);

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

    const urlParts = resource.content_url.split('/');
    const rawName = urlParts[urlParts.length - 1] || `${resource.title}.pdf`;
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const cachePath = `${cacheDirectory}${safeName}`;

    setDownloadingId(resource.id);
    try {
      const result = await downloadAsync(resource.content_url, cachePath);
      if (result.status !== 200) {
        Alert.alert('Download Failed', 'Could not download the file. Please try again.');
        return;
      }

      if (Platform.OS === 'android') {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          Alert.alert('Cancelled', 'Download was cancelled.');
          return;
        }

        const mimeType = getMimeType(resource.resource_type);
        const fileUri = await StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          safeName,
          mimeType,
        );
        const fileContent = await readAsStringAsync(cachePath, {
          encoding: EncodingType.Base64,
        });
        await writeAsStringAsync(fileUri, fileContent, {
          encoding: EncodingType.Base64,
        });

        Alert.alert('Saved', `"${resource.title}" has been saved to your device.`);
      } else {
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

  const totalCount = filteredResources.length;

  // ── Header ─────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search resources..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Primary filters: Class + Subject */}
      <View style={styles.filterRow}>
        {!isStudentView && (
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedClass && selectedClass !== 'all' && styles.filterChipActive,
            ]}
            onPress={() => setShowClassDropdown(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedClass && selectedClass !== 'all' && styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {selectedClassName}
            </Text>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={16}
              color={
                selectedClass && selectedClass !== 'all'
                  ? colors.primary[600]
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
          <Text
            style={[
              styles.filterChipText,
              selectedSubject && selectedSubject !== 'all' && styles.filterChipTextActive,
            ]}
            numberOfLines={1}
          >
            {selectedSubjectName}
          </Text>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={16}
            color={
              selectedSubject && selectedSubject !== 'all'
                ? colors.primary[600]
                : colors.text.tertiary
            }
          />
        </TouchableOpacity>
      </View>

      {/* Segmented control: All / Videos / Documents */}
      <View style={styles.segmentedContainer}>
        <View style={styles.segmentedControl}>
          {TABS.map((tab) => {
            const isActive = selectedTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.segmentItem, isActive && styles.segmentItemActive]}
                onPress={() => setSelectedTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.resultCount}>
          {totalCount} {totalCount === 1 ? 'resource' : 'resources'}
        </Text>
      </View>
    </View>
  );

  // ── Resource Card ──────────────────────────────────────────────
  const renderResourceCard = ({ item: resource }: { item: LearningResource }) => {
    const accent = getResourceAccent(resource.resource_type);
    const className = getClassDisplay(resource.class_instance_id);
    const date = formatDate(resource.created_at);
    const isMenuOpen = overflowMenuId === resource.id;

    return (
      <Pressable
        onPress={() => {
          if (isMenuOpen) {
            setOverflowMenuId(null);
            return;
          }
          handleOpenResource(resource);
        }}
        style={({ pressed }) => [styles.resourceCard, pressed && !isMenuOpen && styles.resourceCardPressed]}
        disabled={!resource.content_url}
      >
        <View style={styles.cardBody}>
          {/* Icon with tinted background */}
          <View style={[styles.resourceIconBox, { backgroundColor: accent.bg }]}>
            <MaterialIcons name={accent.icon} size={26} color={accent.color} />
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
              <Text style={[styles.metaLabel, { color: accent.color }]}>{accent.label}</Text>
              {className && !isStudentView ? (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{className}</Text>
                </>
              ) : null}
              {date ? (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{date}</Text>
                </>
              ) : null}
            </View>
          </View>

          {/* Overflow menu */}
          <Menu
            visible={isMenuOpen}
            onDismiss={() => setOverflowMenuId(null)}
            anchor={
              <IconButton
                icon="more-vert"
                variant="ghost"
                size="sm"
                onPress={() => setOverflowMenuId(isMenuOpen ? null : resource.id)}
              />
            }
          >
            {resource.content_url && (
              <Menu.Item title="Download" icon="download" onPress={() => { setOverflowMenuId(null); handleDownloadResource(resource); }} />
            )}
            {canManage && <Menu.Item title="Edit" icon="edit" onPress={() => { setOverflowMenuId(null); handleEditResource(resource); }} />}
            {canManage && <Menu.Divider />}
            {canManage && <Menu.Item title="Delete" icon="delete" onPress={() => { setOverflowMenuId(null); handleDeleteResource(resource); }} destructive />}
          </Menu>
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
  ) => (
    <TouchableOpacity
      style={[styles.sheetOption, isActive && styles.sheetOptionActive]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text style={[styles.sheetOptionText, isActive && styles.sheetOptionTextActive]}>
        {label}
      </Text>
      {isActive && (
        <View style={styles.sheetCheck}>
          <MaterialIcons name="check" size={16} color={colors.text.inverse} />
        </View>
      )}
    </TouchableOpacity>
  );

  // ── Main render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {filteredResources.length === 0 ? (
        <View style={{ flex: 1 }}>
          {renderHeader()}
          <View style={styles.emptyContainer}>
            <EmptyStateIllustration
              type="resources"
              title={searchQuery ? 'No Results' : 'No Resources Yet'}
              description={
                searchQuery
                  ? `No resources match "${searchQuery}"`
                  : isStudentView
                    ? 'No learning materials available for your class yet'
                    : 'No resources match the selected filters'
              }
              action={
                canManage && !searchQuery ? (
                  <TouchableOpacity style={styles.addButton} onPress={handleAddResource}>
                    <MaterialIcons name="add" size={18} color={colors.text.inverse} />
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
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <FAB icon="add" onPress={handleAddResource} visible={canManage} />

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
      paddingBottom: 120, // extra room so FAB doesn't overlap last card
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },

    // ── Header ────────────────────────────────────────────────
    headerContainer: {
      paddingBottom: spacing.md,
    },

    // ── Search ────────────────────────────────────────────────
    searchContainer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: 4,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.xl,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 10 : 4,
      gap: 10,
      ...shadows.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text.primary,
      paddingVertical: 0,
    },

    // ── Primary Filters ───────────────────────────────────────
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
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
    filterChipActive: {
      backgroundColor: isDark ? colors.primary[100] : `${colors.primary[600]}0C`,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: colors.text.secondary,
    },
    filterChipTextActive: {
      color: colors.primary[600],
      fontWeight: '600' as const,
    },

    // ── Segmented Control ─────────────────────────────────────
    segmentedContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
      borderRadius: borderRadius.lg,
      padding: 3,
    },
    segmentItem: {
      paddingVertical: 7,
      paddingHorizontal: 16,
      borderRadius: borderRadius.lg - 2,
    },
    segmentItemActive: {
      backgroundColor: colors.surface.primary,
      ...shadows.sm,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: colors.text.tertiary,
    },
    segmentTextActive: {
      color: colors.text.primary,
      fontWeight: '600' as const,
    },
    resultCount: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: colors.text.tertiary,
    },

    // ── Resource Card ──────────────────────────────────────────
    resourceCard: {
      marginHorizontal: spacing.md,
      marginTop: 10,
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.xl,
      ...shadows.sm,
      overflow: 'visible',
    },
    resourceCardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    cardBody: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 14,
    },
    resourceIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    resourceContent: {
      flex: 1,
      minWidth: 0,
    },
    resourceTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text.primary,
      lineHeight: 22,
      letterSpacing: -0.2,
    },
    resourceDescription: {
      fontSize: 13,
      fontWeight: '400' as const,
      color: colors.text.tertiary,
      marginTop: 2,
      lineHeight: 18,
    },
    resourceMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      flexWrap: 'wrap',
      gap: 2,
    },
    metaLabel: {
      fontSize: 11,
      fontWeight: '700' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.3,
    },
    metaDot: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginHorizontal: 3,
    },
    metaText: {
      fontSize: 12,
      fontWeight: '400' as const,
      color: colors.text.tertiary,
    },

    // ── Overflow Menu ──────────────────────────────────────────
    overflowArea: {
      position: 'relative',
      zIndex: 10,
    },
    // ── Add button (empty state) ───────────────────────────────
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary[600],
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: borderRadius.full,
    },
    addButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600' as const,
    },

    // ── Bottom Sheet ───────────────────────────────────────────
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
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
      backgroundColor: isDark ? colors.primary[100] : `${colors.primary[600]}0A`,
    },
    sheetOptionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500' as const,
      color: colors.text.primary,
    },
    sheetOptionTextActive: {
      color: colors.primary[600],
      fontWeight: '600' as const,
    },
    sheetCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary[600],
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
