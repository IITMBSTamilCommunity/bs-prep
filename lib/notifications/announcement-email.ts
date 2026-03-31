import { createServiceRoleClient } from "@/lib/supabase/server"

type AnnouncementEmailInput = {
  title: string
  message: string
  createdByEmail?: string | null
}

type ResendEmailPayload = {
  from: string
  to: string[]
  subject: string
  html: string
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function sendWithResend(payload: ResendEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured")
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const responseText = await res.text()
    throw new Error(`Resend API failed: ${res.status} ${responseText}`)
  }
}

async function getBroadcastRecipients(): Promise<string[]> {
  if (process.env.ANNOUNCEMENT_EMAIL_BROADCAST !== "true") {
    return []
  }

  const service = createServiceRoleClient()
  const { data, error } = await service
    .from("profiles")
    .select("email")
    .not("email", "is", null)

  if (error) {
    throw new Error("Failed to fetch email recipients")
  }

  const recipients = (data ?? [])
    .map((row) => row.email)
    .filter((email): email is string => typeof email === "string" && email.includes("@"))

  return Array.from(new Set(recipients))
}

export async function sendAnnouncementCreatedEmail(input: AnnouncementEmailInput): Promise<void> {
  const from = process.env.ANNOUNCEMENT_EMAIL_FROM
  if (!from) {
    return
  }

  const recipients = new Set<string>()

  if (input.createdByEmail && input.createdByEmail.includes("@")) {
    recipients.add(input.createdByEmail)
  }

  const broadcastRecipients = await getBroadcastRecipients()
  for (const email of broadcastRecipients) {
    recipients.add(email)
  }

  if (recipients.size === 0) {
    return
  }

  const safeTitle = escapeHtml(input.title)
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br />")

  await sendWithResend({
    from,
    to: Array.from(recipients),
    subject: `New Announcement: ${input.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <h2 style="margin-bottom: 8px;">New Announcement</h2>
        <p style="margin: 0 0 8px 0;"><strong>${safeTitle}</strong></p>
        <p style="margin: 0;">${safeMessage}</p>
      </div>
    `,
  })
}
