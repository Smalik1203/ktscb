import { log } from '../../lib/logger';

// Typed hook for Academics analytics using direct table queries

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type {
  AnalyticsQueryFilters,
  AcademicsRow,
  RankedRow,
  AcademicsAggregation,
} from '../../lib/analytics-table-types';
import { analyticsUtils } from '../../lib/analytics-utils';

interface UseAcademicsAnalyticsOptions extends AnalyticsQueryFilters {
  limit?: number;
  classInstanceId?: string;
  subjectId?: string;
}

export function useAcademicsAnalytics(options: UseAcademicsAnalyticsOptions) {
  const { school_code, academic_year_id, start_date, end_date, limit, classInstanceId, subjectId } = options;

  return useQuery({
    queryKey: ['analytics', 'academics', school_code, academic_year_id, start_date, end_date, classInstanceId, subjectId, limit],
    queryFn: async () => {
      // 1. Fetch tests in the date range
      let testsQuery = supabase
        .from('tests')
        .select(`
          id,
          title,
          subject_id,
          class_instance_id,
          created_at,
          subjects(id, subject_name),
          class_instances!inner(
            id,
            grade,
            section,
            school_code,
            academic_year_id
          )
        `)
        .filter('class_instances.school_code', 'eq', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id)
        .gte('created_at', start_date)
        .lte('created_at', end_date);

      if (classInstanceId) testsQuery = testsQuery.eq('class_instance_id', classInstanceId);
      if (subjectId) testsQuery = testsQuery.eq('subject_id', subjectId);

      const { data: testsData, error: testsError } = await testsQuery;

      if (testsError) throw testsError;
      if (!testsData || testsData.length === 0) {
        return {
          aggregation: {
            totalTests: 0,
            totalStudents: 0,
            avgScore: 0,
            participationRate: 0,
            subjectSummaries: [],
            studentSummaries: [],
          },
          rankedRows: [],
        };
      }

      // 2. Fetch test questions to calculate max marks per test
      const testIds = testsData.map((t: any) => t.id);

      const { data: questionsData, error: questionsError } = await supabase
        .from('test_questions')
        .select('test_id, points')
        .in('test_id', testIds);

      if (questionsError) throw questionsError;

      // Calculate max marks per test
      const testMaxMarksMap = new Map<string, number>();
      questionsData?.forEach((q: any) => {
        const testId = q.test_id;
        testMaxMarksMap.set(testId, (testMaxMarksMap.get(testId) || 0) + (q.points || 0));
      });

      // 3. Fetch test marks
      const { data: marksData, error: marksError } = await supabase
        .from('test_marks')
        .select(`
          id,
          test_id,
          student_id,
          marks_obtained,
          created_at,
          student!inner(
            id,
            full_name,
            class_instance_id,
            class_instances(grade, section)
          )
        `)
        .in('test_id', testIds);

      if (marksError) throw marksError;

      // 4. Aggregate by student and subject
      const studentSubjectMap = new Map<string, AcademicsRow>();

      marksData?.forEach((mark: any) => {
        const test = testsData.find((t: any) => t.id === mark.test_id);
        if (!test) return;

        const studentId = mark.student_id;
        const studentName = mark.student.full_name;
        const classInfo = mark.student.class_instances;
        const className = classInfo?.grade !== null && classInfo?.grade !== undefined
          ? `Grade ${classInfo.grade}${classInfo.section ? ` - ${classInfo.section}` : ''}`
          : 'Unknown Class';
        const subjectId = test.subject_id;
        const subjectName = test.subjects?.subject_name || 'Unknown';

        // Calculate percentage using actual max marks from test_questions
        const maxMarks = testMaxMarksMap.get(mark.test_id) || 0;
        const scorePercent = maxMarks > 0
          ? analyticsUtils.calculatePercentage(mark.marks_obtained, maxMarks)
          : mark.marks_obtained; // Fallback to raw score if no questions found

        const key = `${studentId}-${subjectId}`;

        if (!studentSubjectMap.has(key)) {
          studentSubjectMap.set(key, {
            studentId,
            studentName,
            className,
            subjectId,
            subjectName,
            avgScore: scorePercent,
            testCount: 1,
            lastTestDate: mark.created_at,
          });
        } else {
          const existing = studentSubjectMap.get(key)!;
          const totalScore = existing.avgScore * existing.testCount + scorePercent;
          existing.testCount++;
          existing.avgScore = totalScore / existing.testCount;
          if (mark.created_at > existing.lastTestDate!) existing.lastTestDate = mark.created_at;
        }
      });

      // 4. Fetch previous period data for trend
      const { startDate: prevStartDate, endDate: prevEndDate } = analyticsUtils.calculatePreviousPeriod(
        start_date,
        end_date
      );

      let prevTestsQuery = supabase
        .from('tests')
        .select(`
          id,
          subject_id,
          class_instances!inner(school_code, academic_year_id)
        `)
        .filter('class_instances.school_code', 'eq', school_code)
        .filter('class_instances.academic_year_id', 'eq', academic_year_id)
        .gte('created_at', prevStartDate)
        .lte('created_at', prevEndDate);

      if (classInstanceId) prevTestsQuery = prevTestsQuery.eq('class_instance_id', classInstanceId);
      if (subjectId) prevTestsQuery = prevTestsQuery.eq('subject_id', subjectId);

      const { data: prevTestsData } = await prevTestsQuery;

      if (prevTestsData && prevTestsData.length > 0) {
        const prevTestIds = prevTestsData.map((t: any) => t.id);

        const { data: prevMarksData } = await supabase
          .from('test_marks')
          .select('test_id, student_id, marks_obtained')
          .in('test_id', prevTestIds);

        const prevMap = new Map<string, { total: number; count: number }>();

        prevMarksData?.forEach((mark: any) => {
          const test = prevTestsData.find((t: any) => t.id === mark.test_id);
          if (!test) return;

          const key = `${mark.student_id}-${test.subject_id}`;
          const scorePercent = mark.marks_obtained;

          if (!prevMap.has(key)) {
            prevMap.set(key, { total: scorePercent, count: 1 });
          } else {
            const existing = prevMap.get(key)!;
            existing.total += scorePercent;
            existing.count++;
          }
        });

        // 5. Rank rows with trends
        const currentRows = Array.from(studentSubjectMap.values());

        // Create previous rows map for trend calculation
        const previousRows = Array.from(prevMap.entries()).map(([key, stats]): AcademicsRow => {
          // Parse key back to studentId-subjectId
          const [studentId, subjectId] = key.split('-');
          return {
            studentId,
            studentName: '',
            className: '',
            subjectId,
            subjectName: '',
            avgScore: stats.total / stats.count,
            testCount: stats.count,
            lastTestDate: null,
          };
        });

        const rankedRows = analyticsUtils.rankRowsWithTrend(
          currentRows,
          previousRows,
          (row) => `${row.studentId}-${row.subjectId}`,
          (row) => row.avgScore,
          'desc'
        );

        const limitedRows = limit ? rankedRows.slice(0, limit) : rankedRows;

        // 6. Calculate aggregation
        const subjectSummaries = Array.from(
          currentRows.reduce((acc, row) => {
            if (!acc.has(row.subjectId)) {
              acc.set(row.subjectId, {
                subjectId: row.subjectId,
                subjectName: row.subjectName,
                avgScore: 0,
                testCount: 0,
                totalScore: 0,
                studentCount: 0,
              });
            }
            const summary = acc.get(row.subjectId)!;
            summary.totalScore += row.avgScore;
            summary.testCount += row.testCount;
            summary.studentCount++;
            summary.avgScore = summary.totalScore / summary.studentCount;
            return acc;
          }, new Map())
        ).map(([, summary]) => ({
          subjectId: summary.subjectId,
          subjectName: summary.subjectName,
          avgScore: summary.avgScore,
          testCount: summary.testCount,
        }));

        const aggregation: AcademicsAggregation = {
          totalTests: testsData.length,
          totalStudents: new Set(currentRows.map((r) => r.studentId)).size,
          avgScore: analyticsUtils.calculateAverage(currentRows.map((r) => r.avgScore)),
          participationRate: (marksData?.length || 0) / (testsData.length * (new Set(marksData?.map((m: any) => m.student_id)).size || 1)) * 100,
          subjectSummaries,
          studentSummaries: currentRows,
        };

        return { aggregation, rankedRows: limitedRows };
      }

      // No previous data - return with zero trends
      const currentRows = Array.from(studentSubjectMap.values());
      const rankedRows = currentRows.map((row, index) => ({
        rank: index + 1,
        data: row,
        trend: analyticsUtils.calculateTrend(row.avgScore, row.avgScore),
      }));

      const limitedRows = limit ? rankedRows.slice(0, limit) : rankedRows;

      const aggregation: AcademicsAggregation = {
        totalTests: testsData.length,
        totalStudents: new Set(currentRows.map((r) => r.studentId)).size,
        avgScore: analyticsUtils.calculateAverage(currentRows.map((r) => r.avgScore)),
        participationRate: 100,
        subjectSummaries: [],
        studentSummaries: currentRows,
      };

      return { aggregation, rankedRows: limitedRows };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!(school_code && school_code !== '') && typeof academic_year_id === 'string' && !!(start_date && start_date !== '') && !!(end_date && end_date !== ''),
  });
}
