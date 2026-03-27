# ⚡ Quick Start - Complete in 10 Minutes

## Phase 1: Install & Configure (2 min)

### 1. Install Dependencies
```bash
npm install
```

### 2. Create `.env.local`
Copy this template and fill in your actual keys:

```bash
# Get from Razorpay Dashboard → Settings → API Keys
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Supabase (you should already have these)
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Don't have Razorpay keys yet?**
- Go to https://razorpay.com/
- Sign up / Log in
- Go to Settings → API Keys
- Copy test keys (start with `rzp_test_`)

---

## Phase 2: Database Migrations (5 min)

❗ **DO THIS IN SUPABASE SQL EDITOR**

Go to: https://supabase.com/dashboard → Your Project → SQL Editor

### Run 1: Payment Orders Table
[Copy from: SUPABASE_MIGRATIONS.md - Migration 1]
- Paste in SQL Editor
- Click "Run"
- Wait for ✅

### Run 2: Login Attempts Table
[Copy from: SUPABASE_MIGRATIONS.md - Migration 2]
- Paste in SQL Editor
- Click "Run"
- Wait for ✅

### Run 3: Update Enrollments RLS
[Copy from: SUPABASE_MIGRATIONS.md - Migration 3]
- Paste in SQL Editor
- Click "Run"
- Wait for ✅

**Verify:** Go to Supabase → Table Editor → See `payment_orders` ✅

---

## Phase 3: Test (3 min)

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Go to Payment Page
- Log in to your account
- Visit: http://localhost:3000/courses/qualifier-math-1
- Click "Pay ₹99"

### 3. Complete Test Payment
- Razorpay modal opens
- Card: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date
- Click "Pay"

### 4. Verify Success
- Should see "Payment successful!"
- Check Supabase: `payment_orders` table should have new row
- Check Supabase: `enrollments` table should show enrollment

---

## ✅ You're Done!

Everything is now:
- ✅ Secure (no secret keys on frontend)
- ✅ Protected (rate limited, validated, signed)
- ✅ Audited (all payments logged)
- ✅ Production-ready

---

## 📚 Need More Info?

- **Full Integration Guide:** [SECURE_RAZORPAY_SETUP.md](SECURE_RAZORPAY_SETUP.md)
- **Setup Checklist:** [SECURITY_SETUP_CHECKLIST.md](SECURITY_SETUP_CHECKLIST.md)
- **SQL Migrations:** [SUPABASE_MIGRATIONS.md](SUPABASE_MIGRATIONS.md)

---

## 🚀 Going Live?

1. Get **Live Keys** from Razorpay
2. Update `.env.local`:
   ```bash
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=live_secret_key
   ```
3. Deploy to production
4. All payments will be real from now on

---

## 🆘 Stuck?

- **npm install fails:** `npm cache clean --force && npm install`
- **Can't find Razorpay keys:** https://dashboard.razorpay.com/app/website-app-settings/api-keys
- **Supabase SQL error:** Check syntax, try one statement at a time
- **Payment fails:** Check `.env.local` has correct keys, restart dev server

That's it! 🎉
