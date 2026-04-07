import crypto from "crypto"

export type RazorpayOrderPayload = {
  amount: number
  currency?: string
  receipt?: string
  notes?: Record<string, string>
}

export type RazorpayOrder = {
  id: string
  entity: string
  amount: number
  amount_paid: number
  amount_due: number
  currency: string
  receipt: string
  status: string
  attempts: number
  notes: Record<string, unknown>
  created_at: number
}

export type RazorpayPayment = {
  id: string
  entity: string
  amount: number
  currency: string
  status: string
  method: string
  amount_refunded: number
  refund_status: string | null
  captured: boolean
  card_id: string | null
  bank: string | null
  wallet: string | null
  vpa: string | null
  email: string
  contact: string
  notes: Record<string, string>
  fee: number
  tax: number
  error_code: string | null
  error_description: string | null
  error_source: string | null
  error_reason: string | null
  error_step: string | null
  error_field: string | null
  acquirer_data: {
    auth_code: string | null
  }
  created_at: number
}

export type RazorpayWebhookPayment = {
  id: string
  entity: string
  amount: number
  currency: string
  status: string
  method: string
  description: string
  amount_refunded: number
  refund_status: string | null
  captured: boolean
  notes: Record<string, string>
  fee: number
  tax: number
  error_code: string | null
  error_description: string | null
  created_at: number
  contact: string | null
  email: string | null
}

/**
 * Get Razorpay API credentials from environment variables
 */
export function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local")
  }

  return { keyId, keySecret }
}

/**
 * Create a Razorpay order
 */
export async function createRazorpayOrder(payload: RazorpayOrderPayload): Promise<RazorpayOrder> {
  const { keyId, keySecret } = getRazorpayCredentials()

  // Generate receipt if not provided
  const receipt = payload.receipt || `receipt_${Date.now()}`

  const body = {
    amount: Math.round(payload.amount * 100), // Convert to paise
    currency: payload.currency || "INR",
    receipt,
    notes: payload.notes,
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create Razorpay order: ${error.error?.description || response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  const { keyId, keySecret } = getRazorpayCredentials()

  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to fetch payment: ${error.error?.description || response.statusText}`)
  }

  return response.json()
}

/**
 * Verify Razorpay webhook signature using SHA256 HMAC
 */
export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string,
  webhookSecret: string,
): boolean {
  const hash = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex")
  return hash === signature
}

/**
 * Validate payment amount matches order amount
 */
export function validatePaymentAmount(paymentAmount: number, orderAmount: number): boolean {
  // Both should be in paise (smallest unit)
  // Allow 1% difference for rounding/fees
  const maxDifference = orderAmount * 0.01
  return Math.abs(paymentAmount - orderAmount) <= maxDifference
}
