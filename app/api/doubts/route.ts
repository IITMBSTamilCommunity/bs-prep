import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { sanitizeString } from "@/lib/security/validation"
import { hasAdminRole } from "@/lib/security/admin-role"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"

type DoubtRecord = {
  id: string
  student_id: string
  subject: string
  status: "open" | "in_progress" | "resolved"
  screenshot_url: string | null
  admin_last_reply_at: string | null
  student_last_reply_at: string | null
  last_student_read_at: string | null
  created_at: string
  updated_at: string
}

const isDevelopment = process.env.NODE_ENV !== "production"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = await hasAdminRole(user.id, user.email)
    const view = request.nextUrl.searchParams.get("view")
    const adminView = admin && view === "admin"

    if (!isDevelopment) {
      const rl = await checkRateLimit(user.id, {
        maxRequests: adminView ? 2000 : 10000,
        windowMs: 60 * 1000,
        keyPrefix: "doubts:list",
      })

      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: getRateLimitHeaders(rl, adminView ? 2000 : 10000) },
        )
      }
    }

    const service = createServiceRoleClient()
    let query = service
      .from("doubts")
      .select("id, student_id, subject, status, screenshot_url, admin_last_reply_at, student_last_reply_at, last_student_read_at, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(adminView ? 120 : 80)

    if (!adminView) {
      query = query.eq("student_id", user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error("Doubts list error:", error)
      return NextResponse.json({ error: "Failed to load doubts" }, { status: 500 })
    }

    const doubts = (data ?? []) as DoubtRecord[]
    if (doubts.length === 0) {
      return NextResponse.json({ doubts: [] })
    }

    const doubtIds = doubts.map((d) => d.id)
    const studentIds = Array.from(new Set(doubts.map((d) => d.student_id)))

    const [{ data: messages }, { data: profiles }] = await Promise.all([
      service
        .from("doubt_messages")
        .select("doubt_id, message, sender_role, created_at")
        .in("doubt_id", doubtIds)
        .order("created_at", { ascending: false }),
      service.from("profiles").select("id, first_name, last_name, email").in("id", studentIds),
    ])

    const latestByDoubt = new Map<string, { message: string; sender_role: string; created_at: string }>()
    for (const item of messages ?? []) {
      if (!latestByDoubt.has(item.doubt_id)) {
        latestByDoubt.set(item.doubt_id, {
          message: item.message ?? "",
          sender_role: item.sender_role ?? "student",
          created_at: item.created_at,
        })
      }
    }

    const profileById = new Map<string, { name: string; email: string | null }>()
    for (const p of profiles ?? []) {
      const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
      profileById.set(p.id, {
        name: fullName || p.email || "Student",
        email: p.email ?? null,
      })
    }

    const normalized = doubts.map((doubt) => {
      const last = latestByDoubt.get(doubt.id)
      const student = profileById.get(doubt.student_id)
      const unreadForStudent =
        !adminView &&
        !!doubt.admin_last_reply_at &&
        new Date(doubt.admin_last_reply_at).getTime() > new Date(doubt.last_student_read_at ?? 0).getTime()

      return {
        ...doubt,
        last_message: last?.message ?? "",
        last_message_sender_role: last?.sender_role ?? "student",
        last_message_at: last?.created_at ?? doubt.created_at,
        unread_for_student: unreadForStudent,
        student_name: student?.name ?? "Student",
        student_email: student?.email ?? null,
      }
    })

    return NextResponse.json({ doubts: normalized })
  } catch (error) {
    console.error("Doubts GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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
        maxRequests: 600,
        windowMs: 60 * 1000,
        keyPrefix: "doubts:create",
      })

      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: getRateLimitHeaders(rl, 600) },
        )
      }
    }

    const text = await request.text()
    if (text.length > 25000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 })
    }

    const body = JSON.parse(text) as {
      subject?: string
      message?: string
      screenshotUrl?: string
    }

    const subject = sanitizeString(body.subject ?? "", 180)
    const message = sanitizeString(body.message ?? "", 4000)
    const screenshotUrl = typeof body.screenshotUrl === "string" ? sanitizeString(body.screenshotUrl, 800) : null

    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const nowIso = new Date().toISOString()

    const { data: createdDoubt, error: doubtError } = await service
      .from("doubts")
      .insert([
        {
          student_id: user.id,
          subject,
          status: "open",
          screenshot_url: screenshotUrl,
          student_last_reply_at: nowIso,
          last_student_read_at: nowIso,
        },
      ])
      .select("id, student_id, subject, status, screenshot_url, created_at, updated_at")
      .single()

    if (doubtError || !createdDoubt) {
      console.error("Create doubt error:", doubtError)
      return NextResponse.json({ error: "Failed to create doubt" }, { status: 500 })
    }

    const { error: msgError } = await service.from("doubt_messages").insert([
      {
        doubt_id: createdDoubt.id,
        sender_id: user.id,
        sender_role: "student",
        message,
        screenshot_url: screenshotUrl,
      },
    ])

    if (msgError) {
      console.error("Create doubt message error:", msgError)
      return NextResponse.json({ error: "Failed to save doubt message" }, { status: 500 })
    }

    return NextResponse.json({ doubt: createdDoubt }, { status: 201 })
  } catch (error) {
    console.error("Create doubt route error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
