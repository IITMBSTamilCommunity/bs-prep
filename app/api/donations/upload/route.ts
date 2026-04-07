import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit"
import { sanitizeFilename } from "@/lib/security/validation"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"])
const isDevelopment = process.env.NODE_ENV !== "production"
const DONATION_BUCKET = "donations"

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const real = request.headers.get("x-real-ip")?.trim()
  const cf = request.headers.get("cf-connecting-ip")?.trim()
  const ip = forwarded || real || cf

  if (!ip || ip.toLowerCase() === "unknown") {
    return null
  }

  return ip
}

function getExt(fileType: string): string {
  if (fileType === "image/png") return "png"
  if (fileType === "image/webp") return "webp"
  return "jpg"
}

function isMissingBucketError(error: unknown): boolean {
  const message = typeof error === "object" && error && "message" in error
    ? String((error as { message?: unknown }).message || "").toLowerCase()
    : ""

  return message.includes("bucket") && (message.includes("not found") || message.includes("does not exist"))
}

async function ensureDonationBucket(): Promise<void> {
  const service = createServiceRoleClient()

  const { data: bucket } = await service.storage.getBucket(DONATION_BUCKET)
  if (bucket) {
    if (!bucket.public) {
      const { error: updateError } = await service.storage.updateBucket(DONATION_BUCKET, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: Array.from(ALLOWED_TYPES),
      })

      if (updateError) {
        throw updateError
      }
    }
    return
  }

  const { error } = await service.storage.createBucket(DONATION_BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_TYPES),
  })

  if (error && !String(error.message || "").toLowerCase().includes("already")) {
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDevelopment) {
      const ip = getClientIp(request)
      if (ip) {
        const rl = await checkRateLimit(ip, {
          maxRequests: 30,
          windowMs: 10 * 60 * 1000,
          keyPrefix: "donations:upload",
        })

        if (!rl.allowed) {
          return NextResponse.json(
            { error: "Too many requests. Please try again in a few minutes." },
            { status: 429, headers: getRateLimitHeaders(rl, 30) },
          )
        }
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
    const safeName = sanitizeFilename(file.name || `donor.${ext}`)
    const filePath = `contributors/${Date.now()}-${safeName.replace(/\.[^.]+$/, "")}.${ext}`

    const service = createServiceRoleClient()
    let { error: uploadError } = await service.storage.from(DONATION_BUCKET).upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

    if (uploadError && isMissingBucketError(uploadError)) {
      await ensureDonationBucket()
      const retry = await service.storage.from(DONATION_BUCKET).upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })
      uploadError = retry.error
    }

    if (uploadError) {
      console.error("Donation image upload error:", uploadError)
      return NextResponse.json({ error: "Image upload failed. Try JPG/PNG/WEBP under 5MB." }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = service.storage.from(DONATION_BUCKET).getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error("Donation upload route error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
