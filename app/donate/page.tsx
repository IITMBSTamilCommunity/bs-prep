"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/client"
import { BadgeCheck, HeartHandshake, LockKeyhole, ShieldCheck, Sparkles, Wallet } from "lucide-react"
import { PostPaymentModal } from "@/components/razorpay/post-payment-modal"

const BeamsBackground = dynamic(() => import("@/components/beams-background").then((mod) => ({ default: mod.BeamsBackground })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-white" />,
})

const DonateRazorpayButton = dynamic(
  () => import("@/components/razorpay/razorpay-button").then((mod) => ({ default: mod.RazorpayButton })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Loading secure payment form...
      </div>
    ),
  },
)

const SUPPORTER_NOTE_DISPLAY_LIMIT = 180
const FORCE_GENERATED_WALL_MESSAGES = true
const WALL_MESSAGE_TEMPLATES = [
  "This platform makes learning practical and clear. Grateful to support the team building it every day.",
  "Happy to contribute to a space that keeps quality education accessible and student-focused.",
  "The structure, clarity, and consistency here are excellent. Wishing the team continued growth.",
  "Supporting BSPREP because the content is genuinely useful and helps learners move forward with confidence.",
  "The effort behind this platform shows in every module. Proud to be a small part of its journey.",
  "Clean explanations, real outcomes, and strong guidance. Glad to support this mission.",
  "Thank you for creating a reliable learning ecosystem. Looking forward to more resources and tools.",
  "A meaningful initiative for learners. Happy to contribute and encourage this work.",
]

type PublicDonation = {
  id: string
  name: string
  amount: number
  contributor_image_url: string | null
  note: string | null
  submitted_at: string
}

function resolveContributorImageUrl(url: string | null): string | null {
  if (!url) return null

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!base) return url

  if (url.startsWith("/storage/v1/object/public/")) {
    return `${base}${url}`
  }

  if (url.startsWith("storage/v1/object/public/")) {
    return `${base}/${url}`
  }

  if (url.startsWith("contributors/")) {
    return `${base}/storage/v1/object/public/donations/${url}`
  }

  return url
}

function formatDisplayName(name: string): string {
  const compact = name.replace(/\s+/g, " ").trim()
  if (!compact) return "Supporter"

  return compact
    .split(" ")
    .map((part) => {
      if (part.length <= 2) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(" ")
}

function getSupporterWallMessage(note: string | null, seed: string): string {
  const normalizedNote = (note || "").replace(/\s+/g, " ").trim()
  const hash = Array.from(seed).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 2147483647, 7)
  const generated = WALL_MESSAGE_TEMPLATES[hash % WALL_MESSAGE_TEMPLATES.length]

  if (FORCE_GENERATED_WALL_MESSAGES) {
    return generated
  }

  if (normalizedNote.length >= 50) {
    return normalizedNote
  }

  return generated
}

export default function DonatePage() {
  const supabase = createClient()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [defaultDonorName, setDefaultDonorName] = useState("")
  const [defaultDonorEmail, setDefaultDonorEmail] = useState("")

  const [supporters, setSupporters] = useState<PublicDonation[]>([])
  const [loadingSupporters, setLoadingSupporters] = useState(true)

  // Payment flow state
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null)
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const paymentSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sortedSupporters = useMemo(
    () => [...supporters].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()),
    [supporters],
  )

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setIsAuthenticated(!!user)
      if (user) {
        const firstName = typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name.trim() : ""
        const lastName = typeof user.user_metadata?.last_name === "string" ? user.user_metadata.last_name.trim() : ""
        const fullName = [firstName, lastName].filter(Boolean).join(" ")

        setDefaultDonorName(fullName)
        setDefaultDonorEmail(user.email || "")
      }

      try {
        const res = await fetch("/api/donations", { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          setSupporters(Array.isArray(data.donations) ? data.donations : [])
        }
      } catch (error) {
        console.error("Failed to load supporters:", error)
      } finally {
        setLoadingSupporters(false)
      }
    }

    void bootstrap()
  }, [supabase])

  function handlePaymentSuccess(orderId: string, paymentId: string) {
    setCurrentOrderId(orderId)
    setCurrentPaymentId(paymentId)
    setPaymentError(null)
    setShowPaymentModal(true)
  }

  function handlePaymentError(error: string) {
    setPaymentError(error)
    setShowPaymentModal(false)
    setCurrentPaymentId(null)
    setCurrentOrderId(null)
  }

  function handlePaymentModalClose() {
    setShowPaymentModal(false)
    setCurrentPaymentId(null)
    setCurrentOrderId(null)
  }

  function handlePaymentModalSuccess() {
    if (paymentSuccessTimerRef.current) {
      clearTimeout(paymentSuccessTimerRef.current)
    }

    setPaymentSuccess(true)
    setShowPaymentModal(false)
    setCurrentPaymentId(null)
    setCurrentOrderId(null)
    setPaymentError(null)

    // Refresh supporters list
    setTimeout(() => {
      fetch("/api/donations", { cache: "no-store" })
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error("Failed to fetch")
        })
        .then((data) => {
          setSupporters(Array.isArray(data.donations) ? data.donations : [])
        })
        .catch((error) => console.error("Failed to refresh supporters:", error))
    }, 1000)

    paymentSuccessTimerRef.current = setTimeout(() => {
      setPaymentSuccess(false)
      paymentSuccessTimerRef.current = null
    }, 10 * 1000)
  }

  useEffect(() => {
    return () => {
      if (paymentSuccessTimerRef.current) {
        clearTimeout(paymentSuccessTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-white text-black">
      <BeamsBackground />
      <Navbar isAuthenticated={isAuthenticated} />

      <section className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <header className="mb-8 rounded-3xl border border-[#E6DAC6] bg-[#F8F4ED] px-6 py-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
            <HeartHandshake className="h-4 w-4" />
            Trustworthy Support
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Support BSPREP, See the Community You Are Building
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-700 sm:text-base">
            Left side shows verified public acknowledgements. Right side is a secure Razorpay checkout with clear limits.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Verified Supporter Wall</h2>
                  <p className="mt-1 text-sm text-slate-600">Real supporters, polished acknowledgements, moderated visibility.</p>
                </div>
                <div className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                  Showing {sortedSupporters.length}
                </div>
              </div>

              {loadingSupporters ? (
                <p className="mt-4 text-sm text-slate-500">Loading supporters...</p>
              ) : sortedSupporters.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No public contributions yet. Be the first supporter!</p>
              ) : (
                <>
                  <div className="mt-6 max-h-152 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {sortedSupporters.map((item) => (
                      <article key={item.id} className="relative overflow-hidden rounded-2xl border border-[#E6DAC6] bg-[#FBF7F1] p-4">
                        <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-bl-4xl bg-[#F2E7D9]" />
                        {(() => {
                          const imageUrl = resolveContributorImageUrl(item.contributor_image_url)
                          const displayName = formatDisplayName(item.name)
                          const wallMessage = getSupporterWallMessage(item.note, `${item.id}:${displayName}`)

                          return (
                            <>
                              <div className="relative flex items-center gap-3">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={displayName}
                                    className="h-12 w-12 rounded-full border border-[#E4D7C5] object-cover"
                                    referrerPolicy="no-referrer"
                                    onError={(event) => {
                                      event.currentTarget.style.display = "none"
                                    }}
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E4D7C5] bg-white text-sm font-bold text-slate-700">
                                    {displayName.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-slate-900">{displayName}</p>
                                  <p className="text-xs text-slate-500">{new Date(item.submitted_at).toLocaleDateString()}</p>
                                </div>
                              </div>

                              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-rose-700">Verified supporter</p>

                              <p className="mt-2 wrap-break-word text-sm leading-6 text-slate-600">
                                {wallMessage.slice(0, SUPPORTER_NOTE_DISPLAY_LIMIT)}
                                {wallMessage.length > SUPPORTER_NOTE_DISPLAY_LIMIT ? "..." : ""}
                              </p>
                            </>
                          )
                        })()}
                      </article>
                    ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <div className="top-24 space-y-6 lg:sticky">
              {paymentSuccess ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-900 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-xl text-white">✓</div>
                  <h2 className="mt-3 text-2xl font-bold">Payment Received</h2>
                  <p className="mt-3 text-sm leading-7">
                    Thank you for supporting BSPREP. Your contribution is confirmed and your acknowledgement email is on the way.
                  </p>
                  <p className="mt-3 text-sm leading-7">
                    You can optionally share your profile in the next step for our moderated supporter wall.
                  </p>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-slate-800" />
                    <h2 className="text-2xl font-bold text-slate-900">Secure Donation</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Set an amount and continue with Razorpay checkout.
                  </p>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    Allowed range: <strong>₹10</strong> to <strong>₹5,00,000</strong> per transaction.
                  </div>

                  <div className="mt-5 space-y-3">
                    <DonateRazorpayButton onPaymentSuccess={handlePaymentSuccess} onPaymentError={handlePaymentError} />

                    {paymentError ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{paymentError}</div>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-slate-200 bg-[#0F172A] p-6 text-slate-100 shadow-sm">
                <h3 className="text-lg font-bold">Payment Trust Layer</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <p className="flex items-start gap-2">
                    <LockKeyhole className="mt-0.5 h-4 w-4 text-rose-300" />
                    Razorpay checkout with encrypted transfer and gateway-level verification.
                  </p>
                  <p className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 text-rose-300" />
                    Public supporter wall includes only approved and verified entries.
                  </p>
                  <p className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-rose-300" />
                    We do not store card details and limit public fields to what you choose to share.
                  </p>
                </div>
              </div>

              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  Note
                </p>
                <p className="mt-2 text-sm leading-6">
                  This is a personal initiative and not a registered charitable organization. Contributions are voluntary and used solely for the development and maintenance of the BSPREP platform.
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Modal */}
      {showPaymentModal && currentPaymentId && currentOrderId && (
        <PostPaymentModal
          paymentId={currentPaymentId}
          orderId={currentOrderId}
          defaultName={defaultDonorName}
          defaultEmail={defaultDonorEmail}
          onClose={handlePaymentModalClose}
          onSuccess={handlePaymentModalSuccess}
          onError={handlePaymentError}
        />
      )}

      <Footer />
    </div>
  )
}
