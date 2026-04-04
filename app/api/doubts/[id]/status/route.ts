import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { hasAdminRole } from "@/lib/security/admin-role"

const ALLOWED_STATUSES = new Set(["open", "in_progress", "resolved"])
const isDevelopment = process.env.NODE_ENV !== "production"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = (await request.json()) as { status?: string }
    const status = body.status ?? ""

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data: doubt, error: doubtError } = await service
      .from("doubts")
      .select("id, student_id")
      .eq("id", id)
      .maybeSingle()

    if (doubtError) {
      console.error("Status fetch doubt error:", doubtError)
      return NextResponse.json({ error: "Failed to load doubt" }, { status: 500 })
    }

    if (!doubt) {
      return NextResponse.json({ error: "Doubt not found" }, { status: 404 })
    }

    const isAdmin = await hasAdminRole(user.id, user.email)
    const isOwner = doubt.student_id === user.id

    if (!isDevelopment) {
      const rl = await checkRateLimit(user.id, {
        maxRequests: isAdmin ? 400 : 1200,
        windowMs: 60 * 1000,
        keyPrefix: "doubts:status",
      })

      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: getRateLimitHeaders(rl, isAdmin ? 400 : 1200) },
        )
      }
    }

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const payload: Record<string, string | null> = {
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    }

    const { data: updated, error: updateError } = await service
      .from("doubts")
      .update(payload)
      .eq("id", id)
      .select("id, status, resolved_at, updated_at")
      .single()

    if (updateError) {
      console.error("Update status error:", updateError)
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
    }

    return NextResponse.json({ doubt: updated })
  } catch (error) {
    console.error("Doubt status route error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
