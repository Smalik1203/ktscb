import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../src/contexts/AuthContext';
import { AppNavbar } from '../../src/components/layout/AppNavbarExpo';
import { useCapabilities } from '../../src/hooks/useCapabilities';

export default function TabLayout() {
  const { profile, status, loading, bootstrapping } = useAuth();
  const { can, isLoading: capabilitiesLoading } = useCapabilities();
  const router = useRouter();

  // Protect routes: redirect to login if no profile or not signed in
  useEffect(() => {
    // Don't redirect while checking/auth is loading
    if (loading || bootstrapping) {
      return;
    }

    if (status === 'signedOut' || status === 'accessDenied' || (status === 'signedIn' && !profile)) {
      // Only redirect if we're not already on login page
      router.replace('/login');
    }
  }, [status, profile, loading, bootstrapping, router]);

  // Don't render tabs if user doesn't have a profile or auth is still loading
  if (loading || bootstrapping || capabilitiesLoading || status !== 'signedIn' || !profile) {
    return null; // Will redirect via useEffect or show loading
  }

  // Capability-based tab visibility (NOT role-based!)
  // Safe access: profile is guaranteed non-null here due to early return above
  const canManageAdmins = can('admins.create');
  const canManageClasses = can('classes.manage');
  const canManageSubjects = can('subjects.manage');
  const canManageStudents = can('students.create');
  const canViewFinance = can('finance.access');
  const canManageInventory = can('inventory.create');

  // Feedback tab title based on role
  const getFeedbackTitle = () => {
    if (can('feedback.view_all')) return 'Staff Feedback';
    if (can('feedback.read_own') && !can('feedback.submit')) return 'Feedback Received';
    return 'Share Feedback';
  };

  return (
      <Tabs
        screenOptions={{
          header: ({ options }) => (
            <AppNavbar
              title={options.title || 'KTS'}
              showBackButton={false}
            />
          ),
          tabBarStyle: { display: 'none' }, // Hide bottom navigation bar - sidebar is enough
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarLabel: 'Home',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="dashboard" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="timetable"
          options={{
            title: 'Timetable',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="date-range" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="date-range" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="resources"
          options={{
            title: 'Resources',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="auto-stories" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="announcements"
          options={{
            title: 'Announcements',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="chat" size={size} color={color} />,
          }}
        />

        {/* Feedback Screen */}
        <Tabs.Screen
          name="feedback"
          options={{
            title: getFeedbackTitle(),
            tabBarIcon: ({ size, color }) => <MaterialIcons name="question-answer" size={size} color={color} />,
          }}
        />

        {/* Student Fees screen */}
        <Tabs.Screen
          name="fees-student"
          options={{
            title: 'Fees',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="credit-card" size={size} color={color} />,
            href: null,
          }}
        />

        <Tabs.Screen
          name="syllabus"
          options={{
            title: 'Syllabus',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="auto-stories" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="syllabus-student"
          options={{
            title: 'Syllabus (Student)',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="auto-stories" size={size} color={color} />,
            href: null,
          }}
        />

        <Tabs.Screen
          name="attendance"
          options={{
            title: 'Attendance',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="how-to-reg" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="check-circle" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="assessments"
          options={{
            title: 'Assessments',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="description" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="progress"
          options={{
            title: can('dashboard.admin_stats') ? 'Student Progress' : 'My Progress',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="trending-up" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="chatbot"
          options={{
            title: 'Sage AI',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="smart-toy" size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="fees"
          options={{
            title: 'Fees',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="credit-card" size={size} color={color} />,
          }}
        />




        <Tabs.Screen
          name="manage"
          options={{
            title: 'Management',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="settings" size={size} color={color} />,
          }}
        />

        {/* Finance Screen - Super Admin Only */}
        <Tabs.Screen
          name="finance"
          options={{
            title: 'Finance',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="attach-money" size={size} color={color} />,
            href: canViewFinance ? '/(tabs)/finance' : null,
          }}
        />

        {/* Admin Management Screen - capability-gated */}
        <Tabs.Screen
          name="add-admin"
          options={{
            title: 'Add Admins',
            href: canManageAdmins ? '/(tabs)/add-admin' : null,
          }}
        />

        {/* Class Management Screen - capability-gated */}
        <Tabs.Screen
          name="add-classes"
          options={{
            title: 'Add Classes',
            href: canManageClasses ? '/(tabs)/add-classes' : null,
          }}
        />

        {/* Subject Management Screen - capability-gated */}
        <Tabs.Screen
          name="add-subjects"
          options={{
            title: 'Add Subjects',
            href: canManageSubjects ? '/(tabs)/add-subjects' : null,
          }}
        />

        {/* Student Management Screen - capability-gated */}
        <Tabs.Screen
          name="add-student"
          options={{
            title: 'Add Students',
            href: canManageStudents ? '/(tabs)/add-student' : null,
          }}
        />

        {/* Inventory Management Screen - capability-gated */}
        <Tabs.Screen
          name="inventory"
          options={{
            title: 'Inventory',
            tabBarIcon: ({ size, color }) => <MaterialIcons name="inventory-2" size={size} color={color} />,
            href: canManageInventory ? '/(tabs)/inventory' : null,
          }}
        />
      </Tabs>
  );
}
