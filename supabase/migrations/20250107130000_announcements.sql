-- Create announcements table for Twitter-style feed
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  
  -- Targeting
  target_type TEXT CHECK (target_type IN ('all', 'class', 'role')) DEFAULT 'all',
  class_instance_id UUID REFERENCES class_instances(id) ON DELETE CASCADE,
  target_role TEXT,
  
  -- Metadata
  school_code TEXT NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional features
  pinned BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX idx_announcements_school ON announcements(school_code, created_at DESC);
CREATE INDEX idx_announcements_class ON announcements(class_instance_id, created_at DESC);
CREATE INDEX idx_announcements_pinned ON announcements(pinned, created_at DESC) WHERE pinned = true;

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Everyone can view announcements for their school
CREATE POLICY "Users can view school announcements"
  ON announcements FOR SELECT
  USING (
    school_code = (SELECT school_code FROM users WHERE id = auth.uid())
  );

-- Only admins/superadmins can create announcements
CREATE POLICY "Admins can create announcements"
  ON announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND school_code = announcements.school_code
      AND role IN ('admin', 'superadmin')
    )
  );

-- Only creator can update their own announcements
CREATE POLICY "Creators can update own announcements"
  ON announcements FOR UPDATE
  USING (created_by = auth.uid());

-- Only creator can delete their own announcements
CREATE POLICY "Creators can delete own announcements"
  ON announcements FOR DELETE
  USING (created_by = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();
