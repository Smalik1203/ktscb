# Performance & Load Testing Guide - ClassBridge

## Overview
Comprehensive guide to performance and load testing for ClassBridge, ensuring the app can handle real-world usage scenarios with hundreds of concurrent users.

---

## Table of Contents
1. [Why Performance Testing Matters](#why-performance-testing-matters)
2. [Types of Testing](#types-of-testing)
3. [Key Metrics to Measure](#key-metrics-to-measure)
4. [Testing Tools](#testing-tools)
5. [Frontend Performance Testing](#frontend-performance-testing)
6. [Backend Load Testing](#backend-load-testing)
7. [Database Performance Testing](#database-performance-testing)
8. [Real-World Test Scenarios](#real-world-test-scenarios)
9. [Setting Up Tests](#setting-up-tests)
10. [Running Tests](#running-tests)
11. [Interpreting Results](#interpreting-results)
12. [Optimization Strategies](#optimization-strategies)

---

## Why Performance Testing Matters

### Critical Scenarios in ClassBridge
- **Morning Rush (8-9 AM)**: 500+ students logging in, checking timetables
- **Attendance Marking (9-10 AM)**: 30+ teachers marking attendance simultaneously
- **Test Results Day**: 1000+ students checking results at the same time
- **Assignment Deadline**: 200+ students submitting assignments in final hour
- **Fee Payment Deadline**: 100+ parents checking/paying fees

### Risks Without Testing
- ❌ App crashes during peak usage
- ❌ Slow loading times frustrate users
- ❌ Database deadlocks during concurrent writes
- ❌ Failed submissions (assignments, test answers)
- ❌ Poor user experience → app abandonment

---

## Types of Testing

### 1. Performance Testing
**What**: Measure app responsiveness and speed
**Goal**: Ensure fast loading and smooth interactions
**Focus**: Individual user experience

### 2. Load Testing
**What**: Test app under expected load
**Goal**: Handle normal concurrent user levels
**Example**: 500 users browsing simultaneously

### 3. Stress Testing
**What**: Push app beyond normal limits
**Goal**: Find breaking point
**Example**: 2000 concurrent users

### 4. Spike Testing
**What**: Sudden surge in users
**Goal**: Handle unexpected traffic spikes
**Example**: Test results announced, 1000 users login in 1 minute

### 5. Endurance Testing (Soak Testing)
**What**: Sustained load over time
**Goal**: Check for memory leaks, degradation
**Example**: 200 users active for 8 hours

---

## Key Metrics to Measure

### Frontend Metrics

#### 1. App Startup Time
- **Target**: < 2 seconds (cold start)
- **Measure**: Time from app launch to dashboard visible

#### 2. Screen Render Time
- **Target**: < 500ms per screen
- **Measure**: Time to render content after navigation

#### 3. Frame Rate (FPS)
- **Target**: 60 FPS (smooth animations)
- **Measure**: During scrolling, animations

#### 4. Memory Usage
- **Target**: < 100 MB for typical session
- **Watch for**: Memory leaks over time

#### 5. Bundle Size
- **Target**: < 10 MB (JavaScript bundle)
- **Impact**: Download size, initial load

### Backend Metrics

#### 1. API Response Time
- **Target**:
  - Simple queries: < 200ms
  - Complex queries: < 500ms
  - Mutations: < 300ms

#### 2. Throughput
- **Target**: 1000 requests/second (peak load)
- **Measure**: Requests handled per second

#### 3. Error Rate
- **Target**: < 0.1% errors
- **Measure**: Failed requests / total requests

#### 4. Concurrent Users
- **Target**: 500 concurrent users
- **Measure**: Simultaneous active connections

### Database Metrics

#### 1. Query Execution Time
- **Target**:
  - Simple SELECT: < 50ms
  - Complex JOIN: < 200ms
  - Aggregations: < 500ms

#### 2. Connection Pool Usage
- **Target**: < 80% of pool size
- **Watch for**: Connection exhaustion

#### 3. Database CPU/Memory
- **Target**: < 70% utilization
- **Supabase Dashboard**: Monitor in real-time

#### 4. Index Hit Rate
- **Target**: > 95%
- **Measure**: Queries using indexes vs full scans

---

## Testing Tools

### Frontend Performance Testing

#### 1. **Flipper** (React Native Debugger)
- Built-in performance profiler
- Network inspector
- Layout inspector
- Free and easy to set up

```bash
# Install Flipper
brew install --cask flipper

# Install Flipper plugins
npm install --save-dev react-native-flipper
```

#### 2. **React Native Performance Monitor**
- Built-in FPS monitor
- Memory usage tracking

```javascript
// Enable in dev mode
import { PerformanceMonitor } from 'react-native';

// Shows FPS overlay
```

#### 3. **why-did-you-render**
- Detect unnecessary re-renders
- Performance optimization tool

```bash
npm install --save-dev @welldone-software/why-did-you-render
```

```javascript
// src/wdyr.js
import whyDidYouRender from '@welldone-software/why-did-you-render';

if (__DEV__) {
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}
```

#### 4. **React DevTools Profiler**
- Measure component render times
- Identify slow components

### Backend Load Testing

#### 1. **k6** (Recommended)
- Modern load testing tool
- JavaScript-based test scripts
- Beautiful CLI output
- Free and open-source

```bash
# Install k6
brew install k6

# Or download from https://k6.io
```

#### 2. **Artillery**
- Easy YAML configuration
- Good for API testing
- Real-time reporting

```bash
npm install -g artillery
```

#### 3. **Apache JMeter**
- Industry standard
- GUI-based
- Comprehensive features
- Steep learning curve

#### 4. **Locust**
- Python-based
- Easy to write tests
- Web-based UI

```bash
pip install locust
```

### Database Testing

#### 1. **pgBench** (PostgreSQL Benchmark)
- Built-in PostgreSQL tool
- Test database performance

```bash
# Install PostgreSQL tools
brew install postgresql

# Run benchmark
pgbench -c 10 -j 2 -t 1000 your_database
```

#### 2. **Supabase Dashboard**
- Monitor real-time performance
- Query statistics
- Index recommendations
- Connection pool usage

---

## Frontend Performance Testing

### Setup Performance Monitoring

#### 1. Install Dependencies
```bash
npm install --save-dev flipper react-native-flipper
npm install --save-dev @welldone-software/why-did-you-render
```

#### 2. Create Performance Utilities

```typescript
// src/utils/performance.ts

export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map();

  static mark(name: string) {
    this.marks.set(name, Date.now());
  }

  static measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark);
    if (!start) {
      console.warn(`No mark found: ${startMark}`);
      return 0;
    }

    const duration = Date.now() - start;
    console.log(`[PERF] ${name}: ${duration}ms`);

    // Optional: Send to analytics
    // analytics.logEvent('performance', { name, duration });

    return duration;
  }

  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      console.log(`[PERF] ${name}: ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.log(`[PERF] ${name} (failed): ${duration}ms`);
      throw error;
    }
  }
}
```

#### 3. Add Performance Tracking to Screens

```typescript
// src/features/dashboard/DashboardScreen.tsx

import { PerformanceMonitor } from '@/utils/performance';

export function DashboardScreen() {
  useEffect(() => {
    PerformanceMonitor.mark('dashboard_mount');
  }, []);

  const { data, isLoading } = useDashboard();

  useEffect(() => {
    if (!isLoading && data) {
      PerformanceMonitor.measure('Dashboard Load Time', 'dashboard_mount');
    }
  }, [isLoading, data]);

  return (
    // Component JSX
  );
}
```

#### 4. Measure Query Performance

```typescript
// src/hooks/useDashboard.ts

import { PerformanceMonitor } from '@/utils/performance';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      return PerformanceMonitor.measureAsync('Dashboard Query', async () => {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .limit(10);

        if (error) throw error;
        return data;
      });
    },
  });
}
```

### Manual Performance Tests

#### Test 1: Cold Start Time
```
Steps:
1. Fully close app
2. Clear app from recent apps
3. Start timer
4. Launch app
5. Stop timer when dashboard visible

Target: < 2 seconds
```

#### Test 2: Screen Navigation Time
```
Steps:
1. Open app (already logged in)
2. Start timer
3. Navigate to Attendance screen
4. Stop timer when list renders

Target: < 500ms
```

#### Test 3: List Scroll Performance
```
Steps:
1. Open student list (500+ students)
2. Enable FPS monitor
3. Scroll through list
4. Check FPS

Target: Consistent 60 FPS
```

#### Test 4: Memory Leak Test
```
Steps:
1. Open app
2. Note initial memory usage
3. Navigate through 10 different screens
4. Return to dashboard
5. Check memory usage

Target: Memory returns to near-initial levels
```

---

## Backend Load Testing

### Using k6

#### 1. Install k6
```bash
brew install k6
# Or download from https://k6.io
```

#### 2. Create Test Scripts

**Basic Load Test**
```javascript
// tests/load/basic-load.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% errors
  },
};

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;

export default function () {
  // Test 1: Login
  const loginRes = http.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: 'test@example.com',
      password: 'password123',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
    }
  );

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'got access token': (r) => r.json('access_token') !== undefined,
  });

  const token = loginRes.json('access_token');

  sleep(1);

  // Test 2: Fetch dashboard data
  const dashboardRes = http.get(`${SUPABASE_URL}/rest/v1/students?select=*&limit=10`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  check(dashboardRes, {
    'dashboard loaded': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 500,
  });

  sleep(2);

  // Test 3: Fetch attendance
  const attendanceRes = http.get(`${SUPABASE_URL}/rest/v1/attendance?select=*&limit=50`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  check(attendanceRes, {
    'attendance loaded': (r) => r.status === 200,
  });

  sleep(1);
}
```

**Stress Test - Test Results Day**
```javascript
// tests/load/results-day-stress.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 },   // Quick ramp to 100
    { duration: '30s', target: 500 },   // Ramp to 500
    { duration: '1m', target: 1000 },   // Peak: 1000 concurrent users
    { duration: '2m', target: 1000 },   // Sustain peak
    { duration: '1m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% < 1 second (relaxed for stress)
    http_req_failed: ['rate<0.05'],     // Less than 5% errors
  },
};

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;

export default function () {
  // Simulate student checking test results
  const resultsRes = http.get(
    `${SUPABASE_URL}/rest/v1/test_attempts?select=*,test:tests(*)&student_id=eq.${__VU}`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
      },
    }
  );

  check(resultsRes, {
    'results loaded': (r) => r.status === 200,
    'got data': (r) => r.json().length >= 0,
  });

  sleep(3);
}
```

**Spike Test - Sudden Traffic**
```javascript
// tests/load/spike-test.js

export const options = {
  stages: [
    { duration: '10s', target: 50 },    // Normal traffic
    { duration: '10s', target: 1000 },  // Sudden spike!
    { duration: '30s', target: 1000 },  // Sustain spike
    { duration: '10s', target: 50 },    // Back to normal
  ],
};

// Rest of the test...
```

**Attendance Concurrent Writes Test**
```javascript
// tests/load/concurrent-attendance.js

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    teachers_marking_attendance: {
      executor: 'constant-vus',
      vus: 30,  // 30 teachers simultaneously
      duration: '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;

export default function () {
  // Mark attendance for 30 students
  for (let i = 0; i < 30; i++) {
    const res = http.post(
      `${SUPABASE_URL}/rest/v1/attendance`,
      JSON.stringify({
        student_id: `student-${__VU}-${i}`,
        date: new Date().toISOString().split('T')[0],
        status: 'present',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Prefer': 'return=minimal',
        },
      }
    );

    check(res, {
      'attendance marked': (r) => r.status === 201,
    });
  }
}
```

#### 3. Run Tests

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Run basic load test
k6 run tests/load/basic-load.js

# Run stress test
k6 run tests/load/results-day-stress.js

# Run spike test
k6 run tests/load/spike-test.js

# Run with custom options
k6 run --vus 100 --duration 30s tests/load/basic-load.js

# Output to file
k6 run tests/load/basic-load.js --out json=results.json

# Run with cloud output (k6 cloud account required)
k6 run --out cloud tests/load/basic-load.js
```

### Using Artillery

#### 1. Install Artillery
```bash
npm install -g artillery
```

#### 2. Create Test Configuration

```yaml
# tests/artillery/load-test.yml

config:
  target: 'https://your-project.supabase.co'
  phases:
    - duration: 60
      arrivalRate: 10      # 10 users per second
      name: "Warm up"
    - duration: 120
      arrivalRate: 50      # 50 users per second
      name: "Peak load"
    - duration: 60
      arrivalRate: 5       # Cool down
      name: "Cool down"
  defaults:
    headers:
      apikey: '{{ $processEnvironment.SUPABASE_ANON_KEY }}'
      Content-Type: 'application/json'

scenarios:
  - name: "Student Dashboard Flow"
    flow:
      - get:
          url: "/rest/v1/students?select=*&limit=10"
      - think: 2
      - get:
          url: "/rest/v1/attendance?select=*&limit=50"
      - think: 3
      - get:
          url: "/rest/v1/tasks?select=*&limit=20"
```

#### 3. Run Artillery Tests

```bash
# Run test
artillery run tests/artillery/load-test.yml

# Run with report
artillery run --output report.json tests/artillery/load-test.yml
artillery report report.json
```

---

## Database Performance Testing

### 1. Analyze Slow Queries

Connect to Supabase and check slow queries:

```sql
-- Enable query logging (if not already enabled)
ALTER DATABASE postgres SET log_min_duration_statement = 100; -- Log queries > 100ms

-- View slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

### 2. Check Index Usage

```sql
-- Find missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
ORDER BY n_distinct DESC;

-- Check index hit rate (should be > 95%)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

### 3. Test Query Performance

```sql
-- Test attendance query (common operation)
EXPLAIN ANALYZE
SELECT
  s.full_name,
  a.status,
  a.date
FROM attendance a
JOIN student s ON s.id = a.student_id
WHERE a.class_instance_id = 'some-uuid'
  AND a.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY a.date DESC;

-- Should show:
-- - Index Scan (good) vs Seq Scan (bad for large tables)
-- - Execution time < 100ms
```

### 4. Load Test Database Directly

```bash
# Using pgbench
pgbench -h your-db-host.supabase.co -U postgres -d postgres -c 10 -j 2 -t 1000

# Custom script
pgbench -h your-db-host.supabase.co -U postgres -d postgres -f custom-test.sql -c 20 -t 500
```

**custom-test.sql**:
```sql
-- Simulate attendance query
SELECT * FROM attendance WHERE class_instance_id = 'test-uuid' LIMIT 50;

-- Simulate student lookup
SELECT * FROM student WHERE school_code = 'TEST001';

-- Simulate dashboard aggregation
SELECT
  class_instance_id,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present
FROM attendance
WHERE date = CURRENT_DATE
GROUP BY class_instance_id;
```

---

## Real-World Test Scenarios

### Scenario 1: Morning Login Rush
**Time**: 8:00-9:00 AM
**Users**: 500 students, 30 teachers
**Actions**:
- Login
- Check dashboard
- View timetable
- Check pending tasks

**Load Test Config**:
```javascript
export const options = {
  scenarios: {
    students: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 500 },
        { duration: '10m', target: 500 },
        { duration: '5m', target: 0 },
      ],
      gracefulRampDown: '1m',
    },
    teachers: {
      executor: 'constant-vus',
      vus: 30,
      duration: '20m',
    },
  },
};
```

### Scenario 2: Attendance Marking Period
**Time**: 9:00-9:30 AM
**Users**: 30 teachers
**Actions**:
- Each marks attendance for 40 students
- 1200 concurrent write operations

**Test Focus**:
- Database write performance
- Lock contention
- Transaction throughput

### Scenario 3: Test Results Publication
**Time**: 2:00 PM (results announced)
**Users**: Spike from 0 to 1000 in 5 minutes
**Actions**:
- Login
- Navigate to test results
- View scores
- View analytics

**Test Focus**:
- Spike handling
- Read query performance
- Cache effectiveness

### Scenario 4: Assignment Submission Deadline
**Time**: 11:50-12:00 PM (deadline at noon)
**Users**: 200 students submitting in last 10 minutes
**Actions**:
- Upload files
- Submit assignment
- Confirm submission

**Test Focus**:
- File upload performance
- Concurrent writes
- Storage throughput

### Scenario 5: All-Day Sustained Load
**Duration**: 8 hours
**Users**: 100-300 concurrent (varies)
**Actions**: Mixed usage patterns

**Test Focus**:
- Memory leaks
- Connection pool exhaustion
- Performance degradation over time

---

## Setting Up Tests

### 1. Create Test Directory Structure

```bash
mkdir -p tests/{load,performance,database}
mkdir -p tests/load/{k6,artillery}
mkdir -p tests/results
```

### 2. Install Dependencies

```bash
# Backend load testing
brew install k6
npm install -g artillery

# Database testing
brew install postgresql

# Frontend performance
npm install --save-dev flipper react-native-flipper
npm install --save-dev @welldone-software/why-did-you-render
```

### 3. Create Test User Accounts

```sql
-- Create test users for load testing
INSERT INTO users (email, role, school_code)
SELECT
  'test_student_' || i || '@test.com',
  'student',
  'TEST001'
FROM generate_series(1, 1000) AS i;

-- Create test teachers
INSERT INTO users (email, role, school_code)
SELECT
  'test_teacher_' || i || '@test.com',
  'teacher',
  'TEST001'
FROM generate_series(1, 50) AS i;
```

### 4. Prepare Test Data

```sql
-- Create test classes
INSERT INTO class_instances (...)
VALUES (...);

-- Create test students
INSERT INTO student (...)
VALUES (...);

-- Create test attendance records
INSERT INTO attendance (...)
SELECT ... FROM generate_series(...);
```

### 5. Create Environment Config

```bash
# tests/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
TEST_EMAIL=test@example.com
TEST_PASSWORD=password123
```

---

## Running Tests

### Complete Test Suite

```bash
#!/bin/bash
# tests/run-all-tests.sh

echo "Starting ClassBridge Performance Test Suite"
echo "============================================="

# Load environment
source tests/.env

# 1. Frontend Performance
echo "\n1. Running Frontend Performance Tests..."
npm run test:performance

# 2. Basic Load Test
echo "\n2. Running Basic Load Test (100 users)..."
k6 run tests/load/k6/basic-load.js

# 3. Stress Test
echo "\n3. Running Stress Test (1000 users)..."
k6 run tests/load/k6/stress-test.js

# 4. Spike Test
echo "\n4. Running Spike Test..."
k6 run tests/load/k6/spike-test.js

# 5. Database Performance
echo "\n5. Running Database Performance Tests..."
psql -h $DB_HOST -U postgres -d postgres -f tests/database/performance-queries.sql

# 6. Generate Report
echo "\n6. Generating Combined Report..."
node tests/generate-report.js

echo "\nAll tests completed!"
echo "Report available at: tests/results/report.html"
```

### Individual Test Runs

```bash
# Frontend only
npm run test:performance

# Backend load test
k6 run tests/load/k6/basic-load.js

# Stress test
k6 run tests/load/k6/stress-test.js

# Database benchmark
pgbench -c 10 -j 2 -t 1000 your-database
```

---

## Interpreting Results

### k6 Output Example

```
     ✓ login successful
     ✓ dashboard loaded
     ✓ response time OK

     checks.........................: 98.50% ✓ 985    ✗ 15
     data_received..................: 45 MB  150 kB/s
     data_sent......................: 12 MB  40 kB/s
     http_req_blocked...............: avg=1.2ms    min=0.5ms   med=1ms     max=150ms   p(90)=2ms     p(95)=3ms
     http_req_connecting............: avg=0.8ms    min=0.3ms   med=0.7ms   max=120ms   p(90)=1.5ms   p(95)=2ms
     ✓ http_req_duration............: avg=245ms    min=50ms    med=220ms   max=1.2s    p(90)=450ms   p(95)=650ms
     http_req_failed................: 1.50%  ✗ 15     ✓ 985
     http_req_receiving.............: avg=2ms      min=0.5ms   med=1.8ms   max=50ms    p(90)=3ms     p(95)=4ms
     http_req_sending...............: avg=0.5ms    min=0.1ms   med=0.4ms   max=10ms    p(90)=1ms     p(95)=1.5ms
     http_req_tls_handshaking.......: avg=0ms      min=0ms     med=0ms     max=0ms     p(90)=0ms     p(95)=0ms
     http_req_waiting...............: avg=242ms    min=48ms    med=218ms   max=1.1s    p(90)=445ms   p(95)=645ms
     http_reqs......................: 1000   33.3/s
     iteration_duration.............: avg=3s       min=2.5s    med=3s      max=5s      p(90)=3.5s    p(95)=4s
     iterations.....................: 1000   33.3/s
     vus............................: 100    min=100  max=100
     vus_max........................: 100    min=100  max=100
```

### What to Look For

#### ✅ Good Signs
- **http_req_duration p(95) < 500ms**: 95% of requests fast
- **http_req_failed < 1%**: Low error rate
- **checks > 95%**: Most validations passing
- **Stable metrics**: No degradation over time

#### ⚠️ Warning Signs
- **http_req_duration increasing**: Performance degrading
- **http_req_failed > 5%**: High error rate
- **Checks dropping**: Failures increasing
- **Memory increasing**: Potential leak

#### ❌ Critical Issues
- **http_req_failed > 10%**: System failing
- **http_req_duration > 2s**: Unacceptable slowness
- **Test crashes**: Load too high
- **Database errors**: Connection pool exhausted

---

## Optimization Strategies

### Frontend Optimizations

#### 1. Reduce Re-renders
```typescript
// Use React.memo for expensive components
export const StudentCard = React.memo(({ student }) => {
  return <View>...</View>;
});

// Use useMemo for expensive calculations
const sortedStudents = useMemo(() => {
  return students.sort((a, b) => a.name.localeCompare(b.name));
}, [students]);

// Use useCallback for event handlers
const handlePress = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

#### 2. Optimize Lists
```typescript
// Use FlatList with optimization props
<FlatList
  data={students}
  renderItem={renderStudent}
  keyExtractor={(item) => item.id}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  initialNumToRender={10}
  windowSize={5}
  removeClippedSubviews={true}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

#### 3. Lazy Load Images
```typescript
import { Image } from 'expo-image';

<Image
  source={{ uri: student.photo_url }}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
/>
```

#### 4. Code Splitting
```typescript
// Lazy load screens
const AttendanceScreen = lazy(() => import('./AttendanceScreen'));

// Use Suspense
<Suspense fallback={<LoadingSpinner />}>
  <AttendanceScreen />
</Suspense>
```

### Backend Optimizations

#### 1. Add Database Indexes
```sql
-- Attendance lookups
CREATE INDEX idx_attendance_class_date ON attendance(class_instance_id, date);
CREATE INDEX idx_attendance_student ON attendance(student_id, date DESC);

-- Student searches
CREATE INDEX idx_student_school_class ON student(school_code, class_instance_id);
CREATE INDEX idx_student_name ON student USING gin(full_name gin_trgm_ops);

-- Test lookups
CREATE INDEX idx_test_attempts_student ON test_attempts(student_id, test_id);
```

#### 2. Optimize Queries
```typescript
// Bad: N+1 queries
const students = await supabase.from('student').select('*');
for (const student of students) {
  const attendance = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', student.id);
}

// Good: Single query with join
const students = await supabase
  .from('student')
  .select(`
    *,
    attendance (*)
  `)
  .eq('class_instance_id', classId);
```

#### 3. Use Pagination
```typescript
// Add pagination to large lists
const { data, count } = await supabase
  .from('students')
  .select('*', { count: 'exact' })
  .range(0, 49); // First 50 items

// Infinite scroll
const { data } = await supabase
  .from('students')
  .select('*')
  .range(offset, offset + pageSize - 1);
```

#### 4. Implement Caching
```typescript
// React Query with longer staleTime
export function useStudents() {
  return useQuery({
    queryKey: ['students'],
    queryFn: fetchStudents,
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
}
```

### Database Optimizations

#### 1. Connection Pooling
```typescript
// Configure Supabase client
const supabase = createClient(url, key, {
  db: {
    pool: {
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
    },
  },
});
```

#### 2. Use Database Functions
```sql
-- Complex operation as database function
CREATE OR REPLACE FUNCTION get_student_dashboard(student_uuid UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'pending_tasks', (SELECT COUNT(*) FROM tasks WHERE student_id = student_uuid AND status = 'pending'),
    'attendance_percentage', (SELECT AVG(CASE WHEN status = 'present' THEN 100 ELSE 0 END) FROM attendance WHERE student_id = student_uuid),
    'latest_grades', (SELECT json_agg(test_marks) FROM test_marks WHERE student_id = student_uuid ORDER BY created_at DESC LIMIT 5)
  );
$$ LANGUAGE sql STABLE;

-- Call from app
const { data } = await supabase.rpc('get_student_dashboard', { student_uuid: userId });
```

#### 3. Materialized Views
```sql
-- Pre-computed attendance statistics
CREATE MATERIALIZED VIEW attendance_stats AS
SELECT
  class_instance_id,
  date,
  COUNT(*) as total_students,
  SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
  ROUND(100.0 * SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*), 2) as percentage
FROM attendance
GROUP BY class_instance_id, date;

-- Refresh periodically
REFRESH MATERIALIZED VIEW attendance_stats;
```

---

## Monitoring in Production

### 1. Supabase Dashboard
- Query performance
- Database CPU/memory
- API request logs
- Error rates

### 2. Application Monitoring

```typescript
// src/lib/monitoring.ts

export class AppMonitoring {
  static logPerformance(metric: string, value: number) {
    // Send to analytics service
    console.log(`[METRIC] ${metric}: ${value}`);

    // Optional: Send to Sentry, Firebase, etc.
    // analytics.logEvent('performance', { metric, value });
  }

  static logError(error: Error, context?: any) {
    console.error('[ERROR]', error, context);

    // Send to error tracking
    // Sentry.captureException(error, { extra: context });
  }
}
```

### 3. Set Up Alerts

- API response time > 1s
- Error rate > 5%
- Database connections > 80%
- Failed requests spike

---

## Checklist Before Launch

- [ ] Frontend startup time < 2s
- [ ] All screens render < 500ms
- [ ] 60 FPS during scrolling
- [ ] No memory leaks detected
- [ ] API response time p(95) < 500ms
- [ ] System handles 500 concurrent users
- [ ] Error rate < 1%
- [ ] Database queries < 200ms
- [ ] Indexes on all foreign keys
- [ ] Slow query logging enabled
- [ ] Load test passed (30 min sustained)
- [ ] Stress test passed (breaking point known)
- [ ] Spike test passed (handles sudden traffic)
- [ ] Monitoring dashboards set up
- [ ] Alerts configured

---

## Next Steps

1. **Set up test environment** with production-like data
2. **Run baseline tests** to establish current performance
3. **Identify bottlenecks** from test results
4. **Implement optimizations** (indexes, caching, etc.)
5. **Re-test** to verify improvements
6. **Document results** and share with team
7. **Set up continuous monitoring** in production
8. **Schedule regular performance tests** (monthly)

---

**Ready to start testing?** Let me know which test you'd like to set up first!
