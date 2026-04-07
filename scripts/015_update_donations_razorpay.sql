-- Update donations table for Razorpay integration

-- Add Razorpay-related columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'razorpay_payment_id'
  ) THEN
    ALTER TABLE public.donations ADD COLUMN razorpay_payment_id TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'razorpay_order_id'
  ) THEN
    ALTER TABLE public.donations ADD COLUMN razorpay_order_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'razorpay_webhook_verified'
  ) THEN
    ALTER TABLE public.donations ADD COLUMN razorpay_webhook_verified BOOLEAN DEFAULT FALSE;
  END IF;
END
$$;

-- Make upi_reference_id nullable (for backward compatibility with old records)
ALTER TABLE public.donations ALTER COLUMN upi_reference_id DROP NOT NULL;

-- Create index for faster payment ID lookups
CREATE INDEX IF NOT EXISTS idx_donations_razorpay_payment_id ON public.donations(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_donations_razorpay_order_id ON public.donations(razorpay_order_id);

-- RLS policies remain the same (public can read verified donations, admins can manage all)
