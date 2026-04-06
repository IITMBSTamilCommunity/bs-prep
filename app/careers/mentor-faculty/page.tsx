"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ArrowLeft, CheckCircle2, Clock, IndianRupee, MapPin, Briefcase } from "lucide-react"

const BeamsBackground = dynamic(() => import("@/components/beams-background").then((mod) => ({ default: mod.BeamsBackground })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-white -z-10" />,
})

const APPLY_LINK = "https://forms.gle/hUGXu7MPNpdS3i7CA"

const requirements = [
  "A or S grade in relevant IITM BS course",
  "Overall CGPA 7.5 or above",
  "Good Tamil or English explanation skills",
  "Stable internet and decent microphone",
]

export default function MentorFacultyPage() {
  return (
    <div className="min-h-screen bg-white relative">
      <BeamsBackground />
      <Navbar isAuthenticated={false} />

      <main className="relative z-10 pt-24 pb-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Link href="/careers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to careers
          </Link>

          <section className="rounded-2xl border border-[#E5DBC8] bg-white p-6 md:p-8 shadow-sm">
            <div className="mb-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white uppercase tracking-wide">
                <Briefcase className="h-3.5 w-3.5" />
                Subject Educator
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-black">Subject Educator</h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                <Clock className="h-3.5 w-3.5" /> Part-time
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                <MapPin className="h-3.5 w-3.5" /> Remote
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                <IndianRupee className="h-3.5 w-3.5" /> Paid
              </span>
            </div>

            <div className="mt-6">
              <h2 className="text-xl font-semibold text-black">Job Description</h2>
              <p className="mt-2 text-sm md:text-base text-gray-700 leading-relaxed">
                Deliver focused live teaching for IITM BS students, clear academic doubts, and support exam preparation with structured guidance.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-black mb-3">Requirements</h3>
              <ul className="space-y-2">
                {requirements.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={APPLY_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-black/85"
            >
              Apply
            </a>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
