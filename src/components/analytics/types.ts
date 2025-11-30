// Analytics Type Definitions

export interface SuperAdminAnalytics {
  attendance: {
    avgRate: number;
    trend7Days: { date: string; rate: number }[];
    trend30Days: { date: string; rate: number }[];
    classesByConsistency: {
      classId: string;
      className: string;
      avgRate: number;
      trend: 'improving' | 'stable';
    }[];
  };
  academics: {
    avgScoreBySubject: {
      subjectId: string;
      subjectName: string;
      avgScore: number;
      participationRate: number;
    }[];
    participationRate: number;
  };
  fees: {
    realizationRate: number;
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    agingBuckets: {
      current: number;
      '30to60': number;
      '60to90': number;
      over90: number;
    };
  };
  operations: {
    timetableCoverage: number;
    teacherLoadBalance: {
      teacherId: string;
      teacherName: string;
      totalPeriods: number;
      conductedPeriods: number;
    }[];
  };
  syllabus: {
    overallProgress: number;
    progressBySubject: {
      subjectId: string;
      subjectName: string;
      completedTopics: number;
      totalTopics: number;
      progress: number;
    }[];
    progressByClass: {
      classId: string;
      className: string;
      progress: number;
    }[];
  };
  engagement: {
    testParticipation: number;
    taskSubmissionRate: number;
  };
  summary: {
    totalStudents: number;
    totalClasses: number;
    totalTeachers: number;
    activeAcademicYear: string;
  };
}

export interface AdminAnalytics {
  presence: {
    weeklyTrend: {
      date: string;
      rate: number;
      presentCount: number;
      totalStudents: number;
    }[];
    steadyParticipation: number;
    currentRate: number;
  };
  learning: {
    quizAvgTrend: { date: string; avgScore: number }[];
    assignmentOnTimeRate: number;
    subjectCompletion: {
      subjectId: string;
      subjectName: string;
      completionPercent: number;
    }[];
  };
  syllabus: {
    progressBySubject: {
      subjectId: string;
      subjectName: string;
      completedTopics: number;
      totalTopics: number;
      progress: number;
    }[];
  };
  operations: {
    plannedPeriods: number;
    conductedPeriods: number;
    coveragePercent: number;
    weeklyTrend: {
      date: string;
      planned: number;
      conducted: number;
      coverage: number;
    }[];
  };
  engagement: {
    quizParticipation: number;
    assignmentParticipation: number;
  };
  summary: {
    className: string;
    totalStudents: number;
    classTeacher: string;
  };
}

export interface StudentAnalytics {
  attendanceRhythm: {
    daysAttendedThisMonth: number;
    totalDaysThisMonth: number;
    fourWeekTrend: {
      week: number;
      presentDays: number;
      totalDays: number;
      rate: number;
    }[];
    currentRate: number;
  };
  learning: {
    subjectScoreTrend: {
      subjectId: string;
      subjectName: string;
      avgScore: number;
      testCount: number;
      recentTrend: { date: string; score: number }[];
    }[];
    assignmentOnTimeStreak: number;
    totalAssignments: number;
  };
  progressHighlights: {
    closestToPersonalBest: {
      subjectId: string;
      subjectName: string;
      bestScore: number;
      recentScore: number;
    };
    syllabusProgress: {
      subjectId: string;
      subjectName: string;
      completedTopics: number;
      totalTopics: number;
      progress: number;
    }[];
  };
  fees: {
    totalBilled: number;
    totalPaid: number;
    totalDue: number;
    lastPaymentDate: string | null;
    status: 'paid' | 'current' | 'overdue' | 'no_billing';
  };
  summary: {
    studentName: string;
    className: string;
    schoolName: string;
  };
}

export type TimePeriod = 'today' | 'week' | 'month' | 'custom';
export type AnalyticsFeature = 'attendance' | 'fees' | 'learning' | 'operations' | 'overview';

export interface DateRange {
  startDate: string;
  endDate: string;
}

// Preset date ranges
export const DATE_PRESETS: { value: TimePeriod; label: string; description: string }[] = [
  { value: 'today', label: 'Today', description: 'Today only' },
  { value: 'week', label: 'This Week', description: 'Last 7 days' },
  { value: 'month', label: 'This Month', description: 'Last 30 days' },
  { value: 'custom', label: 'Custom', description: 'Select dates' },
];

// Helper function to calculate date range based on time period
export function getDateRangeForPeriod(
  timePeriod: TimePeriod,
  customRange?: DateRange
): DateRange {
  // If custom period with provided range, use it
  if (timePeriod === 'custom' && customRange) {
    return customRange;
  }

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  
  switch (timePeriod) {
    case 'today':
      // Just today
      break;
    case 'week':
      // Last 7 days
      startDate.setDate(startDate.getDate() - 6);
      break;
    case 'month':
      // Last 30 days
      startDate.setDate(startDate.getDate() - 29);
      break;
    case 'custom':
      // Default to last 30 days if no custom range provided
      startDate.setDate(startDate.getDate() - 29);
      break;
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

// Format date for display
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

