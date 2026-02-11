-- =====================================================
-- Schedule analytics MV refresh (every 5 minutes)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'refresh-analytics-mvs',
  '*/5 * * * *',
  $$SELECT refresh_analytics_materialized_views();$$
);

