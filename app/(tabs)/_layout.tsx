import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { LayoutDashboard, CalendarRange, UserCheck, CreditCard, LineChart, Settings2, CalendarDays, NotebookText, CheckCircle2, FileText, TrendingUp, DollarSign, Package } from 'lucide-react-native';
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
  const canManageClasses = can('classes.create');
  const canManageSubjects = can('subjects.create');
  const canManageStudents = can('students.create');
  const canViewFinance = can('management.view') && (profile?.role === 'superadmin' ?? false); // Finance is super admin only - safe optional chaining
  const canManageInventory = can('inventory.create');

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
          tabBarIcon: ({ size, color }) => <LayoutDashboard size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="timetable"
        options={{
          title: 'Timetable',
          tabBarIcon: ({ size, color }) => <CalendarRange size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ size, color }) => <CalendarDays size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="resources"
        options={{
          title: 'Resources',
          tabBarIcon: ({ size, color }) => <NotebookText size={size} color={color} />,
        }}
      />

      {/* Student Fees screen */}
      <Tabs.Screen
        name="fees-student"
        options={{
          title: 'Fees',
          tabBarIcon: ({ size, color }) => <CreditCard size={size} color={color} />,
          href: null,
        }}
      />

      <Tabs.Screen
        name="syllabus"
        options={{
          title: 'Syllabus',
          tabBarIcon: ({ size, color }) => <NotebookText size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="syllabus-student"
        options={{
          title: 'Syllabus (Student)',
          tabBarIcon: ({ size, color }) => <NotebookText size={size} color={color} />,
          href: null,
        }}
      />

      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ size, color }) => <UserCheck size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ size, color }) => <CheckCircle2 size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="assessments"
        options={{
          title: 'Assessments',
          tabBarIcon: ({ size, color }) => <FileText size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="progress"
        options={{
          title: 'My Progress',
          tabBarIcon: ({ size, color }) => <TrendingUp size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="fees"
        options={{
          title: 'Fees',
          tabBarIcon: ({ size, color }) => <CreditCard size={size} color={color} />,
        }}
      />


      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ size, color }) => <LineChart size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="manage"
        options={{
          title: 'Management',
          tabBarIcon: ({ size, color }) => <Settings2 size={size} color={color} />,
        }}
      />

      {/* Finance Screen - Super Admin Only */}
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ size, color }) => <DollarSign size={size} color={color} />,
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
          tabBarIcon: ({ size, color }) => <Package size={size} color={color} />,
          href: canManageInventory ? '/(tabs)/inventory' : null,
        }}
      />
    </Tabs>
  );
}
