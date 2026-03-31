import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { validateAndSanitizeInput, validateRequiredFields } from "@/lib/security/validation"
import { apiRateLimiter, writeRateLimiter } from "@/lib/rate-limit"
import { hasAdminRole } from "@/lib/security/admin-role"
import { sendAnnouncementCreatedEmail } from "@/lib/notifications/announcement-email"

function parseAnnouncementDate(dateInput: unknown): string | null {
  if (!dateInput || typeof dateInput !== "string") {
    return null
  }

  const parsed = new Date(dateInput)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const e = error as { code?: string; message?: string }
  return e.code === "PGRST204" && (e.message || "").includes(`'${columnName}'`)
}

// Valid announcement types
const VALID_ANNOUNCEMENT_TYPES = ['Live Classes', 'YouTube Videos', 'Announcements', 'General']

function validateAnnouncementType(type: unknown): { valid: boolean; type: string } {
  if (!type || typeof type !== 'string') {
    return { valid: true, type: 'General' } // Default to General
  }

  if (VALID_ANNOUNCEMENT_TYPES.includes(type)) {
    return { valid: true, type }
  }

  return { valid: false, type: 'General' }
}

// GET: fetch announcements - public endpoint
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await apiRateLimiter.check(ip)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100) // Limit results to prevent excessive data transfer

    if (error) {
      console.error('Announcements fetch error:', error)
      return NextResponse.json(
        { error: "Failed to fetch announcements" },
        { status: 500 }
      )
    }

    const creatorIds = Array.from(
      new Set(
        (data ?? [])
          .map((item: Record<string, unknown>) => item.created_by)
          .filter((value): value is string => typeof value === "string")
      )
    )

    const profileEmailById = new Map<string, string>()
    if (creatorIds.length > 0) {
      const service = createServiceRoleClient()
      const { data: creatorProfiles } = await service
        .from("profiles")
        .select("id, email")
        .in("id", creatorIds)

      for (const profile of creatorProfiles ?? []) {
        if (profile.id && profile.email) {
          profileEmailById.set(profile.id, profile.email)
        }
      }
    }

    const normalized = (data ?? []).map((item: Record<string, unknown>) => ({
      ...item,
      message: (item.message as string | undefined) ?? (item.content as string | undefined) ?? "",
      created_by_email:
        (item.created_by_email as string | undefined) ??
        (typeof item.created_by === "string" ? profileEmailById.get(item.created_by) : undefined) ??
        null,
    }))

    return NextResponse.json(normalized)
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

    // Validate and sanitize inputs
    const titleValidation = validateAndSanitizeInput(body.title, 200)
    const messageValidation = validateAndSanitizeInput(message, 5000)

    if (!titleValidation.valid) {
      return NextResponse.json(
        { error: `Invalid title: ${titleValidation.errors.join(', ')}` },
        { status: 400 }
      )
    }

    if (!messageValidation.valid) {
      return NextResponse.json(
        { error: `Invalid message: ${messageValidation.errors.join(', ')}` },
        { status: 400 }
      )
    }

    const parsedDate = parseAnnouncementDate(body.date)
    if (body.date && !parsedDate) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      )
    }

    // Validate announcement type
    const typeValidation = validateAnnouncementType(body.announcement_type)
    if (!typeValidation.valid) {
      return NextResponse.json(
        { error: `Invalid announcement type. Valid types are: ${VALID_ANNOUNCEMENT_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const adminClient = createServiceRoleClient()

    // Build payload with creator info
    const payloadWithCreator: Record<string, unknown> = {
      title: titleValidation.sanitized,
      message: messageValidation.sanitized,
      created_by: user.id,
      created_by_email: user.email ?? null,
      ...(parsedDate ? { created_at: parsedDate } : {}),
    }

    // Include announcement_type if it's valid (handle DB schema differences)
    if (typeValidation.type) {
      payloadWithCreator.announcement_type = typeValidation.type
    }

    const payloadWithoutCreator: Record<string, unknown> = {
      title: titleValidation.sanitized,
      message: messageValidation.sanitized,
      ...(parsedDate ? { created_at: parsedDate } : {}),
    }

    // Include announcement_type in payload without creator too
    if (typeValidation.type) {
      payloadWithoutCreator.announcement_type = typeValidation.type
    }

    let { data, error } = await adminClient
      .from("announcements")
      .insert([payloadWithCreator])
      .select()

    // If column doesn't exist in DB yet, retry without it
    if (error && (isMissingColumnError(error, "created_by_email") || isMissingColumnError(error, "created_by") || isMissingColumnError(error, "announcement_type"))) {
      const fallbackPayload = {
        title: titleValidation.sanitized,
        message: messageValidation.sanitized,
        ...(parsedDate ? { created_at: parsedDate } : {}),
      }
      const retry = await adminClient.from("announcements").insert([fallbackPayload]).select()
      data = retry.data
      error = retry.error
    }

    if (error) {
      console.error('Announcement creation error:', error)
      return NextResponse.json(
        { error: "Failed to create announcement" },
        { status: 500 }
      )
    }

    const announcement = data?.[0]

    try {
      await sendAnnouncementCreatedEmail({
        title: titleValidation.sanitized,
        message: messageValidation.sanitized,
        createdByEmail: user.email ?? null,
      })
    } catch (mailError) {
      // Email failures should not block announcement creation.
      console.error("Announcement email dispatch failed:", mailError)
    }

    return NextResponse.json(
      {
        ...announcement,
        message: announcement?.message ?? announcement?.content ?? "",
        created_by_email: announcement?.created_by_email ?? user.email ?? null,
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

