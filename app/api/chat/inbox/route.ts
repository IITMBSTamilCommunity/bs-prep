import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"
import { hasMentorRole } from "@/lib/security/mentor-role"
import { SUBJECT_CHAT_LABEL_BY_ID, isSubjectChatCourse } from "@/lib/chat/constants"
import { ensureSubjectGroups, getEnrolledSubjectCourseIds, getMentorSubjectCourseIds } from "@/lib/chat/server"

type ProfileRow = {
  id: string
  role: string | null
  mentor_subject: string | null
  mentor_subjects: string[] | null
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
}

type SubjectGroupRow = {
  id: string
  course_id: string
  name: string
}

type SubjectMessageRow = {
  id: string
  group_id: string
  sender_id: string
  sender_role: "student" | "mentor" | "admin"
  message: string
  created_at: string
}

type DirectChatRow = {
  id: string
  mentor_id: string
  student_id: string
  course_id: string
  updated_at: string
  created_at: string
}

type DirectMessageRow = {
  id: string
  chat_id: string
  sender_id: string
  sender_role: "student" | "mentor" | "admin"
  message: string
  created_at: string
}

function sanitizeDisplayName(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length < 2) {
    return null
  }

  return normalized
}

function metadataDisplayName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const record = metadata as Record<string, unknown>
  const fullName = sanitizeDisplayName(typeof record.full_name === "string" ? record.full_name : null)
  if (fullName) {
    return fullName
  }

  return sanitizeDisplayName(typeof record.name === "string" ? record.name : null)
}

async function getAuthDisplayNames(service: ReturnType<typeof createServiceRoleClient>, userIds: string[]) {
  const resolvedEntries = await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data, error } = await service.auth.admin.getUserById(userId)
        if (error || !data?.user) {
          return null
        }

        const metadataName = metadataDisplayName(data.user.user_metadata)
        if (!metadataName) {
          return null
        }

        return [userId, metadataName] as const
      } catch {
        return null
      }
    }),
  )

  return new Map<string, string>(resolvedEntries.filter((entry): entry is readonly [string, string] => Boolean(entry)))
}

function nameFromEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null
  }

  const localPart = email.split("@")[0]?.trim()
  if (!localPart) {
    return null
  }

  const words = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!words.length) {
    return null
  }

  const displayName = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ")
  return displayName.length >= 2 ? displayName : null
}

function resolveDisplayName(profile: ProfileRow | undefined, authName: string | undefined, fallback: string): string {
  if (profile) {
    const profileName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
    return profileName || authName || nameFromEmail(profile.email) || fallback
  }

  return authName || fallback
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

    const [{ data: selfProfile }, isAdmin, isMentor] = await Promise.all([
      service
        .from("profiles")
        .select("id, role, mentor_subject, mentor_subjects, first_name, last_name, email, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      hasAdminRole(user.id, user.email),
      hasMentorRole(user.id, user.email),
    ])

    const profile = (selfProfile ?? null) as ProfileRow | null

    await ensureSubjectGroups(service)

    let subjectCourseIds: string[] = []

    if (isMentor) {
      subjectCourseIds = getMentorSubjectCourseIds(profile).filter((courseId) => isSubjectChatCourse(courseId))
    } else {
      subjectCourseIds = await getEnrolledSubjectCourseIds(service, user.id)
    }

    const { data: groupsData } = subjectCourseIds.length
      ? await service
          .from("subject_chat_groups")
          .select("id, course_id, name")
          .in("course_id", subjectCourseIds)
      : { data: [] }

    const groups = (groupsData ?? []) as SubjectGroupRow[]
    const groupIds = groups.map((item) => item.id)

    const { data: groupMessageData } = groupIds.length
      ? await service
          .from("subject_chat_messages")
          .select("id, group_id, sender_id, sender_role, message, created_at")
          .in("group_id", groupIds)
          .order("created_at", { ascending: false })
      : { data: [] }

    const latestGroupMessageByGroupId = new Map<string, SubjectMessageRow>()
    for (const message of (groupMessageData ?? []) as SubjectMessageRow[]) {
      if (!latestGroupMessageByGroupId.has(message.group_id)) {
        latestGroupMessageByGroupId.set(message.group_id, message)
      }
    }

    let directChats: DirectChatRow[] = []

    if (!isMentor && subjectCourseIds.length > 0) {
      const [{ data: mentorsBySingle }, { data: mentorsByArray }] = await Promise.all([
        service
          .from("profiles")
          .select("id, mentor_subject, mentor_subjects")
          .eq("role", "mentor")
          .in("mentor_subject", subjectCourseIds),
        service
          .from("profiles")
          .select("id, mentor_subject, mentor_subjects")
          .eq("role", "mentor")
          .overlaps("mentor_subjects", subjectCourseIds),
      ])

      const mentorById = new Map<string, { id: string; mentor_subject: string | null; mentor_subjects: string[] | null }>()
      for (const mentor of [...(mentorsBySingle ?? []), ...(mentorsByArray ?? [])]) {
        mentorById.set(String(mentor.id), {
          id: String(mentor.id),
          mentor_subject: typeof mentor.mentor_subject === "string" ? mentor.mentor_subject : null,
          mentor_subjects: Array.isArray(mentor.mentor_subjects) ? mentor.mentor_subjects : null,
        })
      }

      const upserts = Array.from(mentorById.values()).flatMap((mentor) => {
        const mentorCourseIds = getMentorSubjectCourseIds(mentor).filter((courseId) => subjectCourseIds.includes(courseId))
        return mentorCourseIds.map((courseId) => ({
          mentor_id: mentor.id,
          student_id: user.id,
          course_id: courseId,
          updated_at: new Date().toISOString(),
        }))
      })

      if (upserts.length > 0) {
        await service.from("mentor_direct_chats").upsert(upserts, { onConflict: "mentor_id,student_id,course_id" })
      }
    }

    const { data: chatRows } = await service
      .from("mentor_direct_chats")
      .select("id, mentor_id, student_id, course_id, updated_at, created_at")
      .or(`mentor_id.eq.${user.id},student_id.eq.${user.id}`)
      .order("updated_at", { ascending: false })

    directChats = (chatRows ?? []) as DirectChatRow[]

    const directChatIds = directChats.map((chat) => chat.id)

    const { data: directMessageData } = directChatIds.length
      ? await service
          .from("mentor_direct_messages")
          .select("id, chat_id, sender_id, sender_role, message, created_at")
          .in("chat_id", directChatIds)
          .order("created_at", { ascending: false })
      : { data: [] }

    const latestDirectMessageByChatId = new Map<string, DirectMessageRow>()
    for (const message of (directMessageData ?? []) as DirectMessageRow[]) {
      if (!latestDirectMessageByChatId.has(message.chat_id)) {
        latestDirectMessageByChatId.set(message.chat_id, message)
      }
    }

    const partnerIds = Array.from(
      new Set(
        directChats.map((chat) => {
          if (chat.student_id === user.id) {
            return chat.mentor_id
          }
          return chat.student_id
        }),
      ),
    )

    const senderIds = Array.from(
      new Set(
        [
          ...Array.from(latestGroupMessageByGroupId.values()).map((message) => message.sender_id),
          ...Array.from(latestDirectMessageByChatId.values()).map((message) => message.sender_id),
          ...partnerIds,
        ].filter(Boolean),
      ),
    )

    const { data: senderProfiles } = senderIds.length
      ? await service
          .from("profiles")
          .select("id, role, mentor_subject, mentor_subjects, first_name, last_name, email, avatar_url")
          .in("id", senderIds)
      : { data: [] }

    const profileById = new Map<string, ProfileRow>()
    for (const sender of (senderProfiles ?? []) as ProfileRow[]) {
      profileById.set(sender.id, sender)
    }

    const authDisplayNames = await getAuthDisplayNames(service, senderIds)

    const groupConversations = groups.map((group) => {
      const latestMessage = latestGroupMessageByGroupId.get(group.id)
      const sender = latestMessage ? profileById.get(latestMessage.sender_id) : undefined

      return {
        id: `group:${group.id}`,
        kind: "group" as const,
        group_id: group.id,
        course_id: group.course_id,
        title: group.name || `${SUBJECT_CHAT_LABEL_BY_ID[group.course_id] ?? group.course_id} Community`,
        subtitle: SUBJECT_CHAT_LABEL_BY_ID[group.course_id] ?? group.course_id,
        last_message: latestMessage?.message ?? "No messages yet",
        last_message_at: latestMessage?.created_at ?? null,
        last_sender_name: latestMessage
          ? resolveDisplayName(sender, authDisplayNames.get(latestMessage.sender_id), latestMessage.sender_role)
          : null,
        last_sender_role: latestMessage?.sender_role ?? null,
      }
    })

    const directConversations = directChats.map((chat) => {
      const latestMessage = latestDirectMessageByChatId.get(chat.id)
      const partnerId = chat.student_id === user.id ? chat.mentor_id : chat.student_id
      const partner = profileById.get(partnerId)
      const partnerRoleRaw = String(partner?.role ?? "member").toLowerCase()
      const partnerRoleLabel =
        partnerRoleRaw === "mentor"
          ? "Mentor"
          : partnerRoleRaw === "student"
            ? "Student"
            : partnerRoleRaw === "admin"
              ? "Admin"
              : "Member"
      const partnerFallback = partnerRoleLabel === "Member" ? "Participant" : partnerRoleLabel

      return {
        id: `direct:${chat.id}`,
        kind: "direct" as const,
        chat_id: chat.id,
        course_id: chat.course_id,
        title: resolveDisplayName(partner, authDisplayNames.get(partnerId), partnerFallback),
        subtitle: `${SUBJECT_CHAT_LABEL_BY_ID[chat.course_id] ?? chat.course_id} • ${partnerRoleLabel}`,
        partner: {
          id: partnerId,
          name: resolveDisplayName(partner, authDisplayNames.get(partnerId), partnerFallback),
          avatar_url: partner?.avatar_url ?? null,
          role: partner?.role ?? null,
          email: partner?.email ?? null,
        },
        last_message: latestMessage?.message ?? "Start your conversation",
        last_message_at: latestMessage?.created_at ?? chat.updated_at ?? chat.created_at,
        last_sender_name: latestMessage
          ? resolveDisplayName(
              profileById.get(latestMessage.sender_id),
              authDisplayNames.get(latestMessage.sender_id),
              latestMessage.sender_role,
            )
          : null,
        last_sender_role: latestMessage?.sender_role ?? null,
      }
    })

    const conversations = [...groupConversations, ...directConversations].sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return bTime - aTime
    })

    return NextResponse.json({
      viewer_id: user.id,
      viewer_role: isAdmin ? "admin" : isMentor ? "mentor" : "student",
      needs_mentor_subject: isMentor && !subjectCourseIds.length,
      mentor_subject: getMentorSubjectCourseIds(profile)[0] ?? null,
      mentor_subjects: getMentorSubjectCourseIds(profile),
      subject_course_ids: subjectCourseIds,
      conversations,
    })
  } catch (error) {
    console.error("Chat inbox GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
