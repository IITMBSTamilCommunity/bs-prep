type DonationThankYouInput = {
  donorName: string
  donorEmail: string
  amount: number
  upiReferenceId?: string
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
    .replace(/\"/g, "&quot;")
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

export async function sendDonationThankYouEmail(input: DonationThankYouInput): Promise<void> {
  const from = process.env.DONATION_EMAIL_FROM || process.env.ANNOUNCEMENT_EMAIL_FROM
  if (!from) {
    return
  }

  const donorName = escapeHtml(input.donorName)
  const donorEmail = escapeHtml(input.donorEmail)
  const upiReferenceId = input.upiReferenceId ? escapeHtml(input.upiReferenceId) : null
  const amount = Number.isFinite(input.amount) ? input.amount.toFixed(2) : "0.00"

  await sendWithResend({
    from,
    to: [input.donorEmail],
    subject: "Thank You for Supporting BSPREP",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 640px; margin: 0 auto;">
        <h2 style="margin: 0 0 12px 0;">Thank You for Your Support!</h2>
        <p style="margin: 0 0 10px 0;">Hi ${donorName},</p>
        <p style="margin: 0 0 10px 0;">Your contribution means a lot to us. Because of your support, BSPREP can continue building high-quality data science content and make learning accessible to more students.</p>

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 18px 0;" />

        <h3 style="margin: 0 0 8px 0;">Contribution Details</h3>
        <p style="margin: 0;">Name: ${donorName}</p>
        <p style="margin: 0;">Email: ${donorEmail}</p>
        <p style="margin: 0;">Amount: INR ${amount}</p>
        ${upiReferenceId ? `<p style="margin: 0;">UPI Reference ID: ${upiReferenceId}</p>` : ""}

        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 18px 0;" />

        <h3 style="margin: 0 0 8px 0;">We Appreciate You</h3>
        <p style="margin: 0 0 8px 0;">Every contribution, big or small, helps us:</p>
        <ul style="margin: 0 0 12px 20px; padding: 0;">
          <li>Improve the platform</li>
          <li>Create better learning resources</li>
          <li>Support more learners on their journey</li>
        </ul>

        <h3 style="margin: 0 0 8px 0;">What is Next?</h3>
        <p style="margin: 0 0 10px 0;">Your support has been received successfully. If you submitted your details, we will acknowledge your contribution soon.</p>

        <p style="margin: 12px 0 0 0;">From the BSPREP Team</p>
        <p style="margin: 0;">Thank you for believing in what we are building.</p>
        <p style="margin: 0;">Keep learning. Keep growing.</p>
      </div>
    `,
  })
}
