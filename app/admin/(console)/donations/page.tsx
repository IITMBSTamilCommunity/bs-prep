"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, IndianRupee } from "lucide-react"

type Donation = {
  id: string
  name: string
  email: string
  amount: number
  razorpay_payment_id: string | null
  contributor_image_url: string | null
  show_public: boolean
  note: string | null
  status: string
  submitted_at: string
}

function isVerifiedStatus(status: string): boolean {
  const normalized = status.toLowerCase().trim()
  return normalized === "verified" || normalized === "reviewed"
}

function isFinalStatus(status: string): boolean {
  const normalized = status.toLowerCase().trim()
  return normalized === "verified" || normalized === "reviewed" || normalized === "rejected" || normalized === "deleted"
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

function getFriendlyErrorMessage(error: unknown, fallback: string): string {
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

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/donations", { cache: "no-store" })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : "Failed to load donations")
          return
        }

        setDonations(Array.isArray(data?.donations) ? data.donations : [])
      } catch (error) {
        setError(getFriendlyErrorMessage(error, "Failed to load donations"))
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return donations

    return donations.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        (item.razorpay_payment_id && item.razorpay_payment_id.toLowerCase().includes(query))
      )
    })
  }, [donations, search])

  const totalAmount = useMemo(
    () => filtered.reduce((sum, item) => (isVerifiedStatus(item.status) ? sum + Number(item.amount || 0) : sum), 0),
    [filtered],
  )

  async function updateDonationStatus(id: string, status: "verified" | "rejected" | "pending" | "deleted") {
    setUpdatingId(id)
    setError("")
    try {
      const res = await fetch("/api/admin/donations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to update donation status")
        return
      }

      setDonations((prev) => {
        if (status === "deleted") {
          return prev.filter((item) => item.id !== id)
        }
        return prev.map((item) => (item.id === id ? { ...item, status } : item))
      })
    } catch (error) {
      setError(getFriendlyErrorMessage(error, "Failed to update donation status"))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">Donations</h1>
          <p className="mt-1 text-sm text-slate-400">View who paid, donation amount, payment ID, and supporter image.</p>
        </div>

        <label className="flex h-11 w-full max-w-xs items-center gap-2 rounded-xl border border-white/10 bg-[#131821] px-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, payment ID"
            suppressHydrationWarning
            autoComplete="off"
            className="h-full w-full bg-transparent text-slate-200 outline-none placeholder:text-slate-500"
          />
        </label>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#0c1016] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Contributions</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0c1016] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Verified Amount</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">INR {totalAmount.toFixed(2)}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1016]">
        <div className="grid grid-cols-[2.2fr_1.1fr_1.4fr_0.9fr_0.9fr_1.2fr] border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <p>Contributor</p>
          <p>Amount</p>
          <p>Payment ID</p>
          <p>Status</p>
          <p>Public</p>
          <p>Actions</p>
        </div>

        {isLoading ? (
          <p className="px-6 py-8 text-sm text-slate-400">Loading donations...</p>
        ) : error ? (
          <p className="px-6 py-8 text-sm text-rose-300">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-400">No donations found.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((item) => (
              <article key={item.id} className="grid grid-cols-[2.2fr_1.1fr_1.4fr_0.9fr_0.9fr_1.2fr] items-center gap-4 px-6 py-4">
                {(() => {
                  const imageUrl = resolveContributorImageUrl(item.contributor_image_url)
                  const displayName = formatDisplayName(item.name)
                  return (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0">
                    <div className="absolute inset-0 flex items-center justify-center rounded-full border border-white/15 bg-[#1a1f29] text-sm font-semibold text-slate-300">
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={displayName}
                        className="relative h-12 w-12 rounded-full border border-white/15 object-cover"
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          event.currentTarget.style.display = "none"
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{displayName}</p>
                    <p className="truncate text-xs text-slate-500">{item.email}</p>
                    {item.note ? <p className="truncate text-xs text-slate-500">{item.note}</p> : null}
                  </div>
                </div>
                  )
                })()}

                <p className="flex items-center gap-1 text-sm font-semibold text-emerald-300">
                  <IndianRupee className="h-4 w-4" />
                  {Number(item.amount).toFixed(2)}
                </p>

                <p className="text-xs text-slate-300">{item.razorpay_payment_id ? item.razorpay_payment_id.substring(0, 12) + "..." : "N/A"}</p>

                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    item.status === "verified"
                      ? "text-emerald-300"
                      : item.status === "rejected"
                        ? "text-rose-300"
                        : item.status === "deleted"
                          ? "text-slate-400"
                        : "text-amber-300"
                  }`}
                >
                  {item.status}
                </p>

                <p className={`text-xs font-semibold uppercase tracking-wide ${item.show_public ? "text-emerald-300" : "text-slate-400"}`}>
                  {item.show_public ? "Yes" : "No"}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateDonationStatus(item.id, "verified")}
                    disabled={updatingId === item.id || isFinalStatus(item.status)}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 disabled:opacity-50"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDonationStatus(item.id, "rejected")}
                    disabled={updatingId === item.id || isFinalStatus(item.status)}
                    className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDonationStatus(item.id, "deleted")}
                    disabled={updatingId === item.id}
                    className="rounded-md border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-[11px] font-semibold text-slate-300 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
