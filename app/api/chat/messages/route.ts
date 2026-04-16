import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { hasAdminRole } from "@/lib/security/admin-role"
import { hasMentorRole } from "@/lib/security/mentor-role"
import { sanitizeString } from "@/lib/security/validation"
import { SUBJECT_CHAT_LABEL_BY_ID } from "@/lib/chat/constants"
import { getEnrolledSubjectCourseIds, getMentorSubjectCourseIds } from "@/lib/chat/server"

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

type DirectChatRow = {
  id: string
  mentor_id: string
  student_id: string
  course_id: string
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

function parseConversationId(conversationId: string | null): { kind: "group" | "direct"; id: string } | null {
  if (!conversationId) {
    return null
  }

  const [kind, id] = conversationId.split(":")
  if ((kind === "group" || kind === "direct") && id) {
    return { kind, id }
  }

  return null
}

async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null }
  }

  const service = createServiceRoleClient()
  const [{ data: profile }, isAdmin, isMentor] = await Promise.all([
    service
      .from("profiles")
      .select("id, role, mentor_subject, mentor_subjects, first_name, last_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    hasAdminRole(user.id, user.email),
    hasMentorRole(user.id, user.email),
  ])

  return {
    error: null,
    user,
    service,
    profile: (profile ?? null) as ProfileRow | null,
    isAdmin,
    isMentor,
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthContext()
    if (context.error || !context.user || !context.service) {
      return context.error
    }

    const parsed = parseConversationId(request.nextUrl.searchParams.get("conversationId"))
    if (!parsed) {
      return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 })
    }

    const { user, service, profile, isAdmin, isMentor } = context

    if (parsed.kind === "group") {
      const { data: group, error: groupError } = await service
        .from("subject_chat_groups")
        .select("id, course_id, name")
        .eq("id", parsed.id)
        .maybeSingle()

      if (groupError) {
        return NextResponse.json({ error: "Failed to load group" }, { status: 500 })
      }

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 })
      }

      const groupRow = group as SubjectGroupRow
      const enrolledCourseIds = await getEnrolledSubjectCourseIds(service, user.id)
      const mentorCourseIds = getMentorSubjectCourseIds(profile)
      const canAccess =
        isAdmin ||
        (isMentor && mentorCourseIds.includes(groupRow.course_id)) ||
        enrolledCourseIds.includes(groupRow.course_id)

      if (!canAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const { data: messages, error: messagesError } = await service
        .from("subject_chat_messages")
        .select("id, sender_id, sender_role, message, created_at")
        .eq("group_id", groupRow.id)
        .order("created_at", { ascending: true })

      if (messagesError) {
        return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
      }

      const senderIds = Array.from(new Set((messages ?? []).map((item) => String(item.sender_id))))
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

      return NextResponse.json({
        conversation: {
          id: `group:${groupRow.id}`,
          kind: "group",
          title: groupRow.name,
          subtitle: SUBJECT_CHAT_LABEL_BY_ID[groupRow.course_id] ?? groupRow.course_id,
          course_id: groupRow.course_id,
        },
        messages: (messages ?? []).map((message) => ({
          id: String(message.id),
          sender_id: String(message.sender_id),
          sender_role: message.sender_role,
          sender_name: resolveDisplayName(
            profileById.get(String(message.sender_id)),
            authDisplayNames.get(String(message.sender_id)),
            message.sender_role,
          ),
          message: String(message.message ?? ""),
          created_at: String(message.created_at),
        })),
      })
    }

    const { data: chat, error: chatError } = await service
      .from("mentor_direct_chats")
      .select("id, mentor_id, student_id, course_id")
      .eq("id", parsed.id)
      .maybeSingle()

    if (chatError) {
      return NextResponse.json({ error: "Failed to load direct chat" }, { status: 500 })
    }

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const chatRow = chat as DirectChatRow

    const canAccess =
      isAdmin ||
      chatRow.student_id === user.id ||
      chatRow.mentor_id === user.id

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: partnerProfiles } = await service
      .from("profiles")
      .select("id, role, mentor_subject, mentor_subjects, first_name, last_name, email, avatar_url")
      .in("id", [chatRow.student_id, chatRow.mentor_id])

    const profileById = new Map<string, ProfileRow>()
    for (const item of (partnerProfiles ?? []) as ProfileRow[]) {
      profileById.set(item.id, item)
    }

    const authDisplayNames = await getAuthDisplayNames(service, [chatRow.student_id, chatRow.mentor_id])

    const { data: messages, error: messageError } = await service
      .from("mentor_direct_messages")
      .select("id, sender_id, sender_role, message, created_at")
      .eq("chat_id", chatRow.id)
      .order("created_at", { ascending: true })

    if (messageError) {
      return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
    }

    const partnerId = chatRow.student_id === user.id ? chatRow.mentor_id : chatRow.student_id
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

    return NextResponse.json({
      conversation: {
        id: `direct:${chatRow.id}`,
        kind: "direct",
        title: resolveDisplayName(partner, authDisplayNames.get(partnerId), partnerFallback),
        subtitle: `${SUBJECT_CHAT_LABEL_BY_ID[chatRow.course_id] ?? chatRow.course_id} • ${partnerRoleLabel}`,
        course_id: chatRow.course_id,
        partner: {
          id: partnerId,
          role: partner?.role ?? null,
          avatar_url: partner?.avatar_url ?? null,
          email: partner?.email ?? null,
        },
      },
      messages: (messages ?? []).map((message) => ({
        id: String(message.id),
        sender_id: String(message.sender_id),
        sender_role: message.sender_role,
        sender_name: resolveDisplayName(
          profileById.get(String(message.sender_id)),
          authDisplayNames.get(String(message.sender_id)),
          message.sender_role,
        ),
        message: String(message.message ?? ""),
        created_at: String(message.created_at),
      })),
    })
  } catch (error) {
    console.error("Chat messages GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthContext()
    if (context.error || !context.user || !context.service) {
      return context.error
    }

    const body = (await request.json()) as {
      conversationId?: string
      message?: string
    }

    const parsed = parseConversationId(body.conversationId ?? null)
    if (!parsed) {
      return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 })
    }

    const safeMessage = sanitizeString(body.message ?? "", 2000)
    if (!safeMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const { user, service, profile, isAdmin, isMentor } = context
    const senderRole: "student" | "mentor" | "admin" = isAdmin ? "admin" : isMentor ? "mentor" : "student"

    if (parsed.kind === "group") {
      const { data: group, error: groupError } = await service
        .from("subject_chat_groups")
        .select("id, course_id")
        .eq("id", parsed.id)
        .maybeSingle()

      if (groupError) {
        return NextResponse.json({ error: "Failed to load group" }, { status: 500 })
      }

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 })
      }

      const enrolledCourseIds = await getEnrolledSubjectCourseIds(service, user.id)
      const mentorCourseIds = getMentorSubjectCourseIds(profile)
      const canAccess =
        isAdmin ||
        (isMentor && mentorCourseIds.includes(String(group.course_id))) ||
        enrolledCourseIds.includes(String(group.course_id))

      if (!canAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const { data: inserted, error: insertError } = await service
        .from("subject_chat_messages")
        .insert([
          {
            group_id: parsed.id,
            sender_id: user.id,
            sender_role: senderRole,
            message: safeMessage,
          },
        ])
        .select("id, sender_id, sender_role, message, created_at")
        .single()

      if (insertError || !inserted) {
        return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
      }

      return NextResponse.json({ message: inserted }, { status: 201 })
    }

    const { data: chat, error: chatError } = await service
      .from("mentor_direct_chats")
      .select("id, mentor_id, student_id")
      .eq("id", parsed.id)
      .maybeSingle()

    if (chatError) {
      return NextResponse.json({ error: "Failed to load direct chat" }, { status: 500 })
    }

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const chatRow = chat as DirectChatRow
    const canAccess = isAdmin || chatRow.student_id === user.id || chatRow.mentor_id === user.id

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: inserted, error: insertError } = await service
      .from("mentor_direct_messages")
      .insert([
        {
          chat_id: chatRow.id,
          sender_id: user.id,
          sender_role: senderRole,
          message: safeMessage,
        },
      ])
      .select("id, sender_id, sender_role, message, created_at")
      .single()

    if (insertError || !inserted) {
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    await service
      .from("mentor_direct_chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatRow.id)

    return NextResponse.json({ message: inserted }, { status: 201 })
  } catch (error) {
    console.error("Chat messages POST error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthContext()
    if (context.error || !context.user || !context.service) {
      return context.error
    }

    const body = (await request.json()) as {
      conversationId?: string
      messageId?: string
    }

    const parsed = parseConversationId(body.conversationId ?? null)
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : ""

    if (!parsed || !messageId) {
      return NextResponse.json({ error: "Invalid delete request" }, { status: 400 })
    }

    const { user, service, profile, isAdmin, isMentor } = context

    if (parsed.kind === "group") {
      const { data: group, error: groupError } = await service
        .from("subject_chat_groups")
        .select("id, course_id")
        .eq("id", parsed.id)
        .maybeSingle()

      if (groupError) {
        return NextResponse.json({ error: "Failed to load group" }, { status: 500 })
      }

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 })
      }

      const enrolledCourseIds = await getEnrolledSubjectCourseIds(service, user.id)
      const mentorCourseIds = getMentorSubjectCourseIds(profile)
      const canAccess =
        isAdmin ||
        (isMentor && mentorCourseIds.includes(String(group.course_id))) ||
        enrolledCourseIds.includes(String(group.course_id))

      if (!canAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const { data: messageRow, error: messageError } = await service
        .from("subject_chat_messages")
        .select("id, sender_id")
        .eq("id", messageId)
        .eq("group_id", parsed.id)
        .maybeSingle()

      if (messageError) {
        return NextResponse.json({ error: "Failed to load message" }, { status: 500 })
      }

      if (!messageRow) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 })
      }

      if (!isAdmin && String(messageRow.sender_id) !== user.id) {
        return NextResponse.json({ error: "You can only delete your own messages" }, { status: 403 })
      }

      const { error: deleteError } = await service
        .from("subject_chat_messages")
        .delete()
        .eq("id", messageId)
        .eq("group_id", parsed.id)

      if (deleteError) {
        return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    const { data: chat, error: chatError } = await service
      .from("mentor_direct_chats")
      .select("id, mentor_id, student_id")
      .eq("id", parsed.id)
      .maybeSingle()

    if (chatError) {
      return NextResponse.json({ error: "Failed to load direct chat" }, { status: 500 })
    }

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const chatRow = chat as DirectChatRow
    const canAccess = isAdmin || chatRow.student_id === user.id || chatRow.mentor_id === user.id

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: messageRow, error: messageError } = await service
      .from("mentor_direct_messages")
      .select("id, sender_id")
      .eq("id", messageId)
      .eq("chat_id", chatRow.id)
      .maybeSingle()

    if (messageError) {
      return NextResponse.json({ error: "Failed to load message" }, { status: 500 })
    }

    if (!messageRow) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    if (!isAdmin && String(messageRow.sender_id) !== user.id) {
      return NextResponse.json({ error: "You can only delete your own messages" }, { status: 403 })
    }

    const { error: deleteError } = await service
      .from("mentor_direct_messages")
      .delete()
      .eq("id", messageId)
      .eq("chat_id", chatRow.id)

    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
    }

    await service
      .from("mentor_direct_chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatRow.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Chat messages DELETE error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
