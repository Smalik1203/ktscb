import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCapabilities } from '../../hooks/useCapabilities';
import { StudentTimetableScreen } from '../../components/timetable/StudentTimetableScreen';
import { ModernTimetableScreen } from '../../components/timetable/ModernTimetableScreen';

export default function TimetableScreen() {
  const { profile } = useAuth();
  const { can } = useCapabilities();
  
  // Capability-based check - show admin view if user can manage timetable
  const canManageTimetable = can('timetable.manage');
  
  if (canManageTimetable) {
    return <ModernTimetableScreen />;
  } else {
    return <StudentTimetableScreen />;
  }
}
