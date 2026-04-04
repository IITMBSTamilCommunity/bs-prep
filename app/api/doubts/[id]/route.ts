import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { hasAdminRole } from "@/lib/security/admin-role"

const isDevelopment = process.env.NODE_ENV !== "production"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const isAdmin = await hasAdminRole(user.id, user.email)

    if (!isDevelopment) {
      const rl = await checkRateLimit(user.id, {
        maxRequests: isAdmin ? 2500 : 12000,
        windowMs: 60 * 1000,
        keyPrefix: "doubts:thread-read",
      })

      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: getRateLimitHeaders(rl, isAdmin ? 2500 : 12000) },
        )
      }
    }

    const service = createServiceRoleClient()

    const { data: doubt, error: doubtError } = await service
      .from("doubts")
      .select("id, student_id, subject, status, screenshot_url, created_at, updated_at, last_student_read_at, last_admin_read_at")
      .eq("id", id)
      .maybeSingle()

    if (doubtError) {
      console.error("Fetch doubt detail error:", doubtError)
      return NextResponse.json({ error: "Failed to fetch doubt" }, { status: 500 })
    }

    if (!doubt) {
      return NextResponse.json({ error: "Doubt not found" }, { status: 404 })
    }

    if (!isAdmin && doubt.student_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: messages, error: messagesError } = await service
      .from("doubt_messages")
      .select("id, doubt_id, sender_id, sender_role, message, screenshot_url, created_at")
      .eq("doubt_id", id)
      .order("created_at", { ascending: true })

    if (messagesError) {
      console.error("Fetch doubt messages error:", messagesError)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    const senderIds = Array.from(new Set((messages ?? []).map((m) => m.sender_id)))
    const { data: profiles } = senderIds.length
      ? await service.from("profiles").select("id, first_name, last_name, email").in("id", senderIds)
      : { data: [] }

    const profileById = new Map<string, { name: string; email: string | null }>()
    for (const p of profiles ?? []) {
      const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
      profileById.set(p.id, {
        name: fullName || p.email || "User",
        email: p.email ?? null,
      })
    }

    const nowIso = new Date().toISOString()
    if (isAdmin) {
      await service.from("doubts").update({ last_admin_read_at: nowIso }).eq("id", id)
    } else {
      await service.from("doubts").update({ last_student_read_at: nowIso }).eq("id", id)
    }

    return NextResponse.json({
      doubt,
      messages: (messages ?? []).map((m) => ({
        ...m,
        sender_name: profileById.get(m.sender_id)?.name ?? (m.sender_role === "admin" ? "Admin" : "You"),
      })),
      viewer_role: isAdmin ? "admin" : "student",
    })
  } catch (error) {
    console.error("Doubt detail route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
