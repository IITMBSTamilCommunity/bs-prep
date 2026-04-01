-- =====================================================
-- SECURITY POLICIES FOR SUPABASE
-- =====================================================
-- This file contains Row Level Security (RLS) policies
-- Run these in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE IF EXISTS user_profiles_extended ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS course_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS week_videos ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- USER PROFILES POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles_extended;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles_extended;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles_extended;
DROP POLICY IF EXISTS "Public profiles viewable by all" ON user_profiles_extended;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles_extended
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles_extended
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles_extended
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Public profiles are viewable (for leaderboard, etc.)
CREATE POLICY "Public profiles viewable by all"
  ON user_profiles_extended
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- ENROLLMENTS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Users can create own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Users can delete own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admins can view all enrollments" ON enrollments;

-- Users can view their own enrollments
CREATE POLICY "Users can view own enrollments"
  ON enrollments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own enrollments
CREATE POLICY "Users can create own enrollments"
  ON enrollments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own enrollments
CREATE POLICY "Users can delete own enrollments"
  ON enrollments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all enrollments
CREATE POLICY "Admins can view all enrollments"
  ON enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- COURSES POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view courses" ON courses;
DROP POLICY IF EXISTS "Admins can manage courses" ON courses;

-- Anyone (including anonymous) can view courses
CREATE POLICY "Anyone can view courses"
  ON courses
  FOR SELECT
  TO public
  USING (true);

-- Only admins can create, update, delete courses
CREATE POLICY "Admins can manage courses"
  ON courses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- COURSE WEEKS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view course weeks" ON course_weeks;
DROP POLICY IF EXISTS "Admins can manage course weeks" ON course_weeks;

-- Anyone can view course weeks
CREATE POLICY "Anyone can view course weeks"
  ON course_weeks
  FOR SELECT
  TO public
  USING (true);

-- Only admins can manage course weeks
CREATE POLICY "Admins can manage course weeks"
  ON course_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- WEEK VIDEOS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view videos" ON week_videos;
DROP POLICY IF EXISTS "Admins can manage videos" ON week_videos;

-- Anyone can view videos
CREATE POLICY "Anyone can view videos"
  ON week_videos
  FOR SELECT
  TO public
  USING (true);

-- Only admins can manage videos
CREATE POLICY "Admins can manage videos"
  ON week_videos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- ANNOUNCEMENTS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can create announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON announcements;

-- Anyone (including anonymous) can view announcements
CREATE POLICY "Anyone can view announcements"
  ON announcements
  FOR SELECT
  TO public
  USING (true);

-- Only admins can create announcements
CREATE POLICY "Admins can create announcements"
  ON announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update announcements
CREATE POLICY "Admins can update announcements"
  ON announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete announcements
CREATE POLICY "Admins can delete announcements"
  ON announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- STORAGE BUCKET POLICIES
-- =====================================================

-- Profile pictures bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can view avatars
CREATE POLICY "Anyone can view avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- =====================================================
-- FUNCTIONS FOR ADDITIONAL SECURITY
-- =====================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles_extended
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns a resource
CREATE OR REPLACE FUNCTION owns_resource(resource_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() = resource_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- AUDIT LOG TABLE (OPTIONAL)
-- =====================================================

-- Create audit log table for tracking important actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles_extended
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes on foreign keys and frequently queried columns
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles_extended(role);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at DESC);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON courses TO authenticated;
GRANT SELECT ON course_weeks TO authenticated;
GRANT SELECT ON week_videos TO authenticated;
GRANT SELECT ON announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_profiles_extended TO authenticated;
GRANT SELECT, INSERT, DELETE ON enrollments TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these to verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public';

-- View all policies
-- SELECT * FROM pg_policies WHERE schemaname = 'public';
