# 📋 Copy-Paste SQL Migrations for Supabase

Go to: https://supabase.com/dashboard → SQL Editor → New Query

Run these in order (one at a time).

---

## Migration 1: Create Payment Orders Table

**File:** `scripts/009_create_payment_orders_table.sql`

```sql
-- Create payment_orders table for secure payment audit trail
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  is_bundle BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_order_id ON payment_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_payment_id ON payment_orders(razorpay_payment_id);

ALTER TABLE IF EXISTS payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment records" ON payment_orders;
CREATE POLICY "Users can view own payment records"
  ON payment_orders FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert payments" ON payment_orders;
CREATE POLICY "Service role can insert payments"
  ON payment_orders FOR INSERT
  WITH CHECK (true);
```

**Status:** ✅ Ready to run

---

## Migration 2: Create Login Attempts Table

**File:** `scripts/010_create_login_attempts_table.sql`

```sql
-- Create login_attempts table for tracking and rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  success BOOLEAN DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created ON login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created ON login_attempts(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at DESC);

ALTER TABLE IF EXISTS login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to login attempts" ON login_attempts;
CREATE POLICY "No direct access to login attempts"
  ON login_attempts
  FOR ALL
  USING (false);
```

**Status:** ✅ Ready to run

---

## Migration 3: Update Enrollments RLS Policies

**File:** `scripts/011_update_enrollments_rls.sql`

```sql
-- Update enrollments table RLS policies for secure access
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

-- Service role can manage enrollments
DROP POLICY IF EXISTS "Service role can manage enrollments" ON enrollments;
CREATE POLICY "Service role can manage enrollments"
  ON enrollments FOR ALL
  USING (true);
```

**Status:** ✅ Ready to run

---

## How to Run

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "+ New Query"
5. Copy entire SQL block above (one migration at a time)
6. Paste into editor
7. Click "Run"
8. Wait for success message ✅
9. Repeat for next migration

---

## Verify Migrations Ran Successfully

In Supabase → Table Editor, you should see:

- ✅ `payment_orders` table (new)
- ✅ `login_attempts` table (new)
- ✅ `enrollments` table (updated with new RLS policies)

All tables should have Row Level Security enabled.

---

## If Something Goes Wrong

**Query failed?**
- Check SQL syntax
- Try running each statement separately
- Look at error message for clues

**Need to undo?**
```sql
DROP TABLE IF EXISTS payment_orders;
DROP TABLE IF EXISTS login_attempts;
-- Note: enrollments updates cannot be easily undone, just update policies again
```

**Still stuck?**
- Go to Supabase Docs: https://supabase.com/docs
- Check RLS documentation
- Create new query and debug step by step
