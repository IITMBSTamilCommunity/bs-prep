"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2, ArrowLeft, Video, Search, X } from "lucide-react";
import Link from "next/link";

const LiveClassCard = dynamic(
  () => import("@/components/live-class-card").then(mod => ({ default: mod.LiveClassCard })),
  {
    ssr: false,
    loading: () => <div className="h-36 animate-pulse rounded-xl bg-gray-100" />
  }
);

interface LiveClass {
  course: string;
  topic: string;
  meetingLink: string;
  time: string;
  date: string;
  youtubeLink?: string;
}

type Filter = "all" | "upcoming" | "completed";

const COURSE_LABELS: Record<string, string> = {
  "ct": "Computational Thinking",
  "math-1": "Mathematics I",
  "stats-1": "Statistics I",
  "python": "Programming in Python",
  "math-2": "Mathematics II",
  "stats-2": "Statistics II",
  "english-1": "English I",
  "english-2": "English II",
};

function getStatus(date: string, time: string): "live" | "upcoming" | "completed" {
  const classDate = new Date(date);
  const [hours, minutes] = time.split(":").map(Number);
  classDate.setHours(hours, minutes, 0, 0);
  const diffMins = Math.floor((classDate.getTime() - Date.now()) / 60000);
  if (diffMins < -60) return "completed";
  if (diffMins <= 15 && diffMins >= -60) return "live";
  return "upcoming";
}

export default function LiveClassesPage() {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/live-classes");
        if (!response.ok) throw new Error("Failed to fetch live classes");
        const data = await response.json();
        setClasses(data.classes || []);
      } catch (err) {
        console.error("Error fetching classes:", err);
        setError("Unable to load live classes. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
    const interval = setInterval(fetchClasses, 30000);
    return () => clearInterval(interval);
  }, []);

  // Unique course codes present in data
  const availableCourses = useMemo(() => {
    const codes = Array.from(new Set(classes.map(c => c.course.toLowerCase())));
    return codes.sort();
  }, [classes]);

  const toggleCourse = (code: string) => {
    setSelectedCourses(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const filtered = classes.filter((cls) => {
    // Status filter
    if (filter !== "all") {
      const s = getStatus(cls.date, cls.time);
      if (filter === "upcoming" && s !== "upcoming" && s !== "live") return false;
      if (filter === "completed" && s !== "completed") return false;
    }
    // Topic search
    if (search.trim() && !cls.topic.toLowerCase().includes(search.trim().toLowerCase())) return false;
    // Course filter
    if (selectedCourses.length > 0 && !selectedCourses.includes(cls.course.toLowerCase())) return false;
    return true;
  });

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Completed" },
  ];

  const hasActiveFilters = search.trim() || selectedCourses.length > 0;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-black transition-colors text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Page Header */}
      <div className="bg-white border border-gray-200 rounded-xl px-7 py-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center shrink-0">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black leading-tight">Live Classes</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Join upcoming lectures and watch recordings of past classes.
            </p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-2xl font-bold text-black">{classes.length}</p>
          <p className="text-xs text-gray-500 font-medium">Total Classes</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by topic…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-white text-black text-sm focus:outline-none focus:border-black transition-colors"
          suppressHydrationWarning
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar filter */}
        <aside className="hidden lg:block w-52 shrink-0 bg-white border border-gray-200 rounded-xl p-4 space-y-4 sticky top-24">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Status</p>
            <div className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === tab.key ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50 hover:text-black"
                  }`}
                >
                  {tab.label}
                  {tab.key !== "all" && (
                    <span className={`ml-1.5 text-xs ${filter === tab.key ? "text-white/60" : "text-gray-400"}`}>
                      {classes.filter(c => {
                        const s = getStatus(c.date, c.time);
                        return tab.key === "upcoming" ? s === "upcoming" || s === "live" : s === "completed";
                      }).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {availableCourses.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Course</p>
              <div className="space-y-1">
                {availableCourses.map(code => {
                  const label = COURSE_LABELS[code] ?? code;
                  const active = selectedCourses.includes(code);
                  return (
                    <button
                      key={code}
                      onClick={() => toggleCourse(code)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                        active ? "bg-black text-white" : "text-gray-600 hover:bg-gray-50 hover:text-black"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-sm border-2 flex-shrink-0 ${active ? "bg-white border-white" : "border-gray-300"}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(""); setSelectedCourses([]); setFilter("all"); }}
              className="w-full text-xs text-red-500 hover:text-red-700 font-semibold py-1 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Mobile filter tabs */}
          <div className="flex lg:hidden items-center gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                  filter === tab.key
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-600 border-gray-200 hover:border-black hover:text-black"
                }`}
              >
                {tab.label}
                {tab.key !== "all" && (
                  <span className={`ml-1.5 text-xs ${filter === tab.key ? "text-white/70" : "text-gray-400"}`}>
                    {classes.filter((c) => {
                      const s = getStatus(c.date, c.time);
                      return tab.key === "upcoming" ? s === "upcoming" || s === "live" : s === "completed";
                    }).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Results count */}
          {!loading && !error && (
            <p className="text-xs text-gray-400 font-medium">
              {filtered.length} {filtered.length === 1 ? "class" : "classes"} found
              {hasActiveFilters && " · "}
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearch(""); setSelectedCourses([]); setFilter("all"); }}
                  className="text-red-500 hover:text-red-700 underline underline-offset-2"
                >
                  clear filters
                </button>
              )}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-black" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
              <p className="text-gray-600 font-medium">No classes match your filters.</p>
              <button
                onClick={() => { setSearch(""); setSelectedCourses([]); setFilter("all"); }}
                className="mt-2 text-sm text-black underline underline-offset-2 hover:no-underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((cls, index) => (
                <LiveClassCard
                  key={index}
                  course={cls.course}
                  topic={cls.topic}
                  meetingLink={cls.meetingLink}
                  time={cls.time}
                  date={cls.date}
                  youtubeLink={cls.youtubeLink}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
