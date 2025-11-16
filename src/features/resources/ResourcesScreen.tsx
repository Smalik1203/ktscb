import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Pressable, Linking, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { BookOpen, FileText, Video as VideoIcon, Plus, Edit, Trash2, Download } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors, typography, spacing, borderRadius, shadows } from '../../../lib/design-system';
import { useAuth } from '../../contexts/AuthContext';
import { useAllResources } from '../../hooks/useResources';
import { useClasses } from '../../hooks/useClasses';
import { useSubjects } from '../../hooks/useSubjects';
import { Card, LoadingView, ErrorView, EmptyState } from '../../components/ui';
import { EmptyStateIllustration } from '../../components/ui/EmptyStateIllustration';
import { VideoPlayer } from '../../components/resources/VideoPlayer';
import { PDFViewer } from '../../components/resources/PDFViewer';
import { AddResourceModal } from '../../components/resources/AddResourceModal';
import { LearningResource } from '../../services/api';

export default function ResourcesScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: resources, isLoading, error } = useAllResources(profile?.school_code || undefined);
  const { data: classes = [] } = useClasses(profile?.school_code);
  const { data: subjectsResult } = useSubjects(profile?.school_code);
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
  
  // Animated values for bottom sheet animations
  const typeSlideAnim = React.useRef(new Animated.Value(0)).current;
  const classSlideAnim = React.useRef(new Animated.Value(0)).current;
  const subjectSlideAnim = React.useRef(new Animated.Value(0)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [editingResource, setEditingResource] = useState<LearningResource | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
      case 'document':
        return <FileText size={20} color={colors.error[600]} />;
      case 'video':
        return <VideoIcon size={20} color={colors.primary[600]} />;
      default:
        return <BookOpen size={20} color={colors.info[600]} />;
    }
  };

  const getResourceColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
      case 'document':
        return colors.error[50];
      case 'video':
        return colors.primary[50];
      default:
        return colors.info[50];
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

  // Animation effects for bottom sheets - Type Dropdown
  React.useEffect(() => {
    if (showTypeDropdown) {
      // Reset values before animating
      typeSlideAnim.setValue(0);
      overlayOpacity.setValue(0);
      
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(typeSlideAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(typeSlideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showTypeDropdown]);

  // Animation effects for bottom sheets - Class Dropdown
  React.useEffect(() => {
    if (showClassDropdown) {
      // Reset values before animating
      classSlideAnim.setValue(0);
      overlayOpacity.setValue(0);
      
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(classSlideAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(classSlideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showClassDropdown]);

  // Animation effects for bottom sheets - Subject Dropdown
  React.useEffect(() => {
    if (showSubjectDropdown) {
      // Reset values before animating
      subjectSlideAnim.setValue(0);
      overlayOpacity.setValue(0);
      
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(subjectSlideAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(subjectSlideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showSubjectDropdown]);

  const handleResourceSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['resources'] });
  };

  const handleDownloadResource = async (resource: LearningResource) => {
    if (!resource.content_url) {
      Alert.alert('Unavailable', 'This resource does not have downloadable content yet.');
      return;
    }

    try {
      await Linking.openURL(resource.content_url);
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Unable to open the resource link.');
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
              
              // Invalidate and refetch resources query to update UI
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

  const dateOptions = useMemo(
    () => [
      { id: 'all', label: 'All Dates' },
      { id: 'last_7_days', label: 'Last 7 Days' },
      { id: 'last_30_days', label: 'Last 30 Days' },
      { id: 'this_year', label: 'This Year' },
    ],
    []
  );

  const selectedDateOption = dateOptions.find(option => option.id === selectedDateRange) || dateOptions[0];

  const getClassDisplay = (classId: string | null | undefined, classList: typeof classes) => {
    if (!classId) return undefined;
    const match = classList.find(cls => cls.id === classId);
    if (!match) return undefined;
    return `${match.grade}-${match.section}`;
  };

  const getSubjectDisplay = (subjectId: string | null | undefined, subjectList: typeof subjects) => {
    if (!subjectId) return undefined;
    return subjectList.find(subject => subject.id === subjectId)?.subject_name;
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
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatResourceType = (type?: string | null) => {
    if (!type) return 'Resource';
    return type.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  };


  // Filter resources based on selected filters and tab
  const filteredResources = resources?.filter(resource => {
    // Filter by class
    if (selectedClass !== 'all' && resource.class_instance_id !== selectedClass) {
      return false;
    }
    
    // Filter by subject
    if (selectedSubject !== 'all' && resource.subject_id !== selectedSubject) {
      return false;
    }
    
    // Filter by tab/category
    switch (selectedTab) {
      case 'lectures':
        return resource.resource_type.toLowerCase() === 'video';
      case 'study_materials':
        return ['pdf', 'document'].includes(resource.resource_type.toLowerCase());
      default:
        return true;
    }
  })
    ?.filter(resource => {
      if (selectedDateRange === 'all') return true;
      if (!resource.created_at) return false;

      const resourceDate = new Date(resource.created_at);
      if (Number.isNaN(resourceDate.getTime())) return false;

      const now = new Date();
      const diffInDays = (now.getTime() - resourceDate.getTime()) / (1000 * 60 * 60 * 24);

      switch (selectedDateRange) {
        case 'last_7_days':
          return diffInDays <= 7;
        case 'last_30_days':
          return diffInDays <= 30;
        case 'this_year':
          return resourceDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    }) || [];

  const classSummaryLabel = selectedClass === 'all'
    ? 'All Classes'
    : getClassDisplay(selectedClass, classes) || 'Class';

  const subjectSummaryLabel = selectedSubject === 'all'
    ? 'All Subjects'
    : getSubjectDisplay(selectedSubject, subjects) || 'Subject';

  const selectedDateLabel = selectedDateOption.label;

  if (isLoading) {
    return <LoadingView message="Loading resources..." />;
  }

  if (error) {
    return <ErrorView message={error.message} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Filter Cards Section (Attendance Style) */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            {/* Class Filter */}
            <TouchableOpacity
              style={styles.filterItem}
              onPress={() => setShowClassDropdown(true)}
            >
              <View style={styles.filterIcon}>
                <BookOpen size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterValue}>
                  {selectedClass === 'all' ? 'Class' : 
                   classes.find(c => c.id === selectedClass)?.grade + '-' + 
                   classes.find(c => c.id === selectedClass)?.section || 'Class'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.filterDivider} />

            {/* Subject Filter */}
            <TouchableOpacity
              style={styles.filterItem}
              onPress={() => setShowSubjectDropdown(true)}
            >
              <View style={styles.filterIcon}>
                <FileText size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterValue}>
                  {selectedSubject === 'all' ? 'Subject' : 
                   subjects.find(s => s.id === selectedSubject)?.subject_name || 'Subject'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.filterDivider} />

            {/* Type Filter */}
            <TouchableOpacity
              style={styles.filterItem}
              onPress={() => setShowTypeDropdown(true)}
            >
              <View style={styles.filterIcon}>
                <VideoIcon size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterValue}>
                  {selectedTab === 'all' ? 'Type' : 
                   selectedTab === 'lectures' ? 'Lectures' : 
                   'Study Materials'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Resources Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Resources</Text>
          <Text style={styles.sectionCount}>{filteredResources.length} items</Text>
        </View>

        {/* Empty State or Resources List */}
        {filteredResources.length === 0 ? (
          <EmptyStateIllustration
            type="resources"
            title="No Resources"
            description="Get started by adding your first learning resource"
            action={
              <TouchableOpacity
                style={styles.createResourceButton}
                onPress={handleAddResource}
              >
                <Plus size={20} color={colors.text.inverse} />
                <Text style={styles.createResourceButtonText}>Create Resource</Text>
              </TouchableOpacity>
            }
          />
        ) : (
          <View style={styles.resourcesContent}>
        {filteredResources.map((resource) => {
          const className = getClassDisplay(resource.class_instance_id, classes) || 'Class';
          const formattedDate = formatResourceDate(resource.created_at);
          const typeLabel = formatResourceType(resource.resource_type);
          
          return (
            <Card key={resource.id} style={styles.resourceCard}>
              <Pressable
                onPress={() => handleOpenResource(resource)}
                android_ripple={{ color: 'rgba(79, 70, 229, 0.08)' }}
                style={({ pressed }) => [
                  styles.cardPressable,
                  pressed && styles.cardPressed
                ]}
                disabled={!resource.content_url}
              >
                <View style={styles.cardInner}>
                  <View style={[styles.resourceIcon, { backgroundColor: getResourceColor(resource.resource_type) }]}>
                    {getResourceIcon(resource.resource_type)}
                  </View>
                  
                  <View style={styles.resourceDetails}>
                    <Text style={styles.resourceTitle} numberOfLines={1}>
                      {resource.title}
                    </Text>
                    {resource.description ? (
                      <Text style={styles.resourceSubtitle} numberOfLines={1}>
                        {resource.description}
                      </Text>
                    ) : null}
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
                  {resource.content_url ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleDownloadResource(resource)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Download size={18} color={colors.text.primary} />
                    </TouchableOpacity>
                  ) : null}
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
                        <Trash2 size={18} color={colors.error[600]} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                </View>
              </Pressable>
            </Card>
          );
        })}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button - Only for admins */}
      {filteredResources.length > 0 && canManage && (
        <TouchableOpacity onPress={handleAddResource} style={styles.floatingButton}>
          <Plus size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      )}

      {/* Type Dropdown Modal - Bottom Sheet */}
      <Modal
        visible={showTypeDropdown}
        transparent
        animationType="none"
        onRequestClose={() => setShowTypeDropdown(false)}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowTypeDropdown(false)}
          />
          <Animated.View 
            style={[
              styles.bottomSheet,
              {
                transform: [
                  {
                    translateY: typeSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Type</Text>
            <View style={styles.sheetContent}>
              <TouchableOpacity
                style={[styles.sheetItem, selectedTab === 'all' && styles.sheetItemActive]}
                onPress={() => {
                  setSelectedTab('all');
                  setShowTypeDropdown(false);
                }}
              >
                <Text style={[styles.sheetItemText, selectedTab === 'all' && styles.sheetItemTextActive]}>
                  All
                </Text>
                {selectedTab === 'all' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetItem, selectedTab === 'lectures' && styles.sheetItemActive]}
                onPress={() => {
                  setSelectedTab('lectures');
                  setShowTypeDropdown(false);
                }}
              >
                <Text style={[styles.sheetItemText, selectedTab === 'lectures' && styles.sheetItemTextActive]}>
                  Lectures
                </Text>
                {selectedTab === 'lectures' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetItem, selectedTab === 'study_materials' && styles.sheetItemActive]}
                onPress={() => {
                  setSelectedTab('study_materials');
                  setShowTypeDropdown(false);
                }}
              >
                <Text style={[styles.sheetItemText, selectedTab === 'study_materials' && styles.sheetItemTextActive]}>
                  Study Materials
                </Text>
                {selectedTab === 'study_materials' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Class Dropdown Modal - Bottom Sheet */}
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
              <TouchableOpacity
                style={[styles.sheetItem, selectedClass === 'all' && styles.sheetItemActive]}
                onPress={() => {
                  setSelectedClass('all');
                  setShowClassDropdown(false);
                }}
              >
                <Text style={[styles.sheetItemText, selectedClass === 'all' && styles.sheetItemTextActive]}>
                  All Classes
                </Text>
                {selectedClass === 'all' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.sheetItem, selectedClass === cls.id && styles.sheetItemActive]}
                  onPress={() => {
                    setSelectedClass(cls.id);
                    setShowClassDropdown(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, selectedClass === cls.id && styles.sheetItemTextActive]}>
                    {cls.grade}-{cls.section}
                  </Text>
                  {selectedClass === cls.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Subject Dropdown Modal - Bottom Sheet */}
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
              <TouchableOpacity
                style={[styles.sheetItem, selectedSubject === 'all' && styles.sheetItemActive]}
                onPress={() => {
                  setSelectedSubject('all');
                  setShowSubjectDropdown(false);
                }}
              >
                <Text style={[styles.sheetItemText, selectedSubject === 'all' && styles.sheetItemTextActive]}>
                  All Subjects
                </Text>
                {selectedSubject === 'all' && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              {subjects.map((subject) => (
                <TouchableOpacity
                  key={subject.id}
                  style={[styles.sheetItem, selectedSubject === subject.id && styles.sheetItemActive]}
                  onPress={() => {
                    setSelectedSubject(subject.id);
                    setShowSubjectDropdown(false);
                  }}
                >
                  <Text style={[styles.sheetItemText, selectedSubject === subject.id && styles.sheetItemTextActive]}>
                    {subject.subject_name}
                  </Text>
                  {selectedSubject === subject.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Resource Viewer Modal */}
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

      {/* Add Resource Modal - Only for admins */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
    borderBottomWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2430',
  },
  filterChipsScroll: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
    height: 48,
    flexGrow: 0,
    flexShrink: 0,
  },
  filterChipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 0,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    lineHeight: 20,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: spacing.md,
  },
  filterRow: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
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
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  filterContent: {
    flex: 1,
  },
  filterLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  filterValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  filterDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.DEFAULT,
    marginHorizontal: spacing.sm,
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
  scrollContent: {
    paddingBottom: 80,
  },
  resourceCard: {
    marginBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardPressable: {
    backgroundColor: '#FFFFFF',
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
    color: '#1F2430',
    marginBottom: 2,
  },
  resourceSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
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
    color: '#6B7280',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#6B7280',
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
    backgroundColor: '#F8F9FB',
    borderWidth: 1,
    borderColor: '#E6E8EF',
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
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
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    backgroundColor: '#D1D5DB',
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
    backgroundColor: '#F9FAFB',
  },
  sheetItemActive: {
    backgroundColor: '#EEF2FF',
  },
  sheetItemText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  sheetItemTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  checkmark: {
    fontSize: typography.fontSize.lg,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
  emptyFill: { 
    flex: 1, 
    backgroundColor: '#F8F9FB' 
  },
  createResourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.button,
  },
  createResourceButtonText: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
  },
});
