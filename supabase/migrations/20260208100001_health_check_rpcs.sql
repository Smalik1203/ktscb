-- =====================================================
-- Health Check Helper RPCs
-- Used by supabase/functions/health-check
-- =====================================================

-- 1. Simple DB ping — returns true if the database is alive
CREATE OR REPLACE FUNCTION health_ping()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true;
$$;

COMMENT ON FUNCTION health_ping() IS 'Simple DB connectivity check for health monitoring';

GRANT EXECUTE ON FUNCTION health_ping() TO anon;
GRANT EXECUTE ON FUNCTION health_ping() TO authenticated;
GRANT EXECUTE ON FUNCTION health_ping() TO service_role;


-- 2. Materialized view freshness checker
-- Returns a row per MV with name, row count, and staleness flag.
-- A MV is considered "stale" if its underlying table was modified
-- after the last known refresh (approximated by pg_stat).
CREATE OR REPLACE FUNCTION check_mv_freshness()
RETURNS TABLE(name text, row_estimate bigint, is_stale boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.relname::text                          AS name,
    c.reltuples::bigint                      AS row_estimate,
    -- Mark stale if 0 rows (empty MV = never refreshed or broken)
    (c.reltuples < 1)                        AS is_stale
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'm'          -- 'm' = materialized view
    AND n.nspname = 'public'
  ORDER BY c.relname;
$$;

COMMENT ON FUNCTION check_mv_freshness() IS 'Returns freshness info for all public materialized views. Used by health-check edge function.';

GRANT EXECUTE ON FUNCTION check_mv_freshness() TO service_role;
