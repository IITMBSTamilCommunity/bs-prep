"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Mail, Search, ShieldCheck, UserRound, Trash2 } from "lucide-react"

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

  // Deletion flow state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerificationCode, setOtpVerificationCode] = useState("")
  const [deletionStatus, setDeletionStatus] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [deletingUserEmail, setDeletingUserEmail] = useState("")
  const [testingOTP, setTestingOTP] = useState("")

  // Edit profile state
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editFirstName, setEditFirstName] = useState("")
  const [editLastName, setEditLastName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editStatus, setEditStatus] = useState("")
  const [isEditProcessing, setIsEditProcessing] = useState(false)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch("/api/admin/users")
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

  async function initiateUserDeletion(user: DirectoryUser) {
    if (user.role === 'admin') {
      setDeletionStatus("Cannot delete admin accounts. Only general users can be deleted.")
      return
    }

    setDeletingUserId(user.id)
    setDeletingUserEmail(user.email)
    setDeletionStatus("")
    setOtpVerificationCode("")
    setIsProcessing(true)

    try {
      const res = await fetch(`/api/admin/users/${user.id}/initiate-deletion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json()

      if (!res.ok) {
        setDeletionStatus(data.error || "Failed to initiate deletion")
        setDeletingUserId(null)
        setIsProcessing(false)
        return
      }

      setOtpSent(true)
      // For development/testing - show the OTP if available
      if (data.otp_for_testing) {
        setTestingOTP(data.otp_for_testing)
        setDeletionStatus(`DEV MODE: OTP Code = ${data.otp_for_testing}\n\nOTP sent to ${data.masked_email}.\nClick "Auto-fill Testing OTP" button below to use it.`)
      } else {
        setDeletionStatus(`OTP has been sent to ${data.masked_email}.\n\nPlease check email and enter the OTP code below.`)
      }
    } catch (error) {
      setDeletionStatus("Failed to initiate deletion. Please try again.")
      setDeletingUserId(null)
    } finally {
      setIsProcessing(false)
    }
  }

  async function confirmUserDeletion() {
    if (!deletingUserId || !otpVerificationCode) {
      setDeletionStatus("Please enter the OTP")
      return
    }

    setIsProcessing(true)

    try {
      const res = await fetch(`/api/admin/users/${deletingUserId}/confirm-deletion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpVerificationCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        const message = data.message || data.error || "Failed to confirm deletion"
        const attemptsRemaining = data.attempts_remaining || 0
        let errorMsg = `❌ ${message}`
        if (attemptsRemaining > 0) {
          errorMsg += `\n\nAttempts remaining: ${attemptsRemaining}`
        }
        setDeletionStatus(errorMsg)
        return
      }

      setDeletionStatus(`✅ Account deleted successfully.\n\nAll user data has been permanently removed.`)
      setUsers(users.filter((u) => u.id !== deletingUserId))
      
      // Reset deletion flow after 2 seconds
      setTimeout(() => {
        setDeletingUserId(null)
        setOtpSent(false)
        setOtpVerificationCode("")
        setDeletionStatus("")
        setTestingOTP("")
      }, 2000)
    } catch (error) {
      setDeletionStatus("❌ Failed to confirm deletion. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  function cancelDeletion() {
    setDeletingUserId(null)
    setOtpSent(false)
    setOtpVerificationCode("")
    setDeletionStatus("")
    setTestingOTP("")
  }

  function autoFillTestOTP() {
    if (testingOTP) {
      setOtpVerificationCode(testingOTP)
    }
  }

  function startEditProfile(user: DirectoryUser) {
    setEditingUserId(user.id)
    setEditFirstName(user.first_name || "")
    setEditLastName(user.last_name || "")
    setEditEmail(user.email)
    setEditPhone(user.phone || "")
    setEditStatus("")
  }

  function cancelEditProfile() {
    setEditingUserId(null)
    setEditFirstName("")
    setEditLastName("")
    setEditEmail("")
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
          email: editEmail.trim(),
          phone: editPhone.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setEditStatus(data.error || "Failed to update profile")
        return
      }

      setEditStatus("Profile updated successfully")
      
      // Update local user data
      setUsers(
        users.map((u) =>
          u.id === editingUserId
            ? {
                ...u,
                first_name: editFirstName.trim() || null,
                last_name: editLastName.trim() || null,
                email: editEmail.trim(),
                phone: editPhone.trim() || null,
              }
            : u
        )
      )

      // Close modal after 1.5 seconds
      setTimeout(() => {
        cancelEditProfile()
      }, 1500)
    } catch (error) {
      setEditStatus("Failed to update profile. Please try again.")
    } finally {
      setIsEditProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">Directory</h1>
          <p className="mt-1 text-sm text-slate-400">Manage users and admin accounts.</p>
        </div>

        <label className="flex h-11 w-full max-w-xs items-center gap-2 rounded-xl border border-white/10 bg-[#0a101c] px-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name or email..."
            className="h-full w-full bg-transparent text-slate-200 outline-none placeholder:text-slate-500"
          />
        </label>
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#070c15]">
        <div className="grid grid-cols-[2.2fr_1fr_1fr_auto] border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <p>Identity</p>
          <p>Access Level</p>
          <p>Joined On</p>
          <p>Actions</p>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-sm text-slate-400">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-6 py-12 text-sm text-slate-400">No users found.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredUsers.map((user) => {
              const fullName = user.full_name || `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unnamed User"
              const isAdmin = user.role === "admin"
              const initials = fullName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() || "")
                .join("") || "U"

              return (
                <article key={user.id} className="grid grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-[2.2fr_1fr_1fr_auto]">
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#111a2d] text-xs font-semibold text-slate-300">
                          {initials || <UserRound className="h-4 w-4" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-100">{fullName}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-slate-400">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </p>
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
                      {isAdmin ? "Admin" : "User"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <p className="flex items-center gap-1 text-sm text-slate-400">
                        <CalendarDays className="h-4 w-4" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                      {user.phone && (
                        <p className="mt-1 text-xs text-slate-500">Phone: {user.phone}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditProfile(user)}
                        className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/20"
                        title="Edit user profile"
                      >
                        Edit
                      </button>
                      {!isAdmin && (
                        <button
                          onClick={() => initiateUserDeletion(user)}
                          disabled={deletingUserId === user.id}
                          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Delete this user"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {deletingUserId && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl border border-white/10 bg-[#070c15] p-6 shadow-xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-100">Confirm User Deletion</h2>
            <p className="mt-2 text-sm text-slate-400">
              {otpSent
                ? "An OTP has been sent to the user's email. Enter it below to confirm deletion."
                : `Are you sure you want to delete ${deletingUserEmail}? This action cannot be undone.`}
            </p>

            {deletionStatus && (
              <div className={`mt-4 rounded-lg border px-3 py-2 text-xs whitespace-pre-wrap ${
                deletionStatus.includes("successfully")
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-300"
              }`}>
                {deletionStatus}
              </div>
            )}

            {otpSent && (
              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otpVerificationCode}
                  onChange={(e) => setOtpVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 text-center font-mono text-lg"
                />
                {testingOTP && (
                  <button
                    onClick={autoFillTestOTP}
                    type="button"
                    className="w-full rounded-lg border border-slate-500/40 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-500/20"
                  >
                    Auto-fill Testing OTP ({testingOTP})
                  </button>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              {otpSent ? (
                <>
                  <button
                    onClick={confirmUserDeletion}
                    disabled={isProcessing || otpVerificationCode.length !== 6}
                    className="flex-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isProcessing ? "Verifying..." : "Confirm Deletion"}
                  </button>
                  <button
                    onClick={cancelDeletion}
                    disabled={isProcessing}
                    className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => initiateUserDeletion(users.find(u => u.id === deletingUserId)!)}
                    disabled={isProcessing}
                    className="flex-1 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isProcessing ? "Sending OTP..." : "Send OTP"}
                  </button>
                  <button
                    onClick={cancelDeletion}
                    disabled={isProcessing}
                    className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {editingUserId && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
          <div className="rounded-2xl border border-white/10 bg-[#070c15] p-6 shadow-xl max-w-md w-full mx-4 my-8">
            <h2 className="text-lg font-semibold text-slate-100">Edit User Profile</h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">First Name</label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="First name"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">Last Name</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Last name"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email address"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400">Phone (Optional)</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Phone number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            {editStatus && (
              <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                editStatus.includes("successfully")
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-300"
              }`}>
                {editStatus}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={saveProfileChanges}
                disabled={isEditProcessing}
                className="flex-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEditProcessing ? "Saving..." : "Save Changes"}
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
    </div>
  )
}
