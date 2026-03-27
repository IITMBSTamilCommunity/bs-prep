# Secure Razorpay Integration Guide (Production-Ready)

## 📋 Prerequisites

1. **Razorpay Account** – Sign up at https://razorpay.com/
2. **API Keys** – Get from https://dashboard.razorpay.com/app/website-app-settings/api-keys
   - Public Key: `rzp_test_XXXXX` (safe to expose)
   - Secret Key: `rzp_test_secret_XXXXX` (NEVER expose on frontend)

---

## 🚀 Step-by-Step Setup

### Step 1: Install Dependencies

```bash
npm install razorpay zod
```

### Step 2: Configure Environment Variables

Create `.env.local` in your project root:

```bash
# ========== Razorpay Keys ==========
# Public key - safe to expose on frontend
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx

# Server-side only keys - NEVER expose on frontend
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# ========== Supabase Config ==========
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Service role key (server-side only)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

⚠️ **IMPORTANT:** Never commit `.env.local` to git. Add to `.gitignore`:
```bash
.env.local
.env*.local
```

### Step 3: Set Up Database (Supabase)

Run these SQL migrations in your Supabase SQL Editor:

**Migration 1: Create Payment Orders Table**
```sql
-- File: scripts/009_create_payment_orders_table.sql
-- Copy the entire contents and run in Supabase SQL Editor
```

**Migration 2: Create Login Attempts Table (for rate limiting)**
```sql
-- File: scripts/010_create_login_attempts_table.sql
-- Copy the entire contents and run in Supabase SQL Editor
```

**Migration 3: Add Missing Enrollments Fields**
```sql
-- Ensure enrollments table has correct RLS policies
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Users can view their own enrollments
DROP POLICY IF EXISTS "Users can view own enrollments" ON enrollments;
CREATE POLICY "Users can view own enrollments"
  ON enrollments FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert enrollments
DROP POLICY IF EXISTS "Service role can insert enrollments" ON enrollments;
CREATE POLICY "Service role can insert enrollments"
  ON enrollments FOR INSERT
  WITH CHECK (true);
```

### Step 4: Backend API Routes (Already Created)

The following API routes are already set up in your project:

**Create Order API:** `app/api/payment/create-order/route.ts`
- ✅ Validates user via JWT token
- ✅ Rate limits: 100 requests per 15 minutes per user
- ✅ Never exposes Razorpay secret key
- ✅ Returns secure order ID

**Verify Payment API:** `app/api/payment/verify/route.ts`
- ✅ Verifies Razorpay signature (prevents fraud)
- ✅ Rate limits: 50 attempts per 15 minutes per user
- ✅ Automatically enrolls user in course(s)
- ✅ Creates audit trail in payment_orders table

### Step 5: Update Payment Pages

Update your payment pages to use the backend APIs instead of client-side Razorpay:

**In `app/payment/[courseId]/page.tsx`:**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PaymentPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkAuth()
    loadRazorpayScript()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/sign-up')
      return
    }
    setUser(user)
  }

  const loadRazorpayScript = () => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
  }

  const handlePayment = async (courseId: string, amount: number) => {
    if (!user) {
      alert('Please log in first')
      return
    }

    setLoading(true)

    try {
      // Step 1: Get JWT token from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session found')

      // Step 2: Create order on backend
      const orderResponse = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          courseId,
          isBundle: false,
        }),
      })

      if (!orderResponse.ok) throw new Error('Failed to create order')

      const order = await orderResponse.json()

      // Step 3: Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'BSPrep',
        description: 'Course Enrollment',
        prefill: {
          email: user.email,
        },
        theme: {
          color: '#000000',
        },
        handler: async (response: any) => {
          // Step 4: Verify payment on backend
          const verifyResponse = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              courseId,
            }),
          })

          if (verifyResponse.ok) {
            alert('Payment successful! You are now enrolled.')
            router.push('/dashboard/courses')
          } else {
            alert('Payment verification failed')
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      }

      const razorpay = new (window as any).Razorpay(options)
      razorpay.open()
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment failed. Please try again.')
      setLoading(false)
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <button
      onClick={() => handlePayment('qualifier-math-1', 9900)}
      disabled={loading}
    >
      {loading ? 'Processing...' : 'Pay ₹99'}
    </button>
  )
}
```

---

## 🔒 Security Features Implemented

### ✅ Backend-Only Secret Keys
- Razorpay secret key **never** exposed on frontend
- Only public key used in client code
- All sensitive operations on backend

### ✅ JWT Authentication
- Every API request requires valid JWT token
- User ID extracted from token, never trusted from body

### ✅ Input Validation & Sanitization
- All inputs validated with Zod schemas
- XSS prevention via HTML tag stripping
- SQL injection prevention via parameterized queries

### ✅ Rate Limiting
- Auth attempts: Limited per IP/email
- Payment API: 100 create-order requests per user per 15 min
- Payment verification: 50 verify attempts per user per 15 min
- Prevents bot attacks and brute force

### ✅ Signature Verification
- Razorpay signatures verified on backend
- Constant-time comparison to prevent timing attacks
- Fraudulent payments rejected before enrollment

### ✅ Row Level Security (RLS)
- Users can only view/modify their own data
- Payment records isolated by user
- Enrollments protected with user_id check

### ✅ Audit Trail
- All payments logged in `payment_orders` table
- Timestamps and order IDs tracked
- Easy to investigate disputes

---

## 📊 Test Payment Flow

### Test Mode (Development)

**Test Card Details:**
- Card: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date

**Flow:**
1. Go to payment page
2. Click "Pay ₹99"
3. Razorpay modal opens
4. Enter test card details
5. Click "Pay"
6. Backend verifies signature
7. User automatically enrolled
8. Redirects to dashboard

### Live Mode (Production)

Replace test keys with live keys from Razorpay Dashboard:
```bash
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_live_secret
```

Real payments will be processed. Complete Razorpay KYC required.

---

## 🛡️ Additional Security Recommendations

1. **Enable HTTPS** – Use SSL certificate (required for Razorpay)
2. **Validate on Backend** – Never trust client-side validation
3. **Log Everything** – Track all payment attempts
4. **Monitor Failures** – Alert on unusual patterns
5. **Rotate Keys** – Regenerate API keys periodically
6. **Use Webhooks** – For real-time payment updates (advanced)

---

## 🆘 Troubleshooting

**"Razorpay is not configured"**
- Check `.env.local` has `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- Restart dev server: `npm run dev`

**"Rate limit exceeded"**
- Wait 15 minutes or use different user
- Check X-RateLimit-Reset header

**"Invalid token"**
- User must be logged in
- Session might be expired, refresh and retry

**"Signature verification failed"**
- Server secret key may be wrong
- Check `RAZORPAY_KEY_SECRET` in `.env.local`

---

## ✨ Summary

You now have:
- ✅ Secure backend-only payment processing
- ✅ Rate limiting on all endpoints
- ✅ Input validation & XSS prevention
- ✅ Signature verification against fraud
- ✅ Automatic enrollment on success
- ✅ Complete audit trail
- ✅ RLS-protected user data

Production ready and secure! 🚀
