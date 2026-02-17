-- ============================================================================
-- Transport Management System — Database Schema
-- Creates: drivers, trips, gps_logs
-- ============================================================================

-- ==========================================================================
-- 1. DRIVERS TABLE
-- Extends the users table with driver-specific data (bus, license, etc.)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  school_code TEXT NOT NULL,
  bus_number TEXT,                     -- e.g. "BUS-001"
  license_number TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: school-level lookups
CREATE INDEX idx_drivers_school ON drivers(school_code) WHERE is_active = true;

-- Enable RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Drivers can read their own row
CREATE POLICY "Drivers can read own profile"
  ON drivers FOR SELECT
  USING (id = auth.uid());

-- Drivers can update their own row (phone, etc.)
CREATE POLICY "Drivers can update own profile"
  ON drivers FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Super Admins / Admins can read all drivers in their school
CREATE POLICY "Admins can read school drivers"
  ON drivers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('superadmin', 'cb_admin', 'admin')
        AND users.school_code = drivers.school_code
    )
  );

-- Admins can insert/update/delete drivers for their school
CREATE POLICY "Admins can manage school drivers"
  ON drivers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('superadmin', 'cb_admin', 'admin')
        AND users.school_code = drivers.school_code
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('superadmin', 'cb_admin', 'admin')
        AND users.school_code = drivers.school_code
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_drivers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_drivers_updated_at();

-- ==========================================================================
-- 2. TRIPS TABLE
-- Records start/stop lifecycle for each driver trip.
-- The id is generated client-side (format: trip_<ts>_<rand>).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,                          -- client-generated trip ID
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_code TEXT NOT NULL,

  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,                         -- NULL while trip is active
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: driver's trip history (most recent first)
CREATE INDEX idx_trips_driver ON trips(driver_id, created_at DESC);

-- Index: school-level queries by status
CREATE INDEX idx_trips_school_status ON trips(school_code, status);

-- Index: find active trips quickly
CREATE INDEX idx_trips_active ON trips(driver_id) WHERE status = 'active';

-- Enable RLS
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own trips
CREATE POLICY "Drivers can create own trips"
  ON trips FOR INSERT
  WITH CHECK (driver_id = auth.uid());

-- Drivers can read their own trips
CREATE POLICY "Drivers can read own trips"
  ON trips FOR SELECT
  USING (driver_id = auth.uid());

-- Drivers can update their own active trips (to set ended_at / status)
CREATE POLICY "Drivers can update own active trips"
  ON trips FOR UPDATE
  USING (
    driver_id = auth.uid()
    AND status = 'active'
  )
  WITH CHECK (driver_id = auth.uid());

-- Super Admins / Admins can read all trips for their school
CREATE POLICY "Admins can read school trips"
  ON trips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('superadmin', 'cb_admin', 'admin')
        AND users.school_code = trips.school_code
    )
  );

-- ==========================================================================
-- 3. GPS_LOGS TABLE
-- Raw GPS data points. Inserted by the Edge Function (service role),
-- so no INSERT policy for regular users.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS gps_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,   -- nullable
  school_code TEXT NOT NULL,

  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,

  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: query by driver + time range
CREATE INDEX idx_gps_logs_driver_time ON gps_logs(driver_id, recorded_at DESC);

-- Index: query by trip (for trip replay / history)
CREATE INDEX idx_gps_logs_trip ON gps_logs(trip_id, recorded_at DESC)
  WHERE trip_id IS NOT NULL;

-- Index: school-level analytics
CREATE INDEX idx_gps_logs_school ON gps_logs(school_code, recorded_at DESC);

-- Enable RLS
ALTER TABLE gps_logs ENABLE ROW LEVEL SECURITY;

-- No INSERT policy — the Edge Function uses the service role key.

-- Drivers can read their own GPS logs
CREATE POLICY "Drivers can read own gps logs"
  ON gps_logs FOR SELECT
  USING (driver_id = auth.uid());

-- Super Admins / Admins can read all GPS logs for their school
CREATE POLICY "Admins can read school gps logs"
  ON gps_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('superadmin', 'cb_admin', 'admin')
        AND users.school_code = gps_logs.school_code
    )
  );
