"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Navbar } from "@/components/navbar"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

function formatSupabaseError(error: unknown) {
  if (!error) return null

  if (error instanceof Error) {
    return { message: error.message }
  }

  if (typeof error === "object") {
    const e = error as {
      message?: string
      code?: string
      details?: string
      hint?: string
      status?: number
      name?: string
    }

    return {
      message: e.message ?? e.name ?? "Unknown Supabase error",
      code: e.code,
      details: e.details,
      hint: e.hint,
      status: e.status,
    }
  }

  return { message: String(error) }
}

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

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      if (error) {
        const details = formatSupabaseError(error)
        console.warn("Profile fetch failed, defaulting to student role:", details)
        // Keep app usable even if role fetch fails for unexpected reasons.
        setRole("student")
        return
      }

      if (profile) {
        console.log("User role detected:", profile.role)
        setRole(profile.role || "student")
        
        // Redirect admin/mentor to their respective dashboards
        if (profile.role === "admin" && window.location.pathname === "/dashboard") {
          router.push("/dashboard/admin/users")
        } else if (profile.role === "mentor" && window.location.pathname === "/dashboard") {
          router.push("/dashboard/mentor/courses")
        }
        return
      }

      // If profile row does not exist yet, create a default one and proceed as student.
      const { error: createProfileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email ?? null,
            first_name: user.user_metadata?.first_name ?? "",
            last_name: user.user_metadata?.last_name ?? "",
            role: "student",
          },
          { onConflict: "id" }
        )

      if (createProfileError) {
        console.error("Error creating default profile:", createProfileError)
      }

      setRole("student")
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
