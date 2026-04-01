-- Add new columns to user_profiles_extended table
ALTER TABLE user_profiles_extended
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS projects TEXT,
ADD COLUMN IF NOT EXISTS experiences TEXT,
ADD COLUMN IF NOT EXISTS educations TEXT;

-- Create unique index on username (if username is provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_extended_username ON user_profiles_extended(username) WHERE username IS NOT NULL;

