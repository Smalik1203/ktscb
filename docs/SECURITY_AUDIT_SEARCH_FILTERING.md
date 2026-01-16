# Supabase Search & Filtering Security Audit

**Audit Date:** January 15, 2026  
**Codebase:** KTS (ClassBridge School Management App)  
**Scope:** User-driven search/filtering patterns that may hit the database unsafely

---

## Executive Summary

This audit examines all client-side and server-side patterns for search, filtering, and data retrieval. The codebase shows **moderate risk** due to:
1. **Client-side search filtering** after fetching paginated data (not DB-level search)
2. **33 instances of `SELECT *`** exposing unnecessary columns
3. **No server-side text search**—no `ILIKE`, `LIKE`, or `textSearch` patterns found
4. **Pagination present but limits vary** (50-500 rows default)
5. **RLS enforced** but does not control query cost

> [!IMPORTANT]
> No critical unbounded text search (`ILIKE`, `LIKE`, `%input%`) patterns were found. The primary risk is **overfetching via client-side filtering**.

---

## Issue #1: Client-Side Search Filtering After Full Page Fetch

### Location
| File | Lines | Risk |
|------|-------|------|
| [AddAdminScreen.tsx](file:///Users/shoaibmalik/Desktop/KTS/src/features/admin/AddAdminScreen.tsx#L44-L55) | 44-55 | **MEDIUM** |
| [AddStudentScreen.tsx](file:///Users/shoaibmalik/Desktop/KTS/src/features/students/AddStudentScreen.tsx#L56-L66) | 56-66 | **MEDIUM** |
| [analytics-utils.ts](file:///Users/shoaibmalik/Desktop/KTS/src/lib/analytics-utils.ts#L134-L150) | 134-150 | **MEDIUM** |

### Pattern Observed

```typescript
// AddAdminScreen.tsx:46-55
const filteredAdmins = useMemo(() => {
  if (!adminSearch.trim()) return admins;
  const q = norm(adminSearch);
  return admins.filter((a: any) =>
    norm(a.full_name || '').includes(q) ||
    norm(a.email || '').includes(q) ||
    norm(a.phone || '').includes(q) ||
    norm(a.admin_code || '').includes(q)
  );
}, [admins, adminSearch]);
```

### Why This Is Risky
- **Data already fetched**: User search triggers keystroke filtering on *already-fetched* data
- **Page size is 25**: Each page fetches up to 25 rows, filtering happens after
- **BUT**: If data grows, user still fetches full page before filtering
- **Cost impact**: Low immediate cost since pagination limits exist, but wastes bandwidth

### Estimated Blast Radius: **LOW-MEDIUM**
- Current datasets are paginated (25 rows/page)
- No unbounded fetches triggered by search

### Fix
**Option 1: Server-Side Search RPC (Recommended)**

```sql
-- Create indexed search RPC
CREATE OR REPLACE FUNCTION search_admins(
  p_school_code TEXT,
  p_query TEXT,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID, full_name TEXT, email TEXT, phone TEXT, admin_code TEXT
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.full_name, a.email, a.phone::TEXT, a.admin_code
  FROM admin a
  WHERE a.school_code = p_school_code
    AND (
      a.full_name ILIKE '%' || p_query || '%'
      OR a.email ILIKE '%' || p_query || '%'
      OR a.admin_code ILIKE '%' || p_query || '%'
    )
  ORDER BY a.full_name
  LIMIT LEAST(p_limit, 100)  -- Hard cap at 100
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Add GIN index for text search
CREATE INDEX IF NOT EXISTS idx_admin_search_fulltext 
ON admin USING gin(to_tsvector('english', full_name || ' ' || COALESCE(email, '') || ' ' || COALESCE(admin_code, '')));
```

**Option 2: Debounce + Minimum Query Length**

```typescript
// Keep client-side but debounce and require min length
const debouncedSearch = useDebouncedValue(adminSearch, 300);
const filteredAdmins = useMemo(() => {
  if (!debouncedSearch.trim() || debouncedSearch.length < 2) return admins;
  // ... filter
}, [admins, debouncedSearch]);
```

---

## Issue #2: 33 Instances of `SELECT *` Exposing Unnecessary Columns

### Location
| File | Line | Table |
|------|------|-------|
| [syllabus.ts](file:///Users/shoaibmalik/Desktop/KTS/src/services/syllabus.ts#L199) | 199, 213, 243, 257 | syllabus_chapters, syllabus_topics |
| [finance.ts](file:///Users/shoaibmalik/Desktop/KTS/src/services/finance.ts#L550) | 550, 575 | finance_accounts, finance_categories |
| [calendarIntegration.ts](file:///Users/shoaibmalik/Desktop/KTS/src/services/calendarIntegration.ts#L110) | 110, 139, 247 | tests, calendar events |
| [inventory.ts](file:///Users/shoaibmalik/Desktop/KTS/src/services/inventory.ts#L131) | 131, 153 | inventory_items |
| [queries.ts](file:///Users/shoaibmalik/Desktop/KTS/src/data/queries.ts#L496) | 496, 574, 766, 854, 929, 965, 1013, 1033, 1191, 1245, 1274 | Multiple tables |
| [useFeesAnalytics.ts](file:///Users/shoaibmalik/Desktop/KTS/src/hooks/analytics/useFeesAnalytics.ts#L35) | 35, 85 | fee_invoices |
| [useAIAnalytics.ts](file:///Users/shoaibmalik/Desktop/KTS/src/hooks/useAIAnalytics.ts#L70) | 70, 210, 260 | analytics tables |

### Why This Is Risky
- **Security**: Exposes all columns including potential sensitive data
- **Performance**: Transfers more data than needed
- **Future risk**: Adding new columns auto-exposes them

### Estimated Blast Radius: **MEDIUM**
- RLS protects row access
- Column exposure depends on table schemas
- Finance tables may contain sensitive metadata

### Fix
Explicitly list required columns:

```typescript
// Before
.select('*')

// After - explicitly list needed columns
.select('id, name, type, is_active, created_at')
```

---

## Issue #3: Pagination Limits Vary (50-500 Rows Default)

### Findings

```
queries.ts:207  → range(0, 99)   = 100 rows (academic_years)
queries.ts:258  → range(0, 199)  = 200 rows (class_instances)
queries.ts:457  → range(0, 499)  = 500 rows (attendance)
queries.ts:502  → range(from, to) with limit = 50 default (attendance overview)
queries.ts:857  → range(0, 99)   = 100 rows (tests)
queries.ts:1152 → range(0, 299)  = 300 rows (payments)
queries.ts:1251 → range(0, 199)  = 200 rows hardcoded
```

### Why This Is Risky
- **499 rows for attendance** (`queries.ts:457`) is high
- No server-enforced maximum—client controls `from` and `to` parameters
- An attacker could request `.range(0, 9999)` directly via Supabase JS client

### Estimated Blast Radius: **MEDIUM-HIGH**
- Attendance table can be large (all students × all days)
- Attacker with valid auth could exfiltrate large datasets

### Fix

**Option 1: RPC with Enforced Limits**

```sql
CREATE OR REPLACE FUNCTION get_attendance_overview(
  p_class_instance_id UUID,
  p_school_code TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS SETOF attendance SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM attendance
  WHERE class_instance_id = p_class_instance_id
    AND school_code = p_school_code
    AND date BETWEEN p_start_date AND p_end_date
  ORDER BY date DESC
  LIMIT LEAST(p_limit, 100)  -- Hard cap at 100
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
```

**Option 2: Postgrest Configuration**
Configure `max_rows` in Supabase dashboard to cap query results.

---

## Issue #4: Count Queries Using `SELECT *` for Counting

### Location
| File | Line |
|------|------|
| [useAdmins.ts](file:///Users/shoaibmalik/Desktop/KTS/src/hooks/useAdmins.ts#L62-L65) | 62-65 |
| [useStudents.ts](file:///Users/shoaibmalik/Desktop/KTS/src/hooks/useStudents.ts#L50-L54) | 50-54 |

### Pattern

```typescript
const { count, error } = await supabase
  .from(DB.tables.admin)
  .select('*', { count: 'exact', head: true })
  .eq(DB.columns.schoolCode, schoolCode);
```

### Why This Is Risky
- While `head: true` prevents data return, `SELECT *` is inefficient for counting
- Postgres query planner processes all columns even with `head: true`

### Estimated Blast Radius: **LOW**

### Fix

```typescript
// Use minimal column for count
.select('id', { count: 'exact', head: true })
```

---

## Issue #5: Absence of Server-Side Text Search

### Positive Finding ✅
**No `ILIKE`, `LIKE`, or `textSearch` patterns found in the codebase.**

This means:
- No direct database wildcard search attacks possible
- No `%${userInput}%` injection points

### BUT Missing Feature
The app lacks proper server-side search, forcing client-side filtering. For production scalability, implement:

1. **Full-Text Search with `to_tsvector` indexes**
2. **RPC functions with input validation**
3. **Consider external search (Algolia, Meilisearch) for large datasets**

---

## Issue #6: User-Controlled Sorting Not Validated

### Finding
Queries use static `.order()` calls—no user-controlled `ORDER BY`:

```typescript
// All sort columns are hardcoded
.order('created_at', { ascending: false })
.order('full_name', { ascending: true })
```

### Status: ✅ **SAFE**
No user input flows into `ORDER BY` clauses.

---

## Issue #7: RPC Functions Review

### Found RPC Functions
| Function | Location | Input Validation |
|----------|----------|------------------|
| `get_syllabus_tree` | syllabus.ts:127 | ✅ Parameters typed |
| `mark_syllabus_taught` | syllabus.ts:284 | ✅ Parameters required |
| `unmark_syllabus_taught` | syllabus.ts:301 | ✅ Parameters required |
| `log_finance_operation` | finance.ts:171 | ✅ Uses SECURITY DEFINER |
| `detect_finance_inconsistencies` | finance.ts:658 | ✅ School-scoped |
| `register_push_token` | notifications.ts:98 | ✅ |
| `get_user_activity_stats` | useUserActivityStats.ts:38 | ⚠️ Cast to `any` |

### Risk Assessment
- All RPCs appear school-scoped
- No unbounded data retrieval in RPCs
- `get_user_activity_stats` uses `as any` cast—review for type safety

### Estimated Blast Radius: **LOW**

---

## Issue #8: Missing Rate Limiting for Search Endpoints

### Finding
No rate limiting observed for:
- Admin search (`onChangeText` triggers immediate filter)
- Student search (`onChangeText` triggers immediate filter)
- General analytics filtering

### Why This Is Risky
- Per-keystroke events don't hit DB directly (client-side)
- BUT if converted to server-side search, rate limiting needed

### Fix
When implementing server-side search:

```typescript
// Edge Function with rate limiting
const rateLimiter = new Map();
const RATE_LIMIT = 10; // requests per 10 seconds

Deno.serve(async (req) => {
  const ip = req.headers.get('x-forwarded-for');
  const now = Date.now();
  const requests = rateLimiter.get(ip) || [];
  const recent = requests.filter((t) => now - t < 10000);
  
  if (recent.length >= RATE_LIMIT) {
    return new Response('Rate limited', { status: 429 });
  }
  
  rateLimiter.set(ip, [...recent, now]);
  // ... process search
});
```

---

## Issue #9: No Read Replicas or Caching for Analytics

### Finding
Analytics queries (`useAIAnalytics.ts`, `useAggregatedAnalytics.ts`) hit the primary database:

```typescript
const { data } = await supabase
  .from('attendance')
  .select('*')  // SELECT * on attendance table
```

### Why This Is Risky
- Analytics queries can be expensive
- Concurrent users running analytics = DB strain
- No materialized views or read replicas configured

### Estimated Blast Radius: **MEDIUM**

### Fix
1. **React Query caching** (already present with `staleTime`)
2. **Materialized views** for analytics aggregations
3. **Read replica** for analytics queries (Supabase Pro feature)

---

## Summary Table

| Issue | File(s) | Risk | Blast Radius | Fix Priority |
|-------|---------|------|--------------|--------------|
| Client-side search filtering | AddAdminScreen, AddStudentScreen, analytics-utils | Medium | Low-Medium | P2 |
| SELECT * usage (33 instances) | Multiple services/hooks | Medium | Medium | P2 |
| High pagination limits (500) | queries.ts | Medium-High | Medium-High | P1 |
| Count queries with SELECT * | useAdmins, useStudents | Low | Low | P3 |
| No server-side text search | N/A | N/A | N/A | P3 (Feature) |
| No rate limiting for search | N/A | Low (currently) | Low | P3 |
| No read replicas for analytics | Analytics hooks | Medium | Medium | P2 |

---

## Prioritized Recommendations

### P1 - High Priority (Fix Immediately)

1. **Cap maximum pagination limits server-side**
   - Set Supabase `max_rows` configuration
   - Or wrap queries in RPC with `LIMIT LEAST(user_limit, 100)`

2. **Add hard limit validation in queries.ts**
   ```typescript
   const MAX_RANGE = 200;
   const to = Math.min(options?.to ?? 49, options.from + MAX_RANGE);
   ```

### P2 - Medium Priority (Fix Soon)

1. **Replace SELECT * with explicit column lists**
   - Start with finance.ts (sensitive data)
   - Then inventory.ts, calendarIntegration.ts

2. **Implement server-side search RPC for admin/student screens**
   - Add debouncing (300ms) for search input
   - Require minimum 2 characters

3. **Add materialized view for analytics aggregations**

### P3 - Low Priority (Backlog)

1. **Refactor count queries** to use minimal column selection
2. **Plan for external search service** if data grows beyond 100k rows
3. **Add rate limiting** when implementing server-side search

---

## What Was NOT Found (Positive Findings)

| Pattern | Status |
|---------|--------|
| `ILIKE`/`LIKE` with user input | ✅ Not found |
| `%${input}%` unbounded patterns | ✅ Not found |
| User-controlled ORDER BY | ✅ Not found |
| User-controlled column selection | ✅ Not found |
| RPC without input validation | ✅ Not found |
| Missing RLS on tables | ✅ RLS enabled |

---

## Conclusion

The codebase is **reasonably secure** for current scale. The main risks are:
1. **Over-fetching** due to client-side filtering and high pagination limits
2. **SELECT * exposure** of potentially sensitive columns
3. **No server-side text search** (not a security issue, but scalability concern)

**No critical vulnerabilities** were found for text-based injection attacks since no `ILIKE`/`LIKE` patterns exist in the codebase.
