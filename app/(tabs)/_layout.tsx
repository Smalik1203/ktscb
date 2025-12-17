import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { LayoutDashboard, CalendarRange, UserCheck, CreditCard, LineChart, Settings2, CalendarDays, NotebookText, CheckCircle2, ReceiptText, FileText } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { AppNavbar } from '../../src/components/layout/AppNavbarExpo';

export default function TabLayout() {
  const { profile, status, loading, bootstrapping } = useAuth();
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
  if (loading || bootstrapping || status !== 'signedIn' || !profile) {
    return null; // Will redirect via useEffect or show loading
  }

  const showSuperAdminTabs = profile?.role === 'superadmin';
  const showAdminTabs = profile?.role === 'admin' || profile?.role === 'superadmin';

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
        name="fees"
        options={{
          title: 'Fees',
          tabBarIcon: ({ size, color }) => <CreditCard size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ size, color }) => <ReceiptText size={size} color={color} />,
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

      {/* Super Admin Screens */}
      <Tabs.Screen
        name="add-admin"
        options={{
          title: 'Add Admins',
          href: showSuperAdminTabs ? '/(tabs)/add-admin' : null,
        }}
      />

      <Tabs.Screen
        name="add-classes"
        options={{
          title: 'Add Classes',
          href: showSuperAdminTabs ? '/(tabs)/add-classes' : null,
        }}
      />

      <Tabs.Screen
        name="add-subjects"
        options={{
          title: 'Add Subjects',
          href: showSuperAdminTabs ? '/(tabs)/add-subjects' : null,
        }}
      />

      <Tabs.Screen
        name="add-student"
        options={{
          title: 'Add Students',
          href: showAdminTabs ? '/(tabs)/add-student' : null,
        }}
      />
    </Tabs>
  );
}
