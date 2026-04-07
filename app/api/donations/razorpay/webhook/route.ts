import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { verifyRazorpayWebhookSignature, fetchRazorpayPayment } from "@/lib/razorpay"
import type { RazorpayWebhookPayment } from "@/lib/razorpay"

type RazorpayWebhookPayload = {
  event: string
  created_at: number
  entity: {
    id: string
    entity: string
    amount: number
    currency: string
    status: string
    method: string
    description?: string
    amount_refunded?: number
    refund_status?: string | null
    captured?: boolean
    email?: string
    contact?: string
    notes?: Record<string, string>
    fee?: number
    tax?: number
    error_code?: string | null
    error_description?: string | null
    created_at?: number
    [key: string]: unknown
  }
  payload?: {
    payment?: {
      entity: RazorpayWebhookPayment
    }
    order?: {
      entity: {
        id: string
        amount: number
        [key: string]: unknown
      }
    }
  }
}

/**
 * POST /api/donations/razorpay/webhook
 * Webhook handler for Razorpay payment events
 * Verifies payment and updates donation status
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-razorpay-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    const body = await request.text()
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured")
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
    }

    // Verify webhook signature
    if (!verifyRazorpayWebhookSignature(body, signature, webhookSecret)) {
      console.warn("Invalid webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload: RazorpayWebhookPayload = JSON.parse(body)

    // Only handle payment.authorized event (payment successful)
    if (payload.event === "payment.authorized" || payload.event === "payment.captured") {
      const payment = payload.entity as RazorpayWebhookPayment
      const paymentId = payment.id
      const orderId = payment.notes?.order_id as string | undefined

      if (!paymentId) {
        return NextResponse.json({ error: "Payment ID missing" }, { status: 400 })
      }

      if (!orderId) {
        console.warn(`Payment ${paymentId} has no order_id in notes`)
        return NextResponse.json({ error: "Order ID missing in payment notes" }, { status: 400 })
      }

      console.log(`Processing payment ${paymentId} for order ${orderId}`)

      const service = createServiceRoleClient()

      // Find donation by order ID
      const { data: donations, error: fetchError } = await service
        .from("donations")
        .select("id, razorpay_order_id, razorpay_payment_id, amount")
        .eq("razorpay_order_id", orderId)
        .limit(1)

      if (fetchError) {
        console.error("Failed to fetch donation:", fetchError)
        return NextResponse.json({ error: "Database error" }, { status: 500 })
      }

      if (!donations || donations.length === 0) {
        console.warn(`No donation found for order ${orderId}`)
        return NextResponse.json({ error: "Donation not found" }, { status: 404 })
      }

      const donation = donations[0]

      // Update donation with payment info
      const { error: updateError } = await service
        .from("donations")
        .update({
          razorpay_payment_id: paymentId,
          razorpay_webhook_verified: true,
          // Keep status as pending until user fills in full details
        })
        .eq("id", donation.id)

      if (updateError) {
        console.error("Failed to update donation:", updateError)
        return NextResponse.json({ error: "Failed to save payment info" }, { status: 500 })
      }

      console.log(`Successfully updated donation ${donation.id} with payment ${paymentId}`)
      return NextResponse.json({ success: true, donationId: donation.id })
    }

    // Ignore other events
    if (payload.event === "payment.failed") {
      const payment = payload.entity as RazorpayWebhookPayment
      console.warn(`Payment ${payment.id} failed: ${payment.error_description}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: "ok" })
}
