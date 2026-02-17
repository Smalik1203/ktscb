/**
 * ProgressTrackingScreen - Detailed student progress view with stats, charts, and report download
 * 
 * For Students: Shows their own progress
 * For Admin/SuperAdmin: Shows class filter + student list, then individual student progress
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Animated,
  Share,
  Alert,
  Text,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Card, ProgressBar, LoadingView, ErrorView } from '../../ui';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { useClasses } from '../../hooks/useClasses';
import { useStudents } from '../../hooks/useStudents';
import type { ThemeColors } from '../../theme/types';
import { useStudentProgress, SubjectProgress, TestResult } from '../../hooks/useStudentProgress';
import { useProgressReport, useProgressReportViewer } from '../../hooks/useProgressReport';
import { ProgressReportViewer } from '../../components/assessments/ProgressReportViewer';
import { spacing, typography, borderRadius, shadows } from '../../../lib/design-system';
import { useReportComment } from '../../hooks/useReportComment';

export default function ProgressTrackingScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useAuth();
  const { can } = useCapabilities();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Check if user is admin (can view all students' progress)
  const isAdmin = can('students.read') && can('assessments.read');

  // Admin state
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(undefined);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Animation for class picker
  const classSlideAnim = React.useRef(new Animated.Value(0)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  // Fetch classes for admin
  const { data: classes = [] } = useClasses(isAdmin ? profile?.school_code || '' : '');

  // Fetch students for selected class
  const { data: studentsData, isLoading: studentsLoading } = useStudents(
    selectedClassId,
    profile?.school_code || undefined
  );
  const students = studentsData?.data || [];

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s: any) =>
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.student_code || '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  // Progress data - for admin, use selected student; for student, use their own
  const { data: progressData, isLoading, error, refetch, isRefetching } = useStudentProgress(
    isAdmin ? selectedStudentId : undefined
  );

  // Progress Report hooks
  const {
    generateReport,
    isGenerating: isReportGenerating,
    reset: resetReportError,
  } = useProgressReport({
    onSuccess: (data) => {
      showReport(data);
      resetReportError();
    },
  });
  const { isVisible: isReportVisible, reportData, showReport, hideReport } = useProgressReportViewer();

  // Report Comment hook - for admin, use selected student's class - simplified to just show insights
  const selectedStudent = students.find((s: any) => s.id === selectedStudentId);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const {
    comment: reportComment,
    isGenerating: isCommentGenerating,
    generateComment,
    regenerate: regenerateComment,
  } = useReportComment({
    studentId: isAdmin ? selectedStudentId : profile?.auth_id,
    classInstanceId: isAdmin ? selectedStudent?.class_instance_id ?? undefined : undefined,
    autoGenerate: false, // Don't auto-generate, user has to click
  });

  // Animation effects for class picker
  useEffect(() => {
    if (showClassPicker) {
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
  }, [showClassPicker]);

  const getGradeColor = useCallback((grade: string): string => {
    switch (grade) {
      case 'A+': return colors.success[600];
      case 'A': return colors.success[500];
      case 'B+': return colors.primary[600];
      case 'B': return colors.primary[500];
      case 'C': return colors.warning[600];
      case 'D': return colors.warning[500];
      default: return colors.error[600];
    }
  }, [colors]);

  const getTrendIcon = useCallback((trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <MaterialIcons name="trending-up" size={16} color={colors.success[600]} />;
      case 'down':
        return <MaterialIcons name="trending-down" size={16} color={colors.error[600]} />;
      default:
        return <MaterialIcons name="remove" size={16} color={colors.text.secondary} />;
    }
  }, [colors]);

  const formatDate = useCallback((dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  }, []);

  const getSelectedClassName = () => {
    if (!selectedClassId) return 'Select Class';
    const selectedClass = classes.find((c: any) => c.id === selectedClassId);
    return selectedClass ? `Grade ${selectedClass.grade}-${selectedClass.section}` : 'Select Class';
  };

  const handleSelectStudent = (student: any) => {
    setSelectedStudentId(student.id);
    setSelectedStudentName(student.full_name);
  };

  const handleBackToList = () => {
    setSelectedStudentId(undefined);
    setSelectedStudentName('');
  };

  // ==================== ADMIN VIEW: Student Selection ====================
  if (isAdmin && !selectedStudentId) {
    return (
      <View style={styles.container}>
        {/* Filter Section */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.filterItem}
              onPress={() => setShowClassPicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.filterIcon}>
                <MaterialIcons name="menu-book" size={16} color={colors.text.inverse} />
              </View>
              <View style={styles.filterContent}>
                <Text style={styles.filterLabel}>Class</Text>
                <Text style={styles.filterValue} numberOfLines={1}>
                  {getSelectedClassName()}
                </Text>
              </View>
              <MaterialIcons name="keyboard-arrow-down" size={16} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* No Class Selected */}
        {!selectedClassId && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="menu-book" size={64} color={colors.text.secondary} />
            <Text style={styles.emptyTitle}>Select a Class</Text>
            <Text style={styles.emptyText}>Choose a class to view student progress</Text>
          </View>
        )}

        {/* Student List */}
        {selectedClassId && (
          <View style={styles.studentListContainer}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color={colors.text.secondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search students..."
                placeholderTextColor={colors.text.secondary}
                value={studentSearch}
                onChangeText={setStudentSearch}
              />
              {studentSearch.length > 0 && (
                <TouchableOpacity onPress={() => setStudentSearch('')}>
                  <MaterialIcons name="close" size={18} color={colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Student Count */}
            <Text style={styles.studentCount}>
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </Text>

            {studentsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[600]} />
                <Text style={styles.loadingText}>Loading students...</Text>
              </View>
            ) : filteredStudents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="person" size={48} color={colors.text.secondary} />
                <Text style={styles.emptyTitle}>No Students Found</Text>
                <Text style={styles.emptyText}>
                  {studentSearch ? 'Try a different search term' : 'No students in this class'}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.studentList}
                showsVerticalScrollIndicator={false}
              >
                {filteredStudents.map((student: any) => (
                  <TouchableOpacity
                    key={student.id}
                    style={styles.studentCard}
                    onPress={() => handleSelectStudent(student)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentAvatarText}>
                        {(student.full_name || 'S').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{student.full_name}</Text>
                      <Text style={styles.studentCode}>{student.student_code}</Text>
                    </View>
                    <View style={styles.studentArrow}>
                      <MaterialIcons name="bar-chart" size={20} color={colors.primary[600]} />
                    </View>
                  </TouchableOpacity>
                ))}
                <View style={{ height: insets.bottom + 16 }} />
              </ScrollView>
            )}
          </View>
        )}

        {/* Class Picker Modal */}
        <Modal
          visible={showClassPicker}
          transparent
          animationType="none"
          onRequestClose={() => setShowClassPicker(false)}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
            <TouchableOpacity
              style={styles.overlayTouchable}
              activeOpacity={1}
              onPress={() => setShowClassPicker(false)}
            />
            <Animated.View
              style={[
                styles.modalContent,
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
                {classes.map((cls: any) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[
                      styles.sheetItem,
                      selectedClassId === cls.id && styles.sheetItemActive,
                    ]}
                    onPress={() => {
                      setSelectedClassId(cls.id);
                      setShowClassPicker(false);
                      setStudentSearch('');
                    }}
                  >
                    <Text
                      style={[
                        styles.sheetItemText,
                        selectedClassId === cls.id && styles.sheetItemTextActive,
                      ]}
                    >
                      Grade {cls.grade} - {cls.section}
                    </Text>
                    {selectedClassId === cls.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          </Animated.View>
        </Modal>
      </View>
    );
  }

  // ==================== PROGRESS VIEW (Student or Admin with selected student) ====================

  if (isLoading && !progressData) {
    return <LoadingView message="Loading progress..." />;
  }

  if (error && !isAdmin) {
    return <ErrorView message={error.message || 'Failed to load progress data'} onRetry={refetch} />;
  }

  if (!progressData) {
    return (
      <View style={styles.container}>
        {/* Back button for admin */}
        {isAdmin && selectedStudentId && (
          <TouchableOpacity style={styles.backButton} onPress={handleBackToList}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
            <Text style={styles.backButtonText}>Back to Students</Text>
          </TouchableOpacity>
        )}
        <View style={styles.emptyContainer}>
          <MaterialIcons name="bar-chart" size={64} color={colors.text.secondary} />
          <Text style={styles.emptyTitle}>No Progress Data</Text>
          <Text style={styles.emptyText}>Complete some assessments to see progress here.</Text>
        </View>
      </View>
    );
  }

  const { stats, subjects, recent_tests, attendance, student_name, class_info, academic_year } = progressData;

  return (
    <View style={styles.container}>
      {/* Back button for admin */}
      {isAdmin && selectedStudentId && (
        <TouchableOpacity style={styles.backButton} onPress={handleBackToList}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          <Text style={styles.backButtonText}>Back to Students</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[colors.primary[600]]} />
        }
      >
        {/* Hero Section - NO GRADE, only percentage */}
        <View style={styles.heroSection}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroGreeting}>
              {isAdmin ? `${student_name}'s Progress` : `Hello, ${student_name?.split(' ')[0]}! 👋`}
            </Text>
            <Text style={styles.heroSubtext}>
              {class_info ? `Class ${class_info.grade}-${class_info.section}` : ''}
              {academic_year ? ` • ${academic_year}` : ''}
            </Text>
          </View>
          <View style={styles.heroRight}>
            <Text style={[styles.heroPercentage, { color: colors.success[600] }]}>
              {stats.overall_average.toFixed(1)}%
            </Text>
            <Text style={styles.heroPercentageLabel}>Average</Text>
          </View>
        </View>

        {/* Download Report Button */}
        <TouchableOpacity
          style={styles.downloadReportButton}
          onPress={() => generateReport(isAdmin ? selectedStudentId : undefined)}
          disabled={isReportGenerating}
          activeOpacity={0.8}
        >
          <View style={styles.downloadReportIcon}>
            <MaterialIcons name="description" size={20} color={colors.text.inverse} />
          </View>
          <View style={styles.downloadReportContent}>
            <Text style={styles.downloadReportTitle}>Download Progress Report</Text>
            <Text style={styles.downloadReportSubtitle}>Get detailed PDF report of performance</Text>
          </View>
          {isReportGenerating ? (
            <ActivityIndicator size="small" color={colors.primary[600]} />
          ) : (
            <MaterialIcons name="download" size={20} color={colors.primary[600]} />
          )}
        </TouchableOpacity>

        {/* Stats Cards Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primary[100] }]}>
              <MaterialIcons name="menu-book" size={18} color={colors.primary[600]} />
            </View>
            <Text style={styles.statValue}>{stats.total_tests}</Text>
            <Text style={styles.statLabel}>Tests Taken</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.success[100] }]}>
              <MaterialIcons name="gps-fixed" size={18} color={colors.success[600]} />
            </View>
            <Text style={styles.statValue}>{stats.overall_average.toFixed(1)}%</Text>
            <Text style={styles.statLabel}>Average Score</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.warning[100] }]}>
              <MaterialIcons name="event" size={18} color={colors.warning[600]} />
            </View>
            <Text style={styles.statValue}>{stats.tests_this_month}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </View>

        {/* Performance Overview Card */}
        <Card style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <View style={styles.overviewTitleRow}>
              <MaterialIcons name="auto-awesome" size={20} color={colors.primary[600]} />
              <Text style={styles.overviewTitle}>Performance Overview</Text>
            </View>
            {stats.improvement_rate !== 0 && (
              <View style={[
                styles.improvementBadge,
                { backgroundColor: stats.improvement_rate > 0 ? colors.success[100] : colors.error[100] }
              ]}>
                {stats.improvement_rate > 0 ? (
                  <MaterialIcons name="north-east" size={14} color={colors.success[600]} />
                ) : (
                  <MaterialIcons name="south-east" size={14} color={colors.error[600]} />
                )}
                <Text style={[
                  styles.improvementText,
                  { color: stats.improvement_rate > 0 ? colors.success[700] : colors.error[700] }
                ]}>
                  {Math.abs(stats.improvement_rate).toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          <View style={styles.overviewStats}>
            <View style={styles.overviewStatItem}>
              <Text style={styles.overviewStatLabel}>Highest Score</Text>
              <Text style={[styles.overviewStatValue, { color: colors.success[600] }]}>
                {stats.highest_score.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.overviewStatDivider} />
            <View style={styles.overviewStatItem}>
              <Text style={styles.overviewStatLabel}>Lowest Score</Text>
              <Text style={[styles.overviewStatValue, { color: colors.error[600] }]}>
                {stats.lowest_score.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.overviewStatDivider} />
            <View style={styles.overviewStatItem}>
              <Text style={styles.overviewStatLabel}>Subjects</Text>
              <Text style={styles.overviewStatValue}>{stats.subjects_count}</Text>
            </View>
          </View>
        </Card>

        {/* Attendance Card */}
        {attendance && (
          <Card style={styles.attendanceCard}>
            <View style={styles.attendanceHeader}>
              <MaterialIcons name="schedule" size={20} color={colors.primary[600]} />
              <Text style={styles.attendanceTitle}>Attendance</Text>
              <Text style={[
                styles.attendancePercentage,
                { color: attendance.percentage >= 75 ? colors.success[600] : colors.error[600] }
              ]}>
                {attendance.percentage.toFixed(1)}%
              </Text>
            </View>
            <ProgressBar
              progress={attendance.percentage}
              fillColor={attendance.percentage >= 75 ? colors.success[600] : colors.error[600]}
              style={styles.attendanceProgress}
            />
            <View style={styles.attendanceStats}>
              <View style={styles.attendanceStatItem}>
                <MaterialIcons name="check-circle" size={14} color={colors.success[600]} />
                <Text style={styles.attendanceStatText}>Present: {attendance.present}</Text>
              </View>
              <View style={styles.attendanceStatItem}>
                <MaterialIcons name="cancel" size={14} color={colors.error[600]} />
                <Text style={styles.attendanceStatText}>Absent: {attendance.absent}</Text>
              </View>
              <View style={styles.attendanceStatItem}>
                <MaterialIcons name="event" size={14} color={colors.text.secondary} />
                <Text style={styles.attendanceStatText}>Total: {attendance.total}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* AI Insights Button - Compact */}
        {isAdmin && selectedStudentId && (
          <TouchableOpacity
            style={styles.aiInsightsBtn}
            onPress={() => {
              if (!reportComment) {
                generateComment();
              }
              setShowCommentModal(true);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.aiInsightsIcon, { backgroundColor: colors.primary[100] }]}>
              <MaterialIcons name="auto-awesome" size={18} color={colors.primary[600]} />
            </View>
            <View style={styles.aiInsightsContent}>
              <Text style={styles.aiInsightsTitle}>Sage&apos;s Insight</Text>
              <Text style={styles.aiInsightsSubtitle}>
                {reportComment ? 'View generated comment' : 'Generate personalized comment'}
              </Text>
            </View>
            {isCommentGenerating ? (
              <ActivityIndicator size="small" color={colors.primary[600]} />
            ) : (
              <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.primary[600]} style={{ transform: [{ rotate: '-90deg' }] }} />
            )}
          </TouchableOpacity>
        )}

        {/* AI Comment Modal */}
        <Modal
          visible={showCommentModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCommentModal(false)}
        >
          <View style={styles.commentModalOverlay}>
            <TouchableOpacity
              style={styles.commentModalDismiss}
              activeOpacity={1}
              onPress={() => setShowCommentModal(false)}
            />
            <View style={styles.commentModalContent}>
              <View style={styles.commentModalHandle} />

              <View style={styles.commentModalHeader}>
                <View style={[styles.commentModalIconBg, { backgroundColor: colors.primary[100] }]}>
                  <MaterialIcons name="auto-awesome" size={24} color={colors.primary[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentModalTitle}>Sage&apos;s Insight</Text>
                  <Text style={styles.commentModalSubtitle}>
                    Personalized for {selectedStudentName || 'student'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowCommentModal(false)}>
                  <MaterialIcons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {isCommentGenerating ? (
                <View style={styles.commentModalLoading}>
                  <ActivityIndicator size="large" color={colors.primary[600]} />
                  <Text style={styles.commentModalLoadingTitle}>✨ Generating...</Text>
                  <Text style={styles.commentModalLoadingText}>
                    Analyzing grades, attendance, and behavior
                  </Text>
                </View>
              ) : reportComment ? (
                <ScrollView style={styles.commentModalScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.commentModalTextBox}>
                    <Text style={styles.commentModalQuote}>&quot;</Text>
                    <Text style={styles.commentModalText}>
                      {reportComment.generatedComment}
                    </Text>
                    <Text style={[styles.commentModalQuote, styles.commentModalQuoteEnd]}>&quot;</Text>
                  </View>

                  <View style={styles.commentModalChips}>
                    <View style={[styles.commentModalChip, { backgroundColor: colors.primary[50] }]}>
                      <MaterialIcons name="description" size={12} color={colors.primary[600]} />
                      <Text style={[styles.commentModalChipText, { color: colors.primary[700] }]}>
                        {reportComment.wordCount} words
                      </Text>
                    </View>
                    <View style={[
                      styles.commentModalChip,
                      { backgroundColor: reportComment.positivityScore >= 0.6 ? colors.success[50] : colors.warning[50] }
                    ]}>
                      <Text style={[
                        styles.commentModalChipText,
                        { color: reportComment.positivityScore >= 0.6 ? colors.success[700] : colors.warning[700] }
                      ]}>
                        {(reportComment.positivityScore * 100).toFixed(0)}% positive
                      </Text>
                    </View>
                  </View>

                  {/* Action buttons row */}
                  <View style={styles.commentModalActions}>
                    <TouchableOpacity
                      style={styles.commentModalActionBtn}
                      onPress={async () => {
                        await Clipboard.setStringAsync(reportComment.generatedComment);
                        Alert.alert('Copied!', 'Comment copied to clipboard');
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="content-copy" size={18} color={colors.primary[600]} />
                      <Text style={styles.commentModalActionText}>Copy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.commentModalActionBtn}
                      onPress={async () => {
                        try {
                          await Share.share({
                            message: `${selectedStudentName}'s Report Comment:\n\n${reportComment.generatedComment}`,
                          });
                        } catch {
                          // Share was cancelled or failed - no action needed
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="share" size={18} color={colors.primary[600]} />
                      <Text style={styles.commentModalActionText}>Share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.commentModalActionBtn}
                      onPress={regenerateComment}
                      disabled={isCommentGenerating}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="refresh" size={18} color={colors.primary[600]} />
                      <Text style={styles.commentModalActionText}>Regenerate</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.commentModalEmpty}>
                  <Text style={styles.commentModalEmptyText}>
                    Loading comment...
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Subject-wise Progress */}
        <View style={styles.sectionHeader}>
          <MaterialIcons name="menu-book" size={20} color={colors.primary[600]} />
          <Text style={styles.sectionTitle}>Subject-wise Progress</Text>
        </View>

        {subjects.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No subject data available yet.</Text>
          </Card>
        ) : (
          subjects.map((subject) => (
            <Card key={subject.subject_id} style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{subject.subject_name}</Text>
                  <Text style={styles.subjectTests}>{subject.total_tests} tests</Text>
                </View>
                <View style={styles.subjectStats}>
                  {getTrendIcon(subject.trend)}
                  <Text style={[styles.subjectAverage, { color: subject.average_percentage >= 60 ? colors.success[600] : colors.error[600] }]}>
                    {subject.average_percentage.toFixed(1)}%
                  </Text>
                </View>
              </View>
              <ProgressBar
                progress={subject.average_percentage}
                fillColor={subject.average_percentage >= 60 ? colors.success[600] : colors.error[600]}
                style={styles.subjectProgress}
              />
            </Card>
          ))
        )}

        {/* Class Syllabus Progress Section - Show if report data available */}
        {reportData?.data?.syllabus?.by_subject && reportData.data.syllabus.by_subject.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="menu-book" size={20} color={colors.primary[600]} />
              <Text style={styles.sectionTitle}>Class Syllabus Progress</Text>
            </View>
            {reportData.data.syllabus.by_subject.map((subj: any) => {
              const totalTopics = subj.total_topics || 0;
              const completedTopics = subj.completed_topics || 0;
              const progressPct = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
              return (
                <Card key={subj.subject_id} style={styles.syllabusCard}>
                  <View style={styles.syllabusHeader}>
                    <Text style={styles.syllabusSubjectName}>{subj.subject_name}</Text>
                    <Text style={[styles.syllabusProgress, {
                      color: progressPct >= 75 ? colors.success[600] :
                        progressPct >= 50 ? colors.warning[600] :
                          colors.error[600]
                    }]}>
                      {progressPct.toFixed(1)}%
                    </Text>
                  </View>
                  <ProgressBar
                    progress={progressPct}
                    fillColor={progressPct >= 75 ? colors.success[600] : progressPct >= 50 ? colors.warning[600] : colors.error[600]}
                    style={styles.syllabusProgressBar}
                  />
                  <View style={styles.syllabusStats}>
                    <Text style={styles.syllabusStatText}>
                      Topics: {completedTopics}/{totalTopics} completed
                    </Text>
                  </View>
                </Card>
              );
            })}
          </>
        )}

        {/* Recent Tests */}
        <View style={styles.sectionHeader}>
          <MaterialIcons name="emoji-events" size={20} color={colors.primary[600]} />
          <Text style={styles.sectionTitle}>Recent Tests</Text>
        </View>

        {recent_tests.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No tests completed yet.</Text>
          </Card>
        ) : (
          recent_tests.map((test, index) => (
            <Card key={`${test.id}-${index}`} style={styles.testCard}>
              <View style={styles.testHeader}>
                <View style={styles.testInfo}>
                  <Text style={styles.testTitle} numberOfLines={1}>{test.title}</Text>
                  <View style={styles.testMeta}>
                    <Text style={styles.testSubject}>{test.subject_name}</Text>
                    <Text style={styles.testDot}>•</Text>
                    <Text style={styles.testDate}>{formatDate(test.date)}</Text>
                    <View style={[
                      styles.testModeBadge,
                      { backgroundColor: test.test_mode === 'online' ? colors.primary[100] : colors.success[100] }
                    ]}>
                      <Text style={[
                        styles.testModeText,
                        { color: test.test_mode === 'online' ? colors.primary[700] : colors.success[700] }
                      ]}>
                        {test.test_mode}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.testScore}>
                  <Text style={[styles.testPercentage, { color: test.percentage >= 60 ? colors.success[600] : colors.error[600] }]}>
                    {test.percentage.toFixed(0)}%
                  </Text>
                  <Text style={styles.testMarks}>{test.marks_obtained}/{test.max_marks}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Progress Report Viewer Modal */}
      <ProgressReportViewer
        visible={isReportVisible}
        reportData={reportData}
        onClose={hideReport}
        onRefresh={() => generateReport(isAdmin ? selectedStudentId : undefined)}
        isLoading={isReportGenerating}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.app,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
    },
    // Back Button
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      paddingBottom: 0,
      gap: spacing.sm,
    },
    backButtonText: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
    },
    // Filter Section
    filterSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
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
    },
    filterIcon: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
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
      marginBottom: spacing.xs / 2,
    },
    filterValue: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    // Student List
    studentListContainer: {
      flex: 1,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface.primary,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
      paddingVertical: spacing.xs,
    },
    studentCount: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    studentList: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    studentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface.primary,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
      ...shadows.sm,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border.light,
    },
    studentAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary[100],
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    studentAvatarText: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.primary[600],
    },
    studentInfo: {
      flex: 1,
    },
    studentName: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    studentCode: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      marginTop: 2,
    },
    studentArrow: {
      padding: spacing.sm,
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.surface.overlay,
      justifyContent: 'flex-end',
    },
    overlayTouchable: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    modalContent: {
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
      backgroundColor: colors.surface.secondary,
    },
    sheetItemActive: {
      backgroundColor: isDark ? colors.primary[100] : colors.primary[50],
    },
    sheetItemText: {
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
      fontWeight: typography.fontWeight.medium,
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
    // Hero Section
    heroSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    heroLeft: {
      flex: 1,
    },
    heroGreeting: {
      fontSize: typography.fontSize['2xl'],
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    heroSubtext: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    heroRight: {
      alignItems: 'flex-end',
    },
    heroPercentage: {
      fontSize: typography.fontSize['2xl'],
      fontWeight: typography.fontWeight.bold,
    },
    heroPercentageLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: 2,
    },
    // Download Report Button
    downloadReportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary[50],
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.primary[200],
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    downloadReportIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary[600],
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    downloadReportContent: {
      flex: 1,
    },
    downloadReportTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    downloadReportSubtitle: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: 2,
    },
    // Stats Row
    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      alignItems: 'center',
      ...shadows.sm,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border.light,
    },
    statIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    statValue: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    statLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: 2,
      textAlign: 'center',
    },
    // Overview Card
    overviewCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    overviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    overviewTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    overviewTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    improvementBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      gap: 4,
    },
    improvementText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
    },
    overviewStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    overviewStatItem: {
      alignItems: 'center',
      flex: 1,
    },
    overviewStatLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginBottom: spacing.xs,
    },
    overviewStatValue: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    overviewStatDivider: {
      width: 1,
      backgroundColor: colors.border.light,
    },
    // Attendance Card
    attendanceCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    attendanceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    attendanceTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      flex: 1,
    },
    attendancePercentage: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
    },
    attendanceProgress: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.neutral[200],
      marginBottom: spacing.md,
    },
    attendanceStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    attendanceStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    attendanceStatText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    // AI Insights Button (Compact)
    aiInsightsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface.primary,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.primary[200],
      ...shadows.sm,
    },
    aiInsightsIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiInsightsContent: {
      flex: 1,
    },
    aiInsightsTitle: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    aiInsightsSubtitle: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: 2,
    },
    // Comment Modal
    commentModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    commentModalDismiss: {
      flex: 1,
    },
    commentModalContent: {
      backgroundColor: colors.surface.primary,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '70%',
    },
    commentModalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.neutral[300],
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    commentModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    commentModalIconBg: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentModalTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    commentModalSubtitle: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    commentModalLoading: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
    },
    commentModalLoadingTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginTop: spacing.md,
    },
    commentModalLoadingText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    commentModalScroll: {
      maxHeight: 400,
    },
    commentModalTextBox: {
      backgroundColor: colors.background.secondary,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.md,
      position: 'relative',
    },
    commentModalQuote: {
      fontSize: 36,
      color: colors.primary[300],
      fontWeight: typography.fontWeight.bold,
      lineHeight: 36,
    },
    commentModalQuoteEnd: {
      textAlign: 'right',
    },
    commentModalText: {
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
      lineHeight: 24,
      fontStyle: 'italic',
      paddingVertical: spacing.sm,
    },
    commentModalChips: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    commentModalChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.full,
    },
    commentModalChipText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
    // Action buttons row
    commentModalActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    commentModalActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    commentModalActionText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.primary[600],
    },
    commentModalEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
    },
    commentModalEmptyText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    // Section Header
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      marginTop: spacing.sm,
    },
    sectionTitle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
    },
    // Subject Card
    subjectCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadows.sm,
    },
    subjectHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    subjectInfo: {
      flex: 1,
    },
    subjectName: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    subjectTests: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: 2,
    },
    subjectStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    subjectAverage: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.bold,
    },
    subjectGradeBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    subjectGradeText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.bold,
      color: '#fff',
    },
    subjectProgress: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.neutral[200],
    },
    // Test Card
    testCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadows.sm,
    },
    testHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    testInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    testTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    testMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    testSubject: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
    },
    testDot: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
    },
    testDate: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
    },
    testModeBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    testModeText: {
      fontSize: 10,
      fontWeight: typography.fontWeight.semibold,
      textTransform: 'uppercase',
    },
    testScore: {
      alignItems: 'flex-end',
    },
    testPercentage: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
    },
    testMarks: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
    },
    // Empty States
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    emptyTitle: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    emptyText: {
      fontSize: typography.fontSize.base,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    emptyCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      marginBottom: spacing.sm,
      alignItems: 'center',
    },
    emptyCardText: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
    },
    // Syllabus Card
    syllabusCard: {
      backgroundColor: colors.surface.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadows.sm,
    },
    syllabusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    syllabusSubjectName: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      flex: 1,
    },
    syllabusProgress: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.bold,
    },
    syllabusProgressBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.neutral[200],
      marginBottom: spacing.xs,
    },
    syllabusStats: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    syllabusStatText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
    },
    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: typography.fontSize.base,
      color: colors.text.secondary,
    },
  });
