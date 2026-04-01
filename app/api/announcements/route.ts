import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { sanitizeString, validateRequiredFields } from "@/lib/security/validation"
import { apiRateLimiter, writeRateLimiter } from "@/lib/rate-limit"
import { hasAdminRole } from "@/lib/security/admin-role"
import { sendAnnouncementCreatedEmail } from "@/lib/notifications/announcement-email"

function parseDisplayHours(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return 24
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 720) {
    return null
  }

  return Math.floor(parsed)
}

function isAnnouncementActive(item: Record<string, unknown>): boolean {
  const createdAtRaw = item.created_at
  const displayHoursRaw = item.display_hours

  if (!createdAtRaw || typeof createdAtRaw !== "string") {
    return true
  }

  const createdAt = new Date(createdAtRaw)
  if (Number.isNaN(createdAt.getTime())) {
    return true
  }

  const displayHours = typeof displayHoursRaw === "number" ? displayHoursRaw : Number(displayHoursRaw)
  if (!Number.isFinite(displayHours) || displayHours <= 0) {
    return true
  }

  const expiresAt = createdAt.getTime() + displayHours * 60 * 60 * 1000
  return Date.now() <= expiresAt
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const e = error as { code?: string; message?: string }
  return e.code === "PGRST204" && (e.message || "").includes(`'${columnName}'`)
}

function isNotNullIdError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const e = error as { code?: string; message?: string }
  return e.code === "23502" && (e.message || "").toLowerCase().includes("id")
}

function isInvalidIdTypeError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const e = error as { code?: string; message?: string }
  const message = (e.message || "").toLowerCase()
  return e.code === "22P02" && message.includes("id")
}

// GET: fetch announcements - public endpoint
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await apiRateLimiter.check(ip)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  try {
    const includeExpired = request.nextUrl.searchParams.get("includeExpired") === "1"
    const supabase = await createClient()
    
    let { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)

    if (error && isMissingColumnError(error, "created_at")) {
      const fallback = await supabase
        .from("announcements")
        .select("*")
        .limit(100)
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('Announcements fetch error:', error)
      return NextResponse.json(
        { error: "Failed to fetch announcements" },
        { status: 500 }
      )
    }

    const normalized = (data ?? []).map((item: Record<string, unknown>) => ({
      ...item,
      message: (item.message as string | undefined) ?? "",
    }))

    const filtered = includeExpired ? normalized : normalized.filter((item) => isAnnouncementActive(item))

    return NextResponse.json(filtered)
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST: create announcement - requires admin authentication
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await writeRateLimiter.check(ip)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      )
    }

    // Check if user is admin using the same source as admin portal
    const isAdmin = await hasAdminRole(user.id, user.email)
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Validate request body size
    const text = await req.text()
    if (text.length > 10000) { // 10KB limit
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      )
    }

    const body = JSON.parse(text)
    
    const message = body.message ?? body.content

    // Validate required fields
    const validation = validateRequiredFields({ title: body.title, message }, ['title', 'message'])
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Missing required fields: ${validation.missing.join(', ')}` },
        { status: 400 }
      )
    }

    // Announcements are plain text; apply normalization and length limits only.
    const sanitizedTitle = sanitizeString(body.title, 200)
    const sanitizedMessage = sanitizeString(message, 5000)

    if (!sanitizedTitle) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 })
    }

    if (!sanitizedMessage) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 })
    }

    const parsedDisplayHours = parseDisplayHours(body.display_hours)
    if (parsedDisplayHours === null) {
      return NextResponse.json(
        { error: "Invalid display hours. Enter a value between 1 and 720." },
        { status: 400 }
      )
    }

    const adminClient = createServiceRoleClient()

    // Build payload with creator info
    const payloadWithCreator: Record<string, unknown> = {
      id: randomUUID(),
      title: sanitizedTitle,
      message: sanitizedMessage,
      created_by: user.id,
      display_hours: parsedDisplayHours,
    }

    let { data, error } = await adminClient
      .from("announcements")
      .insert([payloadWithCreator])
      .select()

    // Legacy schema fallback: some DBs use integer identities for `id`.
    if (error && isInvalidIdTypeError(error)) {
      const withoutIdPayload: Record<string, unknown> = {
        title: sanitizedTitle,
        message: sanitizedMessage,
        created_by: user.id,
        display_hours: parsedDisplayHours,
      }
      const retry = await adminClient.from("announcements").insert([withoutIdPayload]).select()

      data = retry.data
      error = retry.error
    }

    // If column doesn't exist in DB yet, retry without it
    if (
      error &&
      (isMissingColumnError(error, "created_by") ||
        isMissingColumnError(error, "display_hours"))
    ) {
      const fallbackPayload = {
        id: randomUUID(),
        title: sanitizedTitle,
        message: sanitizedMessage,
      }
      const retry = await adminClient.from("announcements").insert([fallbackPayload]).select()
      data = retry.data
      error = retry.error
    }

    if (error && isNotNullIdError(error)) {
      const retryWithId = await adminClient
        .from("announcements")
        .insert([
          {
            id: randomUUID(),
            title: sanitizedTitle,
            message: sanitizedMessage,
          },
        ])
        .select()
      data = retryWithId.data
      error = retryWithId.error
    }

    if (error) {
      console.error('Announcement creation error:', error)
      return NextResponse.json(
        { error: "Failed to create announcement", details: (error as { message?: string }).message ?? null },
        { status: 500 }
      )
    }

    const announcement = data?.[0]

    try {
      await sendAnnouncementCreatedEmail({
        title: sanitizedTitle,
        message: sanitizedMessage,
        createdByEmail: user.email ?? null,
      })
    } catch (mailError) {
      // Email failures should not block announcement creation.
      console.error("Announcement email dispatch failed:", mailError)
    }

    return NextResponse.json(
      {
        ...announcement,
        message: announcement?.message ?? "",
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }
}

