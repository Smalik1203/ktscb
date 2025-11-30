import React, { useMemo } from 'react';
import { useTheme } from '../../../../contexts/ThemeContext';
import { View, StyleSheet } from 'react-native';
import { SuperAdminAnalytics, TimePeriod } from '../../types';
import { TimePeriodFilter, MetricCard, ComparisonChart } from '../../shared';
import type { ThemeColors, Typography, Spacing, BorderRadius, Shadows } from '../../../../theme/types';

interface SyllabusProgressDetailViewProps {
  data: SuperAdminAnalytics;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  dateRange: { startDate: string; endDate: string };
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
}

export const SyllabusProgressDetailView: React.FC<SyllabusProgressDetailViewProps> = ({
  data,
  timePeriod,
  setTimePeriod,
  dateRange,
  onDateRangeChange,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, typography, spacing, borderRadius, shadows),
    [colors, typography, spacing, borderRadius, shadows]
  );

  const overallProgress = data?.syllabus?.overallProgress || 0;

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return colors.success[600];
    if (progress >= 50) return colors.info[600];
    return colors.warning[600];
  };

  const subjectData = data?.syllabus?.progressBySubject?.map(subject => {
    const subjectColor = getProgressColor(subject.progress);
    return {
      id: subject.subjectId,
      label: subject.subjectName,
      value: subject.progress,
      color: subjectColor,
      subtext: `${subject.completedTopics}/${subject.totalTopics} topics`,
    };
  }) || [];

  const classData = data?.syllabus?.progressByClass?.map(classItem => {
    const classColor = getProgressColor(classItem.progress);
    return {
      id: classItem.classId,
      label: classItem.className,
      value: classItem.progress,
      color: classColor,
      subtext: `${classItem.className} progress`,
    };
  }) || [];

  return (
    <View style={styles.container}>
      <TimePeriodFilter 
        timePeriod={timePeriod} 
        setTimePeriod={setTimePeriod}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
      />

      <MetricCard
        label="Overall Syllabus Progress"
        value={`${Math.round(overallProgress)}%`}
        subtext="School-wide completion"
        progress={overallProgress}
        variant="ring"
      />

      {subjectData.length > 0 && (
        <ComparisonChart
          title="Progress by Subject"
          subtitle="Completion across all subjects"
          items={subjectData}
          variant="syllabus"
        />
      )}

      {classData.length > 0 && (
        <ComparisonChart
          title="Progress by Class"
          subtitle="Completion across all classes"
          items={classData}
          variant="syllabus"
        />
      )}
    </View>
  );
};

const createStyles = (
  colors: ThemeColors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows
) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
  });
