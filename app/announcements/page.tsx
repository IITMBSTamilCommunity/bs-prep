"use client"

import { useEffect, useState } from "react"

type Announcement = {
  id: number
  title: string
  message: string
  content?: string
  created_at: string
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch("/api/announcements")
        const data = await res.json()
        setAnnouncements(data)
      } catch (err) {
        console.error("Failed to fetch announcements", err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnnouncements()
  }, [])

  if (loading) {
    return <p className="p-6">Loading announcements...</p>
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">📢 Announcements</h1>

      {announcements.length === 0 && (
        <p>No announcements yet.</p>
      )}

      {announcements.map((a) => (
        <div
          key={a.id}
          className="border rounded-lg p-4"
        >
          <h2 className="font-semibold text-lg">{a.title}</h2>
          <p className="mt-1">{a.message || a.content || ""}</p>
          <p className="text-sm text-gray-500 mt-2">
            {new Date(a.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}
