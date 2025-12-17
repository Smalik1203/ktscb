# Krishnaveni Talent School - School Management System

## 📚 Project Overview

Krishnaveni Talent School (KTS) is a comprehensive **React Native** school management system built with **Expo** and **Supabase**. It provides a unified platform for administrators, teachers, and students to manage academic activities, track attendance, monitor performance, and facilitate communication.

**Brand**: "Mentored for Life"

### Key Highlights
- **Multi-platform**: iOS, Android, and Web support via Expo
- **Role-based access control**: Separate interfaces for Super Admin, Admin, Teacher, and Student
- **Real-time data**: Powered by Supabase with PostgreSQL
- **Secure**: Row Level Security (RLS) enforced at database level
- **Modern UI**: Clean, Shopify-inspired design system
- **Offline-capable**: Local caching with React Query

---

## 🛠️ Technology Stack

### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.81.5 | Mobile & web framework |
| **Expo** | 54.0.10 | Development platform & build tools |
| **TypeScript** | 5.9.2 | Type safety |
| **Expo Router** | 6.0.8 | File-based navigation |
| **Supabase** | 2.58.0 | Backend, Auth, Database |
| **React Query** | 5.62.15 | Data fetching & caching |
| **Zustand** | 5.0.8 | State management |

### UI & Components
- **react-native-paper** (5.12.6) - Material Design components
- **lucide-react-native** (0.544.0) - Icon library
- **expo-linear-gradient** - Gradient effects
- **react-native-gesture-handler** - Touch gestures
- **react-native-reanimated** - Animations

### Features & Integrations
- **Document Handling**: PDF viewer, Excel/CSV import, file uploads
- **Media**: Video player, image picker, PDF generation
- **Date/Time**: Date pickers, calendars, time management
- **Charts**: Custom analytics and performance charts

---

## 🏗️ Architecture & Code Organization

### Project Structure

```
cb-rn/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Tab-based screens
│   │   ├── _layout.tsx          # Tab navigation config
│   │   ├── index.tsx            # Dashboard
│   │   ├── add-admin.tsx        # [Super Admin] Add admins
│   │   ├── add-classes.tsx      # [Super Admin] Manage classes
│   │   ├── add-student.tsx      # [Admin+] Add students
│   │   ├── add-subjects.tsx     # [Super Admin] Manage subjects
│   │   ├── analytics.tsx        # Analytics dashboard
│   │   ├── assessments.tsx      # Test management
│   │   ├── attendance.tsx       # Attendance tracking
│   │   ├── calendar.tsx         # School calendar
│   │   ├── fees.tsx            # [Admin+] Fee management
│   │   ├── fees-student.tsx    # [Student] Fee view
│   │   ├── manage.tsx          # [Admin+] Management
│   │   ├── payments.tsx        # [Admin+] Payment history
│   │   ├── resources.tsx       # Learning resources
│   │   ├── syllabus.tsx        # [Admin+] Syllabus management
│   │   ├── syllabus-student.tsx # [Student] Syllabus view
│   │   ├── tasks.tsx           # Tasks/assignments
│   │   └── timetable.tsx       # Timetable
│   ├── login.tsx               # Authentication
│   └── _layout.tsx             # Root layout
│
├── src/
│   ├── components/             # UI Components
│   │   ├── analytics/         # Analytics visualizations
│   │   ├── attendance/        # Attendance components
│   │   ├── calendar/          # Calendar components
│   │   ├── common/            # Shared components
│   │   ├── fees/              # Fee management components
│   │   ├── layout/            # Navigation & layout
│   │   ├── resources/         # Resource viewers (PDF, Video)
│   │   ├── skeletons/         # Loading states
│   │   ├── syllabus/          # Syllabus components
│   │   ├── tasks/             # Task components
│   │   ├── tests/             # Assessment components
│   │   ├── timetable/         # Timetable components
│   │   └── ui/                # Base UI components
│   │
│   ├── contexts/              # React Context providers
│   │   ├── AuthContext.tsx   # Authentication state
│   │   └── ClassSelectionContext.tsx # Class selection
│   │
│   ├── features/              # Feature-specific screens
│   │   ├── admin/            # Admin management
│   │   ├── analytics/        # Analytics screens
│   │   ├── assessments/      # Test screens
│   │   ├── attendance/       # Attendance screens
│   │   ├── calendar/         # Calendar screens
│   │   ├── classes/          # Class management
│   │   ├── dashboard/        # Dashboard screens
│   │   ├── fees/             # Fee screens
│   │   ├── resources/        # Resource screens
│   │   ├── students/         # Student management
│   │   ├── subjects/         # Subject management
│   │   ├── syllabus/         # Syllabus screens
│   │   ├── tasks/            # Task screens
│   │   └── timetable/        # Timetable screens
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── analytics/       # Analytics data hooks
│   │   ├── tests/           # Test management hooks
│   │   ├── useAcademicYears.ts
│   │   ├── useAdmins.ts
│   │   ├── useAttendance.ts
│   │   ├── useCalendar.ts
│   │   ├── useClasses.ts
│   │   ├── useDashboard.ts
│   │   ├── useFees.ts
│   │   ├── useResources.ts
│   │   ├── useStudents.ts
│   │   ├── useSubjects.ts
│   │   ├── useSyllabus.ts
│   │   ├── useTasks.ts
│   │   └── useTimetable.ts
│   │
│   ├── lib/                 # Core libraries
│   │   ├── supabase.ts     # Supabase client
│   │   ├── queryClient.ts  # React Query config
│   │   ├── logger.ts       # Logging utility
│   │   └── analytics-*.ts  # Analytics utilities
│   │
│   ├── services/           # Business logic services
│   │   ├── attendance.ts
│   │   ├── fees.ts
│   │   └── timetable.ts
│   │
│   ├── stores/             # Zustand stores
│   │   └── classStore.ts
│   │
│   ├── types/              # TypeScript type definitions
│   │   ├── database.types.ts
│   │   ├── models.ts
│   │   └── supabase.ts
│   │
│   └── utils/              # Utility functions
│       ├── dateUtils.ts
│       ├── rateLimiter.ts
│       ├── sanitize.ts
│       └── validators.ts
│
├── lib/                    # Global libraries
│   └── design-system.ts   # Design tokens & theme
│
├── assets/                # Static assets
│   ├── images/
│   └── templates/
│
└── docs/                  # Documentation
    └── (auto-generated)
```

---

## 👥 Role-Based Access Control

### User Roles & Hierarchy

```
┌─────────────────┐
│   Super Admin   │  ← Full school management access
└────────┬────────┘
         │
    ┌────┴────┐
    │  Admin  │     ← Class & student management
    └────┬────┘
         │
    ┌────┴────┐
    │ Teacher │     ← Limited admin access
    └────┬────┘
         │
    ┌────┴────┐
    │ Student │     ← Read-only access to own data
    └─────────┘
```

### Authentication Flow

1. **User Login** → Supabase Auth (`auth.users`)
2. **Profile Lookup** → Query `users` table by `auth_user_id`
3. **Role Validation**:
   - If no profile found → **ACCESS DENIED** ❌
   - If role = 'unknown' → **ACCESS DENIED** ❌
   - If valid role → Bootstrap user data ✅
4. **Role-Specific Data**:
   - `student` → Fetch from `student` table
   - `admin`/`teacher` → Fetch from `admin` table
   - `superadmin` → Fetch from `super_admin` table
   - `cb_admin` → Fetch from `cb_admin` table

### Security Features
- **No fallback authentication**: Invalid users are immediately signed out
- **Database-level RLS**: All tables enforce row-level security
- **School isolation**: Users can only access data from their `school_code`
- **Rate limiting**: Login attempts are throttled (5 attempts per 15 minutes)
- **Session management**: Automatic token refresh & expiry handling

---

## 🎯 Feature Breakdown by User Role

### 🔴 Super Admin Features

**Full School Management Access**

#### Navigation Access
- Dashboard
- Calendar
- Timetable
- Resources
- Syllabus (Staff View)
- Attendance
- Analytics
- Tasks
- Assessments
- Fees Management
- Payments
- Management

#### Exclusive Features
- **Add Admins** (`/(tabs)/add-admin`)
  - Create new admin/teacher accounts
  - Assign roles and permissions
  - Manage admin profiles
  
- **Add Classes** (`/(tabs)/add-classes`)
  - Create academic years
  - Define grade-section combinations
  - Manage class instances
  - Assign class teachers
  
- **Add Subjects** (`/(tabs)/add-subjects`)
  - Create and manage subjects
  - Configure subject-class mappings
  
- **Add Students** (`/(tabs)/add-student`)
  - Two modes: Create New | Import Existing
  - Bulk student import
  - Class assignment
  - Generate student credentials

#### Management Capabilities
- View all school data
- Modify system settings
- Access analytics across all classes
- Override attendance records
- Adjust fee plans
- Manage all resources

---

### 🟡 Admin/Teacher Features

**Class & Student Management**

#### Navigation Access
- Dashboard
- Calendar
- Timetable
- Resources
- Syllabus (Staff View)
- Attendance
- Analytics
- Tasks
- Assessments
- Fees Management
- Payments
- Management

#### Key Features
- **Add Students** (`/(tabs)/add-student`)
  - Create student accounts
  - Assign to classes
  - Manage student profiles
  
- **Attendance Management**
  - Mark attendance for assigned classes
  - View attendance reports
  - Update past records (limited window)
  
- **Syllabus Management**
  - Create chapter/topic hierarchy
  - Track syllabus progress
  - Link to timetable slots
  
- **Assessment Management**
  - Create tests/quizzes
  - Upload questions (CSV/Excel)
  - Grade submissions
  - View performance analytics
  
- **Task Management**
  - Assign homework/assignments
  - Set due dates and priorities
  - Review submissions
  - Provide feedback
  
- **Timetable Management**
  - Create daily schedules
  - Assign subjects and teachers
  - Link syllabus topics
  - Mark classes as done/cancelled
  
- **Fee Management**
  - View student fee plans
  - Record payments
  - Generate receipts
  - Track outstanding balances

#### Restrictions
- Cannot create admins
- Cannot modify academic year structure
- Cannot add subjects
- Access limited to assigned classes

---

### 🟢 Student Features

**Personal Academic Portal**

#### Navigation Access
- Dashboard (Personal stats)
- Calendar
- Timetable (View only)
- Resources
- Syllabus (Student View)
- Attendance (Own records)
- Analytics (Own performance)
- Tasks (Assignments)
- Assessments (Tests)
- Fees (Own fees)

#### Key Features
- **Dashboard**
  - Upcoming classes
  - Pending tasks
  - Recent test scores
  - Attendance summary
  
- **Timetable** (Read-only)
  - View daily schedule
  - See assigned subjects
  - Check teacher assignments
  
- **Syllabus** (`/(tabs)/syllabus-student`)
  - View chapters and topics
  - Track completion progress
  - Access linked resources
  
- **Attendance** (Read-only)
  - View own attendance record
  - See percentage metrics
  - Check monthly summaries
  
- **Tasks**
  - View assigned homework
  - Submit assignments
  - Check due dates
  - View grades and feedback
  
- **Assessments**
  - Take online tests
  - View scores and results
  - Access past attempts
  
- **Fees** (`/(tabs)/fees-student`)
  - View fee structure
  - Check payment history
  - See outstanding balance
  
- **Analytics**
  - Subject-wise performance
  - Attendance trends
  - Test score analysis
  - Comparison with class average

#### Restrictions
- No create/edit/delete operations
- Cannot view other students' data
- Cannot modify attendance
- Cannot change fee plans

---

## 📊 Database Schema Overview

### Core Tables

#### User Management
- `users` - Central user table linked to Supabase Auth
- `student` - Student-specific data
- `admin` - Teacher/admin data
- `super_admin` - Super admin data
- `cb_admin` - ClassBridge admin data

#### Academic Structure
- `schools` - School master data
- `academic_years` - Academic year definitions
- `classes` - Grade-section templates
- `class_instances` - Active class instances
- `class_admins` - Class-teacher assignments
- `subjects` - Subject master data

#### Learning Management
- `syllabi` - Subject syllabus definitions
- `syllabus_chapters` - Chapter organization
- `syllabus_topics` - Topic-level content
- `syllabus_progress` - Progress tracking
- `timetable_slots` - Daily class schedules

#### Assessments
- `tests` - Test definitions
- `test_questions` - Question bank
- `test_attempts` - Student attempts
- `test_marks` - Manual grading

#### Operations
- `attendance` - Daily attendance records
- `tasks` - Homework/assignments
- `task_submissions` - Student submissions
- `school_calendar_events` - Events and holidays

#### Finance
- `fee_component_types` - Fee categories
- `fee_student_plans` - Student fee plans
- `fee_student_plan_items` - Plan components
- `fee_payments` - Payment records

#### Resources
- `learning_resources` - General resources
- `lms_videos` - Video content
- `lms_pdfs` - PDF documents
- `chapter_media_bindings` - Media links

### Key Relationships

```
schools
  ├── academic_years
  │     └── class_instances
  │           ├── students (class_instance_id)
  │           ├── timetable_slots
  │           ├── syllabi
  │           └── attendance
  └── subjects
        ├── syllabi
        │     ├── syllabus_chapters
        │     │     └── syllabus_topics
        │     └── chapter_media_bindings
        └── tests
              ├── test_questions
              └── test_attempts
```

**For detailed schema**: See `DATABASE_SCHEMA.md`

---

## 🧩 Key Components & Patterns

### Component Organization

#### Feature-Based Structure
Each feature has dedicated screens, components, and hooks:

```typescript
// Example: Attendance Feature
src/
├── features/attendance/
│   └── AttendanceScreen.tsx       # Main screen
├── components/attendance/
│   ├── AttendanceScreen.tsx       # View component (admin)
│   └── StudentAttendanceView.tsx  # View component (student)
└── hooks/
    └── useAttendance.ts           # Data fetching logic
```

### Custom Hooks Pattern

All data fetching uses React Query via custom hooks:

```typescript
// src/hooks/useStudents.ts
export function useStudents(classInstanceId?: string) {
  return useQuery({
    queryKey: ['students', classInstanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student')
        .select('*')
        .eq('class_instance_id', classInstanceId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!classInstanceId,
  });
}
```

### Design System

Centralized design tokens in `lib/design-system.ts`:

```typescript
export const colors = {
  primary: { 50: '#FFE8DC', 600: '#FF6B35', ... },
  secondary: { 50: '#E3F2FD', 600: '#1976D2', ... },
  // ... more colors
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48
};

export const typography = {
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18, ... },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' }
};
```

### Error Handling

Three-state pattern for all async operations:

```typescript
// Using ThreeStateView component
<ThreeStateView
  loading={isLoading}
  error={error}
  onRetry={refetch}
>
  {/* Render data here */}
</ThreeStateView>
```

---

## 🔑 Authentication & Authorization

### AuthContext (`src/contexts/AuthContext.tsx`)

**State Machine**:
```
'checking' → Initial state
'signedIn' → Authenticated with valid profile
'signedOut' → No session
'accessDenied' → Invalid or missing profile
```

**Bootstrap Flow**:
1. Check Supabase session
2. Fetch user profile from `users` table
3. Validate role and profile existence
4. Fetch school information
5. Set auth state based on validation

**Security Checks**:
- ❌ No profile → Sign out + access denied
- ❌ Role = 'unknown' → Sign out + access denied
- ✅ Valid profile → Bootstrap complete

### Route Protection

```typescript
// app/(tabs)/_layout.tsx
useEffect(() => {
  if (loading || bootstrapping) return;
  
  if (status === 'signedOut' || 
      status === 'accessDenied' || 
      (status === 'signedIn' && !profile)) {
    router.replace('/login');
  }
}, [status, profile, loading, bootstrapping]);
```

### Role-Based Navigation

```typescript
// src/components/layout/DrawerContent.tsx
const MENU: MenuItem[] = [
  {
    key: 'add_admin',
    label: 'Add Admins',
    route: '/(tabs)/add-admin',
    roles: ['superadmin'],  // ← Only visible to super admin
  },
  {
    key: 'add_student',
    label: 'Add Students',
    route: '/(tabs)/add-student',
    roles: ['admin', 'superadmin'],  // ← Admin + Super admin
  },
  {
    key: 'syllabus_student',
    label: 'Syllabus',
    route: '/(tabs)/syllabus-student',
    roles: ['student'],  // ← Student-specific view
  },
];
```

---

## 📱 Key Features Implementation

### 1. Dashboard

**Location**: `src/features/dashboard/DashboardScreen.tsx`

**Role-specific content**:
- **Super Admin/Admin**: School-wide metrics, class summaries, quick actions
- **Student**: Personal stats, upcoming tasks, recent grades

**Data Sources**:
- `useDashboard` hook
- Real-time updates via React Query
- Cached with 5-minute stale time

---

### 2. Attendance Management

**Admin View**: `src/components/attendance/AttendanceScreen.tsx`
- Mark attendance for class
- Bulk operations
- Historical records
- Export reports

**Student View**: `src/components/attendance/StudentAttendanceView.tsx`
- View own attendance
- Monthly calendar
- Percentage metrics
- Read-only

---

### 3. Timetable

**Admin View**: `src/components/timetable/ModernTimetableScreen.tsx`
- Create/edit slots
- Assign subjects & teachers
- Link syllabus topics
- Mark status (done/cancelled)

**Student View**: `src/components/timetable/StudentTimetableScreen.tsx`
- View daily schedule
- See assigned teachers
- Read-only mode

---

### 4. Syllabus Management

**Admin View**: `src/features/syllabus/SyllabusScreen.tsx`
- Create chapter hierarchy
- Add topics
- Track progress
- Link media resources

**Student View**: `src/features/syllabus/StudentSyllabusScreen.tsx`
- Browse chapters/topics
- View completion status
- Access linked resources

---

### 5. Assessments (Tests)

**Components**: `src/components/tests/`
- **CreateTestForm**: Admin creates tests
- **QuestionBuilderScreen**: Question management
- **ImportQuestionsModal**: Bulk import from CSV/Excel
- **TestTakingScreen**: Student test interface
- **TestResultsScreen**: View scores & analysis

**Features**:
- Multiple question types (MCQ, one-word, long answer)
- Online/offline modes
- Auto-grading for MCQs
- Manual grading interface
- Attempt tracking

---

### 6. Task Management

**Components**: `src/components/tasks/TaskFormModal.tsx`

**Admin Features**:
- Create assignments
- Set due dates
- Attach files
- Grade submissions
- Provide feedback

**Student Features**:
- View assigned tasks
- Submit assignments
- Upload attachments
- View grades

---

### 7. Fee Management

**Admin View**: `src/features/fees/FeesScreen.tsx`
- View student fee plans
- Record payments
- Generate receipts
- Track collections

**Student View**: `src/features/fees/StudentFeesScreen.tsx`
- View fee structure
- Payment history
- Outstanding balance

**Tables Used**:
- `fee_component_types` - Fee categories
- `fee_student_plans` - Student plans
- `fee_student_plan_items` - Plan details
- `fee_payments` - Payment records

---

### 8. Analytics

**Location**: `src/features/analytics/AnalyticsScreen.tsx`

**Admin View**:
- School-wide performance
- Class comparisons
- Attendance trends
- Fee collection stats
- Syllabus progress

**Student View**:
- Personal performance
- Subject-wise analysis
- Attendance trends
- Test score history

**Data Sources**: `src/hooks/analytics/`
- `useAcademicsAnalytics.ts`
- `useAttendanceAnalytics.ts`
- `useFeesAnalytics.ts`
- `useSyllabusAnalytics.ts`
- `useTasksAnalytics.ts`

---

### 9. Resources (LMS)

**Components**: `src/components/resources/`
- **PDFViewer**: In-app PDF viewer
- **VideoPlayer**: Video playback
- **AddResourceModal**: Upload interface

**Features**:
- Subject-wise organization
- Chapter linking
- File upload (PDF, video)
- YouTube integration
- Access control

---

### 10. Calendar

**Components**: `src/components/calendar/`
- **CalendarMonthView**: Monthly calendar
- **CalendarEventFormModal**: Event creation
- **IntegratedCalendarView**: Unified view

**Event Types**:
- Holidays
- Exams
- PTM (Parent-Teacher Meetings)
- Assembly
- Sports Day
- Cultural Events
- Field Trips

**Features**:
- Recurring events
- All-day events
- Color coding
- Class-specific events

---

## 🚀 Development Guide

### Prerequisites

```bash
# Node.js (v18+)
node --version

# npm or yarn
npm --version

# Expo CLI
npm install -g expo-cli

# iOS (macOS only)
xcode-select --install

# Android
# Install Android Studio
```

### Environment Setup

Create `.env` file:

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: Analytics, etc.
```

### Installation

```bash
# Install dependencies
npm install

# Validate environment
npm run env:check

# Start development server
npm run dev

# Platform-specific
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

### Project Commands

```bash
# Development
npm start                  # Start Expo dev server
npm run dev               # Start with telemetry disabled

# Building
npm run build:web         # Build for web

# Code Quality
npm run lint              # Run ESLint
npm run typecheck         # TypeScript type checking

# Environment
npm run env:check         # Validate .env variables
npm run env:validate      # Alias for env:check
```

### Development Workflow

1. **Start Dev Server**:
   ```bash
   npm run dev
   ```

2. **Choose Platform**:
   - Press `i` for iOS
   - Press `a` for Android
   - Press `w` for Web

3. **Hot Reload**:
   - Changes auto-reload
   - Press `r` to manually reload
   - Press `Shift + m` for dev menu

4. **Debugging**:
   - React Native Debugger
   - Chrome DevTools
   - Expo DevTools (in browser)

---

## 📝 Code Conventions

### File Naming
- **Components**: PascalCase (`AttendanceScreen.tsx`)
- **Hooks**: camelCase with 'use' prefix (`useStudents.ts`)
- **Utils**: camelCase (`dateUtils.ts`)
- **Types**: PascalCase (`database.types.ts`)

### Component Structure

```typescript
// 1. Imports
import React from 'react';
import { View } from 'react-native';

// 2. Types
interface Props {
  // ...
}

// 3. Component
export function MyComponent({ prop }: Props) {
  // 4. Hooks
  const data = useMyHook();
  
  // 5. Handlers
  const handleAction = () => {
    // ...
  };
  
  // 6. Render
  return (
    <View>
      {/* JSX */}
    </View>
  );
}

// 7. Styles
const styles = StyleSheet.create({
  // ...
});
```

### Hook Pattern

```typescript
export function useMyData(id?: string) {
  return useQuery({
    queryKey: ['myData', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table')
        .select('*')
        .eq('id', id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

---

## 🎨 UI/UX Principles

### Design Philosophy
- **Minimal**: Clean, uncluttered interfaces
- **Shopify-inspired**: Professional, modern aesthetics
- **Consistent**: Design system across all screens
- **Accessible**: Large touch targets, readable fonts
- **Responsive**: Adapts to different screen sizes

### Color Palette
- **Primary**: Royal Purple (#6B3FA0) - Actions, CTAs
- **Secondary**: Golden Orange (#F5A623) - Highlights, badges
- **Accent**: Crimson Red (#E74C3C) - Alerts, accents
- **Success**: Emerald Green - Confirmations
- **Error**: Crimson Red - Errors, warnings
- **Neutral**: Grays - Text, borders

### Typography
- **Headings**: Bold, 24-28px
- **Body**: Regular, 16px
- **Captions**: Light, 14px

### Spacing
- Consistent 4px grid system
- Padding: 8px, 16px, 24px
- Margins: 8px, 16px, 24px, 32px

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Cannot connect to Supabase"
```bash
# Check .env file
cat .env | grep SUPABASE

# Validate environment
npm run env:check
```

#### 2. "RLS policy violation"
- Check user role in database
- Verify school_code matches
- Ensure RLS policies are enabled

#### 3. "Module not found"
```bash
# Clear cache
expo start -c

# Reinstall dependencies
rm -rf node_modules
npm install
```

#### 4. "Metro bundler error"
```bash
# Kill all Metro processes
killall node

# Clear watchman
watchman watch-del-all

# Restart
npm start
```

---

## 📚 Additional Documentation

- **Database Schema**: See `DATABASE_SCHEMA.md`
- **Supabase Setup**: Configure RLS policies, functions, triggers
- **Deployment**: Build and deploy to App Store/Play Store

---

## 🤝 Contributing

### Code Review Checklist
- [ ] TypeScript types defined
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] RLS policies respected
- [ ] Design system followed
- [ ] Mobile-responsive
- [ ] Tested on iOS/Android

---

## 📄 License

Proprietary - Krishnaveni Talent School Management System

---

## 📞 Support

For issues or questions:
- Review existing documentation
- Check Supabase dashboard for data issues
- Verify RLS policies in database
- Check console logs for errors

---

**Last Updated**: November 3, 2025  
**Version**: 1.0.0  
**Built with**: React Native + Expo + Supabase

