import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = await hasAdminRole(user.id, user.email)
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("donations")
      .select("id, name, email, amount, razorpay_payment_id, contributor_image_url, show_public, note, status, submitted_at")
      .order("submitted_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch donations" }, { status: 500 })
    }

    return NextResponse.json({ donations: data || [] })
  } catch (error) {
    console.error("Admin donations GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = await hasAdminRole(user.id, user.email)
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const id = typeof body?.id === "string" ? body.id : ""
    const status = typeof body?.status === "string" ? body.status.toLowerCase().trim() : ""

    if (!id) {
      return NextResponse.json({ error: "Missing donation ID" }, { status: 400 })
    }

    if (!["pending", "verified", "rejected", "deleted"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    let targetStatus = status

    const buildUpdatePayload = (nextStatus: string): { status: string; show_public?: boolean } => {
      const payload: { status: string; show_public?: boolean } = { status: nextStatus }
      if (status === "deleted" || status === "rejected") {
        // Rejected/deleted donations should never appear on public supporter wall.
        payload.show_public = false
      }
      return payload
    }

    let updatePayload = buildUpdatePayload(targetStatus)
    let { data, error } = await service
      .from("donations")
      .update(updatePayload)
      .eq("id", id)
      .select("id, status, show_public")
      .single()

    // Backward compatibility with legacy status values.
    if (error && error.code === "23514") {
      if (status === "verified") {
        targetStatus = "reviewed"
      } else if (status === "pending") {
        targetStatus = "received"
      } else if (status === "deleted") {
        // Legacy schema may not allow deleted; keep it hidden and mark rejected.
        targetStatus = "rejected"
      }

      updatePayload = buildUpdatePayload(targetStatus)

      const retry = await service
        .from("donations")
        .update(updatePayload)
        .eq("id", id)
        .select("id, status, show_public")
        .single()

      data = retry.data
      error = retry.error
    }

    if (error) {
      return NextResponse.json({ error: "Failed to update donation status" }, { status: 500 })
    }

    return NextResponse.json({ success: true, donation: data, requestedStatus: status })
  } catch (error) {
    console.error("Admin donations PATCH error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
