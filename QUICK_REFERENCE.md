# ClassBridge Data Fetching - Quick Reference

## Current State Overview

**Framework**: React Query (TanStack) v4+  
**Backend**: Supabase (PostgreSQL)  
**Caching**: React Query (5 min default stale time, 10 min cache)  
**Platform**: React Native

## Key Metrics

| Metric | Value | Issue |
|--------|-------|-------|
| Dashboard Initial Queries | 50+ | Waterfall + duplication |
| Attendance History | All records | No pagination |
| Syllabus Load Queries | 1 + (N subjects × 3) | N+1 pattern |
| Average Request Count | 1-2/second | High for mobile |
| Cache Hit Ratio | Good | Well organized keys |

## High Impact Issues

### 1. Syllabus Loading N+1 (CRITICAL)
- **File**: `src/hooks/useDashboard.ts` (useSyllabusOverview function)
- **Problem**: 1 + (10 subjects × 3 queries) = 31 queries
- **Fix**: Use batch query or SQL join

### 2. Dashboard Query Waterfall (CRITICAL)
- **File**: `src/features/dashboard/DashboardScreen.tsx`
- **Problem**: 6 hooks × 8+ queries each = 50+ queries on load
- **Fix**: Parallel loading + deduplication

### 3. Attendance Component No Pagination (HIGH)
- **File**: `src/components/attendance/AttendanceScreen.tsx`
- **Problem**: Loads all students (200+) into memory
- **Fix**: Add pagination or virtual scrolling

## Quick Optimization Guide

### Immediate (30 mins)
1. Add field selection to queries (reduce payload 20%)
2. Use RequestDeduplicator in dashboard hooks
3. Memoize student record fetches

### Short Term (2-3 hours)
1. Implement prefetching in DashboardScreen
2. Batch syllabus queries
3. Add attendance history pagination

### Medium Term (1 day)
1. Create database aggregation functions for analytics
2. Implement query batching middleware
3. Add offline sync layer

## File Locations

**Data Fetching**:
- Hooks: `src/hooks/*.ts`
- Query Config: `src/lib/queryClient.ts`
- Supabase Client: `src/lib/supabase.ts`
- API Layer: `src/services/api.ts`

**Optimization Utilities** (Currently Unused):
- `src/utils/queryOptimizations.ts` - Has batchIds, RequestDeduplicator, rate limiter
- `src/data/queries.ts` - Lower-level query functions

**Problem Areas**:
- `src/hooks/useDashboard.ts` - Heavy aggregations (650 lines)
- `src/hooks/useUnifiedTimetable.ts` - Complex mutations (800 lines)
- `src/components/attendance/AttendanceScreen.tsx` - No pagination

## Testing Performance

```bash
# Check network requests
1. Open React Native Debugger
2. Go to Network tab
3. Load Dashboard
4. Count requests in Network tab (should see 40-50)

# Measure load time
1. Use React Profiler
2. Time the dashboard mount
3. Note waterfall requests
```

## Best Practices Applied

✓ Query key factory pattern  
✓ Retry logic with exponential backoff  
✓ Abort signal handling  
✓ Cache invalidation on mutations  
✓ Stale time optimization  

## Best Practices Missing

✗ Request deduplication  
✗ Field selection (mostly select('*'))  
✗ Prefetching  
✗ Pagination for large lists  
✗ Database aggregations  
✗ Batch query operations  

## Critical Query Flows

### Dashboard Load (Student)
```
DashboardScreen mounts
├─ useDashboardStats (8+ queries)
├─ useRecentActivity (5 queries, duplicates)
├─ useUpcomingEvents (1 query)
├─ useFeeOverview (3 queries, duplicates)
├─ useTaskOverview (3 queries, duplicates)
└─ useSyllabusOverview (31 queries!)
Result: 50+ total queries
```

### Attendance Marking
```
AttendanceScreen mounts
├─ useClasses (1 query)
├─ useStudents (ALL records, no pagination)
└─ useClassAttendance (1 query)
Result: 2-3 queries + large payload
```

### Timetable Edit
```
useUnifiedTimetable
├─ timetable_slots (main)
├─ subjects batch (in id list)
├─ admin batch (teacher lookup)
├─ syllabus_progress (taught marks)
└─ Mutations: create/update/delete with cascading
Result: 4 queries + multiple mutations
```

## Monitoring Checklist

- [ ] Dashboard loads in < 3 seconds
- [ ] Network requests < 30 on dashboard load
- [ ] Attendance component handles 200+ students
- [ ] No duplicate student record fetches
- [ ] Attendance cache hits on re-navigate
- [ ] Timetable mutations are optimistic
- [ ] Memory usage < 100MB for large datasets

## Key Code Examples

### Good Pattern (useUnifiedTimetable)
```typescript
// Batch fetch related data
const [subjectsResult, teachersResult] = await Promise.all([
  supabase.from('subjects').select(...).in('id', subjectIds),
  supabase.from('admin').select(...).in('id', teacherIds),
]);
```

### Bad Pattern (useSyllabusOverview)
```typescript
// Loop with separate queries (N+1)
for (const subject of subjects) {
  const chapters = await supabase.from('syllabus_chapters')...
  const topics = await supabase.from('syllabus_topics')...
}
```

### Unused Tool (QueryOptimizations)
```typescript
// Exists but not used
const deduplicator = globalDeduplicator;
const rateLimiter = globalRateLimiter;
```

## Next Steps

1. Profile dashboard loading with React DevTools
2. Implement quick wins (field selection, deduplication)
3. Batch syllabus queries
4. Plan database aggregation functions
5. Add prefetching strategy

