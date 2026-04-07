# Razorpay Donation Integration - Setup Guide

## Overview

The donation system has been refactored to use Razorpay Payment Gateway instead of manual UPI payments. This provides a seamless, secure payment experience for donors.

## Architecture

### Flow
1. **User clicks "Donate Now"** → RazorpayButton (razorpay-button.tsx)
2. **Frontend calls** → POST `/api/donations/razorpay/order` → Creates Razorpay order
3. **Razorpay checkout opens** → User enters amount and pays
4. **Payment successful** → Razorpay webhook → POST `/api/donations/razorpay/webhook`
5. **Webhook verifies payment** → Updates donation record with payment_id
6. **Post-payment modal appears** → PostPaymentModal (post-payment-modal.tsx)
7. **User fills donor details** → Name, email, optional message & photo
8. **Frontend calls** → POST `/api/donations/complete` → Saves donation details
9. **Donation appears on supporter wall** → Public GET `/api/donations` fetches and displays

### Key Components

#### Frontend
- **app/donate/page.tsx** - Main donation page with Razorpay button and supporter wall
- **components/razorpay/razorpay-button.tsx** - Razorpay checkout button
- **components/razorpay/post-payment-modal.tsx** - Post-payment form collecting donor details

#### Backend
- **lib/razorpay.ts** - Razorpay API utilities (create orders, verify signatures, etc.)
- **app/api/donations/razorpay/order/route.ts** - Creates Razorpay order
- **app/api/donations/razorpay/webhook/route.ts** - Webhook handler for payment events
- **app/api/donations/complete/route.ts** - Completes donation with donor details
- **app/api/donations/route.ts** - GET public donations (for supporter wall)
- **app/api/admin/donations/route.ts** - Admin panel for moderation
- **app/admin/(console)/donations/page.tsx** - Admin UI for managing donations

#### Database
- **scripts/015_update_donations_razorpay.sql** - Migration adding Razorpay columns

### Database Schema

```sql
CREATE TABLE donations (
  id UUID PRIMARY KEY,
  created_by UUID,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  razorpay_payment_id TEXT UNIQUE,        -- Razorpay payment identifier
  razorpay_order_id TEXT,                 -- Razorpay order identifier
  razorpay_webhook_verified BOOLEAN DEFAULT FALSE,
  contributor_image_url TEXT,
  note TEXT,
  show_public BOOLEAN DEFAULT TRUE,
  status TEXT CHECK (status IN ('pending', 'verified', 'rejected', 'deleted')),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  upi_reference_id TEXT                   -- Deprecated, kept for backward compatibility
);
```

## Setup Instructions

### 1. Set Up Razorpay Account

1. Go to [razorpay.com](https://razorpay.com)
2. Create an account and verify
3. Go to Settings → API Keys
4. Copy your:
   - **Key ID** (public key)
   - **Key Secret** (private key, keep secret!)
5. Go to Settings → Webhooks
6. Create a webhook with:
   - **URL**: `https://yourdomain.com/api/donations/razorpay/webhook`
   - **Events**: `payment.authorized`, `payment.captured`, `payment.failed`
   - Copy the **Webhook Secret**

### 2. Update Environment Variables

Add to `.env.local`:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Public Razorpay Key (safe to expose)
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_key_id_here
```

### 3. Run Database Migration

```bash
# Option 1: Using Supabase CLI
supabase migration up

# Option 2: Manual - Copy SQL from scripts/015_update_donations_razorpay.sql
# and run in Supabase SQL editor
```

### 4. Deploy Webhook Handler

Make sure your deployment environment has the webhook accessible at:
```
https://yourdomain.com/api/donations/razorpay/webhook
```

Test webhook delivery:
1. In Razorpay Dashboard → Settings → Webhooks
2. Click your webhook → Test
3. Check for successful delivery

### 5. Test Integration

#### Local Testing
```bash
# Start dev server
npm run dev

# Navigate to http://localhost:3000/donate
# Click "Donate Now"
# Use Razorpay test card: 4111 1111 1111 1111
# Expiry: Any future date
# CVV: Any 3 digits
# OTP: 000000
```

#### Production Testing
- Use Razorpay's test mode first
- Switch to live mode once tested
- Test with small amounts initially

## API Endpoints

### POST `/api/donations/razorpay/order`
Creates a Razorpay order for payment.

**Request:**
```json
{
  "amount": 500  // Amount in INR
}
```

**Response:**
```json
{
  "orderId": "order_1Aa00000000001",
  "amount": 50000,     // In paise
  "currency": "INR"
}
```

### POST `/api/donations/razorpay/webhook`
Razorpay webhook handler for payment events (called by Razorpay servers).

**Expected Headers:**
- `x-razorpay-signature` - HMAC SHA256 signature

**Payload:**
```json
{
  "event": "payment.authorized",
  "entity": {
    "id": "pay_...",
    "amount": 50000,
    "status": "authorized",
    "notes": {
      "order_id": "..."
    }
  }
}
```

### POST `/api/donations/complete`
Completes the donation process with donor details.

**Request:**
```json
{
  "razorpayPaymentId": "pay_1Aa00000000001",
  "name": "Donor Name",
  "email": "donor@example.com",
  "message": "I love BSPREP!",
  "showPublic": true,
  "contributorImageUrl": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "donationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Thank you for your support!"
}
```

### GET `/api/donations`
Fetches public verified donations for supporter wall.

**Response:**
```json
{
  "donations": [
    {
      "id": "550e...",
      "name": "Donor Name",
      "amount": 500,
      "contributor_image_url": "https://...",
      "note": "Message from donor",
      "submitted_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Monitoring & Debugging

### Check Webhook Delivery
1. Razorpay Dashboard → Settings → Webhooks → Your webhook
2. View "Recent Events" tab
3. Check delivery status and response

### Database Queries

**View pending payments:**
```sql
SELECT id, name, email, amount, razorpay_payment_id, status
FROM donations
WHERE razorpay_webhook_verified = true AND status = 'pending'
ORDER BY submitted_at DESC;
```

**View verified donations:**
```sql
SELECT name, amount, show_public, status, submitted_at
FROM donations
WHERE status = 'verified' AND show_public = true
ORDER BY submitted_at DESC;
```

### Troubleshooting

#### Webhook not being called
- [ ] Check webhook URL is publicly accessible
- [ ] Verify webhook is configured in Razorpay dashboard
- [ ] Check server logs for errors
- [ ] Test webhook delivery from Razorpay dashboard

#### Payment not showing in database
- [ ] Check if webhook was received (`razorpay_webhook_verified`)
- [ ] Verify payment status in Razorpay dashboard
- [ ] Check server logs for database errors
- [ ] Ensure database migration was applied

#### Modal not appearing after payment
- [ ] Check browser console for JavaScript errors
- [ ] Verify `onPaymentSuccess` callback is being called
- [ ] Check if Razorpay response includes correct payment ID
- [ ] Verify React component is mounted

#### Image upload failing
- [ ] Check file size (max 5MB)
- [ ] Verify file format (PNG, JPG, WEBP only)
- [ ] Check Supabase storage permissions
- [ ] Verify `NEXT_PUBLIC_SUPABASE_URL` is set

## Security Considerations

### Payment Security
- ✅ All payments go directly through Razorpay
- ✅ Credit card data never touches your servers
- ✅ Webhook signatures verified using HMAC-SHA256
- ✅ Rate limiting on donation submission (20 requests/10 minutes)

### Data Security
- ✅ Donor names marked as `show_public` only if they opt-in
- ✅ Emails never displayed publicly
- ✅ RLS policies prevent unauthorized access
- ✅ Admin-only endpoints require authentication

### Environment Variables
- Keep `RAZORPAY_KEY_SECRET` secret (never commit to git)
- Keep `RAZORPAY_WEBHOOK_SECRET` secret
- Use different keys for test and production
- Rotate keys periodically

## Rollback to Manual UPI (if needed)

If you need to revert to manual UPI payments:

1. Restore previous `app/donate/page.tsx` from git
2. Skip the database migration
3. Keep Razorpay routes as backup
4. Remove Razorpay environment variables

## Migration from Old Donations

Old donations with `upi_reference_id` will still be visible in admin panel.
New Razorpay donations use `razorpay_payment_id` instead.

**Query to see both:**
```sql
SELECT id, name, amount, upi_reference_id, razorpay_payment_id, status, submitted_at
FROM donations
ORDER BY submitted_at DESC;
```

## Support

- **Razorpay Docs**: https://razorpay.com/docs/
- **Integration Issues**: Check webhook logs in Razorpay dashboard
- **Database Issues**: Run database migration, verify schema
- **Frontend Issues**: Check browser console for errors
