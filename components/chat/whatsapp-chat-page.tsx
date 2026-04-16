"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCheck,
  Copy,
  Info,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Mic,
  Moon,
  Search,
  SendHorizonal,
  Sun,
  Trash2,
  Users,
  UserRound,
} from "lucide-react"

type Conversation = {
  id: string
  kind: "group" | "direct"
  title: string
  subtitle: string
  course_id: string
  last_message: string
  last_message_at: string | null
  last_sender_name: string | null
  last_sender_role: "student" | "mentor" | "admin" | null
  partner?: {
    id: string
    name?: string | null
    avatar_url?: string | null
    role?: string | null
    email?: string | null
  }
}

type ThreadMessage = {
  id: string
  sender_id: string
  sender_role: "student" | "mentor" | "admin"
  sender_name: string
  message: string
  created_at: string
}

type ThreadResponse = {
  conversation: {
    id: string
    kind: "group" | "direct"
    title: string
    subtitle: string
    course_id: string
  }
  messages: ThreadMessage[]
}

type MessageContextMenuState = {
  x: number
  y: number
  message: ThreadMessage
  isMine: boolean
}

type MessageInfoState = {
  message: ThreadMessage
  seenText: string
  seenNames: string[]
}

type InboxResponse = {
  viewer_id: string
  viewer_role: "student" | "mentor" | "admin"
  needs_mentor_subject: boolean
  conversations: Conversation[]
}

type SpeechRecognitionEvent = {
  resultIndex?: number
  results: ArrayLike<{
    length: number
    [index: number]: { transcript: string }
  }>
}

type SpeechRecognitionErrorEvent = {
  error: string
}

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
}

type WhatsAppChatPageProps = {
  title: string
  subtitle: string
  homeHref: string
  homeLabel: string
  onboardingHref?: string | null
  headerTheme?: "light" | "dark"
}

function formatListTime(value: string | null): string {
  if (!value) {
    return ""
  }

  const date = new Date(value)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 1000 * 60 * 60 * 24) {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  }

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function formatMessageTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export function WhatsAppChatPage({
  title,
  subtitle,
  homeHref,
  homeLabel,
  onboardingHref,
  headerTheme = "light",
}: WhatsAppChatPageProps) {
  const searchParams = useSearchParams()
  const [inbox, setInbox] = useState<InboxResponse | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  const [chatTheme, setChatTheme] = useState<"light" | "dark">("light")
  const [search, setSearch] = useState("")
  const [composer, setComposer] = useState("")
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [threadMeta, setThreadMeta] = useState<ThreadResponse["conversation"] | null>(null)
  const [contextMenu, setContextMenu] = useState<MessageContextMenuState | null>(null)
  const [messageInfo, setMessageInfo] = useState<MessageInfoState | null>(null)
  const [error, setError] = useState("")

  const endRef = useRef<HTMLDivElement | null>(null)
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const selectedConversationIdRef = useRef<string | null>(null)
  const hasAppliedRoleDefaultThemeRef = useRef(false)
  const isOpeningContactThreadRef = useRef(false)
  const handledContactMentorRef = useRef<string | null>(null)
  const isDarkHeader = headerTheme === "dark"
  const isDarkChat = chatTheme === "dark"
  const contactMentorId = searchParams.get("contactMentorId")

  const conversations = inbox?.conversations ?? []
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  )

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId
  }, [selectedConversationId])

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return conversations
    }

    return conversations.filter((conversation) => {
      return (
        conversation.title.toLowerCase().includes(term) ||
        conversation.subtitle.toLowerCase().includes(term) ||
        conversation.last_message.toLowerCase().includes(term)
      )
    })
  }, [conversations, search])

  const loadInbox = async () => {
    try {
      const response = await fetch("/api/chat/inbox", { cache: "no-store" })
      const data = (await response.json()) as InboxResponse | { error?: string }

      if (!response.ok) {
        throw new Error(data.error || "Failed to load chats")
      }

      const nextInbox = data as InboxResponse
      setInbox(nextInbox)

      if (!hasAppliedRoleDefaultThemeRef.current) {
        setChatTheme(nextInbox.viewer_role === "mentor" ? "dark" : "light")
        hasAppliedRoleDefaultThemeRef.current = true
      }

      if (!selectedConversationId && nextInbox.conversations.length > 0) {
        setSelectedConversationId(nextInbox.conversations[0].id)
      }

      if (selectedConversationId && !nextInbox.conversations.some((item) => item.id === selectedConversationId)) {
        setSelectedConversationId(nextInbox.conversations[0]?.id ?? null)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load chat inbox")
    } finally {
      setListLoading(false)
    }
  }

  const loadThread = async (conversationId: string) => {
    setThreadLoading(true)
    try {
      const response = await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, {
        cache: "no-store",
      })
      const data = (await response.json()) as ThreadResponse | { error?: string }

      if (!response.ok) {
        throw new Error(data.error || "Failed to load conversation")
      }

      const thread = data as ThreadResponse
      setThreadMeta(thread.conversation)
      setMessages(thread.messages)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load messages")
    } finally {
      setThreadLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!selectedConversationId || !composer.trim()) {
      return
    }

    setSending(true)
    setError("")

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          message: composer.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to send message")
      }

      setComposer("")
      await Promise.all([loadThread(selectedConversationId), loadInbox()])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    void loadInbox()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const RecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition
    setVoiceSupported(Boolean(RecognitionConstructor))

    return () => {
      speechRecognitionRef.current?.stop()
      speechRecognitionRef.current = null
    }
  }, [])

  const toggleVoiceInput = () => {
    void (async () => {
      if (isListening) {
        speechRecognitionRef.current?.stop()
        setIsListening(false)
        return
      }

      if (typeof window === "undefined") {
        setError("Voice input coming soon")
        return
      }

      const RecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!RecognitionConstructor) {
        setError("Voice input coming soon")
        setVoiceSupported(false)
        return
      }

      try {
        const recognition = new RecognitionConstructor()
        recognition.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-IN"
        recognition.continuous = false
        recognition.interimResults = true

        recognition.onstart = () => {
          setIsListening(true)
          setError("")
        }

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const startIndex = typeof event.resultIndex === "number" ? event.resultIndex : 0
          let transcript = ""

          for (let i = startIndex; i < event.results.length; i += 1) {
            const segment = event.results[i]?.[0]?.transcript
            if (segment) {
              transcript += ` ${segment}`
            }
          }

          const cleanTranscript = transcript.trim()
          if (!cleanTranscript) {
            return
          }

          setComposer((current) => {
            const currentValue = current.trim()
            return currentValue ? `${currentValue} ${cleanTranscript}` : cleanTranscript
          })
        }

        recognition.onerror = () => {
          setIsListening(false)
          speechRecognitionRef.current = null
          setError("Voice input coming soon")
        }

        recognition.onend = () => {
          setIsListening(false)
          speechRecognitionRef.current = null
        }

        speechRecognitionRef.current = recognition
        recognition.start()
      } catch {
        setIsListening(false)
        speechRecognitionRef.current = null
        setError("Voice input coming soon")
      }
    })()
  }

  const openDirectChat = async (targetUserId: string) => {
    const response = await fetch("/api/chat/direct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId }),
    })

    const data = (await response.json()) as { error?: string; conversation_id?: string }
    if (!response.ok) {
      throw new Error(data.error || "Failed to open chat")
    }

    return data.conversation_id ?? null
  }

  const openDirectFromUsername = async (targetUserId: string) => {
    const existingDirectConversation = conversations.find(
      (conversation) => conversation.kind === "direct" && conversation.partner?.id === targetUserId,
    )

    if (existingDirectConversation) {
      setSelectedConversationId(existingDirectConversation.id)
      return
    }

    const conversationId = await openDirectChat(targetUserId)
    if (conversationId) {
      setSelectedConversationId(conversationId)
    }
    await loadInbox()
  }

  const getSeenInfo = (targetMessage: ThreadMessage) => {
    const targetTime = new Date(targetMessage.created_at).getTime()
    const seenByMap = new Map<string, string>()

    for (const message of messages) {
      const messageTime = new Date(message.created_at).getTime()
      if (messageTime <= targetTime) {
        continue
      }

      if (message.sender_id === targetMessage.sender_id) {
        continue
      }

      if (!seenByMap.has(message.sender_id)) {
        seenByMap.set(message.sender_id, message.sender_name)
      }
    }

    const seenNames = Array.from(seenByMap.values())

    if (threadMeta?.kind === "direct") {
      if (seenNames.length > 0) {
        return {
          seenText: `Seen by ${seenNames[0]}`,
          seenNames,
        }
      }

      return {
        seenText: "Not seen yet by the other person",
        seenNames,
      }
    }

    if (seenNames.length > 0) {
      return {
        seenText: `Seen by ${seenNames.length} participant${seenNames.length > 1 ? "s" : ""}`,
        seenNames,
      }
    }

    return {
      seenText: "No one has seen this message yet",
      seenNames,
    }
  }

  const openMessageInfo = (message: ThreadMessage) => {
    const info = getSeenInfo(message)
    setMessageInfo({
      message,
      seenText: info.seenText,
      seenNames: info.seenNames,
    })
  }

  const copyMessage = async (message: ThreadMessage) => {
    try {
      await navigator.clipboard.writeText(message.message)
      setError("")
    } catch {
      setError("Could not copy message")
    }
  }

  const deleteMessage = async (messageId: string) => {
    const conversationId = selectedConversationIdRef.current
    if (!conversationId) {
      return
    }

    setDeletingMessageId(messageId)
    setError("")

    try {
      const response = await fetch("/api/chat/messages", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          messageId,
        }),
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete message")
      }

      setMessages((current) => current.filter((message) => message.id !== messageId))
      await loadInbox()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete message")
    } finally {
      setDeletingMessageId(null)
    }
  }

  useEffect(() => {
    if (!contextMenu) {
      return
    }

    const closeContextMenu = () => setContextMenu(null)
    window.addEventListener("click", closeContextMenu)
    window.addEventListener("scroll", closeContextMenu, true)

    return () => {
      window.removeEventListener("click", closeContextMenu)
      window.removeEventListener("scroll", closeContextMenu, true)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!inbox || !contactMentorId || handledContactMentorRef.current === contactMentorId) {
      return
    }

    const matchedConversation = inbox.conversations.find(
      (conversation) => conversation.kind === "direct" && conversation.partner?.id === contactMentorId,
    )

    if (matchedConversation) {
      setSelectedConversationId(matchedConversation.id)
      handledContactMentorRef.current = contactMentorId
      return
    }

    if (isOpeningContactThreadRef.current) {
      return
    }

    isOpeningContactThreadRef.current = true

    void (async () => {
      try {
        const conversationId = await openDirectChat(contactMentorId)
        if (conversationId) {
          setSelectedConversationId(conversationId)
        }
        await loadInbox()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to open direct chat")
      } finally {
        isOpeningContactThreadRef.current = false
        handledContactMentorRef.current = contactMentorId
      }
    })()
  }, [inbox, contactMentorId])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      setThreadMeta(null)
      return
    }

    void loadThread(selectedConversationId)

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadThread(selectedConversationId)
        void loadInbox()
      }
    }, 20000)

    return () => clearInterval(interval)
  }, [selectedConversationId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-bold sm:text-3xl ${isDarkHeader ? "text-slate-100" : "text-slate-900"}`}>{title}</h1>
          <p className={`mt-1 text-sm ${isDarkHeader ? "text-slate-300" : "text-slate-500"}`}>{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChatTheme((current) => (current === "dark" ? "light" : "dark"))}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
              isDarkChat
                ? "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isDarkChat ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {isDarkChat ? "Light" : "Dark"}
          </button>
          <Link
            href={homeHref}
            className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition ${
              isDarkHeader
                ? "border-slate-500/60 bg-slate-800/80 text-slate-100 hover:bg-slate-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {homeLabel}
          </Link>
        </div>
      </header>

      {inbox?.needs_mentor_subject && onboardingHref ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Select your teaching subject before chatting with students.
          <Link href={onboardingHref} className="ml-2 font-semibold underline">
            Set subject
          </Link>
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section
        className={`h-[calc(100dvh-13.25rem)] min-h-0 overflow-hidden rounded-2xl border shadow-sm ${
          isDarkChat ? "border-slate-700 bg-slate-900" : "border-[#d9e0e6] bg-[#f6f8fa]"
        }`}
      >
        <div className="grid h-full min-h-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside
            className={`${selectedConversationId ? "hidden lg:flex" : "flex"} h-full min-h-0 flex-col overflow-hidden border-r ${
              isDarkChat ? "border-slate-700 bg-slate-900" : "border-[#d9e0e6] bg-[#ffffff]"
            }`}
          >
            <div className={`border-b px-4 py-4 ${isDarkChat ? "border-slate-700 bg-slate-800" : "border-[#d9e0e6] bg-[#f0f2f5]"}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-semibold ${isDarkChat ? "text-slate-100" : "text-slate-900"}`}>Chats</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isDarkChat ? "bg-slate-700 text-slate-200" : "bg-[#e2e8f0] text-slate-600"
                  }`}
                >
                  {conversations.length}
                </span>
              </div>
              <div className={`mt-3 flex items-center rounded-lg px-3 py-2 ${isDarkChat ? "bg-slate-700" : "bg-white"}`}>
                <Search className={`h-4 w-4 ${isDarkChat ? "text-slate-300" : "text-slate-400"}`} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search chats"
                  className={`ml-2 w-full bg-transparent text-sm outline-none ${
                    isDarkChat ? "text-slate-100 placeholder:text-slate-300" : "text-slate-800 placeholder:text-slate-400"
                  }`}
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              {listLoading ? (
                <div className={`flex h-full items-center justify-center gap-2 text-sm ${isDarkChat ? "text-slate-300" : "text-slate-500"}`}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading chats...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${isDarkChat ? "text-slate-300" : "text-slate-500"}`}>
                  <MessagesSquare className={`h-9 w-9 ${isDarkChat ? "text-slate-400" : "text-slate-400"}`} />
                  <p className="text-sm">No chats available yet.</p>
                </div>
              ) : (
                <ul>
                  {filteredConversations.map((conversation) => {
                    const active = conversation.id === selectedConversationId
                    const isGroup = conversation.kind === "group"

                    return (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedConversationId(conversation.id)}
                          className={`w-full border-b px-4 py-3 text-left transition ${
                            isDarkChat
                              ? active
                                ? "border-slate-700 bg-slate-800"
                                : "border-slate-800 bg-slate-900 hover:bg-slate-800"
                              : active
                                ? "border-[#eef2f5] bg-[#ebf5ff]"
                                : "border-[#eef2f5] bg-white hover:bg-[#f8fafc]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-full text-white ${
                                isGroup ? "bg-[#0ea5e9]" : "bg-[#10b981]"
                              }`}
                            >
                              {isGroup ? <Users className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`truncate text-sm font-semibold ${isDarkChat ? "text-slate-100" : "text-slate-900"}`}>{conversation.title}</p>
                                <span className={`shrink-0 text-[11px] ${isDarkChat ? "text-slate-400" : "text-slate-400"}`}>{formatListTime(conversation.last_message_at)}</span>
                              </div>
                              <p className={`mt-0.5 truncate text-xs ${isDarkChat ? "text-slate-300" : "text-slate-500"}`}>{conversation.subtitle}</p>
                              <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${isDarkChat ? "text-slate-300" : "text-slate-500"}`}>
                                {conversation.last_sender_role ? (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                      isDarkChat ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {conversation.last_sender_role}
                                  </span>
                                ) : null}
                                <span className="truncate">{conversation.last_message}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </aside>

          <div className={`${selectedConversationId ? "flex" : "hidden lg:flex"} h-full min-h-0 flex-col overflow-hidden ${isDarkChat ? "bg-slate-950" : "bg-[#efeae2]"}`}>
            {!selectedConversation ? (
              <div className={`flex h-full flex-col items-center justify-center gap-3 px-8 text-center ${isDarkChat ? "text-slate-300" : "text-slate-500"}`}>
                <MessageCircle className={`h-12 w-12 ${isDarkChat ? "text-slate-400" : "text-slate-400"}`} />
                <p className="text-sm">Select a conversation to start chatting.</p>
              </div>
            ) : (
              <>
                <div className={`flex items-center gap-3 border-b px-4 py-3 ${isDarkChat ? "border-slate-700 bg-slate-800" : "border-[#d9e0e6] bg-[#f0f2f5]"}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedConversationId(null)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full lg:hidden ${
                      isDarkChat ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-[#dbe4ec]"
                    }`}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
                      threadMeta?.kind === "group" ? "bg-[#0ea5e9]" : "bg-[#10b981]"
                    }`}
                  >
                    {threadMeta?.kind === "group" ? <Users className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${isDarkChat ? "text-slate-100" : "text-slate-900"}`}>{threadMeta?.title || selectedConversation.title}</p>
                    <p className={`truncate text-xs ${isDarkChat ? "text-slate-300" : "text-slate-500"}`}>{threadMeta?.subtitle || selectedConversation.subtitle}</p>
                  </div>
                </div>

                <div
                  className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4"
                  style={{
                    backgroundImage: isDarkChat
                      ? "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)"
                      : "radial-gradient(circle at 1px 1px, rgba(120,120,120,0.12) 1px, transparent 0)",
                    backgroundSize: "18px 18px",
                  }}
                >
                  {threadLoading ? (
                    <div className={`flex h-full items-center justify-center gap-2 text-sm ${isDarkChat ? "text-slate-300" : "text-slate-500"}`}>
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className={`flex h-full items-center justify-center text-sm ${isDarkChat ? "text-slate-300" : "text-slate-500"}`}>No messages yet.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {messages.map((message) => {
                        const isMine = inbox?.viewer_id === message.sender_id
                        const canOpenDirectFromName =
                          !isMine &&
                          threadMeta?.kind === "group" &&
                          inbox?.viewer_role !== "admin" &&
                          message.sender_role !== "admin"

                        return (
                          <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                            <div
                              onContextMenu={(event) => {
                                event.preventDefault()
                                setContextMenu({
                                  x: event.clientX,
                                  y: event.clientY,
                                  message,
                                  isMine,
                                })
                              }}
                              className={`max-w-[86%] rounded-xl px-3 py-2 shadow-sm sm:max-w-[72%] ${
                                isMine
                                  ? isDarkChat
                                    ? "rounded-br-sm bg-emerald-700 text-emerald-50"
                                    : "rounded-br-sm bg-[#d9fdd3] text-slate-900"
                                  : isDarkChat
                                    ? "rounded-bl-sm bg-slate-800 text-slate-100"
                                    : "rounded-bl-sm bg-white text-slate-900"
                              }`}
                            >
                              {!isMine ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!canOpenDirectFromName) {
                                      return
                                    }
                                    void openDirectFromUsername(message.sender_id)
                                  }}
                                  className={`mb-1 text-[11px] font-semibold ${
                                    isDarkChat ? "text-emerald-300" : "text-emerald-700"
                                  } ${canOpenDirectFromName ? "underline decoration-dotted underline-offset-2" : ""}`}
                                  title={canOpenDirectFromName ? "Open direct message" : undefined}
                                >
                                  {message.sender_name}
                                </button>
                              ) : null}
                              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>
                              <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isDarkChat ? "text-slate-300" : "text-slate-500"}`}>
                                <span>{formatMessageTime(message.created_at)}</span>
                                {isMine ? <CheckCheck className="h-3 w-3 text-[#53bdeb]" /> : null}
                                {deletingMessageId === message.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={endRef} />
                    </div>
                  )}
                </div>

                <div className={`border-t px-3 py-3 ${isDarkChat ? "border-slate-700 bg-slate-800" : "border-[#d9e0e6] bg-[#f0f2f5]"}`}>
                  <div className="flex items-end gap-2">
                    <textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          void sendMessage()
                        }
                      }}
                      placeholder="Type a message"
                      rows={1}
                      className={`max-h-36 min-h-10 flex-1 resize-y rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#53bdeb] ${
                        isDarkChat
                          ? "border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-400"
                          : "border-[#d3dbe2] bg-white text-slate-900 placeholder:text-slate-400"
                      }`}
                      suppressHydrationWarning
                    />
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      disabled={!voiceSupported}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isListening
                          ? "border-rose-500 bg-rose-500 text-white hover:bg-rose-600"
                          : isDarkChat
                            ? "border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600"
                            : "border-[#d3dbe2] bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      title={
                        !voiceSupported
                          ? "Voice input not supported"
                          : isListening
                            ? "Stop voice input"
                            : "Start voice input"
                      }
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={sending || !composer.trim()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white transition hover:bg-[#02bd94] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {contextMenu ? (
        <div
          className={`fixed z-50 min-w-42.5 rounded-xl border shadow-xl ${
            isDarkChat ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
          }`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              void copyMessage(contextMenu.message)
              setContextMenu(null)
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
              isDarkChat ? "text-slate-100 hover:bg-slate-800" : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            <Copy className="h-4 w-4" /> Copy
          </button>

          <button
            type="button"
            onClick={() => {
              openMessageInfo(contextMenu.message)
              setContextMenu(null)
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
              isDarkChat ? "text-slate-100 hover:bg-slate-800" : "text-slate-800 hover:bg-slate-100"
            }`}
          >
            <Info className="h-4 w-4" /> Message Info
          </button>

          <button
            type="button"
            disabled={!(contextMenu.isMine || inbox?.viewer_role === "admin")}
            onClick={() => {
              if (!(contextMenu.isMine || inbox?.viewer_role === "admin")) {
                return
              }

              void deleteMessage(contextMenu.message.id)
              setContextMenu(null)
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isDarkChat ? "text-rose-300 hover:bg-slate-800" : "text-rose-600 hover:bg-slate-100"
            }`}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      ) : null}

      {messageInfo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setMessageInfo(null)}>
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-xl ${
              isDarkChat ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Message Info</h3>
            <p className={`mt-2 text-sm ${isDarkChat ? "text-slate-300" : "text-slate-600"}`}>{messageInfo.seenText}</p>

            {messageInfo.seenNames.length > 0 ? (
              <ul className={`mt-2 space-y-1 text-xs ${isDarkChat ? "text-slate-300" : "text-slate-600"}`}>
                {messageInfo.seenNames.map((name) => (
                  <li key={`${messageInfo.message.id}-${name}`}>• {name}</li>
                ))}
              </ul>
            ) : null}

            <p className={`mt-3 text-xs ${isDarkChat ? "text-slate-400" : "text-slate-500"}`}>
              Sent at {formatMessageTime(messageInfo.message.created_at)}
            </p>

            <button
              type="button"
              onClick={() => setMessageInfo(null)}
              className={`mt-4 inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition ${
                isDarkChat
                  ? "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
