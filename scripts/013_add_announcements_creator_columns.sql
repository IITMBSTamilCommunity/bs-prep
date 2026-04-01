-- Add creator tracking fields for announcements
ALTER TABLE IF EXISTS public.announcements
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.announcements
  ADD COLUMN IF NOT EXISTS created_by_email TEXT;

CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);

-- Backfill creator email where creator id exists
UPDATE public.announcements AS a
SET created_by_email = p.email
FROM public.profiles AS p
WHERE a.created_by = p.id
  AND a.created_by_email IS NULL;

