-- Optional: Notification events registry for kill-switch capability
-- Allows enabling/disabling notification events without app update

CREATE TABLE IF NOT EXISTS notification_events (
  event TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- Only service role can manage (Edge Functions only)
-- No policies for regular users = no access from client

-- Seed with initial events
INSERT INTO notification_events (event) VALUES
  ('attendance_marked'),
  ('task_assigned'),
  ('fee_updated'),
  ('assessment_scheduled'),
  ('announcement_posted')
ON CONFLICT (event) DO NOTHING;
