"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Navbar } from "@/components/navbar"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error("Error fetching auth user:", userError)
        router.push("/")
        return
      }

      if (!user) {
        router.push("/")
        return
      }

      setUser(user)

      const roleRes = await fetch("/api/account/me", { cache: "no-store" })
      if (!roleRes.ok) {
        const metadataRole = typeof user.user_metadata?.role === "string" ? user.user_metadata.role : "student"
        setRole(metadataRole)
        return
      }

      const roleData = await roleRes.json()
      const detectedRole = typeof roleData?.profile?.role === "string" ? roleData.profile.role : "student"
      setRole(detectedRole)

      // Redirect admin/mentor to their respective dashboards
      if (detectedRole === "admin" && window.location.pathname === "/dashboard") {
        router.push("/admin")
      } else if (detectedRole === "mentor" && window.location.pathname === "/dashboard") {
        router.push("/dashboard/mentor/courses")
      }
    }

    getUser()
  }, [])

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen">
      <Navbar isAuthenticated={true} userRole={role || "student"} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
