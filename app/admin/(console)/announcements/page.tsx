"use client"

import { FormEvent, useEffect, useState } from "react"

type Announcement = {
  id: string | number
  title: string
  message: string
  content?: string
  announcement_type?: string
  created_by_email?: string | null
  created_at: string
}

const ANNOUNCEMENT_TYPES = ['Live Classes', 'YouTube Videos', 'Announcements', 'General']

function getAnnouncementTypeColor(type?: string): string {
  switch (type) {
    case 'Live Classes':
      return 'border-purple-500/40 bg-purple-500/10 text-purple-300'
    case 'YouTube Videos':
      return 'border-red-500/40 bg-red-500/10 text-red-300'
    case 'Announcements':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-300'
    default:
      return 'border-white/20 bg-white/5 text-slate-300'
  }
}

function toInputDateTime(value?: string): string {
  if (!value) {
    return ""
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }

  const offsetMs = parsed.getTimezoneOffset() * 60 * 1000
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16)
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [title, setTitle] = useState("")
  const [messageText, setMessageText] = useState("")
  const [announcementType, setAnnouncementType] = useState<string>("General")
  const [date, setDate] = useState("")
  const [loadingCreate, setLoadingCreate] = useState(false)

  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editMessage, setEditMessage] = useState("")
  const [editAnnouncementType, setEditAnnouncementType] = useState<string>("General")
  const [editDate, setEditDate] = useState("")
  const [loadingEdit, setLoadingEdit] = useState(false)

  const [deletingId, setDeletingId] = useState<string | number | null>(null)
  const [statusMessage, setStatusMessage] = useState("")

  async function loadAnnouncements() {
    setLoadingList(true)
    try {
      const res = await fetch("/api/announcements", { cache: "no-store" })
      const data = await res.json()

      if (!res.ok) {
        setStatusMessage(data.error || "Failed to load announcements")
        return
      }

      setAnnouncements(data)
    } catch {
      setStatusMessage("Failed to load announcements")
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    void loadAnnouncements()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setLoadingCreate(true)
    setStatusMessage("")

    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        message: messageText,
        announcement_type: announcementType,
        date,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setStatusMessage(data.error || "Something went wrong")
    } else {
      setStatusMessage("Announcement added successfully")
      setTitle("")
      setMessageText("")
      setAnnouncementType("General")
      setDate("")
      await loadAnnouncements()
    }

    setLoadingCreate(false)
  }

  function startEdit(announcement: Announcement) {
    setEditingId(announcement.id)
    setEditTitle(announcement.title)
    setEditMessage(announcement.message || announcement.content || "")
    setEditAnnouncementType(announcement.announcement_type || "General")
    setEditDate(toInputDateTime(announcement.created_at))
    setStatusMessage("")
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle("")
    setEditMessage("")
    setEditAnnouncementType("General")
    setEditDate("")
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (!editingId) {
      return
    }

    setLoadingEdit(true)
    setStatusMessage("")

    const res = await fetch(`/api/announcements/${editingId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: editTitle,
        message: editMessage,
        announcement_type: editAnnouncementType,
        date: editDate,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setStatusMessage(data.error || "Failed to update announcement")
    } else {
      setStatusMessage("Announcement updated successfully")
      cancelEdit()
      await loadAnnouncements()
    }

    setLoadingEdit(false)
  }

  async function handleDelete(id: string | number) {
    setDeletingId(id)
    setStatusMessage("")

    const res = await fetch(`/api/announcements/${id}`, {
      method: "DELETE",
    })

    const data = await res.json()

    if (!res.ok) {
      setStatusMessage(data.error || "Failed to delete announcement")
    } else {
      setStatusMessage("Announcement deleted successfully")
      if (editingId === id) {
        cancelEdit()
      }
      await loadAnnouncements()
    }

    setDeletingId(null)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">Announcements</h1>
        <p className="mt-1 text-sm text-slate-400">Create, edit, and schedule announcement messages.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-[#070c15] p-5">
        <h2 className="text-lg font-semibold text-slate-100">Create Announcement</h2>
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
          />

          <select
            value={announcementType}
            onChange={(e) => setAnnouncementType(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none"
          >
            {ANNOUNCEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <textarea
            placeholder="Message"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            required
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
          />

          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none"
          />

          <button
            type="submit"
            disabled={loadingCreate}
            className="rounded-lg border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingCreate ? "Posting..." : "Post Announcement"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#070c15] p-5">
        <h2 className="text-lg font-semibold text-slate-100">Existing Announcements</h2>
        {loadingList && <p className="mt-4 text-sm text-slate-400">Loading announcements...</p>}
        {!loadingList && announcements.length === 0 && <p className="mt-4 text-sm text-slate-400">No announcements yet.</p>}

        <div className="mt-4 space-y-3">
          {!loadingList && announcements.map((a) => (
            <article key={a.id} className="rounded-xl border border-white/10 bg-[#0a101c] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-100">{a.title}</h3>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getAnnouncementTypeColor(a.announcement_type)}`}>
                  {a.announcement_type || 'General'}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{a.message || a.content || ""}</p>
              <p className="mt-2 text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">Created by: {a.created_by_email || "Admin"}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(a)}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === a.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {editingId && (
        <section className="rounded-2xl border border-white/10 bg-[#070c15] p-5">
          <h2 className="text-lg font-semibold text-slate-100">Edit Announcement #{editingId}</h2>
          <form onSubmit={handleUpdate} className="mt-4 space-y-3">
            <input
              placeholder="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
            />

            <select
              value={editAnnouncementType}
              onChange={(e) => setEditAnnouncementType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none"
            >
              {ANNOUNCEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Message"
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
              required
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
            />

            <input
              type="datetime-local"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none"
            />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loadingEdit}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingEdit ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {statusMessage ? <p className="text-sm text-slate-300">{statusMessage}</p> : null}
    </div>
  )
}
