-- Create OTP verification table for secure account deletion
CREATE TABLE IF NOT EXISTS public.deletion_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes'),
  verified_at TIMESTAMP WITH TIME ZONE,
  deleted_by_admin_id UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(user_id, email)
);

ALTER TABLE public.deletion_otp_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can see and manage OTP codes
CREATE POLICY "Admins can view OTP codes" ON public.deletion_otp_codes
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can create OTP codes" ON public.deletion_otp_codes
  FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update OTP codes" ON public.deletion_otp_codes
  FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Clean up expired OTP codes periodically (optional - can use a cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.deletion_otp_codes
  WHERE expires_at < CURRENT_TIMESTAMP AND is_verified = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
