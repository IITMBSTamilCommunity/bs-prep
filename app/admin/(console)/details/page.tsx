"use client"

import { FormEvent, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type AdminProfile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  created_at: string
  avatar_url: string | null
}

export default function AdminDetailsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState("")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/me", { cache: "no-store" })
        const data = await res.json()

        if (!res.ok) {
          setStatusMessage(data.error || "Failed to load admin details")
          return
        }

        const nextProfile = data?.profile || null
        setProfile(nextProfile)
        setFirstName(nextProfile?.first_name ?? "")
        setLastName(nextProfile?.last_name ?? "")
      } catch {
        setStatusMessage("Failed to load admin details")
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setProfileSaving(true)
    setStatusMessage("")

    try {
      const res = await fetch("/api/admin/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setStatusMessage(data.error || "Failed to update profile")
        return
      }

      setProfile(data.profile)
      setStatusMessage("Profile updated successfully")
    } catch {
      setStatusMessage("Failed to update profile")
    } finally {
      setProfileSaving(false)
    }
  }

  async function deleteMyAccount() {
    setDeleteError("")
    setIsDeletingAccount(true)

    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" })
      const data = await res.json()

      if (!res.ok) {
        setDeleteError(data.error || "Failed to delete account")
        setIsDeletingAccount(false)
        return
      }

      await supabase.auth.signOut()
      router.push("/")
    } catch {
      setDeleteError("Failed to delete account")
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your profile details and admin account settings.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-[#0c1016] p-5">
        <h2 className="text-lg font-semibold text-slate-100">Profile Details</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Loading details...</p>
        ) : profile ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
            <div>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Admin avatar"
                  className="h-20 w-20 rounded-full border border-white/15 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-[#1a1e26] text-xl font-semibold text-slate-200">
                  {((profile.email || "A").trim()[0] || "A").toUpperCase()}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Email</p>
              <p className="text-sm text-slate-200">{profile.email || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Role</p>
              <p className="text-sm uppercase tracking-wide text-emerald-300">{profile.role || "admin"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">First Name</p>
              <p className="text-sm text-slate-200">{profile.first_name || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Last Name</p>
              <p className="text-sm text-slate-200">{profile.last_name || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Joined</p>
              <p className="text-sm text-slate-200">{new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Details unavailable.</p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0c1016] p-5">
        <h2 className="text-lg font-semibold text-slate-100">Change Name</h2>
        <p className="mt-1 text-sm text-slate-400">Only first and last names can be updated here.</p>

        <form onSubmit={saveProfile} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="First name"
            className="rounded-lg border border-white/10 bg-[#131821] px-3 py-2 text-slate-100 outline-none"
          />
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Last name"
            className="rounded-lg border border-white/10 bg-[#131821] px-3 py-2 text-slate-100 outline-none"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {profileSaving ? "Saving..." : "Save Name"}
            </button>
          </div>
        </form>

        {statusMessage ? <p className="mt-3 text-sm text-slate-300">{statusMessage}</p> : null}
      </section>
      <section className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5">
        <h2 className="text-lg font-semibold text-rose-300">Delete My Account</h2>
        <p className="mt-1 text-sm text-slate-300">This permanently removes your account and cannot be undone.</p>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20"
          >
            Delete My Account
          </button>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-rose-500/30 bg-[#10151d] p-4">
            <p className="text-sm text-slate-300">Type DELETE to confirm account removal.</p>
            <input
              value={deleteInput}
              onChange={(event) => setDeleteInput(event.target.value)}
              placeholder="Type DELETE"
              className="w-full rounded-lg border border-rose-500/30 bg-[#131821] px-3 py-2 text-slate-100 outline-none"
            />
            {deleteError ? <p className="text-sm text-rose-300">{deleteError}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteInput("")
                  setDeleteError("")
                }}
                className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
                disabled={isDeletingAccount}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteMyAccount}
                disabled={deleteInput !== "DELETE" || isDeletingAccount}
                className="rounded-md border border-rose-500/50 bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingAccount ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
