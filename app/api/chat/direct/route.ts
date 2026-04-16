import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getEnrolledSubjectCourseIds, getMentorSubjectCourseIds } from "@/lib/chat/server"

type DirectChatRow = {
  id: string
}

type UserProfileRow = {
  id: string
  role: string | null
  mentor_subject: string | null
  mentor_subjects: string[] | null
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

    const body = (await request.json()) as { mentorId?: string; studentId?: string; targetUserId?: string }
    const mentorIdFromBody = typeof body.mentorId === "string" ? body.mentorId.trim() : ""
    const studentIdFromBody = typeof body.studentId === "string" ? body.studentId.trim() : ""
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : ""
    const peerUserId = targetUserId || mentorIdFromBody || studentIdFromBody

    if (!peerUserId) {
      return NextResponse.json({ error: "target user id is required" }, { status: 400 })
    }

    if (peerUserId === user.id) {
      return NextResponse.json({ error: "You cannot start a direct chat with yourself" }, { status: 400 })
    }

    const service = createServiceRoleClient()

    const { data: selfProfile } = await service
      .from("profiles")
      .select("id, role, mentor_subject, mentor_subjects")
      .eq("id", user.id)
      .maybeSingle()

    const { data: peerProfile, error: peerError } = await service
      .from("profiles")
      .select("id, role, mentor_subject, mentor_subjects")
      .eq("id", peerUserId)
      .maybeSingle()

    if (peerError) {
      return NextResponse.json({ error: "Failed to validate user" }, { status: 500 })
    }

    if (!peerProfile) {
      return NextResponse.json({ error: "Selected user not found" }, { status: 404 })
    }

    const selfRole = String(selfProfile?.role ?? "student").toLowerCase()
    const peerRole = String(peerProfile.role ?? "student").toLowerCase()

    if (selfRole === "admin" || peerRole === "admin") {
      return NextResponse.json({ error: "Admins cannot create direct chats" }, { status: 403 })
    }

    const [participantA, participantB] = [user.id, peerUserId].sort()

    const { data: existingChat } = await service
      .from("mentor_direct_chats")
      .select("id")
      .or(`and(mentor_id.eq.${participantA},student_id.eq.${participantB}),and(mentor_id.eq.${participantB},student_id.eq.${participantA})`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingChat) {
      const chat = existingChat as DirectChatRow
      return NextResponse.json({ success: true, conversation_id: `direct:${chat.id}` })
    }

    const [selfEnrolledCourseIds, peerEnrolledCourseIds] = await Promise.all([
      getEnrolledSubjectCourseIds(service, user.id),
      getEnrolledSubjectCourseIds(service, peerUserId),
    ])

    const selfMentorCourseIds = getMentorSubjectCourseIds(selfProfile as UserProfileRow)
    const peerMentorCourseIds = getMentorSubjectCourseIds(peerProfile as UserProfileRow)

    const sharedMentorToStudent = selfMentorCourseIds.find((courseId) => peerEnrolledCourseIds.includes(courseId))
    const sharedStudentToMentor = peerMentorCourseIds.find((courseId) => selfEnrolledCourseIds.includes(courseId))
    const sharedStudentToStudent = selfEnrolledCourseIds.find((courseId) => peerEnrolledCourseIds.includes(courseId))

    const courseId =
      sharedMentorToStudent ??
      sharedStudentToMentor ??
      sharedStudentToStudent ??
      selfMentorCourseIds[0] ??
      peerMentorCourseIds[0] ??
      selfEnrolledCourseIds[0] ??
      peerEnrolledCourseIds[0] ??
      "general-community"

    const { data: inserted, error: insertError } = await service
      .from("mentor_direct_chats")
      .insert([
        {
          mentor_id: participantA,
          student_id: participantB,
          course_id: courseId,
          updated_at: new Date().toISOString(),
        },
      ])
      .select("id")
      .single()

    if (insertError || !inserted) {
      return NextResponse.json({ error: "Failed to start direct chat" }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversation_id: `direct:${inserted.id}` })
  } catch (error) {
    console.error("Chat direct POST error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
