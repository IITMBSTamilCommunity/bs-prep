import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { validateAndSanitizeInput } from "@/lib/security/validation"
import { writeRateLimiter } from "@/lib/rate-limit"

export async function PATCH(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const rl = await writeRateLimiter.check(ip)
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const firstNameRaw = typeof body?.first_name === "string" ? body.first_name : ""
    const lastNameRaw = typeof body?.last_name === "string" ? body.last_name : ""

    const firstNameValidation = validateAndSanitizeInput(firstNameRaw, 100)
    const lastNameValidation = validateAndSanitizeInput(lastNameRaw, 100)

    if (!firstNameValidation.valid || !lastNameValidation.valid) {
      return NextResponse.json({ error: "Invalid first name or last name" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data: profile, error: updateError } = await service
      .from("profiles")
      .update({
        first_name: firstNameValidation.sanitized || null,
        last_name: lastNameValidation.sanitized || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id, first_name, last_name")
      .single()

    if (updateError) {
      console.error("Settings profile update error:", updateError)
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error("Settings profile PATCH error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
