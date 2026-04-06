import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sanitizeString } from "@/lib/security/validation"

const DEGREE_VALUES = ["data-science", "electronic-systems"] as const
const LEVEL_VALUES = ["foundation", "diploma", "degree"] as const

function isGoogleDriveLink(value: string): boolean {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const protocol = parsed.protocol.toLowerCase()

    if (protocol !== "https:") {
      return false
    }

    return host === "drive.google.com" || host.endsWith(".drive.google.com") || host === "docs.google.com"
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    const degree = sanitizeString(request.nextUrl.searchParams.get("degree") ?? "", 50)
    const level = sanitizeString(request.nextUrl.searchParams.get("level") ?? "", 30)
    const subject = sanitizeString(request.nextUrl.searchParams.get("subject") ?? "", 120)

    const supabase = await createClient()
    let query = supabase
      .from("resources_notes")
      .select("id, degree, level, subject, notes_week_from, notes_week_to, title, contributor_name, notes_content_label, drive_link, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(300)

    if (degree && DEGREE_VALUES.includes(degree as (typeof DEGREE_VALUES)[number])) {
      query = query.eq("degree", degree)
    }

    if (level && LEVEL_VALUES.includes(level as (typeof LEVEL_VALUES)[number])) {
      query = query.eq("level", level)
    }

    if (subject) {
      query = query.eq("subject", subject)
    }

    const { data, error } = await query

    if (error && (error as { code?: string }).code === "42P01") {
      return NextResponse.json({ notes: [] })
    }

    if (error) {
      console.error("Resources notes GET error:", error)
      return NextResponse.json({ error: "Failed to load notes" }, { status: 500 })
    }

    return NextResponse.json({ notes: data ?? [] })
  } catch (error) {
    console.error("Resources notes GET route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in to submit notes" }, { status: 401 })
    }

    const text = await request.text()
    if (text.length > 15000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 })
    }

    const body = JSON.parse(text) as {
      degree?: string
      level?: string
      subject?: string
      notesWeekFrom?: number
      notesWeekTo?: number
      contributorName?: string
      driveLink?: string
    }

    const degree = sanitizeString(body.degree ?? "", 50)
    const level = sanitizeString(body.level ?? "", 30)
    const subject = sanitizeString(body.subject ?? "", 120)
    const contributorName = sanitizeString(body.contributorName ?? "", 120)
    const driveLink = sanitizeString(body.driveLink ?? "", 800)

    const notesWeekFrom = Number(body.notesWeekFrom)
    const notesWeekTo = Number(body.notesWeekTo)

    if (!DEGREE_VALUES.includes(degree as (typeof DEGREE_VALUES)[number])) {
      return NextResponse.json({ error: "Invalid degree" }, { status: 400 })
    }

    if (!LEVEL_VALUES.includes(level as (typeof LEVEL_VALUES)[number])) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 })
    }

    if (!subject || !contributorName || !driveLink) {
      return NextResponse.json({ error: "Please fill all required fields" }, { status: 400 })
    }

    if (!Number.isInteger(notesWeekFrom) || !Number.isInteger(notesWeekTo) || notesWeekFrom < 1 || notesWeekTo < notesWeekFrom || notesWeekTo > 52) {
      return NextResponse.json({ error: "Invalid week range" }, { status: 400 })
    }

    if (!isGoogleDriveLink(driveLink)) {
      return NextResponse.json({ error: "Only Google Drive links are allowed" }, { status: 400 })
    }

    const generatedTitle = sanitizeString(`${subject} Weeks ${notesWeekFrom}-${notesWeekTo} Notes`, 200)
    const generatedContentLabel = sanitizeString(`Weeks ${notesWeekFrom}-${notesWeekTo}`, 200)

    let insertResult = await supabase
      .from("resources_notes")
      .insert([
        {
          user_id: user.id,
          degree,
          level,
          subject,
          notes_week_from: notesWeekFrom,
          notes_week_to: notesWeekTo,
          title: generatedTitle,
          contributor_name: contributorName,
          notes_content_label: generatedContentLabel,
          drive_link: driveLink,
          status: "pending",
        },
      ])
      .select("id")
      .single()

    if (insertResult.error) {
      console.error("Resources notes POST error:", insertResult.error)
      const detail = insertResult.error.message || "Unknown database error"
      return NextResponse.json({ error: `Failed to submit notes: ${detail}` }, { status: 500 })
    }

    return NextResponse.json({ id: insertResult.data.id, message: "Submitted for approval" }, { status: 201 })
  } catch (error) {
    console.error("Resources notes POST route error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}