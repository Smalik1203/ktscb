# ClassBridge Data Fetching Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Native App                            │
│                     (Expo/React Native Web)                        │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      React Component Layer                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ DashboardScreen  │  │AttendanceScreen  │  │TimetableScreen   │ │
│  │ (Multiple Hooks) │  │ (useStudents +   │  │(useUnifiedTable) │ │
│  │                  │  │  useAttendance)  │  │                  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
└────────────────────────┬────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Custom Hooks │  │ React Query  │  │   Context   │
│              │  │   (TanStack) │  │    Hooks    │
│ useDashboard │  │              │  │             │
│ useAttendance│  │ - useQuery   │  │ useAuth     │
│ useTimetable │  │ - useMutation│  │ useClass    │
│ etc.         │  │ - queryClient│  │ etc.        │
└──────────────┘  └──────────────┘  └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   Query Client Configuration   │
        │  (src/lib/queryClient.ts)      │
        │                                │
        │  - staleTime: 5 min            │
        │  - gcTime: 10 min              │
        │  - Retry logic: 0 for 4xx      │
        │  - Query Key Factory Pattern   │
        │  - Mutation configuration      │
        └────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   Supabase JavaScript Client   │
        │  (src/lib/supabase.ts)         │
        │                                │
        │  - AsyncStorage (session)      │
        │  - RLS Policies (security)     │
        │  - Realtime throttling (10/s)  │
        │  - Abort signal handling       │
        └────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │     Database Queries Layer     │
        │   (REST API via Supabase)      │
        │                                │
        │  - src/services/api.ts         │
        │  - src/data/queries.ts         │
        │                                │
        │  Examples:                     │
        │  .from('timetable_slots')      │
        │  .from('attendance')           │
        │  .from('student')              │
        │  .from('syllabus_progress')    │
        └────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │    Supabase Backend            │
        │   (PostgreSQL + PostgREST)     │
        │                                │
        │  - schools                     │
        │  - class_instances             │
        │  - student                     │
        │  - admin                       │
        │  - timetable_slots             │
        │  - attendance                  │
        │  - syllabus_*                  │
        │  - tasks                       │
        │  - fees                        │
        │  - tests                       │
        └────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   AsyncStorage / Local Cache   │
        │                                │
        │  - Session persistence        │
        │  - React Query cache           │
        │  - Offline fallback            │
        └────────────────────────────────┘
```

## Data Flow Diagram - Dashboard Load

```
User navigates to Dashboard
         │
         ▼
┌─────────────────────────────┐
│ DashboardScreen mounts      │
└──────────────┬──────────────┘
               │
    ┌──────────┴──────────┬──────────────┬─────────────┬──────────────┐
    │                     │              │             │              │
    ▼                     ▼              ▼             ▼              ▼
┌─────────────┐   ┌───────────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐
│useDashboard │   │useRecentActivity │useUpcoming  │useFeeOverview │useTaskOverview
│Stats (8+q)  │   │Events (3q)       │Events (1q)  │(3q)           │(3q)
└──────┬──────┘   └────┬─────────┘   └──────┬──┘   └──┬─────────┘   └──┬──────────┘
       │               │                    │        │                 │
       ▼               ▼                    ▼        ▼                 ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │                 In Parallel (but separately)                      │
    │                                                                    │
    │  Problem: Multiple duplicated student record fetches             │
    │  Result: 19+ queries just from these 5 hooks                    │
    └──────────────────────────────────────────────────────────────────┘
       │
       └──────────────────────────────┬─────────────────────────────┐
                                      │                             │
                                      ▼                             ▼
                          ┌───────────────────────┐    ┌──────────────────┐
                          │ useSyllabusOverview   │    │All queries cache │
                          │ (31+ queries!)        │    │is populated      │
                          └───────┬───────────────┘    └──────────────────┘
                                  │
                  ┌───────────────┼───────────────┐
                  │               │               │
                  ▼               ▼               ▼
           Fetch timetable   For each subject:  Aggregated
              (1 query)      - Fetch syllabus   in React
                             - Fetch chapters
                             - Fetch topics
                             (3 queries × N)

Total Dashboard Load: 50+ queries!
Expected: < 20 queries
Optimization Potential: 60% reduction
```

## Query Dependency Tree - Attendance

```
AttendanceScreen
    │
    ├─ useClasses
    │   └─ Query: SELECT * FROM class_instances WHERE school_code = ?
    │
    ├─ useStudents (ALL students, no pagination)
    │   └─ Query: SELECT id, full_name, student_code... FROM student WHERE class_instance_id = ?
    │
    ├─ useClassAttendance (for specific date)
    │   └─ Query: SELECT * FROM attendance WHERE class_instance_id = ? AND date = ?
    │
    └─ When marking attendance:
        └─ useMarkBulkAttendance
            └─ Mutation: INSERT INTO attendance (bulk)
                └─ Invalidates:
                    - attendance.class
                    - attendance.school
                    - attendance.student
                    - attendance.stats

Problem: No pagination on students list
Impact: Large memory footprint for classes with 200+ students
```

## Cache Strategy Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  React Query Cache                          │
├─────────────────────────────────────────────────────────────┤
│ Entity          │ staleTime  │ gcTime    │ Use Case         │
├─────────────────┼────────────┼───────────┼──────────────────┤
│ Timetable       │ 10 min     │ 30 min    │ Stable schedule  │
│ Attendance      │ 2-5 min    │ 5-10 min  │ Frequent updates │
│ Dashboard Stats │ 5 min      │ 10 min    │ Quick refresh    │
│ Syllabus        │ 10 min     │ 30 min    │ Rarely changes   │
│ User Profile    │ 5 min      │ 10 min    │ Session data     │
│ Classes         │ 10 min     │ 30 min    │ Static           │
│ Students        │ 5 min      │ 10 min    │ May change       │
│ Tasks           │ 2 min      │ 5 min     │ Quick updates    │
│ Fees            │ 10 min     │ 30 min    │ Monthly updates  │
└─────────────────┴────────────┼───────────┴──────────────────┘

Query Key Structure:
  queryKeys.timetable.byClassAndDate(classId, date)
  → ['timetable', 'byClass', classId, 'date', date]

Invalidation Pattern:
  on mutation success → invalidateQueries({ queryKey: ['timetable'] })
  → Clears all timetable-related queries
```

## Query Pattern Examples

### Pattern 1: Simple Query (GOOD)
```
Component
    ↓
useQuery({
    queryKey: ['class', classId],
    queryFn: () => supabase.from('class_instances').select(...).eq('id', classId),
    staleTime: 10 * 60 * 1000,
})
    ↓
Supabase
```

### Pattern 2: Batch Query (GOOD)
```
Component (useUnifiedTimetable)
    ↓
useQuery
    ├─ Query 1: Fetch slots
    ├─ Query 2: Batch fetch subjects
    └─ Query 3: Batch fetch teachers
    (Parallel: Promise.all)
    ↓
Supabase (3 requests)
```

### Pattern 3: Waterfall Query (BAD)
```
Component (useSyllabusOverview)
    ↓
useQuery
    ├─ Query 1: Fetch timetable
    └─ For each subject:
        ├─ Query 2: Fetch syllabus
        ├─ Query 3: Fetch chapters
        ├─ Query 4: Fetch topics
        └─ Query 5: Fetch progress
    (Sequential: await each)
    ↓
Supabase (1 + 4N requests)

Problem: Waiting for data sequentially
Impact: Total load time = sum of all query times
Solution: Fetch all subjects' data in parallel
```

## Optimization Opportunities Map

```
LOW EFFORT, HIGH IMPACT
├─ Add field selection (.select('id, name') vs .select('*'))
│  Impact: 20-30% bandwidth reduction
│  Effort: 2 hours
│
├─ Use RequestDeduplicator in dashboard hooks
│  Impact: Reduce duplicate requests
│  Effort: 1 hour
│
└─ Memoize student record fetches
   Impact: Reduce 50+ queries to ~40
   Effort: 1 hour

────────────────────────────────────────────────────────────

MEDIUM EFFORT, HIGH IMPACT
├─ Batch syllabus queries
│  Impact: Reduce 13 queries to 3-4
│  Effort: 4 hours
│
├─ Implement prefetching
│  Impact: Perceived performance +40%
│  Effort: 3 hours
│
└─ Paginate attendance list
   Impact: Reduce memory footprint
   Effort: 2 hours

────────────────────────────────────────────────────────────

HIGH EFFORT, HIGH IMPACT
├─ Database aggregation functions
│  Impact: 90% faster analytics queries
│  Effort: Full day
│
├─ Query batching middleware
│  Impact: Combine multiple queries
│  Effort: Full day
│
└─ Comprehensive offline support
   Impact: Full offline capability
   Effort: 2-3 days
```

## Request Flow Timeline

```
Dashboard Load Timeline (Current - 50+ queries)
─────────────────────────────────────────────────

Time (seconds)
0.0  ├─ DashboardScreen mounts
     │
0.1  ├─ useDashboardStats starts (sequential in hook)
     │  ├─ Today's classes query
     │  ├─ Student record lookup
     │  ├─ Month attendance (2 queries)
     │  ├─ Week attendance (1 query)
     │  ├─ Tasks (1 query)
     │  └─ Submissions (1 query)
     │
0.5  ├─ useRecentActivity starts (fetches student again)
     │  ├─ Recent attendance
     │  ├─ Recent tasks
     │  └─ Recent test scores
     │
1.0  ├─ useUpcomingEvents starts
     │  └─ Calendar events
     │
1.2  ├─ useFeeOverview starts (fetches student again)
     │  ├─ Student lookup
     │  ├─ Fee plan
     │  └─ Payments
     │
1.5  ├─ useTaskOverview starts (fetches student again)
     │  ├─ Student lookup
     │  ├─ Tasks
     │  └─ Submissions
     │
2.0  ├─ useSyllabusOverview starts (worst!)
     │  ├─ Timetable (1 query)
     │  └─ For each of 10 subjects:
     │     ├─ Syllabus (waterfall!)
     │     ├─ Chapters (waterfall!)
     │     ├─ Topics (waterfall!)
     │     └─ Progress (waterfall!)
     │
5.0  └─ Dashboard finally renders all data

Expected Timeline (Optimized - 20 queries)
─────────────────────────────────────────

Time (seconds)
0.0  ├─ DashboardScreen mounts
     │
0.1  ├─ All hooks start in parallel
     │  ├─ Dashboard stats (batch & dedupe)
     │  ├─ Recent activity (reuses student record)
     │  ├─ Upcoming events
     │  ├─ Fee overview (reuses student record)
     │  ├─ Task overview (reuses student record)
     │  └─ Syllabus overview (batch subjects in parallel)
     │
1.5  └─ Dashboard renders all data
```

## Storage & Cache Hierarchy

```
┌──────────────────────────────────────────┐
│         Memory (RAM) - React Query      │
│                                          │
│  Active Queries: 20-50 concurrent      │
│  Cache Size: 50-100 MB                 │
│  TTL: 5-30 minutes                     │
│                                          │
│  - Dashboard stats                     │
│  - Recent data                         │
│  - User preferences                    │
└──────────────────────────────────────────┘
              ↑ (Cache Hit %)               ↑
              │ (95% on re-navigate)        │ (Fetch miss)
┌──────────────────────────────────────────┐
│    AsyncStorage (Persistent Cache)      │
│   (React Native only)                    │
│                                          │
│  Data: Session tokens, preferences     │
│  Size: 5-10 MB                         │
│  Retention: Permanent                  │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│     Supabase Server (PostgreSQL)         │
│                                          │
│  - Source of truth                     │
│  - RLS policies enforced                │
│  - Realtime subscriptions (throttled)  │
└──────────────────────────────────────────┘
```

