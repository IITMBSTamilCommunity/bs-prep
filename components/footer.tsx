"use client"

import Link from "next/link"
import { useState } from "react"
import { Linkedin, Youtube, Github, Globe, X, Instagram, Twitter } from "lucide-react"

const developers: {name: string; photo: string; linkedin: string; github: string; instagram: string; twitter: string; portfolio: string; handles: {linkedin: string; github: string; instagram: string; twitter: string; portfolio: string}; about: string}[] = []
/* DEVELOPERS_DISABLED
const _developers_data = [
  {
    name: "Prodhosh VS",
    photo: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/developers/prodhosh_photo.jpeg",
    linkedin: "https://www.linkedin.com/in/prodhoshvs/",
    github: "https://github.com/PRODHOSH",
    instagram: "https://www.instagram.com/itzprodhosh/",
    twitter: "https://x.com/prodhosh3",
    portfolio: "https://prodhosh.netlify.app/",
    handles: { linkedin: "prodhoshvs", github: "PRODHOSH", instagram: "itzprodhosh", twitter: "prodhosh3", portfolio: "prodhosh.netlify.app" },
    about:
      "Freshman at VIT Chennai and IIT Madras BS Data Science.\nI mainly build SaaS-style web platforms for clubs, communities, and small organizations with focus on usability and scalability.\nCurrently transitioning from full-stack development toward AI engineering by strengthening fundamentals and integrating intelligence into applications.\nGoal: build software that doesn't just run — it learns and adapts.",
  },
  {
    name: "Saran V",
    photo: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/developers/saran.jpg",
    linkedin: "https://www.linkedin.com/in/saran-v-7060b1385",
    github: "https://github.com/saranv007",
    instagram: "https://www.instagram.com/itz_sano_x",
    twitter: "",
    portfolio: "",
    handles: { linkedin: "saran-v", github: "saranv007", instagram: "itz_sano_x", twitter: "", portfolio: "" },
    about: "Hi, I'm Saran V, a Data Science student pursuing BS in Data Science at IIT Madras and BSc in Computer Science & Mathematics at Christ University, Bangalore. I'm passionate about Data Science and Machine Learning, aiming to become a Data Scientist/ML Engineer who builds real-world solutions using data. Through this website, I contribute to this sector by building quiz preparation tools, sharing useful resources, and integrating payment gateway systems to create practical and impactful digital solutions.",
  },
  {
    name: "Rishwanth S V",
    photo: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/developers/rishwanth.jpg",
    linkedin: "https://www.linkedin.com/in/RishSV/",
    github: "https://github.com/rishsv/",
    instagram: "https://www.instagram.com/rish.offcl",
    twitter: "",
    portfolio: "",
    handles: { linkedin: "RishSV", github: "rishsv", instagram: "rish.offcl", twitter: "", portfolio: "" },
    about: "Student at Saveetha Engineering College and IIT Madras BS in Data Science. I build practical web platforms for clubs, events, and student communities, focusing on simplicity, reliability, and real-world usability. Alongside academics, I freelance — developing websites, managing deployments, and designing logos and branding assets for organizations and small teams.\n\nMy current journey is moving from full-stack development toward AI Engineering and Data Science, data-driven systems by strengthening programming fundamentals, problem solving, and analytical thinking. I'm especially interested in creating applications that don't just display information but understand users and improve with data.\n\nI enjoy learning new technologies, experimenting with ideas, and turning concepts into working products. Long-term, I aim to build scalable software and intelligent tools that genuinely help people — tools that automate effort, support decisions, and grow smarter over time.",
  },
]
DEVELOPERS_DISABLED */

export function Footer() {
  const [activeDev, setActiveDev] = useState<string | null>(null)
  const selectedDev = developers.find((d) => d.name === activeDev) ?? null

  const quickLinks = [
    { name: "Courses", href: "/courses" },
    { name: "Quiz Prep", href: "/quiz-prep" },
    { name: "Resources", href: "/resources" },
    { name: "Support", href: "/support" },
    { name: "Careers", href: "/careers" },
  ]

  const legalLinks = [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms & Conditions", href: "/terms" },
    { name: "Disclaimer", href: "/disclaimer" },
    { name: "Community Guidelines", href: "/community" },
  ]

  const supportLinks = [
    { name: "Contact Us", href: "mailto:bsprep.team@gmail.com" },
    { name: "Support", href: "/support" },
  ]

  return (
    <>
      <footer className="bg-[#FAF8F5]/95 backdrop-blur-sm border-t border-[#EDE6DE] mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src="https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/logo.jpeg" alt="BSPrep Logo" className="w-10 h-10 rounded-full object-cover" />
                <span className="text-xl font-bold text-black">BSPrep</span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">Learn. Grow. Excel. Together.</p>
              <p className="text-slate-500 text-xs">Community-driven academic support for IIT Madras students.</p>
              <div className="flex gap-3 pt-2">
                <a
                  href="https://www.linkedin.com/company/bs-prep/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-[#0077b5] hover:text-white transition-all duration-300 hover:scale-110"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="https://www.youtube.com/@DataScienceIITMTamil"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white transition-all duration-300 hover:scale-110"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-black mb-4">Quick Links</h3>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-slate-600 hover:text-black transition-colors text-sm inline-flex items-center group">
                      <span className="group-hover:translate-x-1 transition-transform inline-block">{link.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="font-semibold text-black mb-4">Legal</h3>
              <ul className="space-y-3">
                {legalLinks.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-slate-600 hover:text-black transition-colors text-sm inline-flex items-center group">
                      <span className="group-hover:translate-x-1 transition-transform inline-block">{link.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="font-semibold text-black mb-4">Support</h3>
              <ul className="space-y-3">
                {supportLinks.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-slate-600 hover:text-black transition-colors text-sm inline-flex items-center group">
                      <span className="group-hover:translate-x-1 transition-transform inline-block">{link.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-slate-500 text-sm"> 2026 BSPrep. All rights reserved.</p>
              <p className="text-slate-400 text-xs max-w-md text-center md:text-right">
                This platform is not affiliated with IIT Madras.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Individual Developer Modal */}
      {activeDev && selectedDev && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setActiveDev(null)}
        >
          {selectedDev.name === "Rishwanth S V" ? (
            /* ── Rishwanth: photo in header, wide, scrollable ── */
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-black px-8 py-7 relative shrink-0 flex items-center justify-between gap-6">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-widest font-medium mb-1">Developer</p>
                  <h2 className="text-3xl font-bold text-white">{selectedDev.name}</h2>
                </div>
                <img
                  src={selectedDev.photo}
                  alt={selectedDev.name}
                  className="w-20 h-20 rounded-xl object-cover border-2 border-white/20 shadow-xl bg-gray-700 shrink-0"
                />
                <button
                  onClick={() => setActiveDev(null)}
                  className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              <div className="px-8 py-6 overflow-y-auto space-y-5">
                {(selectedDev.linkedin || selectedDev.github || selectedDev.instagram || selectedDev.twitter || selectedDev.portfolio) && (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedDev.linkedin && (
                      <a href={selectedDev.linkedin} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group">
                        <Linkedin className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 group-hover:text-white/50 leading-none uppercase tracking-wide">LinkedIn</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{selectedDev.handles?.linkedin}</p>
                        </div>
                      </a>
                    )}
                    {selectedDev.github && (
                      <a href={selectedDev.github} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group">
                        <Github className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 group-hover:text-white/50 leading-none uppercase tracking-wide">GitHub</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{selectedDev.handles?.github}</p>
                        </div>
                      </a>
                    )}
                    {selectedDev.instagram && (
                      <a href={selectedDev.instagram} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group">
                        <Instagram className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 group-hover:text-white/50 leading-none uppercase tracking-wide">Instagram</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{selectedDev.handles?.instagram}</p>
                        </div>
                      </a>
                    )}
                    {selectedDev.twitter && (
                      <a href={selectedDev.twitter} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group">
                        <Twitter className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 group-hover:text-white/50 leading-none uppercase tracking-wide">X / Twitter</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{selectedDev.handles?.twitter}</p>
                        </div>
                      </a>
                    )}
                    {selectedDev.portfolio && (
                      <a href={selectedDev.portfolio} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group col-span-2">
                        <Globe className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 group-hover:text-white/50 leading-none uppercase tracking-wide">Portfolio</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{selectedDev.handles?.portfolio}</p>
                        </div>
                      </a>
                    )}
                  </div>
                )}
                {selectedDev.about ? (
                  <div className="border-t border-gray-100 pt-5 pb-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium mb-3">About</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{selectedDev.about}</p>
                  </div>
                ) : (
                  <div className="border-t border-gray-100 pt-5 pb-2">
                    <p className="text-sm text-gray-400 italic">Details coming soon.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Prodhosh / Saran: original overlapping-photo design ── */
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-black px-8 pt-8 pb-16 relative">
                <button
                  onClick={() => setActiveDev(null)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <p className="text-white/40 text-xs uppercase tracking-widest font-medium">Developer</p>
                <h2 className="text-3xl font-bold text-white mt-1">{selectedDev.name}</h2>
              </div>
              <div className="relative px-8">
                <div className="-mt-12 mb-4">
                  <img
                    src={selectedDev.photo}
                    alt={selectedDev.name}
                    className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-xl bg-gray-100"
                  />
                </div>
                {(selectedDev.linkedin || selectedDev.github || selectedDev.instagram || selectedDev.twitter || selectedDev.portfolio) ? (
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {selectedDev.linkedin && (
                      <a href={selectedDev.linkedin} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group">
                        <Linkedin className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400 group-hover:text-white/60 leading-none">LinkedIn</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{selectedDev.handles?.linkedin}</p>
                        </div>
                      </a>
                    )}
                    {selectedDev.github && (
                      <a href={selectedDev.github} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group">
                        <Github className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400 group-hover:text-white/60 leading-none">GitHub</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{selectedDev.handles?.github}</p>
                        </div>
                      </a>
                    )}
                    {selectedDev.instagram && (
                      <a href={selectedDev.instagram} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group">
                        <Instagram className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400 group-hover:text-white/60 leading-none">Instagram</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{selectedDev.handles?.instagram}</p>
                        </div>
                      </a>
                    )}
                    {selectedDev.twitter && (
                      <a href={selectedDev.twitter} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group">
                        <Twitter className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400 group-hover:text-white/60 leading-none">X / Twitter</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{selectedDev.handles?.twitter}</p>
                        </div>
                      </a>
                    )}
                    {selectedDev.portfolio && (
                      <a href={selectedDev.portfolio} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-black hover:border-black hover:bg-black hover:text-white transition-all group col-span-2">
                        <Globe className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400 group-hover:text-white/60 leading-none">Portfolio</p>
                          <p className="text-xs font-semibold mt-0.5">{selectedDev.handles?.portfolio}</p>
                        </div>
                      </a>
                    )}
                  </div>
                ) : null}
                {selectedDev.about ? (
                  <div className="border-t border-gray-100 pt-5 mb-6">
                    <p className="text-[11px] text-gray-400 uppercase tracking-widest font-medium mb-2">About</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{selectedDev.about}</p>
                  </div>
                ) : (
                  <div className="pb-8">
                    <p className="text-sm text-gray-400 italic">Details coming soon.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

