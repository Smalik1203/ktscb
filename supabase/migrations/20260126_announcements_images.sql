-- Add image support to announcements table
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add index for faster image queries (optional, for future filtering)
CREATE INDEX IF NOT EXISTS idx_announcements_has_image 
ON announcements(school_code, created_at DESC) 
WHERE image_url IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN announcements.image_url IS 'URL to announcement image stored in Supabase Storage';
