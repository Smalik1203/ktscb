#!/usr/bin/env node

/**
 * Extreme Load Test for ClassBridge
 * Tests: 1000 concurrent users for 5 minutes
 */

const https = require('https');

// Configuration
const SUPABASE_URL = 'https://mvvzqouqxrtyzuzqbeud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12dnpxb3VxeHJ0eXp1enFiZXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NDUxNjEsImV4cCI6MjA2ODQyMTE2MX0.pdo_JBuGQP1aRlMLLMoST7xSD89PH2uB6bhzKiJTfu0';

const CONCURRENT_USERS = 1000;
const TEST_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const RAMP_UP_TIME_MS = 30 * 1000; // 30 seconds to reach 1000 users

// Metrics
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: {},
  startTime: null,
  endTime: null,
};

// Test scenarios (realistic ClassBridge usage)
const scenarios = [
  {
    name: 'Dashboard Load',
    endpoint: '/rest/v1/student?select=*&limit=10',
    weight: 30, // 30% of traffic
  },
  {
    name: 'Attendance Check',
    endpoint: '/rest/v1/attendance?select=*&limit=50',
    weight: 25,
  },
  {
    name: 'Timetable View',
    endpoint: '/rest/v1/timetable_slots?select=*&limit=20',
    weight: 20,
  },
  {
    name: 'Test Results',
    endpoint: '/rest/v1/test_attempts?select=*,test:tests(name)&limit=10',
    weight: 15,
  },
  {
    name: 'Tasks List',
    endpoint: '/rest/v1/tasks?select=*&limit=20',
    weight: 10,
  },
];

// Make HTTP request
function makeRequest(scenario) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const options = {
      hostname: 'mvvzqouqxrtyzuzqbeud.supabase.co',
      path: scenario.endpoint,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        metrics.totalRequests++;

        if (res.statusCode === 200) {
          metrics.successfulRequests++;
          metrics.responseTimes.push(responseTime);
        } else {
          metrics.failedRequests++;
          const errorKey = `HTTP ${res.statusCode}`;
          metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;
        }

        resolve({
          success: res.statusCode === 200,
          responseTime,
          statusCode: res.statusCode,
        });
      });
    });

    req.on('error', (error) => {
      metrics.totalRequests++;
      metrics.failedRequests++;
      const errorKey = error.code || 'UNKNOWN_ERROR';
      metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;

      resolve({
        success: false,
        error: error.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.errors['TIMEOUT'] = (metrics.errors['TIMEOUT'] || 0) + 1;

      resolve({
        success: false,
        error: 'Request timeout',
      });
    });

    req.end();
  });
}

// Select scenario based on weight
function selectScenario() {
  const rand = Math.random() * 100;
  let cumulative = 0;

  for (const scenario of scenarios) {
    cumulative += scenario.weight;
    if (rand <= cumulative) {
      return scenario;
    }
  }

  return scenarios[0];
}

// Simulate single user
async function simulateUser(userId, testEndTime) {
  while (Date.now() < testEndTime) {
    const scenario = selectScenario();
    await makeRequest(scenario);

    // Random delay between 1-3 seconds (realistic user behavior)
    const delay = Math.random() * 2000 + 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Calculate statistics
function calculateStats() {
  const sortedTimes = metrics.responseTimes.sort((a, b) => a - b);
  const len = sortedTimes.length;

  if (len === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      p95: 0,
      p99: 0,
    };
  }

  return {
    min: sortedTimes[0],
    max: sortedTimes[len - 1],
    avg: Math.round(sortedTimes.reduce((a, b) => a + b, 0) / len),
    median: sortedTimes[Math.floor(len / 2)],
    p95: sortedTimes[Math.floor(len * 0.95)],
    p99: sortedTimes[Math.floor(len * 0.99)],
  };
}

// Print progress
function printProgress() {
  const elapsed = Date.now() - metrics.startTime;
  const stats = calculateStats();
  const successRate = metrics.totalRequests > 0
    ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
    : 0;
  const rps = Math.round(metrics.totalRequests / (elapsed / 1000));

  console.clear();
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     CLASSBRIDGE EXTREME LOAD TEST - LIVE RESULTS      ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║ Target: 1000 concurrent users | Duration: 5 minutes    ║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║ Elapsed Time:        ${formatTime(elapsed).padEnd(30)}║`);
  console.log(`║ Total Requests:      ${metrics.totalRequests.toString().padEnd(30)}║`);
  console.log(`║ Successful:          ${metrics.successfulRequests.toString().padEnd(30)}║`);
  console.log(`║ Failed:              ${metrics.failedRequests.toString().padEnd(30)}║`);
  console.log(`║ Success Rate:        ${successRate}%${' '.repeat(30 - successRate.length - 1)}║`);
  console.log(`║ Requests/sec:        ${rps.toString().padEnd(30)}║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║                   RESPONSE TIMES (ms)                  ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║ Min:                 ${stats.min.toString().padEnd(30)}║`);
  console.log(`║ Max:                 ${stats.max.toString().padEnd(30)}║`);
  console.log(`║ Average:             ${stats.avg.toString().padEnd(30)}║`);
  console.log(`║ Median:              ${stats.median.toString().padEnd(30)}║`);
  console.log(`║ 95th Percentile:     ${stats.p95.toString().padEnd(30)}║`);
  console.log(`║ 99th Percentile:     ${stats.p99.toString().padEnd(30)}║`);

  if (Object.keys(metrics.errors).length > 0) {
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║                       ERRORS                           ║');
    console.log('╠════════════════════════════════════════════════════════╣');

    Object.entries(metrics.errors).forEach(([error, count]) => {
      const line = `${error}: ${count}`;
      console.log(`║ ${line.padEnd(54)}║`);
    });
  }

  console.log('╚════════════════════════════════════════════════════════╝');

  // Performance assessment
  if (stats.p95 < 500 && successRate > 99) {
    console.log('✅ EXCELLENT: Response times under 500ms, >99% success rate');
  } else if (stats.p95 < 1000 && successRate > 95) {
    console.log('⚠️  GOOD: Acceptable performance, minor optimizations needed');
  } else if (stats.p95 < 2000 && successRate > 90) {
    console.log('⚠️  WARNING: Performance degrading, optimization required');
  } else {
    console.log('❌ CRITICAL: System struggling under load, immediate action needed');
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Main test runner
async function runLoadTest() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║        STARTING EXTREME LOAD TEST                     ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║ Configuration:                                         ║`);
  console.log(`║   • Target Users: 1000                                 ║`);
  console.log(`║   • Ramp-up Time: 30 seconds                           ║`);
  console.log(`║   • Peak Duration: 5 minutes                           ║`);
  console.log(`║   • Environment: Production                            ║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║ ⚠️  WARNING: This will generate heavy load on your DB  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('Starting in 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  metrics.startTime = Date.now();
  const testEndTime = metrics.startTime + TEST_DURATION_MS;

  // Start progress updates
  const progressInterval = setInterval(printProgress, 1000);

  // Spawn users gradually (ramp-up)
  const usersPerInterval = CONCURRENT_USERS / (RAMP_UP_TIME_MS / 100);
  const users = [];

  for (let i = 0; i < CONCURRENT_USERS; i++) {
    users.push(simulateUser(i, testEndTime));

    if (i % Math.ceil(usersPerInterval) === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n🚀 All ${CONCURRENT_USERS} users spawned! Test running...\n`);

  // Wait for all users to complete
  await Promise.all(users);

  clearInterval(progressInterval);
  metrics.endTime = Date.now();

  // Final report
  printProgress();

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                   TEST COMPLETED                       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Save results to file
  const results = {
    testConfig: {
      concurrentUsers: CONCURRENT_USERS,
      duration: TEST_DURATION_MS / 1000,
      rampUpTime: RAMP_UP_TIME_MS / 1000,
    },
    metrics: {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      successRate: ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + '%',
      requestsPerSecond: Math.round(metrics.totalRequests / ((metrics.endTime - metrics.startTime) / 1000)),
    },
    responseTimes: calculateStats(),
    errors: metrics.errors,
    timestamp: new Date().toISOString(),
  };

  const fs = require('fs');
  const filename = `load-test-results-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));

  console.log(`📄 Results saved to: ${filename}\n`);
}

// Run the test
runLoadTest().catch(console.error);
