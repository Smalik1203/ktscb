import React, { useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  NotebookText,
  UserCheck,
  UsersRound,
  LineChart,
  CreditCard,
  LogOut,
  Bell,
  Settings2,
  User,
  ChevronRight,
  Star,
  CheckCircle2,
  UserPlus,
  List,
  Layers,
  ReceiptText,
  FolderOpen,
  FileText,
  Moon,
  Sun
} from 'lucide-react-native';
import { spacing, borderRadius, typography, shadows, colors } from '../../../lib/design-system';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useClass } from '../../hooks/useClasses';

type MenuItem = {
  key: string;
  label: string;
  icon: any;
  route: string;
  roles?: ('superadmin' | 'cb_admin' | 'admin' | 'teacher' | 'student')[];
  section: 'Main' | 'Academic' | 'Learning' | 'Admin' | 'Settings' | 'CB Admin';
  badge?: number;
  isNew?: boolean;
  description?: string;
  hasSubMenu?: boolean;
  parent?: string;
};

const MENU: MenuItem[] = [
  { 
    key: 'home', 
    label: 'Dashboard', 
    icon: LayoutDashboard, 
    route: '/(tabs)', 
    section: 'Main',
    description: 'Overview and quick stats'
  },
  { 
    key: 'calendar', 
    label: 'Calendar', 
    icon: CalendarDays, 
    route: '/(tabs)/calendar', 
    section: 'Main',
    description: 'Events and schedules'
  },
  { 
    key: 'timetable', 
    label: 'Timetable', 
    icon: CalendarRange, 
    route: '/(tabs)/timetable', 
    section: 'Main',
    description: 'Class schedules'
  },
  { 
    key: 'resources', 
    label: 'Resources', 
    icon: FolderOpen, 
    route: '/(tabs)/resources', 
    section: 'Learning',
    description: 'Study materials'
  },
  { 
    key: 'syllabus_staff', 
    label: 'Syllabus', 
    icon: NotebookText, 
    route: '/(tabs)/syllabus', 
    roles: ['admin', 'superadmin', 'cb_admin', 'teacher'],
    section: 'Learning',
    description: 'Chapters and topics'
  },
  { 
    key: 'syllabus_student', 
    label: 'Syllabus', 
    icon: NotebookText, 
    route: '/(tabs)/syllabus-student', 
    roles: ['student'],
    section: 'Learning',
    description: 'Your syllabus'
  },
  { 
    key: 'attendance', 
    label: 'Attendance', 
    icon: UserCheck, 
    route: '/(tabs)/attendance', 
    roles: ['admin', 'superadmin', 'cb_admin', 'student'], 
    section: 'Academic',
    description: 'Track student attendance'
  },
  { 
    key: 'fees_student', 
    label: 'Fees', 
    icon: CreditCard, 
    route: '/(tabs)/fees-student', 
    roles: ['student'], 
    section: 'Academic',
    description: 'Your fees'
  },
  {
    key: 'assessments',
    label: 'Assessments',
    icon: FileText,
    route: '/(tabs)/assessments',
    section: 'Academic',
    description: 'Tests and exams',
    isNew: true
  },
  { 
    key: 'fees', 
    label: 'Fees', 
    icon: CreditCard, 
    route: '/(tabs)/fees', 
    roles: ['admin', 'superadmin', 'cb_admin'], 
    section: 'Academic',
    description: 'Fee management',
    hasSubMenu: true
  },
  { 
    key: 'fees_payments', 
    label: 'Payments', 
    icon: ReceiptText, 
    route: '/(tabs)/payments', 
    roles: ['admin', 'superadmin', 'cb_admin'], 
    section: 'Academic',
    description: 'Payment history',
    parent: 'fees'
  },
  { 
    key: 'fees_components', 
    label: 'Components', 
    icon: Settings2, 
    route: '/(tabs)/fees?tab=components', 
    roles: ['admin', 'superadmin', 'cb_admin'], 
    section: 'Academic',
    description: 'Manage fee components',
    parent: 'fees'
  },
  { 
    key: 'analytics', 
    label: 'Analytics', 
    icon: LineChart, 
    route: '/(tabs)/analytics', 
    roles: ['admin', 'superadmin', 'cb_admin', 'student'], 
    section: 'Academic',
    description: 'Performance insights'
  },
  { 
    key: 'tasks', 
    label: 'Tasks', 
    icon: CheckCircle2, 
    route: '/(tabs)/tasks', 
    roles: ['admin', 'superadmin', 'cb_admin', 'student'], 
    section: 'Academic',
    description: 'Homework and assignments',
    isNew: true
  },
  { 
    key: 'class_mgmt', 
    label: 'Management', 
    icon: Settings2, 
    route: '/(tabs)/manage', 
    roles: ['admin', 'superadmin', 'cb_admin'], 
    section: 'Academic',
    description: 'Class administration'
  },
  {
    key: 'add_admin',
    label: 'Add Admins',
    icon: UserPlus,
    route: '/(tabs)/add-admin',
    roles: ['superadmin'],
    section: 'Admin',
    description: 'Create and manage administrators'
  },
  {
    key: 'add_classes',
    label: 'Add Classes',
    icon: List,
    route: '/(tabs)/add-classes',
    roles: ['superadmin'],
    section: 'Admin',
    description: 'Manage academic years and classes'
  },
  {
    key: 'add_subjects',
    label: 'Add Subjects',
    icon: Layers,
    route: '/(tabs)/add-subjects',
    roles: ['superadmin'],
    section: 'Admin',
    description: 'Manage school subjects'
  },
  {
    key: 'add_student',
    label: 'Add Students',
    icon: UsersRound,
    route: '/(tabs)/add-student',
    roles: ['admin', 'superadmin'],
    section: 'Admin',
    description: 'Create and manage students'
  },
];

export function DrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const role = profile?.role as MenuItem['roles'] extends (infer U)[] ? U : never;
  const [activeItem, setActiveItem] = React.useState<string>('home');
  const [expandedMenus, setExpandedMenus] = React.useState<Set<string>>(new Set(['fees']));
  const insets = useSafeAreaInsets();
  
  // Fetch class information for students
  const isStudent = role === 'student';
  const { data: classData } = useClass(profile?.class_instance_id || undefined);
  
  // Dynamic styles based on theme
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface.primary,
    },
    sectionLabel: {
      color: colors.text.tertiary,
      fontSize: 13,
      fontWeight: typography.fontWeight.semibold as any,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    menuItemActive: {
      backgroundColor: isDark ? colors.primary[50] : colors.primary[50],
      borderLeftWidth: 3,
      borderLeftColor: colors.primary[600],
    },
    menuItemLabel: {
      fontSize: 17,
      fontWeight: typography.fontWeight.medium as any,
      color: colors.text.primary,
      marginLeft: 10,
      flex: 1,
    },
    menuItemLabelActive: {
      color: colors.primary[isDark ? 600 : 700],
      fontWeight: typography.fontWeight.semibold as any,
    },
    subMenuItem: {
      marginLeft: 18,
      paddingVertical: 10,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.sm,
      marginVertical: 4,
    },
    subMenuItemLabel: {
      fontSize: 15,
      marginLeft: 10,
      color: colors.text.secondary,
    },
    badge: {
      backgroundColor: colors.error[500],
      borderRadius: borderRadius.full,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
      marginLeft: spacing.sm,
    },
    badgeText: {
      color: colors.text.inverse,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.bold as any,
    },
    themeToggle: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    logoutButton: {
      backgroundColor: colors.error[50],
      borderWidth: 1,
      borderColor: colors.error[200],
    },
    footerItemLabel: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium as any,
      color: colors.text.primary,
    },
    footerBorder: {
      borderTopColor: colors.border.light,
    },
    avatar: {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    avatarText: {
      fontSize: 18,
      fontWeight: typography.fontWeight.bold as any,
      color: colors.text.inverse,
      letterSpacing: 0.5,
    },
    userName: {
      fontSize: 18,
      fontWeight: typography.fontWeight.semibold as any,
      color: colors.text.inverse,
      marginBottom: 3,
    },
    userRoleContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    userRoleText: {
      fontSize: 13,
      fontWeight: typography.fontWeight.medium as any,
      color: colors.text.inverse,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    headerLogoutButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    headerLogoutIcon: {
      color: colors.text.inverse,
    },
  }), [colors, isDark]);
  
  // Format class name for display
  const displayText = useMemo(() => {
    if (isStudent && classData) {
      return `Grade ${classData.grade}${classData.section ? `-${classData.section}` : ''}`;
    }
    return (profile?.role || 'UNKNOWN').toUpperCase();
  }, [isStudent, classData, profile?.role]);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const grouped = useMemo(() => {
    const allowed = MENU.filter(item => !item.roles || item.roles.includes(role));
    const sections: Record<string, MenuItem[]> = {};
    for (const item of allowed) {
      sections[item.section] = sections[item.section] || [];
      sections[item.section].push(item);
    }
    return sections;
  }, [role]);

  // Animation effects
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogout = async () => {
    try {
      props.navigation.closeDrawer();
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const toggleSubMenu = (key: string) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleItemPress = (item: MenuItem) => {
    try {
      if (item.hasSubMenu) {
        toggleSubMenu(item.key);
        return;
      }
      
      setActiveItem(item.key);
      props.navigation.closeDrawer();
      
      // Handle sub-menu items by setting parent as active too
      if (item.parent) {
        setActiveItem(item.parent);
      }
      
      router.push(item.route as any);
    } catch (_error) {
      try {
        router.replace(item.route as any);
      } catch (fallbackError) {
        console.error('Navigation error:', fallbackError);
      }
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return colors.error[500]; // Red
      case 'cb_admin': return colors.primary[600]; // KTS Purple
      case 'admin': return colors.info[600]; // Purple
      case 'teacher': return colors.accent.main; // KTS Crimson
      case 'student': return colors.secondary.main; // KTS Orange
      default: return colors.neutral[500];
    }
  };

  // Gradient colors for header based on theme - KTS Brand (Purple to Orange)
  // Smooth gradient from Royal Purple to Golden Orange
  const headerGradientColors = isDark 
    ? [colors.primary[700], colors.primary[500], colors.secondary[400]] as const
    : [colors.primary.main, colors.primary[400], colors.secondary.main] as const;

  return (
    <View style={dynamicStyles.container}>
      {/* Clean Header with Gradient */}
      <Animated.View
        style={[
          styles.headerWrapper,
          {
            paddingTop: insets.top + spacing.sm,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={headerGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.userSection}>
            {/* Avatar with initials */}
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarBase, dynamicStyles.avatar]}>
                <Text style={dynamicStyles.avatarText}>
                  {(profile?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
            </View>

            {/* User Details */}
            <View style={styles.userDetails}>
              <Text style={dynamicStyles.userName} numberOfLines={1}>
                {profile?.full_name || 'User'}
              </Text>
              <View style={[styles.roleContainer, dynamicStyles.userRoleContainer]}>
                <Text style={dynamicStyles.userRoleText}>
                  {displayText}
                </Text>
              </View>
            </View>

            {/* Logout Button */}
            <TouchableOpacity
              style={[styles.headerLogoutButtonBase, dynamicStyles.headerLogoutButton]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LogOut size={19} color={colors.text.inverse} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View 
        style={[
          styles.scrollView,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <DrawerContentScrollView {...props} style={styles.scrollView} showsVerticalScrollIndicator={false}>

          {/* Menu Sections */}
          <View style={styles.menu}>
            {Object.entries(grouped).map(([section, items]) => (
              <View key={section} style={styles.section}>
                <Text style={dynamicStyles.sectionLabel}>{section}</Text>
                {items.filter(item => !item.parent).map((item) => {
                  const isExpanded = expandedMenus.has(item.key);
                  const subItems = items.filter(i => i.parent === item.key);
                  
                  return (
                    <View key={item.key}>
                  <TouchableOpacity
                    style={[
                      styles.menuItem,
                      activeItem === item.key && dynamicStyles.menuItemActive
                    ]}
                    onPress={() => handleItemPress(item)}
                  >
                    <item.icon
                      size={21}
                      color={activeItem === item.key ? colors.primary[600] : colors.text.secondary}
                    />
                    <Text style={[
                      dynamicStyles.menuItemLabel,
                      activeItem === item.key && dynamicStyles.menuItemLabelActive
                    ]}>
                      {item.label}
                    </Text>
                        {item.hasSubMenu && (
                          <ChevronRight 
                            size={16} 
                            color={colors.text.secondary}
                            style={[
                              styles.chevron,
                              isExpanded && styles.chevronExpanded
                            ]}
                          />
                        )}
                    {item.badge && (
                      <View style={dynamicStyles.badge}>
                        <Text style={dynamicStyles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                      
                      {/* Sub-items */}
                      {item.hasSubMenu && isExpanded && subItems.map((subItem) => {
                        const isSubItemActive = activeItem === subItem.key || activeItem === subItem.parent;
                        return (
                          <TouchableOpacity
                            key={subItem.key}
                            style={[
                              styles.menuItem,
                              dynamicStyles.subMenuItem,
                              isSubItemActive && dynamicStyles.menuItemActive
                            ]}
                            onPress={() => handleItemPress(subItem)}
                          >
                            <subItem.icon
                              size={19}
                              color={isSubItemActive ? colors.primary[600] : colors.text.secondary}
                            />
                            <Text style={[
                              dynamicStyles.menuItemLabel,
                              dynamicStyles.subMenuItemLabel,
                              isSubItemActive && dynamicStyles.menuItemLabelActive
                            ]}>
                              {subItem.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </DrawerContentScrollView>
      </Animated.View>

      {/* Theme Toggle & Logout Footer */}
      <Animated.View 
        style={[
          styles.footer,
          dynamicStyles.footerBorder,
          {
            opacity: fadeAnim,
            paddingBottom: insets.bottom + spacing.sm,
          }
        ]}
      >
        {/* Theme Toggle */}
        <TouchableOpacity
          style={[
            styles.footerItem,
            dynamicStyles.themeToggle
          ]}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          {isDark ? (
            <Sun size={20} color={colors.text.primary} />
          ) : (
            <Moon size={20} color={colors.text.primary} />
          )}
          <Text style={[dynamicStyles.footerItemLabel, { marginLeft: spacing.sm }]}>
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          style={[
            styles.footerItem,
            dynamicStyles.logoutButton
          ]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <LogOut size={20} color={colors.error[600]} />
          <Text style={[dynamicStyles.footerItemLabel, { marginLeft: spacing.sm, color: colors.error[600] }]}>
            Logout
          </Text>
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

// Static styles that don't depend on theme
const styles = StyleSheet.create({
  headerWrapper: {
    marginBottom: 0,
  },
  headerGradient: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    paddingBottom: 14,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  avatarBase: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  roleContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  headerLogoutButtonBase: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  scrollView: {
    flex: 1,
  },
  menu: {
    paddingHorizontal: 10,
    paddingTop: 0,
    paddingBottom: 10,
  },
  section: {
    marginBottom: 18,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
    marginVertical: 4,
  },
  chevron: {
    marginLeft: 'auto',
    transform: [{ rotate: '0deg' }],
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
});

export default DrawerContent;
