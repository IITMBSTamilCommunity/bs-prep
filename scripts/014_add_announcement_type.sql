-- Add announcement type/category field for filtering and organization
ALTER TABLE IF EXISTS public.announcements
  ADD COLUMN IF NOT EXISTS announcement_type TEXT DEFAULT 'General' CHECK (announcement_type IN ('Live Classes', 'YouTube Videos', 'Announcements', 'General'));

CREATE INDEX IF NOT EXISTS idx_announcements_type ON public.announcements(announcement_type);

-- This allows filtering announcements by type for better user experience

