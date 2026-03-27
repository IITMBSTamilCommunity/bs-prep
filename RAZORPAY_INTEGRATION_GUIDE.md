# Razorpay Integration Guide

## 📋 Prerequisites
1. Razorpay Account - Sign up at https://razorpay.com/
2. Get API Keys from https://dashboard.razorpay.com/app/website-app-settings/api-keys
   - Test Mode: `rzp_test_XXXXX`
   - Live Mode: `rzp_live_XXXXX`

## 🚀 Quick Start (Client-Side Only - For Testing)

### Step 1: Add Environment Variable
The payment pages now read Razorpay key from environment variables.

Add this to `.env.local`:

```bash
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
```

Restart dev server after updating env variables.

### Step 2: Test Payment
1. Go to http://localhost:3000/courses/qualifier-math-1
2. Click "Enroll Now"
3. Fill the form and click "Pay ₹99"
4. Razorpay payment modal will open
5. Use test card details (provided by Razorpay in test mode)

### Test Card Details (Test Mode Only)
- **Card Number:** 4111 1111 1111 1111
- **CVV:** Any 3 digits
- **Expiry:** Any future date
- **Name:** Any name

## 🔒 Production Setup (Recommended - With Backend)

### Why Backend Verification?
- **Security:** Never trust client-side payment confirmation
- **Fraud Prevention:** Verify signature to ensure payment authenticity
- **Database:** Store payment records securely

### Step 1: Create Backend API Routes

#### 1.1 Create Order API (`app/api/create-razorpay-order/route.ts`)

```typescript
import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

// Install: npm install razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(request: Request) {
  try {
    const { amount, currency, courseId } = await request.json()

    const options = {
      amount: amount, // Amount in paise
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        courseId: courseId
      }
    }

    const order = await razorpay.orders.create(options)

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    })
  } catch (error) {
    console.error('Order creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
```

#### 1.2 Create Verify Payment API (`app/api/verify-payment/route.ts`)

```typescript
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId,
      userId
    } = await request.json()

    // Generate signature for verification
    const text = razorpay_order_id + '|' + razorpay_payment_id
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex')

    // Verify signature
    if (generated_signature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      )
    }

    // Payment verified! Now enroll user in course
    const supabase = createClient()
    
    // 1. Store payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        course_id: courseId,
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        amount: 349, // Get from order
        status: 'success',
        created_at: new Date().toISOString()
      })

    if (paymentError) throw paymentError

    // 2. Enroll user in course
    const { error: enrollError } = await supabase
      .from('enrollments')
      .insert({
        user_id: userId,
        course_id: courseId,
        enrolled_at: new Date().toISOString()
      })

    if (enrollError) throw enrollError

    return NextResponse.json({
      success: true,
      message: 'Payment verified and user enrolled'
    })
  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
```

### Step 2: Update Payment Page

Uncomment the backend integration code in `app/payment/[courseId]/page.tsx`:

```typescript
// Lines 77-87: Uncomment to create order on backend
const orderResponse = await fetch('/api/create-razorpay-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: course.price * 100,
    currency: 'INR',
    courseId: courseId
  })
})
const orderData = await orderResponse.json()

// Line 93: Uncomment to use backend order ID
order_id: orderData.orderId,

// Lines 111-125: Uncomment to verify payment on backend
const verifyResponse = await fetch('/api/verify-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    razorpay_order_id: response.razorpay_order_id,
    razorpay_payment_id: response.razorpay_payment_id,
    razorpay_signature: response.razorpay_signature,
    courseId: courseId,
    userId: user?.id
  })
})
```

### Step 3: Environment Variables

Create `.env.local` file:

```bash
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
```

**⚠️ IMPORTANT:** Never commit your Key Secret to Git!

### Step 4: Install Razorpay Package

```bash
npm install razorpay
```

### Step 5: Create Database Tables

Execute in Supabase SQL Editor:

```sql
-- Payments table
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enrollments table
CREATE TABLE enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own enrollments"
  ON enrollments FOR SELECT
  USING (auth.uid() = user_id);
```

## 📱 Testing Flow

### Test Mode (Development)
1. Use test keys (`rzp_test_`)
2. Use test card: 4111 1111 1111 1111
3. No real money is charged

### Live Mode (Production)
1. Replace with live keys (`rzp_live_`)
2. Complete KYC on Razorpay dashboard
3. Real payments will be processed

## 🎨 Customization

### Change Payment Theme
In `app/payment/[courseId]/page.tsx` line 100:

```typescript
theme: {
  color: '#000000' // Change to your brand color
}
```

### Add Your Logo
Line 91:

```typescript
image: '/logo.png', // Update path to your logo
```

## 📊 Webhook Setup (Optional - For Advanced Use)

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/razorpay-webhook`
3. Select events: `payment.captured`, `payment.failed`
4. Save webhook secret

Create `app/api/razorpay-webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)

  // Handle different events
  switch (event.event) {
    case 'payment.captured':
      // Payment successful
      console.log('Payment captured:', event.payload.payment.entity)
      break
    case 'payment.failed':
      // Payment failed
      console.log('Payment failed:', event.payload.payment.entity)
      break
  }

  return NextResponse.json({ status: 'ok' })
}
```

## ✅ Checklist

### Before Going Live
- [ ] Get Razorpay account approved (KYC completed)
- [ ] Switch from test keys to live keys
- [ ] Test payment flow with small amount
- [ ] Set up webhook for payment status
- [ ] Add proper error handling
- [ ] Set up payment confirmation emails
- [ ] Add refund policy page
- [ ] Test edge cases (failed payments, timeouts)
- [ ] Set up monitoring for failed payments

## 🆘 Common Issues

### Issue: "Key ID is required"
**Solution:** Make sure you've added your Razorpay Key ID in the code

### Issue: Payment succeeds but enrollment fails
**Solution:** Check Supabase database permissions and RLS policies

### Issue: Signature verification fails
**Solution:** Ensure Key Secret is correct in `.env.local`

### Issue: Razorpay modal doesn't open
**Solution:** Check browser console for script loading errors

## 📚 Resources

- [Razorpay Documentation](https://razorpay.com/docs/)
- [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/)
- [Razorpay Test Cards](https://razorpay.com/docs/payments/payments/test-card-details/)
- [Webhook Events](https://razorpay.com/docs/webhooks/payloads/)

## 💡 Tips

1. **Always verify payments on backend** - Never trust client-side confirmation
2. **Store payment records** - Keep audit trail of all transactions
3. **Handle failures gracefully** - Show helpful error messages
4. **Test thoroughly** - Use test mode extensively before going live
5. **Monitor transactions** - Set up alerts for failed payments

---

**Need Help?** 
- Razorpay Support: https://razorpay.com/support/
- This integration is ready to use - just add your API keys!
