"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, ImagePlus, Loader2, MessageCircle, Send, Upload } from "lucide-react"
import { useSearchParams } from "next/navigation"

type DoubtItem = {
  id: string
  subject: string
  status: "open" | "in_progress" | "resolved"
  screenshot_url: string | null
  unread_for_student: boolean
  created_at: string
  updated_at: string
  last_message: string
  last_message_sender_role: "student" | "admin"
  last_message_at: string
}

type DoubtMessage = {
  id: string
  sender_id: string
  sender_role: "student" | "admin"
  sender_name: string
  message: string
  screenshot_url: string | null
  created_at: string
}

type DoubtDetailResponse = {
  doubt: DoubtItem
  messages: DoubtMessage[]
  viewer_role: "student" | "admin"
}

function statusStyles(status: DoubtItem["status"]): string {
  if (status === "resolved") return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (status === "in_progress") return "bg-blue-100 text-blue-700 border-blue-200"
  return "bg-amber-100 text-amber-700 border-amber-200"
}

function statusLabel(status: DoubtItem["status"]): string {
  if (status === "in_progress") return "In Progress"
  if (status === "resolved") return "Resolved"
  return "Open"
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export default function DashboardDoubtsPage() {
  const searchParams = useSearchParams()
  const [doubts, setDoubts] = useState<DoubtItem[]>([])
  const [selectedDoubtId, setSelectedDoubtId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DoubtMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)

  const [subject, setSubject] = useState("")
  const [question, setQuestion] = useState("")
  const [newReply, setNewReply] = useState("")
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [createScreenshotUrl, setCreateScreenshotUrl] = useState<string | null>(null)
  const [replyScreenshotUrl, setReplyScreenshotUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [replying, setReplying] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [error, setError] = useState("")

  const selectedDoubt = useMemo(
    () => doubts.find((doubt) => doubt.id === selectedDoubtId) ?? null,
    [doubts, selectedDoubtId],
  )

  const loadDoubts = async () => {
    try {
      const response = await fetch("/api/doubts", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch doubts")
      }

      const list = (data.doubts || []) as DoubtItem[]
      setDoubts(list)

      if (!selectedDoubtId && list.length > 0) {
        setSelectedDoubtId(list[0].id)
      }

      if (selectedDoubtId && !list.some((item) => item.id === selectedDoubtId)) {
        setSelectedDoubtId(list[0]?.id ?? null)
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load doubts"
      setError(message)
    } finally {
      setListLoading(false)
    }
  }

  const loadThread = async (doubtId: string) => {
    setThreadLoading(true)
    try {
      const response = await fetch(`/api/doubts/${doubtId}`, { cache: "no-store" })
      const data = (await response.json()) as DoubtDetailResponse | { error: string }
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load messages")
      }

      setMessages((data as DoubtDetailResponse).messages || [])
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load thread"
      setError(message)
    } finally {
      setThreadLoading(false)
    }
  }

  useEffect(() => {
    void loadDoubts()
  }, [])

  useEffect(() => {
    if (!selectedDoubtId) {
      setMessages([])
      return
    }

    void loadThread(selectedDoubtId)

    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") {
        return
      }
      void loadThread(selectedDoubtId)
    }, 45000)

    return () => clearInterval(interval)
  }, [selectedDoubtId])

  useEffect(() => {
    const preferredThread = searchParams.get("thread")
    if (!preferredThread) return

    if (doubts.some((item) => item.id === preferredThread)) {
      setSelectedDoubtId(preferredThread)
    }
  }, [doubts, searchParams])

  const uploadScreenshot = async (file: File): Promise<string> => {
    const body = new FormData()
    body.append("file", file)

    const response = await fetch("/api/doubts/upload-screenshot", {
      method: "POST",
      body,
    })

    const data = await response.json()
    if (!response.ok || !data.url) {
      throw new Error(data.error || "Failed to upload screenshot")
    }

    return data.url as string
  }

  const handleCreateScreenshot = async (file: File | null) => {
    if (!file) return

    setUploadingScreenshot(true)
    setError("")
    try {
      const url = await uploadScreenshot(file)
      setCreateScreenshotUrl(url)
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Screenshot upload failed"
      setError(message)
    } finally {
      setUploadingScreenshot(false)
    }
  }

  const handleReplyScreenshot = async (file: File | null) => {
    if (!file) return

    setUploadingScreenshot(true)
    setError("")
    try {
      const url = await uploadScreenshot(file)
      setReplyScreenshotUrl(url)
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Screenshot upload failed"
      setError(message)
    } finally {
      setUploadingScreenshot(false)
    }
  }

  const createDoubt = async () => {
    if (!subject.trim() || !question.trim()) {
      setError("Please enter both subject and your question.")
      return
    }

    setCreating(true)
    setError("")
    try {
      const response = await fetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          message: question,
          screenshotUrl: createScreenshotUrl,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to create doubt")
      }

      setSubject("")
      setQuestion("")
      setCreateScreenshotUrl(null)
      await loadDoubts()
      if (data?.doubt?.id) {
        setSelectedDoubtId(data.doubt.id)
      }
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to post your doubt"
      setError(message)
    } finally {
      setCreating(false)
    }
  }

  const sendReply = async () => {
    if (!selectedDoubtId || !newReply.trim()) {
      return
    }

    setReplying(true)
    setError("")
    try {
      const response = await fetch(`/api/doubts/${selectedDoubtId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: newReply,
          screenshotUrl: replyScreenshotUrl,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to send reply")
      }

      setNewReply("")
      setReplyScreenshotUrl(null)
      await loadThread(selectedDoubtId)
    } catch (replyError) {
      const message = replyError instanceof Error ? replyError.message : "Failed to send reply"
      setError(message)
    } finally {
      setReplying(false)
    }
  }

  const updateStatus = async (status: DoubtItem["status"]) => {
    if (!selectedDoubtId) return

    setStatusUpdating(true)
    setError("")
    try {
      const response = await fetch(`/api/doubts/${selectedDoubtId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to update status")
      }

      await loadDoubts()
      await loadThread(selectedDoubtId)
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : "Failed to update status"
      setError(message)
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-black">Get your doubts solved instantly</h1>
        <p className="mt-1 text-sm text-gray-600">Ask questions, attach screenshots, and chat with admin mentors until you are clear.</p>
      </header>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <Card className="border-gray-200">
        <CardContent className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-black">Ask a New Doubt</h2>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject (e.g., Probability question from Week 2)"
            className="h-11 w-full rounded-md border-2 border-gray-300 bg-white px-3 text-sm text-black caret-black outline-none transition-colors placeholder:text-gray-400 focus:border-black focus:ring-2 focus:ring-black/10"
            suppressHydrationWarning
          />
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Describe your doubt in detail so admin can help quickly"
            rows={5}
            className="min-h-28 w-full resize-y rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm text-black caret-black outline-none transition-colors placeholder:text-gray-400 focus:border-black focus:ring-2 focus:ring-black/10"
            suppressHydrationWarning
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ImagePlus className="h-4 w-4" />
              Attach Screenshot
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(event) => void handleCreateScreenshot(event.target.files?.[0] ?? null)}
              />
            </label>
            {uploadingScreenshot ? <span className="text-xs text-gray-500">Uploading...</span> : null}
            {createScreenshotUrl ? <span className="text-xs text-emerald-600">Screenshot attached</span> : null}
          </div>

          <Button onClick={createDoubt} disabled={creating || uploadingScreenshot} className="bg-black text-white hover:bg-black/85" suppressHydrationWarning>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {creating ? "Posting..." : "Post Doubt"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="border-gray-200">
          <CardContent className="p-0">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="font-semibold text-black">Your Threads</h3>
            </div>
            {listLoading ? (
              <div className="px-4 py-6 text-sm text-gray-500">Loading doubts...</div>
            ) : doubts.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No doubts yet. Post your first question.</div>
            ) : (
              <div className="max-h-140 overflow-y-auto">
                {doubts.map((doubt) => (
                  <button
                    type="button"
                    key={doubt.id}
                    onClick={() => setSelectedDoubtId(doubt.id)}
                    className={`w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${selectedDoubtId === doubt.id ? "bg-blue-50" : "bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold text-black">{doubt.subject}</p>
                      {doubt.unread_for_student ? <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className={`border text-[10px] ${statusStyles(doubt.status)}`}>{statusLabel(doubt.status)}</Badge>
                      <span className="text-[11px] text-gray-500">{formatTime(doubt.last_message_at)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-gray-600">{doubt.last_message || "No replies yet"}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-0">
            {!selectedDoubt ? (
              <div className="px-6 py-12 text-center text-gray-500">Select a doubt thread to view replies.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-black">{selectedDoubt.subject}</h3>
                    <p className="text-xs text-gray-500">Created on {formatTime(selectedDoubt.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`border text-xs ${statusStyles(selectedDoubt.status)}`}>{statusLabel(selectedDoubt.status)}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => void updateStatus("resolved")}
                      disabled={statusUpdating || selectedDoubt.status === "resolved"}
                      suppressHydrationWarning
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Mark Resolved
                    </Button>
                  </div>
                </div>

                <div className="max-h-105 space-y-3 overflow-y-auto px-5 py-4">
                  {threadLoading ? (
                    <p className="text-sm text-gray-500">Loading thread...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-gray-500">No messages yet.</p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          message.sender_role === "student"
                            ? "ml-auto bg-black text-white"
                            : "mr-auto bg-gray-100 text-black"
                        }`}
                      >
                        <p className="text-xs font-semibold opacity-80">{message.sender_role === "student" ? "You" : "Admin"}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>
                        {message.screenshot_url ? (
                          <a
                            href={message.screenshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`mt-2 block text-xs underline ${message.sender_role === "student" ? "text-white/90" : "text-blue-700"}`}
                          >
                            View screenshot
                          </a>
                        ) : null}
                        <p className={`mt-2 text-[11px] ${message.sender_role === "student" ? "text-white/70" : "text-gray-500"}`}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-gray-100 px-5 py-4">
                  <textarea
                    value={newReply}
                    onChange={(event) => setNewReply(event.target.value)}
                    placeholder="Add follow-up message"
                    rows={4}
                    className="min-h-24 w-full resize-y rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm text-black caret-black outline-none transition-colors placeholder:text-gray-400 focus:border-black focus:ring-2 focus:ring-black/10"
                    suppressHydrationWarning
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        <ImagePlus className="h-3.5 w-3.5" />
                        Attach
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={(event) => void handleReplyScreenshot(event.target.files?.[0] ?? null)}
                        />
                      </label>
                      {replyScreenshotUrl ? <span className="text-xs text-emerald-600">Attached</span> : null}
                    </div>

                    <Button
                      onClick={sendReply}
                      disabled={replying || uploadingScreenshot || !newReply.trim()}
                      className="bg-black text-white hover:bg-black/85"
                      suppressHydrationWarning
                    >
                      {replying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Reply
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <MessageCircle className="mr-2 inline h-4 w-4" />
        Admin team responds in this thread. You will also get a bell notification when there is a new reply.
      </div>
    </div>
  )
}
