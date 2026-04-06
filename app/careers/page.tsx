"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ArrowRight, Briefcase, Clock, IndianRupee, MapPin } from "lucide-react"

const BeamsBackground = dynamic(() => import("@/components/beams-background").then((mod) => ({ default: mod.BeamsBackground })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-white -z-10" />,
})

const roles = [
  {
    id: "mentor-faculty",
    title: "Subject Educator",
    subtitle: "Teach IITM BS students with structured live support.",
    type: "Part-time",
    mode: "Remote",
    pay: "Paid",
    status: "Open",
  },
]

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white relative">
      <BeamsBackground />
      <Navbar isAuthenticated={false} />

      <main className="relative z-10 pt-24 pb-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-black">Careers</h1>
            <p className="mt-3 text-base md:text-lg text-black/70">Open roles at BSPrep.</p>
          </div>

          <section className="space-y-4">
            {roles.map((role) => (
              <article key={role.id} className="rounded-2xl border border-[#E5DBC8] bg-white p-5 md:p-6 shadow-sm transition hover:shadow-md">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white uppercase tracking-wide">
                        <Briefcase className="h-3.5 w-3.5" />
                        {role.title}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                        {role.status}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-black">{role.title}</h2>
                    <p className="mt-1 text-sm text-gray-600">{role.subtitle}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                        <Clock className="h-3.5 w-3.5" /> {role.type}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                        <MapPin className="h-3.5 w-3.5" /> {role.mode}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                        <IndianRupee className="h-3.5 w-3.5" /> {role.pay}
                      </span>
                    </div>
                  </div>

                  <div className="md:pt-1">
                    <Link
                      href={`/careers/${role.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85"
                    >
                      View Details & Apply
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
