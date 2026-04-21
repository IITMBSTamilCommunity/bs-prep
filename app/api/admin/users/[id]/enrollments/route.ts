import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"

type Params = {
  params: Promise<{ id: string }>
}

type EnrollmentRow = {
  course_id: string
  created_at?: string
  enrolled_at?: string
  payment_status?: string | null
}

const courseTitleFallback: Record<string, string> = {
  "qualifier-math-1": "Mathematics for Data Science I",
  "qualifier-stats-1": "Statistics for Data Science I",
  "qualifier-computational-thinking": "Computational Thinking",
  "qualifier-english-1": "English I",
  "foundation-math-2": "Mathematics for Data Science II",
  "foundation-stats-2": "Statistics for Data Science II",
  "foundation-programming-python": "Programming in Python",
  "foundation-english-2": "English II",
  bundle: "Qualifier Bundle (4 Courses)",
}

function formatFallbackTitle(courseId: string): string {
  if (!courseId) return "Untitled Course"
  return courseTitleFallback[courseId] || courseId.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id: userId } = await params
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

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
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const service = createServiceRoleClient()

    // Support older/newer schema variants across environments.
    let enrollments: EnrollmentRow[] = []
    const attemptErrors: unknown[] = []

    const attempts = [
      () =>
        service
          .from("enrollments")
          .select("course_id, created_at, payment_status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      () =>
        service
          .from("enrollments")
          .select("course_id, enrolled_at, payment_status")
          .eq("user_id", userId)
          .order("enrolled_at", { ascending: false }),
      () =>
        service
          .from("enrollments")
          .select("course_id, enrolled_at")
          .eq("student_id", userId)
          .order("enrolled_at", { ascending: false }),
      () =>
        service
          .from("enrollments")
          .select("course_id, created_at")
          .eq("student_id", userId)
          .order("created_at", { ascending: false }),
    ]

    for (const runAttempt of attempts) {
      const result = await runAttempt()
      if (!result.error) {
        enrollments = (result.data ?? []) as EnrollmentRow[]
        break
      }
      attemptErrors.push(result.error)
    }

    if (!enrollments) {
      enrollments = []
    }

    if (attemptErrors.length === attempts.length) {
      console.error("Admin enrollments fetch error:", attemptErrors)
      return NextResponse.json({ error: "Failed to load enrollments" }, { status: 500 })
    }

    const courseIds = Array.from(new Set((enrollments ?? []).map((item) => String(item.course_id)).filter(Boolean)))

    let titleById = new Map<string, string>()
    if (courseIds.length > 0) {
      const { data: courses } = await service
        .from("courses")
        .select("id, title")
        .in("id", courseIds)

      for (const course of courses ?? []) {
        titleById.set(String(course.id), course.title || formatFallbackTitle(String(course.id)))
      }
    }

    const normalized = (enrollments ?? []).map((item) => {
      const courseId = String(item.course_id)
      const enrolledAt = item.created_at || item.enrolled_at || null
      return {
        course_id: courseId,
        title: titleById.get(courseId) || formatFallbackTitle(courseId),
        enrolled_at: enrolledAt,
        payment_status: item.payment_status || null,
      }
    })

    return NextResponse.json({ enrollments: normalized })
  } catch (error) {
    console.error("Admin enrollments route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
