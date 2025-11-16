# ClassBridge React Native - Data Fetching & Performance Analysis

## Executive Summary

The ClassBridge app uses **React Query (TanStack Query)** as the primary state management solution for data fetching and caching. The architecture is well-structured with separation of concerns across hooks, API services, and components. However, several performance optimization opportunities exist, particularly around query batching, prefetching, and analytics aggregations.

---

## 1. Data Fetching Architecture

### 1.1 Primary Data Fetching Layer
- **Framework**: React Query v4+ (`@tanstack/react-query`)
- **Backend**: Supabase (PostgreSQL with RLS policies)
- **Client Setup**: 
  - AsyncStorage for session persistence (React Native)
  - Realtime event throttling (10 events/second)
  - Custom abort signal handling for request cancellation

### 1.2 Query Client Configuration
**Location**: `src/lib/queryClient.ts`

Default settings:
- `staleTime`: 5 minutes (data considered fresh)
- `gcTime`: 10 minutes (cache retention)
- Retry logic: 0 for 4xx, 2 for 5xx errors
- Exponential backoff: up to 30 seconds max wait
- No refetch on window focus (mobile-optimized)

```typescript
// Global configuration
defaultOptions: {
  queries: {
    staleTime: 5 * 60 * 1000,      // 5 minutes
    gcTime: 10 * 60 * 1000,         // 10 minutes
    refetchOnWindowFocus: false,     // Mobile optimization
    refetchOnReconnect: false,       // Can be enabled per-query
  }
}
```

---

## 2. Caching Mechanisms

### 2.1 React Query Cache Strategy
Each hook defines its own caching strategy:

**Timetable Queries** (`useTimetable.ts`):
- staleTime: 10 minutes
- gcTime: 30 minutes
- Refetch on mount

**Attendance Queries** (`useAttendance.ts`):
- staleTime: 2-5 minutes
- gcTime: 5-10 minutes
- Sensitive data (shorter cache)

**Dashboard Queries** (`useDashboard.ts`):
- staleTime: 5 minutes
- Aggregated data (frequent updates needed)

### 2.2 Query Key Factory Pattern
**Location**: `src/lib/queryClient.ts`

Structured query keys enable fine-grained cache invalidation:

```typescript
queryKeys = {
  user: {
    all: ['user'],
    profile: (userId) => ['user', 'profile', userId],
    context: (userId) => ['user', 'context', userId],
  },
  timetable: {
    all: ['timetable'],
    byClass: (classInstanceId) => ['timetable', 'byClass', classInstanceId],
    byClassAndDate: (classInstanceId, date) => 
      ['timetable', 'byClass', classInstanceId, 'date', date],
  },
  attendance: {
    all: ['attendance'],
    byClass: (classInstanceId, schoolCode) => 
      ['attendance', 'byClass', classInstanceId, schoolCode],
    byClassAndDate: (classInstanceId, date, schoolCode) => 
      ['attendance', 'byClass', classInstanceId, 'date', date, schoolCode],
  },
  // ... 10+ more entity types
}
```

### 2.3 Offline Caching
- AsyncStorage for session persistence
- Not using dedicated offline library
- Basic error handling for network failures

---

## 3. Main Data-Fetching Components

### 3.1 Timetable System (Complex)

**Files**: 
- `src/hooks/useUnifiedTimetable.ts` (800+ lines)
- `src/hooks/useSyllabusLoader.ts`

**Features**:
- Fetches timetable slots for a specific date
- Batch-fetches subject and teacher data using `.in()` operator
- Enriches data with syllabus progress
- Multiple mutations: create, update, delete, mark as taught

**Performance Characteristics**:
- Initial query: 1 main query + 3 batch queries (subjects, teachers, progress)
- Stale time: 30 seconds (tight for sync)
- Auto-refetch: every 30 seconds
- Potential N+1: Subject/teacher lookups (mitigated by batching)

### 3.2 Attendance System (High Volume)

**Files**:
- `src/hooks/useAttendance.ts`
- `src/components/attendance/AttendanceScreen.tsx`

**Operations**:
- `useClassAttendance`: Fetches attendance for a class on a specific date
- `useSchoolAttendance`: Broader attendance view
- `useStudentAttendance`: Individual student records
- `useClassAttendanceSummary`: Date range aggregations
- `useMarkAttendance`: Insert/update with cache invalidation

**Bottleneck**: 
- Dashboard calls multiple attendance queries (month view + week view)
- No aggregation at database level - client-side filtering

### 3.3 Dashboard (Multiple Aggregated Queries)

**File**: `src/hooks/useDashboard.ts` (650+ lines)

**Functions**:
- `useDashboardStats`: 10+ separate database queries
  - Today's classes (1 query)
  - Attendance percentage (2 queries: current month + weekly)
  - Pending assignments (2 queries: tasks + submissions)
  - Upcoming tests (1 query)
  - Student count (1 query for admins)

- `useRecentActivity`: 3 queries (attendance, tasks, test scores)
- `useUpcomingEvents`: 1 query with conditional filters
- `useFeeOverview`: 2 queries (fee plan + payments)
- `useTaskOverview`: 2 queries (tasks + submissions)
- `useSyllabusOverview`: Heavy - 1 + (N subjects × 3) queries

**Problem**: N+1 query pattern in syllabus progress calculation
```typescript
// For each subject, it fetches:
const { data: syllabiData } = await supabase
  .from('syllabi')
  .select('id')
  .eq('class_instance_id', classInstanceId)
  .eq('subject_id', subject.id);  // Individual query per subject

const { data: chapters } = await supabase
  .from('syllabus_chapters')
  .select('id')
  .eq('syllabus_id', syllabiData.id);  // Another query

const { data: topics } = await supabase
  .from('syllabus_topics')
  .select('id')
  .in('chapter_id', chapterIds);  // Another query
```

### 3.4 Student & Admin Management

**Files**:
- `src/hooks/useStudents.ts`
- `src/hooks/useStudentTimetable.ts`
- `src/hooks/useAdmins.ts`

**Features**:
- Pagination support
- Batch fetching via `.in()` operator
- Cache invalidation on mutations

---

## 4. Existing Query Optimizations

### 4.1 Utility Functions
**Location**: `src/utils/queryOptimizations.ts` (196 lines)

Available utilities (but underutilized):

1. **Debounce**: For search inputs, autosave
2. **Throttle**: For scroll handlers, window resize
3. **Batch IDs**: Group up to 100 IDs per query
4. **Rate Limiter**: Token bucket algorithm (20 req/sec default)
5. **Request Deduplicator**: Prevent duplicate in-flight requests
6. **Select Fields**: Field optimization config (mostly unused)
7. **QueryCache**: Custom TTL-based caching

**Status**: These utilities exist but are NOT actively used in most hooks!

### 4.2 Supabase Select Optimization
Some hooks use selective field selection:
```typescript
// Good example from useUnifiedTimetable
select(`
  id,
  class_instance_id,
  class_date,
  period_number,
  slot_type,
  ...
`)
```

But many use wildcard selects:
```typescript
// Less optimal
select('*')
```

---

## 5. Performance Bottlenecks Identified

### 5.1 Waterfall Queries (High Impact)
**Problem**: Dependent queries that wait for previous results

Example: `useSyllabusOverview` in dashboard
1. Fetch timetable slots
2. Extract unique subjects
3. For EACH subject:
   - Fetch syllabus
   - Fetch chapters
   - Fetch topics
   - Fetch progress

**Impact**: 1 + (N subjects × 3) = potentially 13+ queries for 10 subjects

### 5.2 Multiple Dashboard Queries on Load
When DashboardScreen mounts:
- `useDashboardStats`: 10+ queries
- `useRecentActivity`: 3 queries
- `useUpcomingEvents`: 1 query
- `useFeeOverview`: 2 queries
- `useTaskOverview`: 2 queries
- `useSyllabusOverview`: 1 + (N × 3) queries

**Total**: 19+ queries on dashboard load (for students)

### 5.3 Real-time Data with High Refresh Intervals
- Timetable: 30-second auto-refetch
- Attendance: 2-5 minute stale time
- Dashboard stats: 5-minute stale time

**Issue**: Students viewing dashboard get 20+ requests every 5 minutes

### 5.4 Attendance Components Load All Students
```typescript
// In AttendanceScreen.tsx
const { data: studentsResponse } = useStudents(
  selectedClass?.id,
  schoolCode
  // No pagination - fetches ALL students
);
```

For large classes (200+ students), this loads all records into memory.

### 5.5 No Pagination for Large Lists
- Students: Can fetch 100+ records
- Attendance history: No limit on date range loads
- Timetable: Fetches one date at a time but could be batched

### 5.6 Analytics Heavy Lifting
`useAttendanceAnalytics` in the analytics screen:
- Fetches ALL attendance records for a date range
- Client-side aggregation in JavaScript
- No database-level grouping/aggregation

---

## 6. Missing Optimizations

### 6.1 Database-Level Aggregations
Most queries fetch raw data and aggregate in JavaScript:
```typescript
// Current: Client-side aggregation
const presentCount = attendanceData?.filter(a => a.status === 'present').length;

// Better: Use SQL aggregation
SELECT status, COUNT(*) as count
FROM attendance
WHERE ... 
GROUP BY status
```

### 6.2 Request Deduplication
The `RequestDeduplicator` exists but isn't used in hooks. Multiple components requesting same data trigger separate queries.

### 6.3 Prefetching
No prefetch strategy. Dashboard waits for all data to load sequentially.

### 6.4 Pagination
- Attendance history: No pagination
- Timetable: Single-date loads (could prefetch adjacent dates)
- Student lists: Pagination available but not used by attendance component

### 6.5 Field Selection
Most queries use `select('*')` instead of explicit field lists.

### 6.6 Query Batching
No batch query functionality. Could combine multiple table reads.

### 6.7 Caching Strategy for Attendance
Attendance is heavily queried but cache is short (2-5 minutes).

---

## 7. Data Flow Examples

### Example 1: Student Dashboard Load

```
DashboardScreen mounts
├── useDashboardStats
│   ├── Fetch today's classes
│   ├── Fetch student record (auth_user_id → student.id)
│   ├── Fetch month attendance (2 queries)
│   ├── Fetch week attendance (1 query)
│   ├── Fetch active tasks (1 query)
│   ├── Fetch task submissions (1 query)
│   └── Total: 8 queries
├── useRecentActivity
│   ├── Fetch student record again
│   ├── Fetch 2 recent attendance
│   ├── Fetch 2 recent tasks
│   └── Fetch 2 recent test scores
│       └── Total: 5 queries (student fetch duplicated!)
├── useUpcomingEvents
│   └── Fetch 30-day calendar events (1 query)
├── useFeeOverview
│   ├── Fetch student record again
│   ├── Fetch fee plan (1 query)
│   └── Fetch payments (1 query)
│       └── Total: 3 queries (student fetch duplicated!)
├── useTaskOverview
│   ├── Fetch student record again
│   ├── Fetch tasks (1 query)
│   ├── Fetch submissions (1 query)
│   └── Total: 3 queries (student fetch duplicated!)
└── useSyllabusOverview
    ├── Fetch timetable (1 query)
    ├── For each unique subject:
    │   ├── Fetch syllabus
    │   ├── Fetch chapters
    │   ├── Fetch topics
    │   └── Fetch progress
    └── Total: 1 + (10 subjects × 3) = 31 queries

GRAND TOTAL: ~50+ queries on dashboard load!
Multiple student record queries could be deduplicated.
```

### Example 2: Attendance Marking

```
User opens AttendanceScreen
├── useClasses (fetch admin's classes)
├── useStudents (fetch ALL students for class)
├── useClassAttendance (fetch existing attendance for date)
├── If showing history:
│   └── useClassAttendanceSummary (fetch date range)
└── User marks attendance:
    ├── useMarkBulkAttendance mutation
    └── Invalidates:
        - attendance.class
        - attendance.school
        - attendance.student
        - attendance.stats
```

---

## 8. Technology Stack Summary

| Layer | Technology | Performance Notes |
|-------|------------|-------------------|
| **State Management** | React Query 4+ | Good cache strategy, query keys organized |
| **Backend** | Supabase (PostgreSQL) | RLS enabled, good for security |
| **Caching** | React Query built-in | Default 5-10 min, can be tuned |
| **Session Storage** | AsyncStorage | Mobile-optimized, secure |
| **Realtime** | Supabase Realtime | Throttled to 10 events/sec |
| **API Layer** | Direct Supabase client | No middleware layer for optimization |
| **Offline Support** | AsyncStorage + React Query | Basic, not comprehensive |

---

## 9. Current Query Patterns Used

### Pattern 1: Simple Single Query
```typescript
export function useClass(classId?: string) {
  return useQuery({
    queryKey: ['class', classId],
    queryFn: async () => api.classes.get(classId!),
    enabled: !!classId,
    staleTime: 5 * 60 * 1000,
  });
}
```

### Pattern 2: Batch Queries with Enrichment
```typescript
// Good example: useUnifiedTimetable
const [subjects, teachers] = await Promise.all([
  supabase.from('subjects').select(...).in('id', subjectIds),
  supabase.from('admin').select(...).in('id', teacherIds),
]);
```

### Pattern 3: Dependent/Waterfall Queries (Problem!)
```typescript
// Anti-pattern in useSyllabusOverview
const syllabi = await fetch_syllabi();  // Query 1
for (const subject of syllabi) {
  const chapters = await fetch_chapters(subject.id);  // Query 2, 3, 4...
  const topics = await fetch_topics(chapters.ids);     // Query 5, 6, 7...
}
```

---

## 10. Recommended Optimization Opportunities

### High Priority (Quick Wins)

1. **Deduplicate Student Record Queries**
   - Impact: Reduce 50+ dashboard queries to ~40
   - Effort: Low (share context)
   - File: `src/hooks/useDashboard.ts`

2. **Use Request Deduplicator Utility**
   - Impact: Prevent duplicate requests
   - Effort: Low (already implemented)
   - File: Apply to all hooks

3. **Add Field Selection to All Queries**
   - Impact: Reduce bandwidth 20-30%
   - Effort: Low
   - File: All query hooks

4. **Paginate Attendance History**
   - Impact: Reduce memory for large datasets
   - Effort: Medium
   - File: `src/components/attendance/AttendanceScreen.tsx`

### Medium Priority (Strategic)

5. **Prefetch Dashboard Data**
   - Impact: Perceived performance improvement
   - Effort: Medium
   - Pattern: Use `queryClient.prefetchQuery()`

6. **Database-Level Aggregations**
   - Impact: Reduce syllabus queries 70%
   - Effort: Medium (RPC functions needed)
   - File: `src/hooks/useDashboard.ts` (useSyllabusOverview)

7. **Batch Syllabus Queries**
   - Impact: Reduce 13+ queries to 3-4
   - Effort: Medium
   - File: `src/hooks/useSyllabusLoader.ts`

8. **Implement Query Batching Middleware**
   - Impact: Combine related queries
   - Effort: High
   - Pattern: Custom React Query middleware

### Lower Priority (Strategic)

9. **Attendance Analytics SQL Aggregation**
   - Impact: 90% faster analytics
   - Effort: High (custom RPC needed)
   - File: `src/hooks/analytics/useAttendanceAnalytics.ts`

10. **Implement Comprehensive Offline Support**
    - Impact: Better UX on spotty connections
    - Effort: High (requires IndexedDB)
    - Pattern: Add `@react-native-async-storage/async-storage` with custom sync

---

## 11. Unused/Underutilized Features

1. **Batch ID utility** - Exists in `queryOptimizations.ts` but not used
2. **Rate limiter** - Exists but not enforced
3. **Request deduplicator** - Exists but not wired into queries
4. **Custom QueryCache** - Exists but not used
5. **Select field presets** - Defined but not consistently applied
6. **Pagination helper** - Only used in `useStudents`, not attendance

---

## 12. Key Files to Monitor

**Critical Performance Files**:
- `/src/lib/queryClient.ts` - Global configuration
- `/src/hooks/useDashboard.ts` - Aggregation heavy
- `/src/hooks/useUnifiedTimetable.ts` - Complex mutations
- `/src/hooks/useAttendance.ts` - High-volume ops
- `/src/components/attendance/AttendanceScreen.tsx` - Large renders
- `/src/lib/supabase.ts` - Client config

**Optimization Files**:
- `/src/utils/queryOptimizations.ts` - Utilities available
- `/src/data/queries.ts` - Raw query layer
- `/src/services/api.ts` - API abstraction

---

## Summary Table

| Category | Status | Impact | Notes |
|----------|--------|--------|-------|
| **Cache Strategy** | Good | N/A | Well configured defaults |
| **Query Keys** | Excellent | N/A | Organized factory pattern |
| **Field Selection** | Poor | Medium | Mostly `select('*')` |
| **Waterfall Queries** | Bad | High | Syllabus loading especially |
| **Deduplication** | None | Medium | Tools exist, not used |
| **Pagination** | Partial | Low | Only on students list |
| **Prefetching** | None | Medium | No strategy |
| **Batch Operations** | Limited | Medium | Only in timetable hook |
| **DB Aggregations** | Minimal | High | Client-side math prevalent |
| **Offline Support** | Basic | Low | Session only, no sync |
| **Error Handling** | Good | N/A | Proper retry logic |
| **Realtime Updates** | Basic | Low | Throttled, not active in UI |

