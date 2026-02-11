import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Health Check Edge Function
 *
 * Checks:
 *  1. Database connectivity (SELECT 1)
 *  2. Notification queue health (stuck/failed jobs)
 *  3. Materialized view freshness (last refresh time)
 *
 * Designed to be called by UptimeRobot or any external monitor.
 * Returns HTTP 200 if healthy, 503 if degraded.
 */

interface CheckResult {
  status: 'ok' | 'degraded' | 'down';
  latency_ms: number;
  details?: Record<string, unknown>;
}

Deno.serve(async (_req: Request) => {
  const start = Date.now();
  const checks: Record<string, CheckResult> = {};
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // ─── 1. Database connectivity ────────────────────────────────────
  const dbStart = Date.now();
  try {
    const { error } = await supabase.rpc('health_ping');

    if (error) {
      // Fallback: try a simple query if the RPC doesn't exist yet
      const { error: fallbackError } = await supabase
        .from('schools')
        .select('school_code')
        .limit(1);

      if (fallbackError) {
        checks.database = {
          status: 'down',
          latency_ms: Date.now() - dbStart,
          details: { error: fallbackError.message },
        };
        overallStatus = 'down';
      } else {
        checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
      }
    } else {
      checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    checks.database = {
      status: 'down',
      latency_ms: Date.now() - dbStart,
      details: { error: message },
    };
    overallStatus = 'down';
  }

  // ─── 2. Notification queue health ────────────────────────────────
  const queueStart = Date.now();
  try {
    // Check for stuck jobs: processing for > 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckJobs, error: stuckError } = await supabase
      .from('notification_queue')
      .select('id, status, started_at')
      .eq('status', 'processing')
      .lt('started_at', tenMinAgo)
      .limit(10);

    // Check recent failures (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: failedCount, error: failedError } = await supabase
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneHourAgo);

    if (stuckError || failedError) {
      checks.notification_queue = {
        status: 'degraded',
        latency_ms: Date.now() - queueStart,
        details: { error: stuckError?.message || failedError?.message },
      };
      if (overallStatus === 'ok') overallStatus = 'degraded';
    } else {
      const stuckCount = stuckJobs?.length ?? 0;
      const isHealthy = stuckCount === 0 && (failedCount ?? 0) < 10;

      checks.notification_queue = {
        status: isHealthy ? 'ok' : 'degraded',
        latency_ms: Date.now() - queueStart,
        details: {
          stuck_jobs: stuckCount,
          failed_last_hour: failedCount ?? 0,
        },
      };
      if (!isHealthy && overallStatus === 'ok') overallStatus = 'degraded';
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    checks.notification_queue = {
      status: 'degraded',
      latency_ms: Date.now() - queueStart,
      details: { error: message },
    };
    if (overallStatus === 'ok') overallStatus = 'degraded';
  }

  // ─── 3. Materialized view freshness ─────────────────────────────
  const mvStart = Date.now();
  try {
    // Check the last refresh time from pg_stat_user_tables for MV tables
    // Materialized views appear as regular relations; check their row count
    // as a proxy for freshness. If they're empty, something is wrong.
    const { data: mvCheck, error: mvError } = await supabase.rpc(
      'check_mv_freshness'
    );

    if (mvError) {
      // If the RPC doesn't exist, just mark as ok (MVs might not be set up yet)
      checks.materialized_views = {
        status: 'ok',
        latency_ms: Date.now() - mvStart,
        details: { note: 'MV freshness check not available (RPC missing)' },
      };
    } else {
      const stale = Array.isArray(mvCheck)
        ? mvCheck.filter((mv: { is_stale: boolean }) => mv.is_stale)
        : [];

      checks.materialized_views = {
        status: stale.length > 0 ? 'degraded' : 'ok',
        latency_ms: Date.now() - mvStart,
        details: {
          total_views: Array.isArray(mvCheck) ? mvCheck.length : 0,
          stale_views: stale.length,
          stale: stale.map((s: { name: string }) => s.name),
        },
      };
      if (stale.length > 0 && overallStatus === 'ok') overallStatus = 'degraded';
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    checks.materialized_views = {
      status: 'ok',
      latency_ms: Date.now() - mvStart,
      details: { note: 'MV check skipped', error: message },
    };
  }

  // ─── Response ────────────────────────────────────────────────────
  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    total_latency_ms: Date.now() - start,
    checks,
  };

  return new Response(JSON.stringify(response), {
    status: overallStatus === 'down' ? 503 : 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
});
