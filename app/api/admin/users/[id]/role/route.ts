import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"

type Params = {
  params: Promise<{ id: string }>
}

const ALLOWED_ROLES = new Set(["student", "mentor", "admin"])

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, error: "Unauthorized" as const }
  }

  const isAdmin = await hasAdminRole(user.id, user.email)
  if (!isAdmin) {
    return { user: null, error: "Forbidden" as const }
  }

  return { user, error: null }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 })
    }

    const { user, error: adminError } = await verifyAdmin()
    if (adminError) {
      return NextResponse.json({ error: adminError }, { status: adminError === "Unauthorized" ? 401 : 403 })
    }

    const body = await req.json()
    const nextRole = typeof body?.role === "string" ? body.role.toLowerCase().trim() : ""

    if (!ALLOWED_ROLES.has(nextRole)) {
      return NextResponse.json({ error: "Invalid role. Allowed: student, mentor, admin" }, { status: 400 })
    }

    const service = createServiceRoleClient()

    const { data: targetProfile, error: targetError } = await service
      .from("profiles")
      .select("id, role, email")
      .eq("id", id)
      .maybeSingle()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    const currentRole = (targetProfile.role || "student").toLowerCase()

    if (id === user!.id && nextRole !== "admin") {
      return NextResponse.json({ error: "You cannot remove your own admin access" }, { status: 400 })
    }

    if (currentRole === "admin" && nextRole !== "admin") {
      const { count: adminCount } = await service
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")

      if ((adminCount ?? 0) <= 1) {
        return NextResponse.json({ error: "Cannot demote the last admin" }, { status: 400 })
      }
    }

    if (currentRole === nextRole) {
      return NextResponse.json({ success: true, profile: targetProfile })
    }

    const { data: updated, error: updateError } = await service
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", id)
      .select("id, role, email")
      .single()

    if (updateError) {
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: updated })
  } catch (error) {
    console.error("Admin role update error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
