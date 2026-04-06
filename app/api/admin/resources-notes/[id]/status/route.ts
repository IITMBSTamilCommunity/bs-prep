import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"

const UPDATE_STATUS_VALUES = ["approved", "rejected"] as const

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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Missing note id" }, { status: 400 })
    }

    const body = (await request.json()) as { status?: string }
    const nextStatus = (body.status ?? "").trim().toLowerCase()

    if (!UPDATE_STATUS_VALUES.includes(nextStatus as (typeof UPDATE_STATUS_VALUES)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("resources_notes")
      .update({ status: nextStatus })
      .eq("id", id)
      .select("id, status")
      .single()

    if (error) {
      console.error("Admin resources note status update error:", error)
      return NextResponse.json({ error: "Failed to update note status" }, { status: 500 })
    }

    return NextResponse.json({ note: data })
  } catch (error) {
    console.error("Admin resources note status route error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}