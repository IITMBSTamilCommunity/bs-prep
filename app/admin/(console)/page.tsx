import Link from "next/link"
import { createServiceRoleClient } from "@/lib/supabase/server"

async function getPortalStats() {
  const service = createServiceRoleClient()

  const [{ count: userCount }, { count: announcementCount }, { count: adminCount }, { count: doubtCount }] = await Promise.all([
    service.from("profiles").select("id", { count: "exact", head: true }),
    service.from("announcements").select("id", { count: "exact", head: true }),
    service.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
    service.from("doubts").select("id", { count: "exact", head: true }),
  ])

  return {
    users: userCount ?? 0,
    announcements: announcementCount ?? 0,
    admins: adminCount ?? 0,
    doubts: doubtCount ?? 0,
  }
}

export default async function AdminPage() {
  const stats = await getPortalStats()

  const externalTools = [
    {
      name: "Google Search Console",
      description: "Monitor indexing, crawl issues, and search performance.",
      href: "https://search.google.com/search-console?resource_id=sc-domain:bsprep.in",
    },
    {
      name: "Google Analytics",
      description: "Track traffic, engagement, conversions, and top pages.",
      href: "https://analytics.google.com/analytics/web/#/a386139611p528155601/reports/intelligenthome",
    },
  ]

  const cards = [
    {
      title: "Users",
      description: "Browse user directory and role access.",
      href: "/admin/users",
      value: stats.users,
    },
    {
      title: "Announcements",
      description: "Create, edit, and delete announcements.",
      href: "/admin/announcements",
      value: stats.announcements,
    },
    {
      title: "Doubts",
      description: "Reply to student doubts and track resolution status.",
      href: "/admin/doubts",
      value: stats.doubts,
    },
    {
      title: "Settings",
      description: "Manage your admin profile and account settings.",
      href: "/admin/details",
      value: stats.admins,
    },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">Admin Portal</h1>
        <p className="mt-1 text-sm text-slate-400">Manage users, announcements, and admin access from one place.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-2xl border border-white/10 bg-[#070c15] p-5 transition hover:border-white/20 hover:bg-[#0b1220]"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.title}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-100">{card.value}</p>
            <p className="mt-2 text-sm text-slate-400">{card.description}</p>
            <p className="mt-4 text-sm font-medium text-blue-300">Open section</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#070c15] p-5">
        <h2 className="text-lg font-semibold text-slate-100">External Tools</h2>
        <p className="mt-1 text-sm text-slate-400">Open essential reporting tools in a new tab from any device.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {externalTools.map((tool) => (
            <a
              key={tool.name}
              href={tool.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-white/10 bg-[#0b1220] p-4 transition hover:border-white/20 hover:bg-[#101a2d]"
            >
              <p className="text-sm font-semibold text-slate-100">{tool.name}</p>
              <p className="mt-1 text-sm text-slate-400">{tool.description}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-blue-300">Open link</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
