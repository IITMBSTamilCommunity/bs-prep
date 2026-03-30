"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Mail, Search, ShieldCheck, UserRound } from "lucide-react"

type DirectoryUser = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string
  role: string | null
  avatar_url: string | null
  created_at: string
}

export default function AdminUsersDirectoryPage() {
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")

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
        <div className="grid grid-cols-[2.2fr_1fr_1fr] border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <p>Identity</p>
          <p>Access Level</p>
          <p>Joined On</p>
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
                <article key={user.id} className="grid grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-[2.2fr_1fr_1fr]">
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

                  <p className="flex items-center gap-1 text-sm text-slate-400">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
