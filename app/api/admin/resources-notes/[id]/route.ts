import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"

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

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Missing note id" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { error } = await service.from("resources_notes").delete().eq("id", id)

    if (error) {
      console.error("Admin resources note delete error:", error)
      return NextResponse.json({ error: "Failed to delete note" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin resources note delete route error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}