"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Mail, Search, ShieldCheck, UserRound, Trash2, Edit3 } from "lucide-react"

type DirectoryUser = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  role: string | null
  avatar_url: string | null
  created_at: string
}

export default function AdminUsersDirectoryPage() {
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")

  const [statusMessage, setStatusMessage] = useState("")

  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editFirstName, setEditFirstName] = useState("")
  const [editLastName, setEditLastName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editStatus, setEditStatus] = useState("")
  const [isEditProcessing, setIsEditProcessing] = useState(false)

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [deletionStatus, setDeletionStatus] = useState("")
  const [isDeleteProcessing, setIsDeleteProcessing] = useState(false)
  const [deletingUserEmail, setDeletingUserEmail] = useState("")

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" })
        if (!res.ok) {
          throw new Error("Failed to fetch users")
        }
        const data = (await res.json()) as { users?: DirectoryUser[] }
        setUsers(Array.isArray(data.users) ? data.users : [])
      } catch {
        setUsers([])
      } finally {
        setIsLoading(false)
      }
    }

    void loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    if (!query) {
      return users
    }

    return users.filter((user) => {
      const fullName = (user.full_name || `${user.first_name ?? ""} ${user.last_name ?? ""}`).toLowerCase()
      return fullName.includes(query) || user.email.toLowerCase().includes(query)
    })
  }, [searchValue, users])

  const admins = useMemo(
    () => filteredUsers.filter((u) => (u.role || "student").toLowerCase() === "admin"),
    [filteredUsers],
  )
  const students = useMemo(
    () => filteredUsers.filter((u) => (u.role || "student").toLowerCase() !== "admin"),
    [filteredUsers],
  )

  function startEditProfile(user: DirectoryUser) {
    setEditingUserId(user.id)
    setEditFirstName(user.first_name || "")
    setEditLastName(user.last_name || "")
    setEditPhone(user.phone || "")
    setEditStatus("")
  }

  function cancelEditProfile() {
    setEditingUserId(null)
    setEditFirstName("")
    setEditLastName("")
    setEditPhone("")
    setEditStatus("")
  }

  async function saveProfileChanges() {
    if (!editingUserId) return

    setIsEditProcessing(true)
    setEditStatus("")

    try {
      const res = await fetch(`/api/admin/users/${editingUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: editFirstName.trim() || null,
          last_name: editLastName.trim() || null,
          phone: editPhone.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setEditStatus(data.error || "Failed to update profile")
        return
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUserId
            ? {
                ...u,
                first_name: editFirstName.trim() || null,
                last_name: editLastName.trim() || null,
                phone: editPhone.trim() || null,
              }
            : u,
        ),
      )

      setStatusMessage("User profile updated")
      cancelEditProfile()
    } catch {
      setEditStatus("Failed to update profile. Please try again.")
    } finally {
      setIsEditProcessing(false)
    }
  }

  async function initiateUserDeletion(user: DirectoryUser) {
    setDeletingUserId(user.id)
    setDeletingUserEmail(user.email)
    setDeletionStatus("")
  }

  async function deleteUserNow() {
    if (!deletingUserId) {
      setDeletionStatus("No user selected")
      return
    }

    setIsDeleteProcessing(true)

    try {
      const res = await fetch(`/api/admin/users/${deletingUserId}/initiate-deletion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json()

      if (!res.ok) {
        setDeletionStatus(data.error || data.message || "Failed to delete user")
        return
      }

      setUsers((prev) => prev.filter((u) => u.id !== deletingUserId))
      setStatusMessage("User deleted successfully")
      closeDeleteModal()
    } catch {
      setDeletionStatus("Failed to delete user")
    } finally {
      setIsDeleteProcessing(false)
    }
  }

  function closeDeleteModal() {
    setDeletingUserId(null)
    setDeletionStatus("")
    setDeletingUserEmail("")
  }

  function renderRows(sectionUsers: DirectoryUser[]) {
    if (sectionUsers.length === 0) {
      return <div className="px-6 py-8 text-sm text-slate-400">No users found.</div>
    }

    return (
      <div className="divide-y divide-white/5">
        {sectionUsers.map((user) => {
          const fullName = user.full_name || `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unnamed User"
          const isAdmin = (user.role || "student").toLowerCase() === "admin"
          const initials = fullName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || "")
            .join("") || "U"

          return (
            <article key={user.id} className="grid grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-[2.2fr_1fr_1fr_150px]">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={fullName}
                      className="h-10 w-10 rounded-full border border-white/15 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#1a1f29] text-xs font-semibold text-slate-300">
                      {initials || <UserRound className="h-4 w-4" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-100">{fullName}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-400">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </p>
                    {user.phone ? <p className="mt-1 text-xs text-slate-500">Phone: {user.phone}</p> : null}
                  </div>
                </div>
              </div>

              <div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                    isAdmin
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-white/15 bg-white/5 text-slate-300"
                  }`}
                >
                  {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : null}
                  {isAdmin ? "Admin" : "Student"}
                </span>
              </div>

              <div>
                <p className="flex items-center gap-1 text-sm text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => startEditProfile(user)}
                  className="rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
                  title="Edit user"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => initiateUserDeletion(user)}
                  className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                  title="Delete user"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">Directory</h1>
          <p className="mt-1 text-sm text-slate-400">Search, edit, and delete users cleanly.</p>
        </div>

        <label className="flex h-11 w-full max-w-xs items-center gap-2 rounded-xl border border-white/10 bg-[#131821] px-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name or email..."
            className="h-full w-full bg-transparent text-slate-200 outline-none placeholder:text-slate-500"
            suppressHydrationWarning
          />
        </label>
      </header>

      {statusMessage ? <p className="text-sm text-slate-300">{statusMessage}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1016]">
        <div className="grid grid-cols-[2.2fr_1fr_1fr_auto] border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <p>Identity</p>
          <p>Access Level</p>
          <p>Joined On</p>
          <p>Actions</p>
        </div>

        {isLoading ? (
          <div className="px-6 py-10 text-sm text-slate-400">Loading users...</div>
        ) : (
          renderRows(filteredUsers)
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#0c1016] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Admins</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">{admins.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0c1016] px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Students</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">{students.length}</p>
        </div>
      </div>

      {editingUserId && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1016] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100">Edit User</h2>
            <p className="mt-1 text-xs text-slate-400">Only name and phone are editable.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">First Name</label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="First name"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#131821] px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">Last Name</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Last name"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#131821] px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">Phone</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Phone number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#131821] px-3 py-2 text-slate-100 outline-none"
                />
              </div>
            </div>

            {editStatus ? <p className="mt-3 text-xs text-rose-300">{editStatus}</p> : null}

            <div className="mt-6 flex gap-2">
              <button
                onClick={saveProfileChanges}
                disabled={isEditProcessing}
                className="flex-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEditProcessing ? "Saving..." : "Save"}
              </button>
              <button
                onClick={cancelEditProfile}
                disabled={isEditProcessing}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {deletingUserId && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1016] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100">Delete User</h2>
            <p className="mt-1 text-sm text-slate-400">Target: {deletingUserEmail}</p>
            <p className="mt-2 text-xs text-rose-300">This action permanently deletes the user account and related data.</p>

            {deletionStatus ? (
              <p className="mt-3 whitespace-pre-wrap rounded-lg border border-white/10 bg-[#131821] px-3 py-2 text-xs text-slate-300">
                {deletionStatus}
              </p>
            ) : null}

            <div className="mt-6 flex gap-2">
              <button
                onClick={deleteUserNow}
                disabled={isDeleteProcessing}
                className="flex-1 rounded-lg border border-rose-500/50 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleteProcessing ? "Deleting..." : "Delete Permanently"}
              </button>

              <button
                onClick={closeDeleteModal}
                disabled={isDeleteProcessing}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
