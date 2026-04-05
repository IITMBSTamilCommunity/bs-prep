"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Lock, Play, Clock, Star, Search, Award, BookOpen, Package, CheckCircle2 } from "lucide-react"
import { LoginModal } from "@/components/auth/login-modal"
import { SignUpModal } from "@/components/auth/signup-modal"

const BeamsBackground = dynamic(() => import("@/components/beams-background").then(mod => ({ default: mod.BeamsBackground })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-white -z-10" />
})

interface Course {
  id: string
  title: string
  level: "qualifier" | "foundation" | "diploma" | "degree"
  type: "free" | "paid"
  courseType: "skill-path" | "course" | "career-path" | "free-course"
  weeks: number
  description: string
  thumbnail: string
  includesCourses?: number
  withCertificate?: boolean
  price?: number
  originalPrice?: number
  available?: boolean
}

const courses: Course[] = [
  // Available Qualifier Courses
  {
    id: "qualifier-math-1",
    title: "Mathematics for Data Science I",
    level: "qualifier",
    type: "paid",
    courseType: "course",
    weeks: 4,
    description: "Master fundamental math concepts",
    thumbnail: "/courses/math.png",
    price: 99, originalPrice: 499,
    available: true,
    withCertificate: true
  },
  {
    id: "qualifier-stats-1",
    title: "Statistics for Data Science I",
    level: "qualifier",
    type: "paid",
    courseType: "course",
    weeks: 4,
    description: "Learn statistical thinking & analysis",
    thumbnail: "/courses/stats.png",
    price: 99, originalPrice: 499,
    available: true,
    withCertificate: true
  },
  {
    id: "qualifier-computational-thinking",
    title: "Computational Thinking",
    level: "qualifier",
    type: "paid",
    courseType: "course",
    weeks: 4,
    description: "Build problem-solving skills",
    thumbnail: "/courses/ct.png",
    price: 99, originalPrice: 499,
    available: true,
    withCertificate: true
  },
  {
    id: "qualifier-english-1",
    title: "English I",
    level: "qualifier",
    type: "paid",
    courseType: "course",
    weeks: 4,
    description: "Essential communication skills",
    thumbnail: "/courses/english.png",
    price: 99, originalPrice: 499,
    available: false,
    withCertificate: true
  },
  
  // Foundation Courses (Coming Soon)
  {
    id: "foundation-math-2",
    title: "Mathematics for Data Science II",
    level: "foundation",
    type: "paid",
    courseType: "course",
    weeks: 12,
    description: "Advanced mathematical concepts",
    thumbnail: "/courses/math.png",
    price: 99, originalPrice: 499,
    available: false,
    withCertificate: true
  },
  {
    id: "foundation-stats-2",
    title: "Statistics for Data Science II",
    level: "foundation",
    type: "paid",
    courseType: "course",
    weeks: 12,
    description: "Advanced statistical methods",
    thumbnail: "/courses/stats.png",
    price: 99, originalPrice: 499,
    available: false,
    withCertificate: true
  },
  {
    id: "foundation-programming-python",
    title: "Programming in Python",
    level: "foundation",
    type: "paid",
    courseType: "course",
    weeks: 12,
    description: "Python for data analysis",
    thumbnail: "/courses/ct.png",
    price: 99, originalPrice: 499,
    available: false,
    withCertificate: true
  },
  {
    id: "foundation-english-2",
    title: "English II",
    level: "foundation",
    type: "paid",
    courseType: "course",
    weeks: 12,
    description: "Advanced communication skills",
    thumbnail: "/courses/english.png",
    price: 99, originalPrice: 499,
    available: false,
    withCertificate: true
  }
]

export default function CoursesPage() {
  const [selectedLevel, setSelectedLevel] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)

  const filteredCourses = courses.filter(course => {
    const levelMatch = selectedLevel === "all" || course.level === selectedLevel
    const searchMatch = searchQuery === "" || 
      course.title.toLowerCase().includes(searchQuery.toLowerCase())
    return levelMatch && searchMatch
  })

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case "qualifier": return "bg-[#51b206]/20 text-[#51b206] border-[#51b206]/50"
      case "foundation": return "bg-blue-500/20 text-blue-400 border-blue-500/50"
      default: return "bg-slate-500/20 text-black/50 border-slate-500/50"
    }
  }

  const getLevelLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1)
  }

  const getCourseTypeStyles = (courseType: string) => {
    switch (courseType) {
      case "skill-path":
        return {
          bg: "bg-gradient-to-r from-cyan-50 to-cyan-100",
          text: "text-cyan-900",
          label: "Skill path",
          border: "border-l-4 border-cyan-500"
        }
      case "course":
        return {
          bg: "bg-gradient-to-r from-emerald-50 to-emerald-100",
          text: "text-emerald-900",
          label: "Course",
          border: "border-l-4 border-emerald-500"
        }
      case "career-path":
        return {
          bg: "bg-gradient-to-r from-slate-800 to-slate-900",
          text: "text-white",
          label: "Career path",
          border: "border-l-4 border-amber-500"
        }
      case "free-course":
        return {
          bg: "bg-gradient-to-r from-lime-100 to-lime-200",
          text: "text-lime-950",
          label: "Free course",
          border: "border-l-4 border-lime-600"
        }
      default:
        return {
          bg: "bg-gradient-to-r from-slate-50 to-slate-100",
          text: "text-black",
          label: "Course",
          border: "border-l-4 border-slate-400"
        }
    }
  }

  return (
    <>
    <div className="min-h-screen bg-white relative">
      <BeamsBackground />
      <Navbar isAuthenticated={false} />

      {/* Hero Section */}
      <section className="relative z-10 pt-24 pb-8 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-3 text-black">
              Courses we offer
            </h1>
            <p className="text-lg text-black/70">
              Master IITM BS curriculum with structured video courses in Tamil
            </p>
            <p className="text-sm text-black/60 mt-2">
              🇮🇳 All courses taught in Tamil language for better understanding
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="relative z-10 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          {/* Search and Filter Bar */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/50" />
              <Input
                type="text"
                placeholder="Search IITM BS courses"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-10 bg-white border-[#E5E5E5] focus:border-[#3e3098] focus:ring-[#3e3098] rounded-lg text-black placeholder:text-black/50 text-sm"
                suppressHydrationWarning
              />
            </div>
            <select 
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-4 h-10 bg-white border border-[#E5E5E5] rounded-lg text-black text-sm focus:border-[#3e3098] focus:ring-[#3e3098] focus:outline-none min-w-[140px]"
              suppressHydrationWarning
            >
              <option value="all">All Levels</option>
              <option value="qualifier">Qualifier</option>
              <option value="foundation">Foundation</option>
              <option value="diploma">Diploma</option>
              <option value="degree">Degree</option>
            </select>
          </div>

              {/* Package Deal Card */}
              {(selectedLevel === "all" || selectedLevel === "qualifier") && searchQuery === "" && (
                <div className="mb-6">
                  <div
                    onClick={() => setShowLogin(true)}
                    className="cursor-pointer"
                  >
                    <div className="relative overflow-hidden rounded-xl border-2 border-[#51b206] bg-gradient-to-r from-[#f0fde7] via-white to-[#f0fde7] shadow-md hover:shadow-xl transition-all duration-300 group">
                      {/* Ribbon */}
                      <div className="absolute top-0 right-0 bg-[#51b206] text-white text-xs font-bold px-4 py-1 rounded-bl-xl tracking-wide">BEST VALUE</div>

                      <div className="p-6 flex flex-col md:flex-row md:items-center gap-6">
                        {/* Icon + Title */}
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-14 h-14 rounded-full bg-[#51b206]/15 flex items-center justify-center shrink-0">
                            <Package className="w-7 h-7 text-[#51b206]" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#51b206] uppercase tracking-widest mb-0.5">Qualifier Bundle</p>
                            <h3 className="text-xl font-extrabold text-black leading-tight">All 3 Courses — Package Deal</h3>
                            <p className="text-sm text-gray-500 mt-0.5">Enroll in all 3 available qualifier courses at once</p>
                          </div>
                        </div>

                        {/* Included Courses */}
                        <div className="flex flex-col gap-1.5 flex-1">
                          {["Mathematics for Data Science I", "Statistics for Data Science I", "Computational Thinking"].map(name => (
                            <div key={name} className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-[#51b206] shrink-0" />
                              <span className="text-sm text-gray-700 font-medium">{name}</span>
                            </div>
                          ))}
                        </div>

                        {/* Price + CTA */}
                        <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
                          <div className="text-center md:text-right">
                            <p className="text-xs text-gray-400 line-through">₹1497 (3 × ₹499)</p>
                            <p className="text-4xl font-extrabold text-black">₹249</p>
                            <p className="text-xs text-[#51b206] font-semibold">Save ₹1248</p>
                          </div>
                          <span className="inline-block bg-[#51b206] text-white text-sm font-bold px-6 py-2.5 rounded-full group-hover:bg-[#3d8e04] transition-colors">
                            Get Package Deal
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {filteredCourses.length === 0 ? (
                <div className="text-center py-20">
                  <Search className="w-16 h-16 text-black/50 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-black mb-2">No courses found</h3>
                  <p className="text-black/70 mb-6">
                    Try adjusting your search query
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {filteredCourses.map(course => {
                  const isAvailable = course.available !== false
                  const typeStyles = getCourseTypeStyles(course.courseType)

                  return (
                    <Link
                      key={course.id}
                      href={isAvailable ? `/courses/${course.id}` : "#"}
                      className={`group block h-full ${!isAvailable ? 'pointer-events-none' : ''}`}
                    >
                      <Card className="relative bg-white border border-gray-200 hover:border-gray-400 transition-all duration-200 hover:shadow-lg rounded-lg h-full">
                        <CardContent className="p-4 flex flex-col h-full">
                          {/* Top Badge - Course Type */}
                          <div className="mb-2">
                            <span className="inline-block px-2 py-0.5 bg-gray-100 text-black text-xs font-semibold rounded">
                              {typeStyles.label}
                            </span>
                          </div>

                          {/* Course Branding/Provider */}
                          <div className="mb-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">IITM BS</span>
                          </div>

                          {/* Title */}
                          <h3 className="text-base font-bold text-black mb-2 line-clamp-2 leading-tight">
                            {course.title}
                          </h3>

                          {/* Description */}
                          <p className="text-xs text-gray-600 mb-3 line-clamp-1 leading-relaxed">
                            {course.description}
                          </p>

                          {/* Divider */}
                          <div className="h-px bg-gray-200 my-2"></div>

                          <div className="mt-auto space-y-2">
                            {/* Level */}
                            <div className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                              <span className="text-xs font-medium capitalize text-gray-700">{course.level}</span>
                            </div>
                            
                            {/* Price */}
                            {course.price && (
                              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                <span className="text-xs font-medium text-gray-600">Price</span>
                                <div className="flex items-center gap-2">
                                  {course.originalPrice && (
                                    <span className="text-xs text-gray-400 line-through">₹{course.originalPrice}</span>
                                  )}
                                  <span className="text-lg font-bold text-black">₹{course.price}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                        
                        {/* Coming Soon Overlay */}
                        {!isAvailable && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-lg">
                            <div className="bg-white px-6 py-3 rounded-lg shadow-lg border-2 border-black">
                              <p className="text-lg font-bold text-black">Coming Soon</p>
                            </div>
                          </div>
                        )}
                      </Card>
                    </Link>
                  )
                })}
              </div>
              )}
        </div>
      </section>

      <Footer />
    </div>

    <LoginModal
      open={showLogin}
      onOpenChange={setShowLogin}
      onSwitchToSignUp={() => { setShowLogin(false); setShowSignup(true) }}
      onSwitchToForgotPassword={() => setShowLogin(false)}
    />
    <SignUpModal
      open={showSignup}
      onOpenChange={setShowSignup}
      onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true) }}
    />
  </>
  )
}


