-- Create login_attempts table for tracking and rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  success BOOLEAN DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Indexes for fast lookups in rate limiting
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created ON login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created ON login_attempts(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at DESC);

-- Auto-cleanup: Delete attempts older than 30 days (optional, adjust based on use case)
-- You can manually run: DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '30 days';

-- Enable RLS (optional, since this is internal tracking)
ALTER TABLE IF EXISTS login_attempts ENABLE ROW LEVEL SECURITY;

-- Block all public access - only service role can insert
DROP POLICY IF EXISTS "No direct access to login attempts" ON login_attempts;
CREATE POLICY "No direct access to login attempts"
  ON login_attempts
  FOR ALL
  USING (false);
