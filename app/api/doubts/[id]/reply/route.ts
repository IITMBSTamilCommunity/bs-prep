import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { sanitizeString } from "@/lib/security/validation"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { hasAdminRole } from "@/lib/security/admin-role"

const isDevelopment = process.env.NODE_ENV !== "production"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isDevelopment) {
      const rl = await checkRateLimit(user.id, {
        maxRequests: 1500,
        windowMs: 60 * 1000,
        keyPrefix: "doubts:reply",
      })

      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: getRateLimitHeaders(rl, 1500) },
        )
      }
    }

    const text = await request.text()
    if (text.length > 12000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 })
    }

    const body = JSON.parse(text) as {
      message?: string
      screenshotUrl?: string
    }

    const message = sanitizeString(body.message ?? "", 4000)
    const screenshotUrl = typeof body.screenshotUrl === "string" ? sanitizeString(body.screenshotUrl, 800) : null

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data: doubt, error: doubtError } = await service
      .from("doubts")
      .select("id, student_id, status")
      .eq("id", id)
      .maybeSingle()

    if (doubtError) {
      console.error("Reply fetch doubt error:", doubtError)
      return NextResponse.json({ error: "Failed to load doubt" }, { status: 500 })
    }

    if (!doubt) {
      return NextResponse.json({ error: "Doubt not found" }, { status: 404 })
    }

    const isAdmin = await hasAdminRole(user.id, user.email)
    const isOwner = doubt.student_id === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const senderRole = isAdmin ? "admin" : "student"

    const { data: inserted, error: insertError } = await service
      .from("doubt_messages")
      .insert([
        {
          doubt_id: id,
          sender_id: user.id,
          sender_role: senderRole,
          message,
          screenshot_url: screenshotUrl,
        },
      ])
      .select("id, doubt_id, sender_id, sender_role, message, screenshot_url, created_at")
      .single()

    if (insertError || !inserted) {
      console.error("Reply insert error:", insertError)
      return NextResponse.json({ error: "Failed to send reply" }, { status: 500 })
    }

    const nowIso = new Date().toISOString()

    if (isAdmin) {
      await service
        .from("doubts")
        .update({
          admin_last_reply_at: nowIso,
          last_admin_read_at: nowIso,
          status: doubt.status === "resolved" ? "resolved" : "in_progress",
        })
        .eq("id", id)
    } else {
      await service
        .from("doubts")
        .update({
          student_last_reply_at: nowIso,
          last_student_read_at: nowIso,
          status: doubt.status === "resolved" ? "open" : doubt.status,
          resolved_at: doubt.status === "resolved" ? null : undefined,
        })
        .eq("id", id)
    }

    return NextResponse.json({ message: inserted }, { status: 201 })
  } catch (error) {
    console.error("Doubt reply route error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
