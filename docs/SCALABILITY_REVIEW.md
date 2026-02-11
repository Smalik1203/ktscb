# Scalability Review - KTS Codebase
**Date:** January 25, 2026  
**Reviewer:** AI Assistant  
**Scope:** Performance, query patterns, and scalability issues

---

## Executive Summary

This review identifies **critical scalability issues** that will impact performance as the application grows. The codebase shows good practices in many areas (indexes exist, pagination is mostly present), but several patterns violate the project's own scalability rules.

**Priority Issues:**
- 🔴 **P0 (Critical):** Analytics aggregation in JavaScript instead of RPC
- 🔴 **P0 (Critical):** Client-side filtering after fetching data
- 🟡 **P1 (High):** N+1 query patterns
- 🟡 **P1 (High):** Multiple queries per screen (>2 on mount)
- 🟡 **P1 (High):** Missing pagination in some queries
- 🟢 **P2 (Medium):** Select('*') usage in some queries

---

## 🔴 P0: Critical Issues

### 1. Analytics Aggregation in JavaScript (Rule 5.1 Violation)

**Location:** Multiple analytics hooks

**Issue:** Analytics calculations are done in JavaScript after fetching raw data, violating Rule 5.1: "Analytics never run in JavaScript."

#### Affected Files:

**`src/hooks/analytics/useTasksAnalytics.ts`** (Lines 80-219)
```typescript
// ❌ VIOLATION: Aggregation in JavaScript
tasksData.forEach((task: any) => {
  // ... aggregation logic in JS
  const submissions = submissionsData?.filter((s: any) => s.task_id === taskId) || [];
  const submittedCount = submissions.length;
  const onTimeCount = submissions.filter((s: any) => s.submitted_at <= dueDate).length;
  // ... more JS aggregation
});
```

**`src/hooks/analytics/useAggregatedAnalytics.ts`** (Lines 241-278)
```typescript
// ❌ VIOLATION: Aggregation in JavaScript
marks.forEach((mark: any) => {
  const test = tests.find((t: any) => t.id === mark.test_id);
  // ... aggregation logic
  stats.totalScore += scorePercent;
  stats.count++;
});
```

**`src/hooks/analytics/useAcademicsAnalytics.ts`** (Lines 256-285)
```typescript
// ❌ VIOLATION: Aggregation in JavaScript
const aggregation: AcademicsAggregation = {
  totalTests: testsData.length,
  totalStudents: new Set(currentRows.map((r) => r.studentId)).size,
  avgScore: analyticsUtils.calculateAverage(currentRows.map((r) => r.avgScore)),
  // ... more JS calculations
};
```

**Impact:**
- Fetches ALL data to client before aggregating
- High memory usage
- Slow response times as data grows
- Violates Rule 5.1 explicitly

**Recommendation:**
- Move all analytics to RPC functions
- Use SQL aggregation (COUNT, SUM, AVG, GROUP BY)
- Return only aggregated results, not raw data

**Example Fix:**
```sql
-- Create RPC function
CREATE OR REPLACE FUNCTION get_tasks_analytics(
  p_school_code TEXT,
  p_academic_year_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_class_instance_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_tasks BIGINT,
  completed_tasks BIGINT,
  pending_tasks BIGINT,
  overdue_tasks BIGINT,
  avg_on_time_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
    COUNT(*) FILTER (WHERE status = 'overdue') as overdue_tasks,
    AVG(on_time_rate) as avg_on_time_rate
  FROM (
    -- Subquery with aggregations
  ) t;
END;
$$ LANGUAGE plpgsql;
```

---

### 2. Client-Side Filtering After Fetch (Rule 1.3 Violation)

**Location:** `src/lib/analytics-utils.ts` (Lines 165-212)

**Issue:** `applyClientFilters` function filters data in JavaScript after fetching from database.

```typescript
// ❌ VIOLATION: Filtering in JavaScript
export function applyClientFilters<T>(rows: T[], filters: ClientFilterParams): T[] {
  let filtered = [...rows];
  
  // Apply search query
  if (filters.searchQuery && filters.searchQuery.trim()) {
    filtered = filtered.filter((row) => {
      const query = filters.searchQuery!.toLowerCase();
      return Object.values(row as any).some((val) =>
        String(val).toLowerCase().includes(query)
      );
    });
  }
  // ... more JS filtering
}
```

**Impact:**
- Fetches full page of data, then filters client-side
- Wastes bandwidth and memory
- Violates Rule 1.3: "All filtering, grouping, sorting must happen in the database"

**Recommendation:**
- Move all filtering to SQL WHERE clauses
- Use PostgreSQL text search (ILIKE, to_tsvector) for search
- Pass filter parameters to queries, not to client-side functions

**Also Found In:**
- `src/features/admin/AddAdminScreen.tsx` (Lines 44-55) - Client-side admin search
- `src/features/students/AddStudentScreen.tsx` (Lines 56-66) - Client-side student search

---

## 🟡 P1: High Priority Issues

### 3. N+1 Query Pattern

**Location:** `src/services/api.ts` (Lines 703-721)

**Issue:** `getAll` method for resources loops through classes, making sequential queries.

```typescript
// ❌ VIOLATION: N+1 pattern
async getAll(schoolCode: string, limit?: number): Promise<DomainLearningResource[]> {
  const classesResult = await listClasses(schoolCode);
  // ...
  const allResources: DomainLearningResource[] = [];
  
  for (const classInstance of classesResult.data) {
    const result = await listResources(classInstance.id, schoolCode, undefined, { 
      to: limit ? limit - allResources.length : 99 
    });
    if (result.data) {
      allResources.push(...result.data);
    }
  }
  return allResources.slice(0, limit);
}
```

**Impact:**
- If 10 classes exist, makes 11 queries (1 + 10)
- Sequential execution (not parallel)
- Violates Rule 2.2: "No N+1 patterns"

**Recommendation:**
- Use single query with JOIN or UNION
- Or use `Promise.all()` for parallel execution (still not ideal)
- Best: Single query filtering by `school_code` directly

**Example Fix:**
```typescript
async getAll(schoolCode: string, limit?: number): Promise<DomainLearningResource[]> {
  const result = await listResources(
    undefined, // No class filter
    schoolCode,
    undefined,
    { to: limit ?? 99 }
  );
  return result.data || [];
}
```

---

### 4. Multiple Queries Per Screen (>2 on Mount)

**Location:** `src/features/dashboard/DashboardScreen.tsx` (Lines 298-412)

**Issue:** Dashboard makes 6+ queries on initial mount, violating Rule 2.1: "Max 2 queries per screen on mount"

```typescript
// ❌ VIOLATION: 6+ queries on mount
const { data: classInstance } = useClass(...);           // Query 1
const { data: stats } = useDashboardStats(...);         // Query 2
const { data: recentActivityData } = useRecentActivity(...); // Query 3
const { data: upcomingEventsData } = useUpcomingEvents(...);   // Query 4
const { data: feeOverview } = useFeeOverview(...);       // Query 5
const { data: taskOverview } = useTaskOverview(...);    // Query 6
const { data: syllabusOverview } = useSyllabusOverview(...); // Query 7
```

**Impact:**
- Slow initial load
- Multiple round trips to database
- Violates Rule 2.1 explicitly

**Recommendation:**
- Consolidate into 1-2 RPC functions
- Create `get_dashboard_data(school_code, user_id, class_instance_id)` RPC
- Return all dashboard data in single response

**Example Fix:**
```sql
CREATE OR REPLACE FUNCTION get_dashboard_data(
  p_school_code TEXT,
  p_user_id UUID,
  p_class_instance_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'stats', (SELECT ...),
    'recentActivity', (SELECT ...),
    'upcomingEvents', (SELECT ...),
    'feeOverview', (SELECT ...),
    'taskOverview', (SELECT ...),
    'syllabusOverview', (SELECT ...)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

---

### 5. Missing Pagination / No Limit

**Location:** `src/hooks/useTasks.ts` (Lines 64-102)

**Issue:** `useTasks` hook fetches all tasks without pagination.

```typescript
// ❌ VIOLATION: No pagination
export function useTasks(schoolCode: string, filters?: TaskFilters) {
  return useQuery({
    queryKey: ['tasks', schoolCode, filters],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`...`)
        .eq('school_code', schoolCode)
        .eq('is_active', true)
        .order('due_date', { ascending: true });
      // ❌ No .range() or .limit()
      const { data, error } = await query;
      return data as Task[];
    },
  });
}
```

**Impact:**
- Can fetch unbounded rows
- Violates Rule 2.3: "Pagination by default"

**Recommendation:**
- Add `.range(offset, offset + limit - 1)` or `.limit(limit)`
- Default limit: 50 rows
- Add pagination parameters to hook

**Also Found In:**
- `src/hooks/useTasks.ts` - `useStudentTasks` (Line 107) - No pagination
- `src/hooks/useTaskStats.ts` (Line 193) - Fetches all tasks for stats

---

### 6. Client-Side Aggregation for Stats

**Location:** `src/hooks/useTasks.ts` (Lines 189-236)

**Issue:** `useTaskStats` fetches all tasks, then aggregates in JavaScript.

```typescript
// ❌ VIOLATION: Aggregation in JS
export function useTaskStats(schoolCode: string, classInstanceId?: string) {
  return useQuery({
    queryFn: async () => {
      const { data, error } = await query; // Fetches ALL tasks
      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      const stats = {
        total: data.length,  // ❌ Count in JS
        byPriority: {} as Record<string, number>,
        overdue: 0,
        dueToday: 0,
        upcoming: 0,
      };

      data.forEach(task => {  // ❌ Aggregation in JS
        if (task.priority) {
          stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
        }
        if (task.due_date < today) {
          stats.overdue++;
        }
        // ... more JS aggregation
      });

      return stats;
    },
  });
}
```

**Impact:**
- Fetches all tasks just to count them
- Should use SQL COUNT, GROUP BY

**Recommendation:**
- Use SQL aggregation:
```typescript
const { data, error } = await supabase
  .from('tasks')
  .select('priority, due_date')
  .eq('school_code', schoolCode)
  .eq('is_active', true)
  // Use RPC or aggregate in SQL
```

Or create RPC:
```sql
CREATE OR REPLACE FUNCTION get_task_stats(
  p_school_code TEXT,
  p_class_instance_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'total', (SELECT COUNT(*) FROM tasks WHERE ...),
    'byPriority', (SELECT json_object_agg(priority, count) FROM ...),
    'overdue', (SELECT COUNT(*) FROM tasks WHERE due_date < CURRENT_DATE),
    'dueToday', (SELECT COUNT(*) FROM tasks WHERE due_date = CURRENT_DATE),
    'upcoming', (SELECT COUNT(*) FROM tasks WHERE due_date > CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 🟢 P2: Medium Priority Issues

### 7. Select('*') Usage

**Location:** `src/hooks/useTasks.ts` (Lines 71, 129, 172)

**Issue:** Using `select('*')` violates Rule 1.2: "No select('*') in production code"

```typescript
// ❌ VIOLATION: Select *
.select(`
  *,
  subjects(subject_name),
  class_instances(grade, section)
`)
```

**Impact:**
- Overfetches unnecessary columns
- Wastes bandwidth
- Violates explicit rule

**Recommendation:**
- Specify explicit columns
- Only select what's needed

**Example Fix:**
```typescript
.select(`
  id,
  school_code,
  academic_year_id,
  class_instance_id,
  subject_id,
  title,
  description,
  priority,
  assigned_date,
  due_date,
  max_marks,
  is_active,
  created_by,
  created_at,
  updated_at,
  subjects(subject_name),
  class_instances(grade, section)
`)
```

---

## 📊 Summary by Rule Violation

| Rule | Violations | Severity |
|------|-----------|----------|
| Rule 1.2: No select('*') | 3 instances | 🟢 P2 |
| Rule 1.3: Filtering in SQL | Client-side filtering in analytics-utils.ts | 🔴 P0 |
| Rule 2.1: Max 2 queries/screen | DashboardScreen (6+ queries) | 🟡 P1 |
| Rule 2.2: No N+1 patterns | api.ts getAll() method | 🟡 P1 |
| Rule 2.3: Pagination required | useTasks, useStudentTasks | 🟡 P1 |
| Rule 5.1: Analytics in SQL/RPC | All analytics hooks | 🔴 P0 |
| Rule 5.2: Analytics read-only | ✅ Compliant | - |

---

## 🎯 Recommended Action Plan

### Phase 1: Critical Fixes (Week 1)
1. **Move analytics to RPC functions**
   - Create RPC for tasks analytics
   - Create RPC for academics analytics
   - Create RPC for aggregated analytics
   - Update hooks to call RPCs

2. **Fix client-side filtering**
   - Remove `applyClientFilters` function
   - Move all filtering to SQL WHERE clauses
   - Update search to use PostgreSQL text search

### Phase 2: High Priority (Week 2)
3. **Consolidate dashboard queries**
   - Create `get_dashboard_data` RPC
   - Reduce from 6+ queries to 1-2

4. **Fix N+1 patterns**
   - Refactor `api.resources.getAll()` to single query
   - Audit other potential N+1 patterns

5. **Add pagination**
   - Add pagination to `useTasks`
   - Add pagination to `useStudentTasks`
   - Add pagination to `useTaskStats` (or convert to RPC)

### Phase 3: Medium Priority (Week 3)
6. **Remove select('*')**
   - Replace with explicit column lists
   - Audit all queries for select('*')

---

## ✅ Good Practices Found

1. **Indexes are well-defined** - `supabase/migrations/create_performance_indexes.sql` shows comprehensive indexing
2. **Most queries have pagination** - Most list queries use `.range()` or `.limit()`
3. **No select('*') in most places** - Most queries specify explicit columns
4. **Query consolidation in some areas** - `useSyllabusOverview` uses batch queries
5. **Stale time configured** - Most queries have `staleTime` set appropriately

---

## 📝 Notes

- The codebase shows awareness of scalability rules (comments mention "OPTIMIZED")
- Some violations are in newer code that may not have been reviewed
- Indexes exist, which is good - the main issue is query patterns, not missing indexes
- RPC functions should be created for all analytics to follow Rule 5.1

---

## 🔍 Additional Recommendations

1. **Add query performance monitoring**
   - Log slow queries (>500ms)
   - Track query counts per screen
   - Alert on N+1 patterns

2. **Create query review checklist**
   - Before merging, verify:
     - ✅ No select('*')
     - ✅ Pagination present
     - ✅ Filtering in SQL
     - ✅ Max 2 queries per screen
     - ✅ No N+1 patterns
     - ✅ Analytics use RPC

3. **Consider query batching**
   - Use React Query's `useQueries` for parallel queries
   - Or consolidate into RPCs

4. **Add database query timeouts**
   - Set reasonable timeouts (2-5s)
   - Fail fast on slow queries

---

**End of Review**
