/**
 * ResourcesScreen
 * 
 * Refactored to use centralized design system with dynamic theming.
 * All styling uses theme tokens via useTheme hook.
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, TouchableOpacity, Modal, Alert, Pressable, Linking, Animated, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { BookOpen, FileText, Video as VideoIcon, Plus, Edit, Trash2, Download } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { useAllResources } from '../../hooks/useResources';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { Card, LoadingView, ErrorView } from '../../components/ui';
import { EmptyStateIllustration } from '../../components/ui/EmptyStateIllustration';
import { VideoPlayer } from '../../components/resources/VideoPlayer';
import { PDFViewer } from '../../components/resources/PDFViewer';
import { AddResourceModal } from '../../components/resources/AddResourceModal';
import { LearningResource } from '../../services/api';

export default function ResourcesScreen() {
  const { profile } = useAuth();
  const { colors, spacing, borderRadius, typography, shadows, isDark } = useTheme();
  const queryClient = useQueryClient();
  const schoolCode = profile?.school_code ?? undefined;
  const { data: resources, isLoading, error } = useAllResources(schoolCode, 50);
  const { data: classes = [] } = useClasses(schoolCode);
  const { data: subjectsResult } = useSubjects(schoolCode);
  const subjects = subjectsResult?.data || [];
  const canManage = profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.role === 'cb_admin';
  const [selectedResource, setSelectedResource] = useState<LearningResource | null>(null);
  const [viewerType, setViewerType] = useState<'video' | 'pdf' | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTab, setSelectedTab] = useState<'all' | 'lectures' | 'study_materials'>('all');
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  
  const typeSlideAnim = React.useRef(new Animated.Value(0)).current;
  const classSlideAnim = React.useRef(new Animated.Value(0)).current;
  const subjectSlideAnim = React.useRef(new Animated.Value(0)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<LearningResource | null>(null);

  // Create dynamic styles based on theme
  const styles = useMemo(() => createStyles(colors, spacing, borderRadius, typography, shadows, isDark), 
    [colors, spacing, borderRadius, typography, shadows, isDark]);

  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
      case 'document':
        return <FileText size={20} color={colors.error.main} />;
      case 'video':
        return <VideoIcon size={20} color={colors.primary.main} />;
      default:
        return <BookOpen size={20} color={colors.info.main} />;
    }
  };

  const getResourceColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
      case 'document':
        return colors.error[100];
      case 'video':
        return colors.primary[100];
      default:
        return colors.info[100];
    }
  };

  const handleOpenResource = (resource: LearningResource) => {
    if (!resource.content_url) return;
    const type = resource.resource_type.toLowerCase();
    if (type === 'video') {
      setSelectedResource(resource);
      setViewerType('video');
    } else if (type === 'pdf' || type === 'document') {
      setSelectedResource(resource);
      setViewerType('pdf');
    }
  };

  const handleCloseViewer = () => {
    setSelectedResource(null);
    setViewerType(null);
  };

  const handleAddResource = () => {
    setEditingResource(null);
    setShowAddModal(true);
  };

  // Animation effects for bottom sheets
  React.useEffect(() => {
    if (showTypeDropdown) {
      typeSlideAnim.setValue(0);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(typeSlideAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(typeSlideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [showTypeDropdown, overlayOpacity, typeSlideAnim]);

  React.useEffect(() => {
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
  }, [showClassDropdown, overlayOpacity, classSlideAnim]);

  React.useEffect(() => {
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
  }, [showSubjectDropdown, overlayOpacity, subjectSlideAnim]);

  const handleResourceSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['resources'] });
  };

  const handleDownloadResource = async (resource: LearningResource) => {
    if (!resource.content_url) {
      Alert.alert('Unavailable', 'This resource does not have downloadable content yet.');
      return;
    }

    try {
      const urlParts = resource.content_url.split('/');
      const filename = urlParts[urlParts.length - 1] || `${resource.title}.pdf`;

      if (Platform.OS === 'web') {
        await Linking.openURL(resource.content_url);
        return;
      }

      Alert.alert(
        'Download File',
        `Download "${resource.title}" to your device?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Download',
            onPress: async () => {
              try {
                Alert.alert('Downloading', 'Please wait...');
                if (!resource.content_url) {
                  Alert.alert('Error', 'Resource URL is not available');
                  return;
                }
                const downloadResult = await FileSystem.downloadAsync(
                  resource.content_url,
                  filename
                );

                if (downloadResult.status === 200) {
                  const isSharingAvailable = await Sharing.isAvailableAsync();
                  if (isSharingAvailable) {
                    await Sharing.shareAsync(downloadResult.uri, {
                      mimeType: resource.resource_type === 'pdf' ? 'application/pdf' :
                                resource.resource_type === 'video' ? 'video/mp4' :
                                'application/octet-stream',
                      dialogTitle: 'Save File',
                    });
                    Alert.alert('Success', 'File downloaded successfully!');
                  } else {
                    Alert.alert('Downloaded', `File saved to: ${downloadResult.uri}`);
                  }
                } else {
                  throw new Error('Download failed');
                }
              } catch (error) {
                console.error('Download error:', error);
                Alert.alert('Error', 'Failed to download file. Please try again.');
              }
            }
          }
        ]
      );
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Unable to download the resource.');
    }
  };

  const handleEditResource = (resource: LearningResource) => {
    setEditingResource(resource);
    setShowAddModal(true);
  };

  const handleDeleteResource = async (resource: LearningResource) => {
    Alert.alert(
      'Delete Resource',
      `Are you sure you want to delete "${resource.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { api } = await import('../../services/api');
              await api.resources.delete(resource.id);
              await queryClient.invalidateQueries({ queryKey: ['resources'] });
              Alert.alert('Success', 'Resource deleted successfully');
            } catch (error: any) {
              console.error('Delete error:', error);
              Alert.alert('Error', error?.message || 'Failed to delete resource');
            }
          },
        },
      ]
    );
  };

  const getClassDisplay = (classId: string | null | undefined, classList: typeof classes) => {
    if (!classId) return undefined;
    const match = classList.find(cls => cls.id === classId);
    if (!match) return undefined;
    return `${match.grade}-${match.section}`;
  };

  const formatResourceDate = (dateString?: string | null) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Date TBD';
    
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatResourceType = (type?: string | null) => {
    if (!type) return 'Resource';
    return type.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  };

  // Filter resources
  const filteredResources = resources?.filter(resource => {
    if (selectedClass !== 'all' && resource.class_instance_id !== selectedClass) return false;
    if (selectedSubject !== 'all' && resource.subject_id !== selectedSubject) return false;
    
    switch (selectedTab) {
      case 'lectures':
        return resource.resource_type.toLowerCase() === 'video';
      case 'study_materials':
        return ['pdf', 'document'].includes(resource.resource_type.toLowerCase());
        default:
          return true;
      }
    }) || [];

  if (isLoading) {
    return <LoadingView message="Loading resources..." />;
  }

  if (error) {
    return <ErrorView message={error.message} />;
  }

  const renderHeader = () => (
    <>
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterItem} onPress={() => setShowClassDropdown(true)}>
            <View style={styles.filterIcon}>
              <BookOpen size={14} color={colors.text.inverse} />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                {selectedClass === 'all' ? 'Class' : 
                 classes.find(c => c.id === selectedClass)?.grade + '-' + 
                 classes.find(c => c.id === selectedClass)?.section || 'Class'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.filterDivider} />

          <TouchableOpacity style={styles.filterItem} onPress={() => setShowSubjectDropdown(true)}>
            <View style={styles.filterIcon}>
              <FileText size={14} color={colors.text.inverse} />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                {selectedSubject === 'all' ? 'Subject' : 
                 subjects.find(s => s.id === selectedSubject)?.subject_name || 'Subject'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.filterDivider} />

          <TouchableOpacity style={styles.filterItem} onPress={() => setShowTypeDropdown(true)}>
            <View style={styles.filterIcon}>
              <VideoIcon size={14} color={colors.text.inverse} />
            </View>
            <View style={styles.filterContent}>
              <Text style={styles.filterValue} numberOfLines={1} ellipsizeMode="tail">
                {selectedTab === 'all' ? 'Type' : 
                 selectedTab === 'lectures' ? 'Lectures' : 'Materials'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Resources</Text>
        <Text style={styles.sectionCount}>{filteredResources.length} items</Text>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {filteredResources.length === 0 ? (
        <View style={styles.scrollView}>
          {renderHeader()}
          <EmptyStateIllustration
            type="resources"
            title="No Resources"
            description="Get started by adding your first learning resource"
            action={
              <TouchableOpacity style={styles.createResourceButton} onPress={handleAddResource}>
                <Plus size={20} color={colors.text.inverse} />
                <Text style={styles.createResourceButtonText}>Create Resource</Text>
              </TouchableOpacity>
            }
          />
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={renderHeader}
            data={filteredResources}
            renderItem={({ item: resource }) => {
              const className = getClassDisplay(resource.class_instance_id, classes) || 'Class';
              const formattedDate = formatResourceDate(resource.created_at);
              const typeLabel = formatResourceType(resource.resource_type);
              
              return (
                <Card style={styles.resourceCard}>
                  <Pressable
                    onPress={() => handleOpenResource(resource)}
                  android_ripple={{ color: `${colors.primary.main}10` }}
                  style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}
                    disabled={!resource.content_url}
                  >
                    <View style={styles.cardInner}>
                      <View style={[styles.resourceIcon, { backgroundColor: getResourceColor(resource.resource_type) }]}>
                        {getResourceIcon(resource.resource_type)}
                      </View>
                      
                      <View style={styles.resourceDetails}>
                      <Text style={styles.resourceTitle} numberOfLines={1}>{resource.title}</Text>
                      {resource.description && (
                        <Text style={styles.resourceSubtitle} numberOfLines={1}>{resource.description}</Text>
                      )}
                        <View style={styles.metaRow}>
                          <Text style={styles.metaText}>{className}</Text>
                          <View style={styles.metaDot} />
                          <Text style={styles.metaText}>{formattedDate}</Text>
                        </View>
                        <View style={styles.chipRow}>
                          <View style={styles.chip}>
                            <Text style={styles.chipLabel}>{typeLabel}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.cardActions}>
                      {resource.content_url && (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleDownloadResource(resource)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Download size={18} color={colors.text.primary} />
                          </TouchableOpacity>
                      )}
                        {canManage && (
                          <>
                            <TouchableOpacity
                              style={styles.actionBtn}
                              onPress={() => handleEditResource(resource)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Edit size={18} color={colors.text.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.actionBtn}
                              onPress={() => handleDeleteResource(resource)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                            <Trash2 size={18} color={colors.error.main} />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  </Pressable>
                </Card>
              );
            }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resourcesContent}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          showsVerticalScrollIndicator={false}
        />
      )}

      {filteredResources.length > 0 && canManage && (
        <TouchableOpacity onPress={handleAddResource} style={styles.floatingButton}>
          <Plus size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      )}

      {/* Type Dropdown Modal */}
      <Modal visible={showTypeDropdown} transparent animationType="none" onRequestClose={() => setShowTypeDropdown(false)}>
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowTypeDropdown(false)} />
          <Animated.View 
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: typeSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Type</Text>
            <View style={styles.sheetContent}>
              {[
                { id: 'all', label: 'All' },
                { id: 'lectures', label: 'Lectures' },
                { id: 'study_materials', label: 'Study Materials' },
              ].map((item) => (
              <TouchableOpacity
                  key={item.id}
                  style={[styles.sheetItem, selectedTab === item.id && styles.sheetItemActive]}
                  onPress={() => { setSelectedTab(item.id as any); setShowTypeDropdown(false); }}
              >
                  <Text style={[styles.sheetItemText, selectedTab === item.id && styles.sheetItemTextActive]}>{item.label}</Text>
                  {selectedTab === item.id && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Class Dropdown Modal */}
      <Modal visible={showClassDropdown} transparent animationType="none" onRequestClose={() => setShowClassDropdown(false)}>
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowClassDropdown(false)} />
          <Animated.View 
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: classSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Class</Text>
            <ScrollView style={styles.sheetContent}>
              <TouchableOpacity
                style={[styles.sheetItem, selectedClass === 'all' && styles.sheetItemActive]}
                onPress={() => { setSelectedClass('all'); setShowClassDropdown(false); }}
              >
                <Text style={[styles.sheetItemText, selectedClass === 'all' && styles.sheetItemTextActive]}>All Classes</Text>
                {selectedClass === 'all' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.sheetItem, selectedClass === cls.id && styles.sheetItemActive]}
                  onPress={() => { setSelectedClass(cls.id); setShowClassDropdown(false); }}
                >
                  <Text style={[styles.sheetItemText, selectedClass === cls.id && styles.sheetItemTextActive]}>{cls.grade}-{cls.section}</Text>
                  {selectedClass === cls.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Subject Dropdown Modal */}
      <Modal visible={showSubjectDropdown} transparent animationType="none" onRequestClose={() => setShowSubjectDropdown(false)}>
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowSubjectDropdown(false)} />
          <Animated.View 
            style={[
              styles.bottomSheet,
              { transform: [{ translateY: subjectSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Subject</Text>
            <ScrollView style={styles.sheetContent}>
              <TouchableOpacity
                style={[styles.sheetItem, selectedSubject === 'all' && styles.sheetItemActive]}
                onPress={() => { setSelectedSubject('all'); setShowSubjectDropdown(false); }}
              >
                <Text style={[styles.sheetItemText, selectedSubject === 'all' && styles.sheetItemTextActive]}>All Subjects</Text>
                {selectedSubject === 'all' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              {subjects.map((subject) => (
                <TouchableOpacity
                  key={subject.id}
                  style={[styles.sheetItem, selectedSubject === subject.id && styles.sheetItemActive]}
                  onPress={() => { setSelectedSubject(subject.id); setShowSubjectDropdown(false); }}
                >
                  <Text style={[styles.sheetItemText, selectedSubject === subject.id && styles.sheetItemTextActive]}>{subject.subject_name}</Text>
                  {selectedSubject === subject.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Resource Viewer Modal */}
      <Modal visible={!!selectedResource && !!viewerType} animationType="slide" onRequestClose={handleCloseViewer}>
        {selectedResource && viewerType === 'video' && selectedResource.content_url && (
          <VideoPlayer uri={selectedResource.content_url} title={selectedResource.title} onClose={handleCloseViewer} />
        )}
        {selectedResource && viewerType === 'pdf' && selectedResource.content_url && (
          <PDFViewer uri={selectedResource.content_url} title={selectedResource.title} onClose={handleCloseViewer} />
        )}
      </Modal>

      {/* Add Resource Modal */}
      {canManage && (
        <AddResourceModal
          visible={showAddModal}
          onDismiss={() => { setShowAddModal(false); setEditingResource(null); }}
          onSuccess={handleResourceSuccess}
          editingResource={editingResource}
        />
      )}
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  spacing: any,
  borderRadius: any,
  typography: any,
  shadows: any,
  isDark: boolean
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: spacing.md,
  },
  filterRow: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border.DEFAULT,
  },
  filterItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
  },
  filterIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    flexShrink: 0,
  },
  filterContent: {
    flex: 1,
    minWidth: 0,
  },
  filterValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  filterDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border.DEFAULT,
    marginHorizontal: spacing.xs,
    flexShrink: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  resourcesContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  resourceCard: {
    marginBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardPressable: {
    backgroundColor: colors.surface.primary,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  resourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceDetails: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  resourceSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.secondary,
    marginHorizontal: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 6,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    justifyContent: 'flex-end',
  },
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
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
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
    borderRadius: 12,
    marginBottom: spacing.xs,
    backgroundColor: colors.background.secondary,
  },
  sheetItemActive: {
    backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
  },
  sheetItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  sheetItemTextActive: {
    color: colors.primary.main,
    fontWeight: typography.fontWeight.semibold,
  },
  checkmark: {
    fontSize: typography.fontSize.lg,
    color: colors.primary.main,
    fontWeight: typography.fontWeight.bold,
  },
  createResourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
  },
  createResourceButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
