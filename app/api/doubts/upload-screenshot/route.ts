import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { sanitizeFilename } from "@/lib/security/validation"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"])
const isDevelopment = process.env.NODE_ENV !== "production"

function getExt(fileType: string): string {
  if (fileType === "image/png") return "png"
  if (fileType === "image/webp") return "webp"
  return "jpg"
}

export async function POST(request: NextRequest) {
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
        maxRequests: 200,
        windowMs: 5 * 60 * 1000,
        keyPrefix: "doubts:upload",
      })

      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: getRateLimitHeaders(rl, 200) },
        )
      }
    }

    const form = await request.formData()
    const file = form.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPG, JPEG, and WEBP files are allowed" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image must be less than 5MB" }, { status: 400 })
    }

    const ext = getExt(file.type)
    const safeName = sanitizeFilename(file.name || `doubt.${ext}`)
    const filePath = `doubts/${user.id}/${Date.now()}-${safeName.replace(/\.[^.]+$/, "")}.${ext}`

    const service = createServiceRoleClient()
    const { error: uploadError } = await service.storage.from("profiles").upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

    if (uploadError) {
      console.error("Doubt screenshot upload error:", uploadError)
      return NextResponse.json({ error: "Failed to upload screenshot" }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = service.storage.from("profiles").getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error("Doubt screenshot route error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
