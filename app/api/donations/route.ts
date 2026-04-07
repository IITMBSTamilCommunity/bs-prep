import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { validateEmail, sanitizeString, validateAndSanitizeInput } from "@/lib/security/validation"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { sendDonationThankYouEmail } from "@/lib/notifications/donation-email"
import type { PostgrestError } from "@supabase/supabase-js"

type DonationPayload = {
  name?: string
  email?: string
  amount?: number | string
  upiReferenceId?: string
  note?: string
  showPublic?: boolean
  contributorImageUrl?: string
}

type DonationInsertResult = {
  data: any | null
  error: PostgrestError | null
}

function parseAmount(input: number | string | undefined): number {
  if (typeof input === "number") return input
  if (typeof input === "string") return Number(input)
  return Number.NaN
}

function isValidPublicImageUrl(url: string): boolean {
  if (!url) return false
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false

  const lower = url.toLowerCase()
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.includes("/storage/v1/object/public/donations/")
}

function getDonationInsertErrorMessage(error: PostgrestError): string {
  const message = (error.message || "").toLowerCase()
  const details = (error.details || "").toLowerCase()

  if (
    (message.includes("relation") && message.includes("donations") && message.includes("does not exist")) ||
    (message.includes("schema cache") && message.includes("donations"))
  ) {
    return "Donations table is not set up yet. Please run scripts/014_create_donations.sql"
  }

  if (message.includes("missing supabase credentials")) {
    return "Supabase credentials are missing. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  }

  if (message.includes("permission denied") || message.includes("row-level security")) {
    return "Database permission issue for donations table. Re-run scripts/014_create_donations.sql to apply policies"
  }

  if (message.includes("check constraint") && (details.includes("status") || message.includes("status"))) {
    return "Donation status configuration mismatch in database. Please run the latest scripts/014_create_donations.sql"
  }

  if (process.env.NODE_ENV !== "production") {
    return `Donation insert failed: ${error.message}${error.details ? ` (${error.details})` : ""}`
  }

  return "Failed to submit donation details"
}

async function insertDonationWithFallback(
  service: ReturnType<typeof createServiceRoleClient>,
  payload: Record<string, unknown>,
): Promise<DonationInsertResult> {
  const selectColumns = "id, name, email, amount, upi_reference_id, contributor_image_url, show_public, note, status, submitted_at"

  // Attempt 1: full payload (new schema)
  let attempt = await service.from("donations").insert(payload).select(selectColumns).single()
  if (!attempt.error) {
    return { data: attempt.data, error: null }
  }

  // Attempt 2: remove status for legacy status constraints/defaults
  const withoutStatus = { ...payload }
  delete withoutStatus.status
  attempt = await service.from("donations").insert(withoutStatus).select(selectColumns).single()
  if (!attempt.error) {
    return { data: attempt.data, error: null }
  }

  // Attempt 3: remove optional columns if migration was partially applied
  const minimalPayload: Record<string, unknown> = {
    name: payload.name,
    email: payload.email,
    amount: payload.amount,
    upi_reference_id: payload.upi_reference_id,
  }
  attempt = await service.from("donations").insert(minimalPayload).select("id, name, email, amount, upi_reference_id, submitted_at").single()
  if (!attempt.error) {
    const normalizedData = {
      ...attempt.data,
      contributor_image_url: null,
      show_public: false,
      note: null,
      status: "received",
    }
    return { data: normalizedData, error: null }
  }

  // Attempt 4: oldest/alternate schema fallback without upi column.
  const smallestPayload: Record<string, unknown> = {
    name: payload.name,
    email: payload.email,
    amount: payload.amount,
  }
  attempt = await service.from("donations").insert(smallestPayload).select("id, name, email, amount, submitted_at").single()
  if (!attempt.error) {
    const normalizedData = {
      ...attempt.data,
      upi_reference_id: "",
      contributor_image_url: null,
      show_public: false,
      note: null,
      status: "received",
    }
    return { data: normalizedData, error: null }
  }

  return { data: null, error: attempt.error }
}

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

export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get("scope") || "public"
    const service = createServiceRoleClient()

    if (scope === "admin") {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { hasAdminRole } = await import("@/lib/security/admin-role")
      const isAdmin = await hasAdminRole(user.id, user.email)
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const { data, error } = await service
        .from("donations")
        .select("id, name, email, amount, razorpay_payment_id, contributor_image_url, show_public, note, status, submitted_at")
        .order("submitted_at", { ascending: false })

      if (error) {
        return NextResponse.json({ error: "Failed to fetch donations" }, { status: 500 })
      }

      return NextResponse.json({ donations: data || [] })
    }

    let { data, error } = await service
      .from("donations")
      .select("id, name, amount, contributor_image_url, note, submitted_at")
      .eq("show_public", true)
      .eq("status", "verified")
      .order("submitted_at", { ascending: false })
      .limit(40)

    // Legacy compatibility: some old schemas used "reviewed" instead of "verified".
    // If enum/text constraints reject reviewed, we keep verified results without failing.
    if (!error && (!data || data.length === 0)) {
      const reviewedTry = await service
        .from("donations")
        .select("id, name, amount, contributor_image_url, note, submitted_at")
        .eq("show_public", true)
        .eq("status", "reviewed")
        .order("submitted_at", { ascending: false })
        .limit(40)

      if (!reviewedTry.error) {
        data = reviewedTry.data
      }
    }

    if (error) {
      return NextResponse.json({ error: "Failed to fetch supporters" }, { status: 500 })
    }

    return NextResponse.json({ donations: data || [] })
  } catch (error) {
    console.error("Donations GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDevelopment) {
      const ip = getClientIp(request)
      if (ip) {
        const rl = await checkRateLimit(ip, {
          maxRequests: 20,
          windowMs: 10 * 60 * 1000,
          keyPrefix: "donations:submit",
        })

        if (!rl.allowed) {
          return NextResponse.json(
            { error: "Too many requests. Please try again in a few minutes." },
            { status: 429, headers: getRateLimitHeaders(rl, 20) },
          )
        }
      }
    }

    const body = (await request.json()) as DonationPayload

    const nameRaw = typeof body.name === "string" ? body.name : ""
    const emailRaw = typeof body.email === "string" ? body.email.toLowerCase().trim() : ""
    const upiReferenceRaw = typeof body.upiReferenceId === "string" ? body.upiReferenceId : ""
    const noteRaw = typeof body.note === "string" ? body.note : ""
    const contributorImageUrlRaw = typeof body.contributorImageUrl === "string" ? body.contributorImageUrl : ""

    const amount = parseAmount(body.amount)
    const nameValidation = validateAndSanitizeInput(nameRaw, 100)
    const upiValidation = validateAndSanitizeInput(upiReferenceRaw, 80)

    if (!nameValidation.valid || !nameValidation.sanitized) {
      return NextResponse.json({ error: "Please enter a valid name" }, { status: 400 })
    }

    if (!validateEmail(emailRaw)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return NextResponse.json({ error: "Please enter a valid amount" }, { status: 400 })
    }

    if (!upiValidation.valid || !upiValidation.sanitized) {
      return NextResponse.json({ error: "Please enter a valid UPI reference ID" }, { status: 400 })
    }

    const showPublic = body.showPublic === undefined ? true : Boolean(body.showPublic)
    const safeNote = noteRaw ? sanitizeString(noteRaw, 200) : null
    const safeImageUrl = contributorImageUrlRaw && isValidPublicImageUrl(contributorImageUrlRaw)
      ? contributorImageUrlRaw
      : null

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const service = createServiceRoleClient()
    const insertPayload: Record<string, unknown> = {
      name: nameValidation.sanitized,
      email: emailRaw,
      amount,
      upi_reference_id: upiValidation.sanitized,
      note: safeNote,
      show_public: showPublic,
      contributor_image_url: safeImageUrl,
      created_by: user?.id ?? null,
      status: "pending",
    }

    const { data, error } = await insertDonationWithFallback(service, insertPayload)

    if (error) {
      console.error("Donation insert error:", error)
      return NextResponse.json({ error: getDonationInsertErrorMessage(error) }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Failed to submit donation details" }, { status: 500 })
    }

    try {
      await sendDonationThankYouEmail({
        donorName: data.name,
        donorEmail: data.email,
        amount: Number(data.amount),
        upiReferenceId: data.upi_reference_id,
      })
    } catch (mailError) {
      console.error("Donation thank-you email failed:", mailError)
    }

    return NextResponse.json({ success: true, donation: data })
  } catch (error) {
    console.error("Donation POST error:", error)
    const message = error instanceof Error ? error.message : "Invalid request"
    return NextResponse.json(
      { error: process.env.NODE_ENV !== "production" ? `Donation request failed: ${message}` : "Invalid request" },
      { status: 400 },
    )
  }
}
