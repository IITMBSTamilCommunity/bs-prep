import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { validateEmail, sanitizeString, validateAndSanitizeInput } from "@/lib/security/validation"
import { sendDonationThankYouEmail } from "@/lib/notifications/donation-email"
import { fetchRazorpayPayment } from "@/lib/razorpay"

type DonorDetailsPayload = {
  razorpayPaymentId?: string
  razorpayOrderId?: string
  name?: string
  email?: string
  message?: string
  showPublic?: boolean
  contributorImageUrl?: string
}

function isValidPublicImageUrl(url: string): boolean {
  if (!url) return false
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false

  const lower = url.toLowerCase()
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.includes("/storage/v1/object/public/donations/")
  )
}

/**
 * POST /api/donations/complete
 * Completes the donation by adding donor details after payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DonorDetailsPayload

    const paymentId = typeof body.razorpayPaymentId === "string" ? body.razorpayPaymentId?.trim() : ""
    const orderId = typeof body.razorpayOrderId === "string" ? body.razorpayOrderId.trim() : ""
    const nameRaw = typeof body.name === "string" ? body.name : ""
    const emailRaw = typeof body.email === "string" ? body.email.toLowerCase().trim() : ""
    const messageRaw = typeof body.message === "string" ? body.message : ""
    const contributorImageUrlRaw = typeof body.contributorImageUrl === "string" ? body.contributorImageUrl : ""

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 })
    }

    // Validate name
    const nameValidation = validateAndSanitizeInput(nameRaw, 100)
    if (!nameValidation.valid || !nameValidation.sanitized) {
      return NextResponse.json({ error: "Please enter a valid name" }, { status: 400 })
    }

    // Validate email
    if (!validateEmail(emailRaw)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
    }

    // Validate message (optional)
    const safeMessage = messageRaw ? sanitizeString(messageRaw, 300) : null

    // Validate image URL
    const safeImageUrl = contributorImageUrlRaw && isValidPublicImageUrl(contributorImageUrlRaw) ? contributorImageUrlRaw : null

    const service = createServiceRoleClient()
    const showPublic = body.showPublic === undefined ? true : Boolean(body.showPublic)

    let donationRow: { id: string; amount: number } | null = null

    // 1) Try find donation by payment ID.
    const { data: byPayment, error: fetchByPaymentError } = await service
      .from("donations")
      .select("id, amount")
      .eq("razorpay_payment_id", paymentId)
      .limit(1)

    if (fetchByPaymentError) {
      console.error("Failed to fetch donation by payment ID:", fetchByPaymentError)
      return NextResponse.json({ error: "Failed to retrieve donation. Please retry in a moment." }, { status: 500 })
    }

    if (byPayment && byPayment.length > 0) {
      donationRow = { id: byPayment[0].id, amount: Number(byPayment[0].amount || 0) }
    }

    // 2) Fallback: find by order ID, then attach payment ID.
    if (!donationRow && orderId) {
      const { data: byOrder, error: fetchByOrderError } = await service
        .from("donations")
        .select("id, amount")
        .eq("razorpay_order_id", orderId)
        .limit(1)

      if (fetchByOrderError) {
        console.error("Failed to fetch donation by order ID:", fetchByOrderError)
        return NextResponse.json({ error: "Failed to retrieve donation. Please retry in a moment." }, { status: 500 })
      }

      if (byOrder && byOrder.length > 0) {
        donationRow = { id: byOrder[0].id, amount: Number(byOrder[0].amount || 0) }
      }
    }

    // 3) If no row exists yet, create one from Razorpay payment data.
    if (!donationRow) {
      let paidAmount = Number.NaN
      try {
        const payment = await fetchRazorpayPayment(paymentId)
        paidAmount = Number(payment.amount) / 100
      } catch (paymentError) {
        console.error("Failed to verify payment from Razorpay:", paymentError)
        return NextResponse.json({ error: "Unable to verify payment right now. Please retry in a minute." }, { status: 502 })
      }

      if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        return NextResponse.json({ error: "Invalid payment amount from gateway" }, { status: 400 })
      }

      const { data: created, error: createError } = await service
        .from("donations")
        .insert({
          name: nameValidation.sanitized,
          email: emailRaw,
          amount: paidAmount,
          note: safeMessage,
          contributor_image_url: safeImageUrl,
          show_public: showPublic,
          status: "verified",
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId || null,
          razorpay_webhook_verified: true,
          // Backward compatibility for older schemas expecting non-null UPI ref.
          upi_reference_id: `rzp_${paymentId}`,
        })
        .select("id, amount")
        .single()

      if (createError || !created) {
        console.error("Failed to create donation record:", createError)
        return NextResponse.json({ error: "Failed to save donation details" }, { status: 500 })
      }

      donationRow = { id: created.id, amount: Number(created.amount || 0) }
    }

    // Update donation with donor details
    const { data: updated, error: updateError } = await service
      .from("donations")
      .update({
        name: nameValidation.sanitized,
        email: emailRaw,
        note: safeMessage,
        contributor_image_url: safeImageUrl,
        show_public: showPublic,
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId || null,
        razorpay_webhook_verified: true,
        status: "verified", // Mark as verified since payment is confirmed
      })
      .eq("id", donationRow.id)
      .select("id, name, email, amount, note, contributor_image_url, submitted_at")
      .single()

    if (updateError) {
      console.error("Failed to update donation:", updateError)
      return NextResponse.json({ error: "Failed to save donation details" }, { status: 500 })
    }

    // Send thank you email
    try {
      await sendDonationThankYouEmail({
        donorName: nameValidation.sanitized,
        donorEmail: emailRaw,
        amount: Number(updated?.amount ?? donationRow.amount),
      })
    } catch (emailError) {
      console.error("Failed to send thank you email:", emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      donationId: updated.id,
      message: "Thank you for your support!",
    })
  } catch (error) {
    console.error("Complete donation error:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to complete donation" }, { status: 500 })
  }
}
