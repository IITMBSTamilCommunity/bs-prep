"use client"

import { useEffect, useMemo, useState } from "react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/client"
import { Heart, ImagePlus, Loader2, ShieldCheck } from "lucide-react"

type PublicDonation = {
  id: string
  name: string
  amount: number
  contributor_image_url: string | null
  note: string | null
  submitted_at: string
}

function toFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return "Network issue detected. Please check your connection and try again."
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
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

export default function DonatePage() {
  const supabase = createClient()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [amount, setAmount] = useState("")
  const [upiReferenceId, setUpiReferenceId] = useState("")
  const [note, setNote] = useState("")
  const [showPublic, setShowPublic] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [supporters, setSupporters] = useState<PublicDonation[]>([])
  const [loadingSupporters, setLoadingSupporters] = useState(true)

  const configuredUpiId = process.env.NEXT_PUBLIC_DONATION_UPI_ID?.trim()
  const upiId = !configuredUpiId || configuredUpiId.toLowerCase() === "yourname@upi" ? "bsprep@ptyes" : configuredUpiId

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
        const fullName = `${user.user_metadata?.first_name ?? ""} ${user.user_metadata?.last_name ?? ""}`.trim()
        if (fullName) setName(fullName)
        if (user.email) setEmail(user.email)
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)
    setSubmitted(false)
    setIsSubmitting(true)

    try {
      let contributorImageUrl: string | null = null

      if (imageFile) {
        const uploadData = new FormData()
        uploadData.append("file", imageFile)

        const uploadRes = await fetch("/api/donations/upload", {
          method: "POST",
          body: uploadData,
        })

        const uploadPayload = await uploadRes.json()
        if (!uploadRes.ok) {
          throw new Error(uploadPayload.error || "Failed to upload image")
        }

        contributorImageUrl = uploadPayload.url
      }

      const payload = {
        name,
        email,
        amount,
        upiReferenceId,
        note,
        showPublic,
        contributorImageUrl,
      }

      const res = await fetch("/api/donations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit donation details")
      }

      setSubmitted(true)
      setAmount("")
      setUpiReferenceId("")
      setNote("")
      setImageFile(null)

      try {
        const supportersRes = await fetch("/api/donations", { cache: "no-store" })
        if (supportersRes.ok) {
          const refreshed = await supportersRes.json()
          setSupporters(Array.isArray(refreshed.donations) ? refreshed.donations : [])
        }
      } catch (error) {
        console.error("Failed to refresh supporters after submit:", error)
      }
    } catch (error) {
      setSubmitError(toFriendlyErrorMessage(error, "Something went wrong"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-black">
      <Navbar isAuthenticated={isAuthenticated} />

      <section className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-3xl border border-[#E5DBC8] bg-white p-7 shadow-sm">
              <p className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700">
                <Heart className="h-4 w-4" />
                Support BSPREP
              </p>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Help Us Keep Learning Accessible</h1>
              <p className="mt-4 text-base leading-7 text-slate-700">
                BSPREP is an independent educational platform built to make learning data science simple, accessible, and affordable for everyone.
              </p>
              <p className="mt-3 text-base leading-7 text-slate-700">
                If you find our content helpful, you can support us to keep improving and creating more valuable resources.
              </p>

              <div className="mt-6 rounded-2xl border border-[#E5DBC8] bg-[#FFFDF8] p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your support helps us</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>Create high-quality data science content</li>
                  <li>Maintain and improve the platform</li>
                  <li>Keep resources accessible to all learners</li>
                </ul>
              </div>
            </div>

            <div className="rounded-3xl border border-[#E5DBC8] bg-white p-7 shadow-sm">
              <h2 className="text-2xl font-bold">Contribute via UPI</h2>
              <p className="mt-2 text-sm text-slate-600">Scan the QR or pay using Google Pay, PhonePe, Paytm, or any UPI app.</p>

              <div className="mt-6 grid gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
                <img
                  src="/donate-qr.jpeg"
                  alt="UPI QR for BSPREP donation"
                  className="w-[220px] rounded-2xl border border-[#E5DBC8] bg-white p-3"
                  onError={(event) => {
                    event.currentTarget.src = "/donate-qr-placeholder.svg"
                  }}
                />

                <div className="rounded-2xl border border-dashed border-[#D6C8AD] bg-[#FFF8EA] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8A5A00]">UPI ID</p>
                  <p className="mt-1 text-lg font-bold text-[#4A3200]">{upiId}</p>
                  <p className="mt-2 text-sm text-[#6B4A12]">After payment, please enter your UPI reference ID in the form so our team can verify and acknowledge your support quickly.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex">
            {submitted ? (
              <div className="flex h-full w-full flex-col justify-center rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-900 shadow-sm">
                <h3 className="text-2xl font-bold">Thank You for Your Support!</h3>
                <p className="mt-3 text-sm leading-7">
                  Your contribution means a lot to us. Because of your support, BSPREP can continue building high-quality data science content and make learning accessible to more students.
                </p>
                <p className="mt-3 text-sm leading-7">Every contribution, big or small, helps us improve the platform, create better learning resources, and support more learners.</p>
                <p className="mt-3 text-sm leading-7">Your support has been received successfully. If you submitted your details, we will acknowledge your contribution soon.</p>
                <p className="mt-3 text-sm font-semibold">From the BSPREP Team, thank you for believing in what we are building.</p>
                <p className="mt-1 text-sm font-semibold">Keep learning. Keep growing.</p>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col justify-center rounded-3xl border border-[#E5DBC8] bg-white p-7 shadow-sm">
                <h2 className="text-2xl font-bold">After Payment</h2>
                <p className="mt-2 text-sm text-slate-600">Please submit your details so we can verify and acknowledge your support.</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="h-11 w-full rounded-xl border border-[#D9D4CA] px-3 text-sm outline-none focus:border-black"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 w-full rounded-xl border border-[#D9D4CA] px-3 text-sm outline-none focus:border-black"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Amount</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        className="h-11 w-full rounded-xl border border-[#D9D4CA] px-3 text-sm outline-none focus:border-black"
                        placeholder="Amount paid"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">UPI Reference ID</label>
                      <input
                        value={upiReferenceId}
                        onChange={(e) => setUpiReferenceId(e.target.value)}
                        required
                        className="h-11 w-full rounded-xl border border-[#D9D4CA] px-3 text-sm outline-none focus:border-black"
                        placeholder="UPI transaction ref"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Supporter Image (optional)</label>
                    <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#D9D4CA] px-3 text-sm text-slate-600 hover:border-black">
                      <ImagePlus className="h-4 w-4" />
                      <span>{imageFile ? imageFile.name : "Upload your photo/logo"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Message (optional)</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={200}
                      className="min-h-[90px] w-full rounded-xl border border-[#D9D4CA] px-3 py-2 text-sm outline-none focus:border-black"
                      placeholder="Add a short message"
                    />
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-[#E5DBC8] bg-[#FFFDF8] p-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={showPublic}
                      onChange={(e) => setShowPublic(e.target.checked)}
                      className="mt-0.5"
                    />
                    Show my name and contribution on BSPREP supporter wall.
                  </label>

                  {submitError ? (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSubmitting ? "Submitting..." : "Submit Donation Details"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        <section className="mt-10 rounded-3xl border border-blue-200 bg-blue-50 p-7 text-slate-900 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 flex-shrink-0 text-blue-600" />
            <div>
              <h3 className="text-xl font-bold text-blue-900">Secure Payment & Data Privacy</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Your payment information is encrypted and secure. We use industry-standard security measures and trusted UPI gateways to protect your data. All donations are processed securely, and your personal information is never shared with third parties.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                  <span>Bank-level encryption for all transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                  <span>No credit card information stored on our servers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                  <span>Direct UPI payment processing for maximum security</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-[#E5DBC8] bg-white p-7 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Supporter Wall</h2>
            <p className="text-sm text-slate-600">People who chose to share their contribution publicly</p>
          </div>

          {loadingSupporters ? (
            <p className="mt-4 text-sm text-slate-500">Loading supporters...</p>
          ) : sortedSupporters.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No public contributions yet. Be the first supporter.</p>
          ) : (
            <div className="mt-6 flex flex-wrap items-start gap-4">
              {sortedSupporters.map((item) => (
                <article key={item.id} className="w-fit max-w-full rounded-2xl border border-[#E8E1D3] bg-[#FFFEFB] p-4 sm:max-w-[420px]">
                  {(() => {
                    const imageUrl = resolveContributorImageUrl(item.contributor_image_url)
                    return (
                  <div className="flex items-center gap-3">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.name}
                        className="h-12 w-12 rounded-full border border-[#E5DBC8] object-cover"
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          event.currentTarget.style.display = "none"
                        }}
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5DBC8] bg-[#FFF5E5] text-sm font-bold text-[#7C5200]">
                        {item.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-slate-500">{new Date(item.submitted_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                    )
                  })()}

                  {item.note ? <p className="mt-2 break-words text-sm text-slate-600">{item.note}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4" />
            Note
          </p>
          <p className="mt-2 text-sm leading-6">
            This is a personal initiative and not a registered charitable organization. Contributions are voluntary and used solely for the development and maintenance of the BSPREP platform.
          </p>
          <p className="mt-3 text-sm font-semibold">Thank you for supporting BSPREP.</p>
        </section>
      </section>

      <Footer />
    </div>
  )
}
