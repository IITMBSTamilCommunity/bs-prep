"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { createClient } from "@/lib/supabase/client"
import { Heart, ShieldCheck } from "lucide-react"
import { RazorpayButton } from "@/components/razorpay/razorpay-button"
import { PostPaymentModal } from "@/components/razorpay/post-payment-modal"

const BeamsBackground = dynamic(() => import("@/components/beams-background").then((mod) => ({ default: mod.BeamsBackground })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-white" />,
})

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

export default function DonatePage() {
  const supabase = createClient()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [defaultDonorName, setDefaultDonorName] = useState("")
  const [defaultDonorEmail, setDefaultDonorEmail] = useState("")

  const [supporters, setSupporters] = useState<PublicDonation[]>([])
  const [loadingSupporters, setLoadingSupporters] = useState(true)

  // Payment flow state
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null)
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const paymentSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [supporterPage, setSupporterPage] = useState(0)
  const supportersPerPage = 50

  const sortedSupporters = useMemo(
    () => [...supporters].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()),
    [supporters],
  )

  const totalSupporterPages = Math.max(1, Math.ceil(sortedSupporters.length / supportersPerPage))
  const paginatedSupporters = sortedSupporters.slice(
    supporterPage * supportersPerPage,
    (supporterPage + 1) * supportersPerPage,
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
    setSupporterPage(0)

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
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Donation Info */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-black/10 bg-[#FAF8F5]/95 p-7 shadow-sm backdrop-blur-[1px]">
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

              <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your support helps us</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>Create high-quality data science content</li>
                  <li>Maintain and improve the platform</li>
                  <li>Keep resources accessible to all learners</li>
                </ul>
              </div>
            </div>

            
          </div>

          {/* Right Column - Payment + Easy & Secure */}
          <div className="space-y-6">
            {paymentSuccess ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-900 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-xl text-white">✓</div>
                <h3 className="mt-3 text-2xl font-bold">Thank You!</h3>
                <p className="mt-3 text-sm leading-7">
                  Your support has been received successfully. We're grateful for your contribution to BSPREP.
                </p>
                <p className="mt-3 text-sm leading-7">
                  An email confirmation has been sent to you. Your name may also appear on our supporter wall.
                </p>
                <p className="mt-4 text-sm font-semibold">Keep learning. Keep growing.</p>
              </div>
            ) : (
              <div className="rounded-3xl border border-black/10 bg-[#FAF8F5]/95 p-7 shadow-sm backdrop-blur-[1px]">
                <h2 className="text-2xl font-bold">Support Us Today</h2>
                <p className="mt-2 text-sm text-slate-600">Enter your desired amount and proceed to secure payment via Razorpay.</p>

                <div className="mt-6 space-y-4">
                  <RazorpayButton
                    onPaymentSuccess={handlePaymentSuccess}
                    onPaymentError={handlePaymentError}
                  />

                  {paymentError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {paymentError}
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    We partner with Razorpay, India's leading payment gateway, for secure and reliable transactions.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-black/10 bg-[#FAF8F5]/95 p-7 shadow-sm backdrop-blur-[1px]">
              <h2 className="text-2xl font-bold">Easy & Secure</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-rose-600 flex-shrink-0"></span>
                  <span>
                    <strong>Choose Amount:</strong> Select any amount you're comfortable with
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-rose-600 flex-shrink-0"></span>
                  <span>
                    <strong>Secure Payment:</strong> Powered by Razorpay with bank-level encryption
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-rose-600 flex-shrink-0"></span>
                  <span>
                    <strong>Share Your Story:</strong> After payment, tell us about yourself (optional)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-rose-600 flex-shrink-0"></span>
                  <span>
                    <strong>Get Recognized:</strong> Join our supporter wall (if you choose)
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Security Info Section */}
        <section className="mt-10 rounded-3xl border border-blue-200 bg-blue-50 p-7 text-slate-900 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 flex-shrink-0 text-blue-600" />
            <div>
              <h3 className="text-xl font-bold text-blue-900">Secure & Private</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Your payment is processed through Razorpay, India's most trusted payment gateway. All transactions are encrypted with bank-level security. We never store your card details.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                  <span>PCI DSS Level 1 compliance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                  <span>256-bit SSL encryption for all transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                  <span>Your data is never shared with third parties</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Supporter Wall */}
        <section className="mt-10 rounded-3xl border border-[#E5DBC8] bg-white p-7 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Supporter Wall</h2>
            <p className="text-sm text-slate-600">Amazing people who support BSPREP</p>
          </div>

          {loadingSupporters ? (
            <p className="mt-4 text-sm text-slate-500">Loading supporters...</p>
          ) : sortedSupporters.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No public contributions yet. Be the first supporter!</p>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedSupporters.map((item) => (
                  <article key={item.id} className="w-full rounded-2xl border border-[#E8E1D3] bg-[#FFFEFB] p-4">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const imageUrl = resolveContributorImageUrl(item.contributor_image_url)
                        return imageUrl ? (
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
                        )
                      })()}
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-slate-500">{new Date(item.submitted_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <p className="mt-2 break-words text-sm text-slate-600">{item.note?.trim() || "No comment"}</p>
                  </article>
                ))}
              </div>
              {totalSupporterPages > 1 ? (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSupporterPage((page) => Math.max(0, page - 1))}
                    disabled={supporterPage === 0}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white text-black transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous supporters"
                  >
                    ←
                  </button>
                  <span className="text-sm text-slate-600">
                    {supporterPage + 1} / {totalSupporterPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSupporterPage((page) => Math.min(totalSupporterPages - 1, page + 1))}
                    disabled={supporterPage >= totalSupporterPages - 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white text-black transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next supporters"
                  >
                    →
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* Disclaimer */}
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
