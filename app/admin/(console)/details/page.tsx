"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type DirectoryUser = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  role: string
  created_at: string
}

export default function AdminDetailsPage() {
  const router = useRouter()
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState("")

  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileFirstName, setProfileFirstName] = useState("")
  const [profileLastName, setProfileLastName] = useState("")
  const [profileEmail, setProfileEmail] = useState("")

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setCurrentUserId(user?.id ?? null)

        const usersRes = await fetch("/api/admin/users", { cache: "no-store" })
        const usersData = await usersRes.json()

        if (!usersRes.ok) {
          setStatusMessage(usersData.error || "Failed to load users")
          return
        }

        setUsers(Array.isArray(usersData.users) ? usersData.users : [])

        const meRes = await fetch("/api/admin/me", { cache: "no-store" })
        const meData = await meRes.json()
        if (meRes.ok && meData?.profile) {
          setProfileFirstName(meData.profile.first_name ?? "")
          setProfileLastName(meData.profile.last_name ?? "")
          setProfileEmail(meData.profile.email ?? "")
        }
      } catch {
        setStatusMessage("Failed to load admin details")
      } finally {
        setIsLoading(false)
        setProfileLoading(false)
      }
    }

    void load()
  }, [])

  const currentAdmin = useMemo(() => users.find((u) => u.id === currentUserId) ?? null, [users, currentUserId])
  const admins = useMemo(() => users.filter((u) => u.role?.toLowerCase() === "admin"), [users])
  const students = useMemo(() => users.filter((u) => u.role?.toLowerCase() !== "admin"), [users])

  const renderRoleSection = (sectionUsers: DirectoryUser[], sectionLabel: string, emptyLabel: string) => {
    if (sectionUsers.length === 0) {
      return <p className="mt-3 text-sm text-slate-400">{emptyLabel}</p>
    }

    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-white/10 bg-[#0a101c] px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-500">
          <p>Email</p>
          <p>{sectionLabel}</p>
          <p>Action</p>
        </div>
        <div className="divide-y divide-white/5">
          {sectionUsers.map((user) => {
            const isAdmin = (user.role || "").toLowerCase() === "admin"
            const isCurrentUser = user.id === currentUserId
            return (
              <article key={user.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-sm text-slate-200 md:grid-cols-[2fr_1fr_1fr] md:items-center">
                <p className="truncate">{user.email || "No email"}</p>
                <p className={`uppercase tracking-wide ${isAdmin ? "text-emerald-300" : "text-slate-300"}`}>
                  {isAdmin ? "admin" : user.role || "student"}
                </p>
                <div>
                  <button
                    type="button"
                    disabled={pendingUserId === user.id}
                    onClick={() => updateRole(user, isAdmin ? "student" : "admin")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isAdmin
                        ? "border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                        : "border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                    }`}
                  >
                    {pendingUserId === user.id ? "Updating..." : isAdmin ? "Demote to Student" : "Promote to Admin"}
                  </button>
                  {isCurrentUser ? <p className="mt-1 text-[11px] text-slate-500">Your account</p> : null}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    )
  }

  async function saveProfile() {
    setProfileSaving(true)
    setStatusMessage("")

    try {
      const res = await fetch("/api/admin/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: profileFirstName,
          last_name: profileLastName,
          email: profileEmail,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setStatusMessage(data.error || "Failed to update profile")
        return
      }

      setStatusMessage("Profile updated successfully")
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUserId
            ? {
                ...u,
                first_name: data.profile.first_name,
                last_name: data.profile.last_name,
                email: data.profile.email,
                full_name: [data.profile.first_name, data.profile.last_name].filter(Boolean).join(" ") || null,
              }
            : u
        )
      )
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

      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/")
    } catch {
      setDeleteError("Failed to delete account")
      setIsDeletingAccount(false)
    }
  }

  async function updateRole(target: DirectoryUser, nextRole: "admin" | "student") {
    setPendingUserId(target.id)
    setStatusMessage("")

    try {
      const res = await fetch(`/api/admin/users/${target.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: nextRole }),
      })

      const data = await res.json()
      if (!res.ok) {
        setStatusMessage(data.error || "Failed to update role")
        return
      }

      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: nextRole } : u)))
      setStatusMessage(`${target.email} updated to ${nextRole}`)
    } catch {
      setStatusMessage("Failed to update role")
    } finally {
      setPendingUserId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">Admin Details</h1>
        <p className="mt-1 text-sm text-slate-400">Manage admin accounts and role access without SQL.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-[#070c15] p-5">
        <h2 className="text-lg font-semibold text-slate-100">Current Admin</h2>
        {currentAdmin ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Name</p>
              <p className="text-sm text-slate-200">
                {currentAdmin.full_name || [currentAdmin.first_name, currentAdmin.last_name].filter(Boolean).join(" ") || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Email</p>
              <p className="text-sm text-slate-200">{currentAdmin.email || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Role</p>
              <p className="text-sm uppercase tracking-wide text-emerald-300">{currentAdmin.role || "admin"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Joined</p>
              <p className="text-sm text-slate-200">{new Date(currentAdmin.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Current admin profile details are unavailable.</p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#070c15] p-5">
        <h2 className="text-lg font-semibold text-slate-100">My Profile</h2>
        <p className="mt-1 text-sm text-slate-400">Update your own admin profile details.</p>

        {profileLoading ? (
          <p className="mt-4 text-sm text-slate-400">Loading profile...</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={profileFirstName}
              onChange={(event) => setProfileFirstName(event.target.value)}
              placeholder="First name"
              className="rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none"
            />
            <input
              value={profileLastName}
              onChange={(event) => setProfileLastName(event.target.value)}
              placeholder="Last name"
              className="rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none"
            />
            <input
              value={profileEmail}
              onChange={(event) => setProfileEmail(event.target.value)}
              placeholder="Email"
              className="rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none md:col-span-2"
            />
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={saveProfile}
                disabled={profileSaving}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {profileSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5">
        <h2 className="text-lg font-semibold text-rose-300">Delete My Account</h2>
        <p className="mt-1 text-sm text-slate-300">
          Permanently delete your admin account and all associated data. This cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20"
          >
            Delete My Account
          </button>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-rose-500/30 bg-[#0a101c] p-4">
            <p className="text-sm text-slate-300">Type DELETE to confirm account removal.</p>
            <input
              value={deleteInput}
              onChange={(event) => setDeleteInput(event.target.value)}
              placeholder="Type DELETE"
              className="w-full rounded-lg border border-rose-500/30 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none"
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

      <section className="rounded-2xl border border-white/10 bg-[#070c15] p-5">
        <h2 className="text-lg font-semibold text-slate-100">Role Management</h2>
        <p className="mt-1 text-sm text-slate-400">Promote users to admin or demote admins to student.</p>

        {isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No users found.</p>
        ) : (
          <>
            <div className="mt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Admins</h3>
              {renderRoleSection(admins, "Role", "No admins found.")}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-300">Students</h3>
              {renderRoleSection(students, "Role", "No students found.")}
            </div>
          </>
        )}

        <p className="mt-3 text-xs text-slate-500">Total admins: {admins.length}</p>
      </section>

      {statusMessage ? <p className="text-sm text-slate-300">{statusMessage}</p> : null}
    </div>
  )
}
