import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { sanitizeString, validateRequiredFields } from "@/lib/security/validation"
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

function isInvalidIdTypeError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const e = error as { code?: string; message?: string }
  const message = (e.message || "").toLowerCase()
  return e.code === "22P02" && message.includes("id")
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
      return NextResponse.json({ error: "Invalid display hours. Enter a value between 1 and 720." }, { status: 400 })
    }

    const updatePayload: Record<string, string | number> = {
      title: sanitizedTitle,
      message: sanitizedMessage,
      display_hours: parsedDisplayHours,
    }

    let { data, error } = await supabase
      .from("announcements")
      .update(updatePayload)
      .eq("id", announcementId)
      .select()
      .single()

    if (error) {
      const fallbackPayload = {
        title: sanitizedTitle,
        message: sanitizedMessage,
      }

      const retry = await supabase
        .from("announcements")
        .update(fallbackPayload)
        .eq("id", announcementId)
        .select()
        .single()

      data = retry.data
      error = retry.error
    }

    if (error && isInvalidIdTypeError(error)) {
      return NextResponse.json({ error: "Invalid announcement ID format for this database." }, { status: 400 })
    }

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
