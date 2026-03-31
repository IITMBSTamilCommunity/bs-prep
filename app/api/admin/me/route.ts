import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"
import { validateAndSanitizeInput, validateEmail } from "@/lib/security/validation"

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

export async function GET() {
  try {
    const { user, error } = await verifyAdmin()
    if (error) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 })
    }

    const service = createServiceRoleClient()
    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("id, email, first_name, last_name, role, created_at")
      .eq("id", user!.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error("Admin me GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, error } = await verifyAdmin()
    if (error) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 })
    }

    const body = await request.json()
    const firstNameRaw = typeof body?.first_name === "string" ? body.first_name : ""
    const lastNameRaw = typeof body?.last_name === "string" ? body.last_name : ""
    const emailRaw = typeof body?.email === "string" ? body.email.trim() : ""

    const firstNameValidation = validateAndSanitizeInput(firstNameRaw, 100)
    const lastNameValidation = validateAndSanitizeInput(lastNameRaw, 100)

    if (!firstNameValidation.valid) {
      return NextResponse.json({ error: "Invalid first name" }, { status: 400 })
    }
    if (!lastNameValidation.valid) {
      return NextResponse.json({ error: "Invalid last name" }, { status: 400 })
    }

    if (emailRaw && !validateEmail(emailRaw)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const updatePayload: Record<string, string | null> = {
      first_name: firstNameValidation.sanitized || null,
      last_name: lastNameValidation.sanitized || null,
    }

    if (emailRaw) {
      updatePayload.email = emailRaw
    }

    const { data: profile, error: updateError } = await service
      .from("profiles")
      .update(updatePayload)
      .eq("id", user!.id)
      .select("id, email, first_name, last_name, role, created_at")
      .single()

    if (updateError) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile })
  } catch (err) {
    console.error("Admin me PATCH error:", err)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
