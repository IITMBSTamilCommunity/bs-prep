import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { validateAndSanitizeInput, validateRequiredFields } from "@/lib/security/validation"
import { writeRateLimiter } from "@/lib/rate-limit"
import { hasAdminRole } from "@/lib/security/admin-role"

type Params = {
  params: Promise<{ id: string }>
}

function isValidAnnouncementId(id: string): boolean {
  return typeof id === "string" && id.trim().length > 0
}

function coerceAnnouncementId(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id
}

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

async function assertAdmin() {
  const authClient = await createClient()

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return { supabase: null, error: NextResponse.json({ error: "Unauthorized - Authentication required" }, { status: 401 }) }
  }

  const isAdmin = await hasAdminRole(user.id, user.email)
  if (!isAdmin) {
    return { supabase: null, error: NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 }) }
  }

  return { supabase: createServiceRoleClient(), error: null }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const rl = await writeRateLimiter.check(ip)
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const { id } = await params
    if (!isValidAnnouncementId(id)) {
      return NextResponse.json({ error: "Invalid announcement ID" }, { status: 400 })
    }
    const announcementId = coerceAnnouncementId(id)

    const { supabase, error: adminError } = await assertAdmin()
    if (adminError) {
      return adminError
    }

    const text = await req.text()
    if (text.length > 10000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

    const body = JSON.parse(text)
    const message = body.message ?? body.content

    const validation = validateRequiredFields({ title: body.title, message }, ["title", "message"])
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Missing required fields: ${validation.missing.join(", ")}` },
        { status: 400 }
      )
    }

    const titleValidation = validateAndSanitizeInput(body.title, 200)
    const messageValidation = validateAndSanitizeInput(message, 5000)

    if (!titleValidation.valid) {
      return NextResponse.json(
        { error: `Invalid title: ${titleValidation.errors.join(", ")}` },
        { status: 400 }
      )
    }

    if (!messageValidation.valid) {
      return NextResponse.json(
        { error: `Invalid message: ${messageValidation.errors.join(", ")}` },
        { status: 400 }
      )
    }

    const parsedDate = parseAnnouncementDate(body.date)
    if (body.date && !parsedDate) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }

    // Validate announcement type
    const typeValidation = validateAnnouncementType(body.announcement_type)
    if (!typeValidation.valid) {
      return NextResponse.json(
        { error: `Invalid announcement type. Valid types are: ${VALID_ANNOUNCEMENT_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const updatePayload: Record<string, string> = {
      title: titleValidation.sanitized,
      message: messageValidation.sanitized,
      announcement_type: typeValidation.type,
    }

    if (parsedDate) {
      updatePayload.created_at = parsedDate
    }

    const { data, error } = await supabase
      .from("announcements")
      .update(updatePayload)
      .eq("id", announcementId)
      .select()
      .single()

    if (error) {
      console.error("Announcement update error:", error)
      return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("Unexpected error:", err)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const rl = await writeRateLimiter.check(ip)
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const { id } = await params
    if (!isValidAnnouncementId(id)) {
      return NextResponse.json({ error: "Invalid announcement ID" }, { status: 400 })
    }
    const announcementId = coerceAnnouncementId(id)

    const { supabase, error: adminError } = await assertAdmin()
    if (adminError) {
      return adminError
    }

    const { error } = await supabase.from("announcements").delete().eq("id", announcementId)

    if (error) {
      console.error("Announcement delete error:", error)
      return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Unexpected error:", err)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
