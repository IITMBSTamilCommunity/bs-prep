"use client"

import { useEffect, useMemo, useState } from "react"
import { MessageSquare, Search, Send, Loader2, CheckCircle2 } from "lucide-react"

type AdminDoubt = {
  id: string
  student_id: string
  student_name: string
  student_email: string | null
  subject: string
  status: "open" | "in_progress" | "resolved"
  screenshot_url: string | null
  created_at: string
  updated_at: string
  last_message: string
  last_message_sender_role: "student" | "admin"
  last_message_at: string
}

type DoubtMessage = {
  id: string
  sender_role: "student" | "admin"
  sender_name: string
  message: string
  screenshot_url: string | null
  created_at: string
}

function statusClass(status: AdminDoubt["status"]): string {
  if (status === "resolved") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  if (status === "in_progress") return "border-blue-500/30 bg-blue-500/10 text-blue-300"
  return "border-amber-500/30 bg-amber-500/10 text-amber-300"
}

function statusLabel(status: AdminDoubt["status"]): string {
  if (status === "in_progress") return "IN PROGRESS"
  if (status === "resolved") return "RESOLVED"
  return "OPEN"
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

export default function AdminDoubtsPage() {
  const [doubts, setDoubts] = useState<AdminDoubt[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DoubtMessage[]>([])
  const [search, setSearch] = useState("")
  const [reply, setReply] = useState("")
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [replying, setReplying] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const filteredDoubts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return doubts
    return doubts.filter((item) => {
      return (
        item.subject.toLowerCase().includes(query) ||
        (item.student_name || "").toLowerCase().includes(query) ||
        (item.student_email || "").toLowerCase().includes(query)
      )
    })
  }, [doubts, search])

  const selected = useMemo(() => doubts.find((item) => item.id === selectedId) ?? null, [doubts, selectedId])

  const loadDoubts = async () => {
    try {
      const response = await fetch("/api/doubts?view=admin", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to load doubts")
      }

      const list = (data.doubts || []) as AdminDoubt[]
      setDoubts(list)

      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id)
      }

      if (selectedId && !list.some((item) => item.id === selectedId)) {
        setSelectedId(list[0]?.id ?? null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load doubts"
      setStatusMessage(message)
    } finally {
      setLoadingList(false)
    }
  }

  const loadThread = async (id: string) => {
    setLoadingThread(true)
    try {
      const response = await fetch(`/api/doubts/${id}`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to load thread")
      }

      setMessages(data.messages || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load thread"
      setStatusMessage(message)
    } finally {
      setLoadingThread(false)
    }
  }

  useEffect(() => {
    void loadDoubts()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }

    void loadThread(selectedId)
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") {
        return
      }
      void loadThread(selectedId)
      void loadDoubts()
    }, 45000)

    return () => clearInterval(interval)
  }, [selectedId])

  const handleReply = async () => {
    if (!selectedId || !reply.trim()) return

    setReplying(true)
    setStatusMessage("")
    try {
      const response = await fetch(`/api/doubts/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to send reply")
      }

      setReply("")
      await loadThread(selectedId)
      await loadDoubts()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send reply"
      setStatusMessage(message)
    } finally {
      setReplying(false)
    }
  }

  const updateStatus = async (status: AdminDoubt["status"]) => {
    if (!selectedId) return

    setStatusUpdating(true)
    setStatusMessage("")
    try {
      const response = await fetch(`/api/doubts/${selectedId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update status")
      }

      await loadThread(selectedId)
      await loadDoubts()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status"
      setStatusMessage(message)
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">Doubt Queries</h1>
        <p className="mt-1 text-sm text-slate-400">Respond to student questions, track progress, and close threads after clarification.</p>
      </header>

      {statusMessage ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{statusMessage}</p> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[500px_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#070c15]">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search queries..."
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1220] pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                suppressHydrationWarning
              />
            </div>
          </div>

          <div className="max-h-160 overflow-y-auto p-3">
            {loadingList ? (
              <p className="px-2 py-4 text-sm text-slate-400">Loading queries...</p>
            ) : filteredDoubts.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-400">No queries found.</p>
            ) : (
              <div className="space-y-3">
                {filteredDoubts.map((doubt) => (
                  <article
                    key={doubt.id}
                    className={`rounded-xl border p-4 transition ${
                      selectedId === doubt.id
                        ? "border-blue-500/40 bg-[#101827]"
                        : "border-white/10 bg-[#0a101c] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">{doubt.student_name || "Student"}</h3>
                        <p className="text-xs text-slate-500">{doubt.student_email || "No email"}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(doubt.status)}`}>
                        {statusLabel(doubt.status)}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg border border-white/10 bg-[#0e1524] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Question</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">{doubt.subject}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{doubt.last_message || "No messages yet"}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatDate(doubt.last_message_at || doubt.updated_at)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedId(doubt.id)}
                      className="mt-3 w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-blue-300 transition hover:bg-blue-500/20"
                    >
                      Continue Thread
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#070c15]">
          {!selected ? (
            <div className="flex min-h-120 items-center justify-center px-4 text-center text-slate-500">
              Select a query to view and reply.
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">Student</p>
                    <h2 className="text-lg font-semibold text-slate-100">{selected.student_name}</h2>
                    <p className="text-xs text-slate-500">{selected.student_email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void updateStatus("in_progress")}
                      disabled={statusUpdating}
                      className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 disabled:opacity-60"
                    >
                      Mark In Progress
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus("resolved")}
                      disabled={statusUpdating}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
                    >
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                      Mark Resolved
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-white/10 bg-[#0b1220] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Question</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{selected.subject}</p>
                  {selected.screenshot_url ? (
                    <a
                      href={selected.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-blue-300 underline"
                    >
                      Open attached screenshot
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="max-h-105 space-y-3 overflow-y-auto px-5 py-4">
                {loadingThread ? (
                  <p className="text-sm text-slate-400">Loading conversation...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-slate-400">No messages in this thread yet.</p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.sender_role === "admin"
                          ? "ml-auto bg-blue-600 text-white"
                          : "mr-auto bg-[#111827] text-slate-100"
                      }`}
                    >
                      <p className="text-xs font-semibold opacity-80">{message.sender_role === "admin" ? "Admin" : message.sender_name}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>
                      {message.screenshot_url ? (
                        <a
                          href={message.screenshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block text-xs underline"
                        >
                          View screenshot
                        </a>
                      ) : null}
                      <p className="mt-2 text-[11px] opacity-80">{formatDate(message.created_at)}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-white/10 px-5 py-4">
                <div className="rounded-xl border border-white/10 bg-[#0b1220] p-3">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Type your reply for the student"
                    rows={4}
                    className="w-full resize-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                    suppressHydrationWarning
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleReply()}
                  disabled={replying || !reply.trim()}
                  className="mt-3 inline-flex items-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {replying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send Reply
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <p className="text-xs text-slate-500">
        <MessageSquare className="mr-1 inline h-4 w-4" />
        Replies from this panel will trigger student notifications in their dashboard.
      </p>
    </div>
  )
}
