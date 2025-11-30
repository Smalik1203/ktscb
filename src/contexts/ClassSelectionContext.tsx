import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
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
  isSuperAdmin: boolean;
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
  const [selectedClass, setSelectedClass] = useState<ClassListItem | null>(null);
  const [academicYearId, setAcademicYearIdState] = useState<string | null>(null);
  const [scopeLoading, setScopeLoading] = useState(true);
  
  const isSuperAdmin = profile?.role === 'superadmin' || profile?.role === 'cb_admin';
  // Show for superadmins/cb_admin and admins managing multiple classes
  const shouldShowClassSelector = isSuperAdmin || profile?.role === 'admin';
  
  const { data: classes = [], isLoading, error } = useClasses(profile?.school_code || undefined);

  // Load scope from AsyncStorage on mount
  useEffect(() => {
    const loadScope = async () => {
      try {
        const stored = await AsyncStorage.getItem(SCOPE_STORAGE_KEY);
        if (stored) {
          const parsedScope = JSON.parse(stored);
          setAcademicYearIdState(parsedScope.academic_year_id);
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

  // Auto-select first class for super admin if none selected
  useEffect(() => {
    if (isSuperAdmin && classes.length > 0 && !selectedClass) {
      setSelectedClass(classes[0]);
    }
  }, [isSuperAdmin, classes, selectedClass]);

  // For admins/students, if only one class, auto-select it
  useEffect(() => {
    if (!isSuperAdmin && classes.length === 1 && !selectedClass) {
      setSelectedClass(classes[0]);
    } else if (!isSuperAdmin && profile?.class_instance_id && classes.length > 0) {
      const userClass = classes.find(cls => cls.id === profile.class_instance_id);
      if (userClass) setSelectedClass(userClass);
    }
  }, [isSuperAdmin, profile?.class_instance_id, classes, selectedClass]);

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
