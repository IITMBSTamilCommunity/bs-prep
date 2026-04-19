"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { BookOpen, Trophy, Users, TrendingUp, Calendar, Clock, Video, Award, Star } from "lucide-react"

interface Course {
  id: string
  title: string
  description: string
  level: string
  type: string
  courseType?: string
  weeks: number
  thumbnail: string
  includesCourses?: number
  withCertificate?: boolean
}

interface LiveClass {
  course: string
  topic: string
  meetingLink: string
  time: string
  date: string
}

const COURSE_DISPLAY_NAMES: Record<string, string> = {
  "ct": "Computational Thinking",
  "math-1": "Mathematics for Data Science I",
  "stats-1": "Statistics I",
  "python": "Programming in Python",
  "math-2": "Mathematics for Data Science II",
  "stats-2": "Statistics II",
  "english-1": "English I",
  "english-2": "English II",
}

function getCourseDisplayName(code: string): string {
  return COURSE_DISPLAY_NAMES[code.toLowerCase()] ?? code
}

function formatTime12hr(time: string): string {
  const [hourStr, minuteStr] = time.split(":")
  let hour = parseInt(hourStr, 10)
  const minute = minuteStr ?? "00"
  const period = hour >= 12 ? "PM" : "AM"
  hour = hour % 12 || 12
  return `${hour}:${minute} ${period}`
}

export default function StudentDashboard() {
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([])
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchLiveClasses = async () => {
      try {
        const response = await fetch("/api/live-classes")
        if (response.ok) {
          const data = await response.json()
          const now = Date.now()
          const upcoming = (data.classes || []).filter((cls: LiveClass) => {
            try {
              const [h, m] = (cls.time || "0:0").split(":").map(Number)
              const d = new Date(cls.date)
              d.setHours(h, m, 0, 0)
              // keep classes that haven't ended (allow 60 min past start)
              return d.getTime() + 60 * 60 * 1000 > now
            } catch {
              return true
            }
          })
          setLiveClasses(upcoming)
        }
      } catch (error) {
        console.error("Error fetching live classes:", error)
      }
    }
    fetchLiveClasses()
  }, [])

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Student")
          setUserEmail(user.email || "")
          const av = user.user_metadata?.avatar_url || user.user_metadata?.picture || null
          setUserAvatar(av)
          
          // Get enrolled courses with details
          const { data: enrollments } = await supabase
            .from('enrollments')
            .select('course_id')
            .eq('user_id', user.id)
          
          if (enrollments && enrollments.length > 0) {
            const courseIds = enrollments.map(e => e.course_id)
            const { data: courses } = await supabase
              .from('courses')
              .select('*')
              .in('id', courseIds)
            
            setEnrolledCourses(courses || [])
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  const getCourseTypeStyles = (courseType: string) => {
    switch (courseType) {
      case "skill-path":
        return { bg: "bg-gradient-to-r from-cyan-50 to-cyan-100", text: "text-cyan-900", label: "Skill path", border: "border-l-4 border-cyan-500" }
      case "course":
        return { bg: "bg-gradient-to-r from-emerald-50 to-emerald-100", text: "text-emerald-900", label: "Course", border: "border-l-4 border-emerald-500" }
      case "career-path":
        return { bg: "bg-gradient-to-r from-slate-800 to-slate-900", text: "text-white", label: "Career path", border: "border-l-4 border-amber-500" }
      case "free-course":
        return { bg: "bg-gradient-to-r from-lime-100 to-lime-200", text: "text-lime-950", label: "Free course", border: "border-l-4 border-lime-600" }
      default:
        return { bg: "bg-gradient-to-r from-slate-50 to-slate-100", text: "text-black", label: "Course", border: "border-l-4 border-slate-400" }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#51b206]"></div>
      </div>
    )
  }

  const hasNoEnrollments = enrolledCourses.length === 0
  const dashboardLiveClasses = hasNoEnrollments
    ? liveClasses.filter((cls) => cls.course?.toLowerCase() === "python")
    : liveClasses

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Avatar with Pro star */}
          <div className="relative shrink-0">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="h-14 w-14 rounded-full border-2 border-gray-200 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-gray-200 bg-gray-100 text-lg font-bold text-gray-600">
                {(userName[0] || "S").toUpperCase()}
              </div>
            )}
            {enrolledCourses.length > 0 && (
              <span
                title="Enrolled student"
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-amber-400 to-orange-500 shadow"
              >
                <Star className="h-2.5 w-2.5 fill-white text-white" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-black">
                Welcome back, {userName}!
              </h1>
              {enrolledCourses.length > 0 && (
                <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow">
                  Pro
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">
              Continue your learning journey with IITM BS courses
            </p>
          </div>
        </div>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSfyhCw9tPgKmMWYPhjV6Kzixp2RdYEi-x7JPL6JUxoLwbnB_g/viewform?usp=sharing&ouid=109000575421815991569"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-full hover:bg-black/80 transition-colors"
        >
          Join Us
        </a>
      </div>

      {/* Upcoming Live Classes */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-black">
            {hasNoEnrollments ? "Python Live Classes" : "Upcoming Live Classes"}
          </h2>
          <Link href="/dashboard/live-classes">
            <Button size="sm" className="bg-black text-white hover:bg-black/80 text-sm font-semibold">
              Check All Live Classes
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardLiveClasses.length === 0 ? (
            <div className="col-span-full bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600">
                {hasNoEnrollments
                  ? "No Python live classes scheduled at the moment."
                  : "No live classes scheduled at the moment."}
              </p>
            </div>
          ) : (
            dashboardLiveClasses.slice(0, 3).map((liveClass, index) => (
            <Card key={index} className="bg-white border border-gray-200 hover:border-black transition-all duration-200 hover:shadow-lg rounded-xl overflow-hidden">
              <CardContent className="p-0">
                {/* Card Header */}
                <div className="px-5 pt-5 pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/10 border border-red-200 text-xs font-semibold px-2 py-0.5">
                      <Video className="w-3 h-3 mr-1" />
                      Live
                    </Badge>
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </div>
                  {/* Course Title */}
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Course</p>
                    <h3 className="font-bold text-black text-base leading-snug line-clamp-2">
                      {getCourseDisplayName(liveClass.course)}
                    </h3>
                  </div>
                  {/* Topic */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Topic</p>
                    <p className="font-bold text-gray-700 leading-snug line-clamp-2 font-medium">
                      {liveClass.topic}
                    </p>
                  </div>
                </div>
                {/* Card Footer */}
                <div className="px-5 py-3">
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span className="font-medium">{new Date(liveClass.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span className="font-medium">{formatTime12hr(liveClass.time)}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-black hover:bg-black/80 text-white font-semibold text-sm"
                    onClick={() => window.open(liveClass.meetingLink, "_blank")}
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Join Meeting
                  </Button>
                </div>
              </CardContent>
            </Card>
          )))}
        </div>
      </div>

      {enrolledCourses.length === 0 ? (
        /* Not enrolled — show explore prompt only */
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-white border border-gray-200 rounded-2xl text-center">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-black mb-3">Start Your IITM BS Journey</h2>
          <p className="text-gray-500 max-w-md mb-8 leading-relaxed">
            You haven&apos;t enrolled in any courses yet. Explore our Tamil-medium qualifier courses and get started today.
          </p>
          <Link href="/dashboard/courses">
            <Button className="bg-black text-white hover:bg-black/80 px-8 py-5 rounded-full font-semibold text-base gap-2">
              Explore Courses
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* My Courses */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-black">My Courses</h2>
              <Link href="/dashboard/courses">
                <Button size="sm" className="bg-black text-white hover:bg-black/80 text-sm font-semibold gap-1.5">
                  Explore More
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrolledCourses.slice(0, 6).map((course) => {
                const typeStyles = getCourseTypeStyles(course.courseType || "course")
                return (
                  <Link key={course.id} href={`/courses/${course.id}`} className="group block h-full">
                    <Card className="relative bg-white border border-gray-200 hover:border-gray-400 transition-all duration-200 hover:shadow-lg rounded-lg h-full">
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="mb-2">
                          <span className="inline-block px-2 py-0.5 bg-gray-100 text-black text-xs font-semibold rounded">
                            {typeStyles.label}
                          </span>
                        </div>
                        <div className="mb-1">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">IITM BS</span>
                        </div>
                        <h3 className="text-base font-bold text-black mb-2 line-clamp-2 leading-tight">
                          {course.title}
                        </h3>
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                        <div className="h-px bg-gray-200 my-2"></div>
                        {course.includesCourses && (
                          <div className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-gray-500" />
                            Includes <span className="font-semibold text-black">{course.includesCourses} courses</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-auto">
                          <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-xs font-medium capitalize text-gray-700">{course.level}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
