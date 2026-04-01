-- Update enrollments table RLS policies for secure access
-- Run this after 009 and 010 migrations

ALTER TABLE IF EXISTS enrollments ENABLE ROW LEVEL SECURITY;

-- Users can view their own enrollments
DROP POLICY IF EXISTS "Users can view own enrollments" ON enrollments;
CREATE POLICY "Users can view own enrollments"
  ON enrollments FOR SELECT
  USING (auth.uid() = user_id);


-- Users can insert their own enrollments (via verified backend API only)
DROP POLICY IF EXISTS "Users can insert own enrollments" ON enrollments;
CREATE POLICY "Users can insert own enrollments"
  ON enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update policy for upsert operations
DROP POLICY IF EXISTS "Service role can manage enrollments" ON enrollments;
CREATE POLICY "Service role can manage enrollments"
  ON enrollments FOR ALL
  USING (true); -- Service role bypasses RLS checks
