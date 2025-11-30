// Typed hook for Syllabus analytics using direct table queries

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type {
  AnalyticsQueryFilters,
  SyllabusRow,
  RankedRow,
  SyllabusAggregation,
} from '../../lib/analytics-table-types';
import { analyticsUtils } from '../../lib/analytics-utils';

interface UseSyllabusAnalyticsOptions extends AnalyticsQueryFilters {
  limit?: number;
  classInstanceId?: string;
  subjectId?: string;
}

export function useSyllabusAnalytics(options: UseSyllabusAnalyticsOptions) {
  const { school_code, academic_year_id, start_date, end_date, limit, classInstanceId, subjectId } = options;

  return useQuery({
    queryKey: ['analytics', 'syllabus', school_code, academic_year_id, start_date, end_date, classInstanceId, subjectId, limit],
    queryFn: async () => {
      // Validate required parameters
      if (!school_code || !academic_year_id || !start_date || !end_date) {
        console.warn('[useSyllabusAnalytics] Missing required parameters:', {
          school_code: !!school_code,
          academic_year_id: !!academic_year_id,
          start_date: !!start_date,
          end_date: !!end_date,
        });
        return {
          aggregation: {
            overallProgress: 0,
            totalSubjects: 0,
            completedSubjects: 0,
            subjectSummaries: [],
          },
          rankedRows: [],
        };
      }
      
      try {
        // Step 1: Fetch class instances to filter by school and academic year
        const { data: classInstances, error: classError } = await supabase
          .from('class_instances')
          .select('id, grade, section, school_code, academic_year_id')
          .eq('school_code', school_code)
          .eq('academic_year_id', academic_year_id);

        if (classError) throw classError;
        if (!classInstances || classInstances.length === 0) {
          return {
            aggregation: {
              overallProgress: 0,
              totalSubjects: 0,
              completedSubjects: 0,
              subjectSummaries: [],
            },
            rankedRows: [],
          };
        }

        const classIds = classInstances.map(c => c.id).filter(Boolean);
        const classMap = new Map(classInstances.map(c => [c.id, c]));

        // Guard against empty classIds array
        if (classIds.length === 0) {
          return {
            aggregation: {
              overallProgress: 0,
              totalSubjects: 0,
              completedSubjects: 0,
              subjectSummaries: [],
            },
            rankedRows: [],
          };
        }

        // Step 2: Fetch syllabus progress for these classes
        // Note: syllabus_progress tracks coverage by having records with syllabus_chapter_id or syllabus_topic_id
        // There is no is_completed column - completion is determined by the presence of records
        let progressQuery = supabase
          .from('syllabus_progress')
          .select('id, syllabus_chapter_id, syllabus_topic_id, class_instance_id, subject_id, created_at, date')
          .in('class_instance_id', classIds);

        if (classInstanceId) {
          progressQuery = progressQuery.eq('class_instance_id', classInstanceId);
        }

        if (subjectId) {
          progressQuery = progressQuery.eq('subject_id', subjectId);
        }

        const { data: progressData, error: progressError } = await progressQuery;
        if (progressError) throw progressError;

        if (!progressData || progressData.length === 0) {
          return {
            aggregation: {
              overallProgress: 0,
              totalSubjects: 0,
              completedSubjects: 0,
              subjectSummaries: [],
            },
            rankedRows: [],
          };
        }

        // Step 3: Get unique subject IDs and fetch subject details
        const subjectIds = [...new Set(progressData.map(p => p.subject_id).filter(Boolean))];
        
        // Guard against empty subjectIds array
        if (subjectIds.length === 0) {
          return {
            aggregation: {
              overallProgress: 0,
              totalSubjects: 0,
              completedSubjects: 0,
              subjectSummaries: [],
            },
            rankedRows: [],
          };
        }
        
        const { data: subjects, error: subjectsError } = await supabase
          .from('subjects')
          .select('id, subject_name')
          .in('id', subjectIds);

        if (subjectsError) throw subjectsError;

        const subjectMap = new Map((subjects || []).map(s => [s.id, s.subject_name]));

        // Step 4: Get total chapters per subject
        let chaptersQuery = supabase
          .from('syllabus_chapters')
          .select('id, syllabus_id');

        const { data: chapters, error: chaptersError } = await chaptersQuery;
        if (chaptersError) throw chaptersError;

        // Get syllabi to map chapters to subjects
        const syllabusIds = [...new Set((chapters || []).map(c => c.syllabus_id).filter(Boolean))];
        
        // Guard against empty syllabusIds array
        if (syllabusIds.length === 0) {
          // If no syllabi found, return empty results
          return {
            aggregation: {
              overallProgress: 0,
              totalSubjects: 0,
              completedSubjects: 0,
              subjectSummaries: [],
            },
            rankedRows: [],
          };
        }
        
        const { data: syllabi, error: syllabiError } = await supabase
          .from('syllabi')
          .select('id, subject_id')
          .in('id', syllabusIds);

        if (syllabiError) throw syllabiError;

        // Build subject->totalChapters map
        const syllabusToSubject = new Map((syllabi || []).map(s => [s.id, s.subject_id]));
        const chaptersBySubject = new Map<string, number>();

        (chapters || []).forEach(chapter => {
          const subjectId = syllabusToSubject.get(chapter.syllabus_id);
          if (subjectId) {
            chaptersBySubject.set(subjectId, (chaptersBySubject.get(subjectId) || 0) + 1);
          }
        });

        // Step 5: Aggregate progress by class and subject
        // Track unique chapters/topics covered per class-subject combination
        const classSubjectMap = new Map<string, SyllabusRow>();
        const coveredChaptersMap = new Map<string, Set<string>>(); // key: classId-subjectId, value: Set of chapter IDs
        const coveredTopicsMap = new Map<string, Set<string>>(); // key: classId-subjectId, value: Set of topic IDs

        progressData.forEach((progress) => {
          const classId = progress?.class_instance_id;
          const subjectId = progress?.subject_id;
          
          // Skip if required fields are missing
          if (!classId || !subjectId) return;
          
          const classInfo = classMap.get(classId);
          const subjectName = subjectMap.get(subjectId) || 'Unknown Subject';
          const className = classInfo 
            ? classInfo.grade !== null && classInfo.grade !== undefined
              ? `Grade ${classInfo.grade}${classInfo.section ? ` - ${classInfo.section}` : ''}`
              : 'Unknown Class'
            : 'Unknown Class';

          const key = `${classId}-${subjectId}`;

          // Track covered chapters and topics
          if (progress.syllabus_chapter_id) {
            if (!coveredChaptersMap.has(key)) {
              coveredChaptersMap.set(key, new Set());
            }
            coveredChaptersMap.get(key)!.add(progress.syllabus_chapter_id);
          }
          
          if (progress.syllabus_topic_id) {
            if (!coveredTopicsMap.has(key)) {
              coveredTopicsMap.set(key, new Set());
            }
            coveredTopicsMap.get(key)!.add(progress.syllabus_topic_id);
          }

          // Initialize or update the row
          if (!classSubjectMap.has(key)) {
            const totalTopics = chaptersBySubject.get(subjectId) || 0;
            classSubjectMap.set(key, {
              classId,
              className,
              subjectId,
              subjectName,
              completedTopics: 0, // Will be calculated below
              totalTopics,
              progress: 0,
              lastUpdated: progress.created_at || progress.date || null,
            });
          } else {
            const existing = classSubjectMap.get(key)!;
            // Update lastUpdated if this record is more recent
            const recordDate = progress.created_at || progress.date;
            if (recordDate && (!existing.lastUpdated || recordDate > existing.lastUpdated)) {
              existing.lastUpdated = recordDate;
            }
          }
        });

        // Calculate completed topics (unique chapters covered)
        classSubjectMap.forEach((row, key) => {
          const chaptersCovered = coveredChaptersMap.get(key)?.size || 0;
          const topicsCovered = coveredTopicsMap.get(key)?.size || 0;
          // Use chapters as the primary metric, or topics if chapters aren't available
          row.completedTopics = chaptersCovered > 0 ? chaptersCovered : topicsCovered;
        });

        // Step 6: Calculate progress percentages
        classSubjectMap.forEach((row) => {
          row.progress = analyticsUtils.calculatePercentage(row.completedTopics, row.totalTopics);
        });

        // Step 7: Fetch previous period data for trend
        const { startDate: prevStartDate, endDate: prevEndDate } = analyticsUtils.calculatePreviousPeriod(
          start_date,
          end_date
        );

        let prevProgressQuery = supabase
          .from('syllabus_progress')
          .select('class_instance_id, subject_id, syllabus_chapter_id, syllabus_topic_id')
          .in('class_instance_id', classIds)
          .lte('date', prevEndDate);
        
        // Note: classIds is already validated above, so it won't be empty here

        if (classInstanceId) prevProgressQuery = prevProgressQuery.eq('class_instance_id', classInstanceId);
        if (subjectId) prevProgressQuery = prevProgressQuery.eq('subject_id', subjectId);

        const { data: prevProgressData } = await prevProgressQuery;

        const prevMap = new Map<string, { completed: number; total: number }>();
        const prevCoveredChaptersMap = new Map<string, Set<string>>();
        const prevCoveredTopicsMap = new Map<string, Set<string>>();

        (prevProgressData || []).forEach((progress) => {
          const classId = progress?.class_instance_id;
          const subjectId = progress?.subject_id;
          
          // Skip if required fields are missing
          if (!classId || !subjectId) return;
          
          const key = `${classId}-${subjectId}`;

          if (!prevMap.has(key)) {
            const totalTopics = chaptersBySubject.get(subjectId) || 0;
            prevMap.set(key, { completed: 0, total: totalTopics });
          }

          // Track covered chapters and topics
          if (progress.syllabus_chapter_id) {
            if (!prevCoveredChaptersMap.has(key)) {
              prevCoveredChaptersMap.set(key, new Set());
            }
            prevCoveredChaptersMap.get(key)!.add(progress.syllabus_chapter_id);
          }
          
          if (progress.syllabus_topic_id) {
            if (!prevCoveredTopicsMap.has(key)) {
              prevCoveredTopicsMap.set(key, new Set());
            }
            prevCoveredTopicsMap.get(key)!.add(progress.syllabus_topic_id);
          }
        });

        // Calculate completed topics for previous period
        prevMap.forEach((stats, key) => {
          const chaptersCovered = prevCoveredChaptersMap.get(key)?.size || 0;
          const topicsCovered = prevCoveredTopicsMap.get(key)?.size || 0;
          stats.completed = chaptersCovered > 0 ? chaptersCovered : topicsCovered;
        });

        // Step 8: Rank rows with trends
        const currentRows = Array.from(classSubjectMap.values());
        const previousRows = Array.from(prevMap.entries()).map(([key, stats]): SyllabusRow => {
          const [classId, subjectId] = key.split('-');
          const progress = analyticsUtils.calculatePercentage(stats.completed, stats.total);
          return {
            classId,
            className: '',
            subjectId,
            subjectName: '',
            completedTopics: stats.completed,
            totalTopics: stats.total,
            progress,
            lastUpdated: null,
          };
        });

        const rankedRows = analyticsUtils.rankRowsWithTrend(
          currentRows,
          previousRows,
          (row) => `${row.classId}-${row.subjectId}`,
          (row) => row.progress,
          'desc'
        );

        const limitedRows = limit ? rankedRows.slice(0, limit) : rankedRows;

        // Step 9: Calculate aggregation
        const overallProgress = analyticsUtils.calculateAverage(currentRows.map((r) => r.progress));
        const totalSubjects = new Set(currentRows.map((r) => r.subjectId)).size;
        const completedSubjects = currentRows.filter((r) => r.progress === 100).length;

        const aggregation: SyllabusAggregation = {
          overallProgress,
          totalSubjects,
          completedSubjects,
          subjectSummaries: currentRows,
        };

        return { aggregation, rankedRows: limitedRows };
      } catch (error) {
        // Log full error details for debugging
        const errorDetails = error instanceof Error 
          ? { message: error.message, stack: error.stack, name: error.name }
          : error;
        console.error('[useSyllabusAnalytics] Error:', errorDetails);
        
        // Return empty data structure on error instead of throwing
        // This prevents the query from failing and allows the UI to render
        return {
          aggregation: {
            overallProgress: 0,
            totalSubjects: 0,
            completedSubjects: 0,
            subjectSummaries: [],
          },
          rankedRows: [],
        };
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!(school_code && school_code !== '') && typeof academic_year_id === 'string' && !!(start_date && start_date !== '') && !!(end_date && end_date !== ''),
  });
}
