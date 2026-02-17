-- ============================================================================
-- Realtime Transport: latest_bus_positions + updated RPCs + archival
-- ============================================================================

-- ==========================================================================
-- 1. LATEST_BUS_POSITIONS TABLE
-- One row per driver, upserted by the Edge Function on each GPS update.
-- Replaces the expensive LATERAL JOIN on gps_logs for live queries.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS latest_bus_positions (
  driver_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  school_code TEXT NOT NULL,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: school-level lookups (used by get_live_bus_positions RPC)
CREATE INDEX idx_lbp_school ON latest_bus_positions(school_code);

-- Enable RLS
ALTER TABLE latest_bus_positions ENABLE ROW LEVEL SECURITY;

-- Drivers can read their own row
CREATE POLICY "Drivers can read own latest position"
  ON latest_bus_positions FOR SELECT
  USING (driver_id = auth.uid());

-- Admins can read all latest positions for their school
CREATE POLICY "Admins can read school latest positions"
  ON latest_bus_positions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('superadmin', 'cb_admin', 'admin')
        AND users.school_code = latest_bus_positions.school_code
    )
  );

-- No INSERT/UPDATE/DELETE policies — Edge Function uses service role.

-- Auto-update updated_at on UPSERT
CREATE OR REPLACE FUNCTION update_lbp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lbp_updated_at
  BEFORE INSERT OR UPDATE ON latest_bus_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_lbp_updated_at();

-- ==========================================================================
-- 2. SEED FROM EXISTING DATA
-- Populate latest_bus_positions from gps_logs for any currently active trips
-- so the table isn't empty after migration.
-- ==========================================================================

INSERT INTO latest_bus_positions (driver_id, school_code, trip_id, lat, lng, speed, heading, recorded_at)
SELECT DISTINCT ON (gl.driver_id)
  gl.driver_id,
  gl.school_code,
  gl.trip_id,
  gl.lat,
  gl.lng,
  gl.speed,
  gl.heading,
  gl.recorded_at
FROM gps_logs gl
JOIN trips t ON t.driver_id = gl.driver_id AND t.status = 'active'
ORDER BY gl.driver_id, gl.recorded_at DESC
ON CONFLICT (driver_id) DO NOTHING;

-- ==========================================================================
-- 3. UPDATED RPCs — read from latest_bus_positions instead of gps_logs
-- ==========================================================================

-- Replace get_live_bus_positions: O(1) per driver via latest_bus_positions
CREATE OR REPLACE FUNCTION get_live_bus_positions(p_school_code TEXT)
RETURNS TABLE(
  trip_id TEXT,
  driver_id UUID,
  bus_id UUID,
  bus_number TEXT,
  plate_number TEXT,
  driver_name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  pickup_count INTEGER,
  total_students INTEGER
)
LANGUAGE sql STABLE
AS $$
  SELECT
    t.id AS trip_id,
    t.driver_id,
    d.bus_id,
    b.bus_number,
    b.plate_number,
    u.full_name AS driver_name,
    lbp.lat,
    lbp.lng,
    lbp.speed,
    lbp.heading,
    lbp.recorded_at,
    t.started_at,
    COALESCE((SELECT count(*)::int FROM trip_pickups tp WHERE tp.trip_id = t.id), 0) AS pickup_count,
    COALESCE((SELECT count(*)::int FROM student_bus_assignments sba WHERE sba.bus_id = d.bus_id), 0) AS total_students
  FROM trips t
  JOIN drivers d ON d.id = t.driver_id
  JOIN buses b ON b.id = d.bus_id
  JOIN users u ON u.id = t.driver_id
  LEFT JOIN latest_bus_positions lbp ON lbp.driver_id = t.driver_id
  WHERE t.status = 'active'
    AND t.school_code = p_school_code
  ORDER BY t.driver_id;
$$;

-- Drop get_my_bus_status first: return type changed (added driver_id column)
DROP FUNCTION IF EXISTS get_my_bus_status(UUID);

-- Recreate get_my_bus_status: uses latest_bus_positions + adds driver_id to return
CREATE FUNCTION get_my_bus_status(p_auth_user_id UUID)
RETURNS TABLE(
  bus_id UUID,
  bus_number TEXT,
  plate_number TEXT,
  driver_name TEXT,
  driver_id UUID,
  trip_id TEXT,
  trip_active BOOLEAN,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ,
  pickup_count INTEGER,
  total_students INTEGER,
  am_i_picked_up BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    b.id AS bus_id,
    b.bus_number,
    b.plate_number,
    u.full_name AS driver_name,
    d.id AS driver_id,
    t.id AS trip_id,
    (t.id IS NOT NULL) AS trip_active,
    lbp.lat,
    lbp.lng,
    lbp.speed,
    lbp.heading,
    lbp.recorded_at,
    COALESCE((SELECT count(*)::int FROM trip_pickups tp WHERE tp.trip_id = t.id), 0) AS pickup_count,
    COALESCE((SELECT count(*)::int FROM student_bus_assignments s2 WHERE s2.bus_id = b.id), 0) AS total_students,
    EXISTS(
      SELECT 1 FROM trip_pickups tp2
      JOIN student st2 ON st2.id = tp2.student_id
      WHERE tp2.trip_id = t.id AND st2.auth_user_id = p_auth_user_id
    ) AS am_i_picked_up
  FROM student s
  JOIN student_bus_assignments sba ON sba.student_id = s.id
  JOIN buses b ON b.id = sba.bus_id
  JOIN drivers d ON d.bus_id = b.id AND d.is_active = true
  JOIN users u ON u.id = d.id
  LEFT JOIN trips t ON t.driver_id = d.id AND t.status = 'active'
  LEFT JOIN latest_bus_positions lbp ON lbp.driver_id = d.id
  WHERE s.auth_user_id = p_auth_user_id
  LIMIT 1;
$$;

-- ==========================================================================
-- 4. GPS LOGS ARCHIVAL FUNCTION
-- Deletes gps_logs older than p_retention_days (default 30).
-- Call via pg_cron or manually: SELECT archive_old_gps_logs();
-- ==========================================================================

CREATE OR REPLACE FUNCTION archive_old_gps_logs(p_retention_days INT DEFAULT 30)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM gps_logs
  WHERE recorded_at < NOW() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
