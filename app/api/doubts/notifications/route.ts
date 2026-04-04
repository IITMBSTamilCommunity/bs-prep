import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { hasAdminRole } from "@/lib/security/admin-role"

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

    if (!isDevelopment) {
      const rl = await checkRateLimit(user.id, {
        maxRequests: 5000,
        windowMs: 60 * 1000,
        keyPrefix: "doubts:notifications",
      })

      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: getRateLimitHeaders(rl, 5000) },
        )
      }
    }

    const isAdmin = await hasAdminRole(user.id, user.email)
    if (isAdmin) {
      return NextResponse.json({ notifications: [], unread: 0 })
    }

    const service = createServiceRoleClient()
    const { data: doubts, error: doubtsError } = await service
      .from("doubts")
      .select("id, subject, status, admin_last_reply_at, last_student_read_at")
      .eq("student_id", user.id)
      .not("admin_last_reply_at", "is", null)
      .order("admin_last_reply_at", { ascending: false })
      .limit(30)

    if (doubtsError) {
      console.error("Doubt notifications fetch error:", doubtsError)
      return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
    }

    const unreadDoubts = (doubts ?? []).filter((doubt) => {
      const replyAt = doubt.admin_last_reply_at ? new Date(doubt.admin_last_reply_at).getTime() : 0
      const lastRead = doubt.last_student_read_at ? new Date(doubt.last_student_read_at).getTime() : 0
      return replyAt > lastRead
    })

    if (unreadDoubts.length === 0) {
      return NextResponse.json({ notifications: [], unread: 0 })
    }

    const unreadIds = unreadDoubts.map((d) => d.id)
    const { data: latestAdminReplies } = await service
      .from("doubt_messages")
      .select("doubt_id, message, created_at")
      .in("doubt_id", unreadIds)
      .eq("sender_role", "admin")
      .order("created_at", { ascending: false })

    const latestByDoubt = new Map<string, { message: string; created_at: string }>()
    for (const item of latestAdminReplies ?? []) {
      if (!latestByDoubt.has(item.doubt_id)) {
        latestByDoubt.set(item.doubt_id, {
          message: item.message ?? "",
          created_at: item.created_at,
        })
      }
    }

    const notifications = unreadDoubts
      .map((doubt) => {
        const latest = latestByDoubt.get(doubt.id)
        if (!latest) {
          return null
        }

        return {
          id: `doubt-${doubt.id}`,
          doubt_id: doubt.id,
          subject: doubt.subject,
          status: doubt.status,
          message: latest.message,
          created_at: latest.created_at,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      notifications,
      unread: notifications.length,
    })
  } catch (error) {
    console.error("Doubt notifications route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
