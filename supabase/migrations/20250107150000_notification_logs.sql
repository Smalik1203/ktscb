-- Create notification_logs table
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Target user
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL, -- 'sent', 'failed', 'skipped'
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);

-- Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admins can view all logs
CREATE POLICY "Admins can view all notification logs" ON notification_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'superadmin')
        )
    );

-- Users can view their own logs
CREATE POLICY "Users can view own notification logs" ON notification_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert logs (for Edge Functions)
-- No INSERT policy needed for users as only system sends notifications
