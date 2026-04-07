import { NextRequest, NextResponse } from "next/server"
import { createRazorpayOrder } from "@/lib/razorpay"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { createServiceRoleClient } from "@/lib/supabase/server"

const isDevelopment = process.env.NODE_ENV !== "production"

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const real = request.headers.get("x-real-ip")?.trim()
  const cf = request.headers.get("cf-connecting-ip")?.trim()
  const ip = forwarded || real || cf

  if (!ip || ip.toLowerCase() === "unknown") {
    return null
  }

  return ip
}

type CreateOrderPayload = {
  amount?: number | string
}

/**
 * POST /api/donations/razorpay/order
 * Creates a Razorpay order for the donation
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    if (!isDevelopment) {
      const ip = getClientIp(request)
      if (ip) {
        const rl = await checkRateLimit(ip, {
          maxRequests: 20,
          windowMs: 10 * 60 * 1000,
          keyPrefix: "donations:order",
        })

        if (!rl.allowed) {
          return NextResponse.json(
            { error: "Too many requests. Please try again in a few minutes." },
            { status: 429, headers: getRateLimitHeaders(rl, 20) },
          )
        }
      }
    }

    const body = (await request.json()) as CreateOrderPayload

    // Parse and validate amount
    let amount = typeof body.amount === "number" ? body.amount : Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return NextResponse.json(
        { error: "Invalid amount. Please enter an amount between ₹1 and ₹1,000,000" },
        { status: 400 },
      )
    }

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amount,
      currency: "INR",
      receipt: `donation_${Date.now()}`,
      notes: {
        purpose: "BSPREP Donation",
      },
    })

    // Create a pending donation row immediately so admin can track the flow.
    // Donor details will be updated after successful checkout in /api/donations/complete.
    try {
      const service = createServiceRoleClient()
      await service.from("donations").insert({
        name: "Pending Donor",
        email: `pending+${order.id}@bsprep.local`,
        amount,
        upi_reference_id: `rzp_order_${order.id}`,
        razorpay_order_id: order.id,
        status: "pending",
        show_public: false,
      })
    } catch (insertError) {
      console.warn("Failed to create pending donation row at order creation:", insertError)
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount, // in paise
      currency: order.currency,
    })
  } catch (error) {
    console.error("Create order error:", error)

    if (error instanceof Error) {
      if (error.message.includes("credentials not configured")) {
        return NextResponse.json(
          { error: "Donation system not configured. Please contact support." },
          { status: 500 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to create donation order" }, { status: 500 })
  }
}
