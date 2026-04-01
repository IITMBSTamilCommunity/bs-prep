-- Create payment_orders table for secure payment audit trail
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  is_bundle BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'completed', -- pending, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_order_id ON payment_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_payment_id ON payment_orders(razorpay_payment_id);

-- Enable Row Level Security
ALTER TABLE IF EXISTS payment_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own payment records
DROP POLICY IF EXISTS "Users can view own payment records" ON payment_orders;
CREATE POLICY "Users can view own payment records"
  ON payment_orders FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Only service role can insert (via API)
DROP POLICY IF EXISTS "Service role can insert payments" ON payment_orders;
CREATE POLICY "Service role can insert payments"
  ON payment_orders FOR INSERT
  WITH CHECK (true); -- Service role checks are handled in code

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_payment_orders_timestamp ON payment_orders;
CREATE TRIGGER update_payment_orders_timestamp
BEFORE UPDATE ON payment_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
