import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"

const ALLOWED_ROLES = new Set(["student", "mentor", "admin"])

function normalizeRole(role: unknown): "student" | "mentor" | "admin" {
  const value = typeof role === "string" ? role.toLowerCase().trim() : ""
  if (ALLOWED_ROLES.has(value)) {
    return value as "student" | "mentor" | "admin"
  }
  return "student"
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const service = createServiceRoleClient()

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("id, email, role, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
    }

    let resolvedRole = profile?.role ?? user.user_metadata?.role ?? "student"

    if (!profile && user.email) {
      const { data: emailProfile } = await service
        .from("profiles")
        .select("role")
        .ilike("email", user.email)
        .maybeSingle()

      if (emailProfile?.role) {
        resolvedRole = emailProfile.role
      }
    }

    const isAdmin = await hasAdminRole(user.id, user.email)
    const safeRole = isAdmin ? "admin" : normalizeRole(resolvedRole)

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email ?? "",
        role: safeRole,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
      },
    })
  } catch (error) {
    console.error("Account me GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
