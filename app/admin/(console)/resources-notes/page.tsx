"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, ExternalLink, Loader2, Search, Trash2, XCircle } from "lucide-react"

type ReviewStatus = "pending" | "approved" | "rejected"

type AdminResourceNote = {
  id: string
  user_id: string
  degree: string
  level: string
  subject: string
  notes_week_from: number
  notes_week_to: number
  title: string
  contributor_name: string
  notes_content_label: string
  drive_link: string
  status: ReviewStatus
  created_at: string
  updated_at: string
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export default function AdminResourcesNotesPage() {
  const [status, setStatus] = useState<ReviewStatus>("pending")
  const [notes, setNotes] = useState<AdminResourceNote[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes

    return notes.filter((note) => {
      return (
        note.subject.toLowerCase().includes(q) ||
        note.title.toLowerCase().includes(q) ||
        note.contributor_name.toLowerCase().includes(q) ||
        note.notes_content_label.toLowerCase().includes(q)
      )
    })
  }, [notes, query])

  const loadNotes = async (nextStatus: ReviewStatus) => {
    setLoading(true)
    setStatusMessage("")

    try {
      const res = await fetch(`/api/admin/resources-notes?status=${nextStatus}`, { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load notes")
      }

      setNotes(Array.isArray(data.notes) ? data.notes : [])
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load notes")
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadNotes(status)
  }, [status])

  const updateStatus = async (id: string, nextStatus: "approved" | "rejected") => {
    setUpdatingId(id)
    setStatusMessage("")

    try {
      const res = await fetch(`/api/admin/resources-notes/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status")
      }

      setStatusMessage(nextStatus === "approved" ? "Note approved" : "Note rejected")
      setNotes((current) => current.filter((n) => n.id !== id))
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  const deleteNote = async (id: string) => {
    const confirmed = window.confirm("Delete this note permanently?")
    if (!confirmed) {
      return
    }

    setUpdatingId(id)
    setStatusMessage("")

    try {
      const res = await fetch(`/api/admin/resources-notes/${id}`, {
        method: "DELETE",
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete note")
      }

      setStatusMessage("Note deleted")
      setNotes((current) => current.filter((n) => n.id !== id))
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to delete note")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">Resources Notes Review</h1>
        <p className="mt-1 text-sm text-slate-400">Approve or reject note submissions before they appear on the Resources page.</p>
      </header>

      {statusMessage ? <p className="rounded-lg border border-white/10 bg-[#0a101c] px-3 py-2 text-sm text-slate-200">{statusMessage}</p> : null}

      <section className="rounded-2xl border border-white/10 bg-[#070c15] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-xl bg-[#0b1220] p-1">
            {(["pending", "approved", "rejected"] as ReviewStatus[]).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setStatus(entry)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  status === entry
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                {entry}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search submissions"
              className="h-10 w-full rounded-lg border border-white/10 bg-[#0b1220] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              suppressHydrationWarning
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a101c] px-3 py-3 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading submissions...
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-[#0a101c] px-3 py-4 text-sm text-slate-400">No submissions found.</p>
          ) : (
            filtered.map((note) => (
              <article key={note.id} className="rounded-xl border border-white/10 bg-[#0a101c] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{note.degree} / {note.level}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-100">{note.title}</h2>
                    <p className="mt-1 text-sm text-slate-300">{note.subject}</p>
                    <p className="mt-1 text-xs text-slate-400">By {note.contributor_name} • Weeks {note.notes_week_from}-{note.notes_week_to}</p>
                    <p className="mt-1 text-xs text-slate-500">Submitted: {formatDate(note.created_at)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={note.drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Open Drive Link
                    </a>

                    {status === "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={updatingId === note.id}
                          onClick={() => void updateStatus(note.id, "approved")}
                          className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
                        >
                          {updatingId === note.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                          Approve
                        </button>

                        <button
                          type="button"
                          disabled={updatingId === note.id}
                          onClick={() => void updateStatus(note.id, "rejected")}
                          className="inline-flex items-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                        >
                          {updatingId === note.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                          Reject
                        </button>
                      </>
                    ) : null}

                    <button
                      type="button"
                      disabled={updatingId === note.id}
                      onClick={() => void deleteNote(note.id)}
                      className="inline-flex items-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                    >
                      {updatingId === note.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                      Delete
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-sm text-slate-300">{note.notes_content_label}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}