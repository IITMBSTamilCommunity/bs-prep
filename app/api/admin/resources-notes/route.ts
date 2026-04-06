import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"

const STATUS_VALUES = ["pending", "approved", "rejected"] as const

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false as const, status: 401, error: "Unauthorized" }
  }

  const isAdmin = await hasAdminRole(user.id, user.email)
  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }

  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const statusParam = (request.nextUrl.searchParams.get("status") ?? "pending").trim().toLowerCase()
    const status = STATUS_VALUES.includes(statusParam as (typeof STATUS_VALUES)[number])
      ? statusParam
      : "pending"

    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("resources_notes")
      .select("id, user_id, degree, level, subject, notes_week_from, notes_week_to, title, contributor_name, notes_content_label, drive_link, status, created_at, updated_at")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(400)

    if (error && error.code === "42P01") {
      return NextResponse.json({ notes: [] })
    }

    if (error) {
      console.error("Admin resources notes list error:", error)
      return NextResponse.json({ error: "Failed to load resources notes" }, { status: 500 })
    }

    return NextResponse.json({ notes: data ?? [] })
  } catch (error) {
    console.error("Admin resources notes route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}