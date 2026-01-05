import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useCapabilities } from '../hooks/useCapabilities';
import { useClasses } from '../hooks/useClasses';
import { getActiveAcademicYear } from '../data/queries';

const SCOPE_STORAGE_KEY = '@classbridge_app_scope';

interface ClassListItem {
  id: string;
  grade: number | null;
  section: string | null;
  school_code: string;
  academic_year_id: string | null;
  class_teacher_name?: string;
  student_count?: number;
  created_at?: string;
}

interface ClassSelectionContextType {
  selectedClass: ClassListItem | null;
  setSelectedClass: (classItem: ClassListItem | null) => void;
  classes: ClassListItem[];
  isLoading: boolean;
  error: Error | null;
  /** @deprecated Use canManageAllClasses from useCapabilities instead */
  isSuperAdmin: boolean;
  /** Whether the user can select between multiple classes */
  canSelectClass: boolean;
  shouldShowClassSelector: boolean;
  // Academic year scope
  academicYearId: string | null;
  setAcademicYearId: (yearId: string | null) => Promise<void>;
  // Full scope
  scope: {
    school_code: string | null;
    academic_year_id: string | null;
    class_instance_id: string | null;
  };
}

const ClassSelectionContext = createContext<ClassSelectionContextType>({
  selectedClass: null,
  setSelectedClass: () => {},
  classes: [],
  isLoading: false,
  error: null,
  isSuperAdmin: false,
  canSelectClass: false,
  shouldShowClassSelector: false,
  academicYearId: null,
  setAcademicYearId: async () => {},
  scope: {
    school_code: null,
    academic_year_id: null,
    class_instance_id: null,
  },
});

export const useClassSelection = () => {
  const context = useContext(ClassSelectionContext);
  if (!context) {
    throw new Error('useClassSelection must be used within ClassSelectionProvider');
  }
  return context;
};

export const ClassSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const { can } = useCapabilities();
  const [selectedClass, setSelectedClass] = useState<ClassListItem | null>(null);
  const [academicYearId, setAcademicYearIdState] = useState<string | null>(null);
  const [scopeLoading, setScopeLoading] = useState(true);
  
  // Capability-based access control for class selection
  const canManageAllClasses = can('classes.manage');
  const canSelectClass = canManageAllClasses || can('attendance.mark');
  
  // Backward compatibility - isSuperAdmin is deprecated but kept for existing usage
  const isSuperAdmin = canManageAllClasses;
  // Show class selector for users who can manage classes or have admin capabilities
  const shouldShowClassSelector = canSelectClass;
  
  const { data: classes = [], isLoading, error } = useClasses(profile?.school_code || undefined);

  // Load scope from AsyncStorage on mount
  useEffect(() => {
    const loadScope = async () => {
      try {
        const stored = await AsyncStorage.getItem(SCOPE_STORAGE_KEY);
        if (stored) {
          try {
            const parsedScope = JSON.parse(stored);
            // Validate parsed data structure before using
            if (parsedScope && typeof parsedScope === 'object' && 'academic_year_id' in parsedScope) {
              setAcademicYearIdState(parsedScope.academic_year_id || null);
            }
          } catch (parseError) {
            // Corrupted JSON - clear it
            console.warn('Corrupted scope data in storage, clearing:', parseError);
            await AsyncStorage.removeItem(SCOPE_STORAGE_KEY);
          }
        }
      } catch (_error) {
        // Ignore storage errors
      }
    };
    loadScope();
  }, []);

  // Initialize academic year from user profile when auth is ready
  useEffect(() => {
    const initializeAcademicYear = async () => {
      if (!profile?.school_code) {
        setScopeLoading(false);
        return;
      }

      try {
        if (academicYearId) {
          setScopeLoading(false);
          return;
        }

        const { data: academicYear } = await getActiveAcademicYear(profile.school_code);
        if (academicYear) {
          setAcademicYearIdState(academicYear.id);
          await AsyncStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify({
            school_code: profile.school_code,
            academic_year_id: academicYear.id,
            class_instance_id: selectedClass?.id || null,
          }));
        }
      } catch (_error) {
        // Ignore initialization errors
      } finally {
        setScopeLoading(false);
      }
    };

    initializeAcademicYear();
  }, [profile, academicYearId, selectedClass?.id]);

  // Auto-select first class for users who can manage all classes if none selected
  useEffect(() => {
    if (canManageAllClasses && classes.length > 0 && !selectedClass) {
      setSelectedClass(classes[0]);
    }
  }, [canManageAllClasses, classes, selectedClass]);

  // For users with limited class access, auto-select their assigned class
  useEffect(() => {
    if (!canManageAllClasses && classes.length === 1 && !selectedClass) {
      setSelectedClass(classes[0]);
    } else if (!canManageAllClasses && profile?.class_instance_id && classes.length > 0) {
      const userClass = classes.find(cls => cls.id === profile.class_instance_id);
      if (userClass) setSelectedClass(userClass);
    }
  }, [canManageAllClasses, profile?.class_instance_id, classes, selectedClass]);

  // Update AsyncStorage when scope changes
  useEffect(() => {
    const updateStorage = async () => {
      if (profile?.school_code) {
        await AsyncStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify({
          school_code: profile.school_code,
          academic_year_id: academicYearId,
          class_instance_id: selectedClass?.id || null,
        }));
      }
    };
    updateStorage();
  }, [profile?.school_code, academicYearId, selectedClass?.id]);

  const setAcademicYearId = useCallback(async (yearId: string | null) => {
    setAcademicYearIdState(yearId);
    if (profile?.school_code) {
      await AsyncStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify({
        school_code: profile.school_code,
        academic_year_id: yearId,
        class_instance_id: selectedClass?.id || null,
      }));
    }
  }, [profile?.school_code, selectedClass?.id]);

  const value: ClassSelectionContextType = {
    selectedClass,
    setSelectedClass,
    classes,
    isLoading: isLoading || scopeLoading,
    error,
    isSuperAdmin,
    canSelectClass,
    shouldShowClassSelector,
    academicYearId,
    setAcademicYearId,
    scope: {
      school_code: profile?.school_code || null,
      academic_year_id: academicYearId,
      class_instance_id: selectedClass?.id || null,
    },
  };

  return (
    <ClassSelectionContext.Provider value={value}>
      {children}
    </ClassSelectionContext.Provider>
  );
};
