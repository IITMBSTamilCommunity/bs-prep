-- Donations table and storage for BSPREP support page

CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  upi_reference_id TEXT NOT NULL,
  contributor_image_url TEXT,
  note TEXT,
  show_public BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'deleted')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'donations_status_check'
      AND conrelid = 'public.donations'::regclass
  ) THEN
    ALTER TABLE public.donations DROP CONSTRAINT donations_status_check;
  END IF;

  ALTER TABLE public.donations
    ADD CONSTRAINT donations_status_check
    CHECK (status IN ('pending', 'verified', 'rejected', 'deleted'));
END
$$;

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read public donations" ON public.donations;
CREATE POLICY "Public can read public donations"
  ON public.donations
  FOR SELECT
  USING (show_public = TRUE AND status = 'verified');

DROP POLICY IF EXISTS "Admins can manage donations" ON public.donations;
CREATE POLICY "Admins can manage donations"
  ON public.donations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_donations_submitted_at ON public.donations(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_show_public ON public.donations(show_public);
CREATE INDEX IF NOT EXISTS idx_donations_email ON public.donations(email);

INSERT INTO storage.buckets (id, name, public)
VALUES ('donations', 'donations', true)
ON CONFLICT (id) DO NOTHING;
