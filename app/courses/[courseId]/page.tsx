"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { BeamsBackground } from "@/components/beams-background"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowLeft, BookOpen, Calendar, FileText, Video, Search, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { LiveClassCard } from "@/components/live-class-card"
import { LoginModal } from "@/components/auth/login-modal"
import { SignUpModal } from "@/components/auth/signup-modal"

interface LiveClass {
  course: string
  topic: string
  meetingLink: string
  time: string
  date: string
  youtubeLink?: string
}

// Course syllabus data
const courseSyllabusData: Record<string, any> = {
  "qualifier-math-1": {
    title: "Mathematics for Data Science I",
    level: "qualifier",
    price: 99, originalPrice: 499,
    description: "Fundamental mathematics concepts for data science",
    thumbnail: "/courses/math.png",
    syllabus: [
      {
        week: 1,
        title: "Set Theory - Number system, Sets and their operations",
        topics: "Relations and functions - Relations and their types, Functions and their types"
      },
      {
        week: 2,
        title: "Rectangular coordinate system, Straight Lines",
        topics: "Slope of a line, Parallel and perpendicular lines, Representations of a Line, General equations of a line, Straight-line fit"
      },
      {
        week: 3,
        title: "Quadratic Functions",
        topics: "Quadratic functions, Minima, maxima, vertex, and slope, Quadratic Equations"
      },
      {
        week: 4,
        title: "Algebra of Polynomials",
        topics: "Addition, subtraction, multiplication, and division, Algorithms, Graphs of Polynomials - X-intercepts, multiplicities, end behavior, and turning points, Graphing & polynomial creation"
      }
    ]
  },
  "qualifier-stats-1": {
    title: "Statistics for Data Science I",
    level: "qualifier",
    price: 99, originalPrice: 499,
    description: "Introduction to statistical thinking and analysis",
    thumbnail: "/courses/stats.png",
    syllabus: [
      {
        week: 1,
        title: "Introduction and type of data",
        topics: "Types of data, Descriptive and Inferential statistics, Scales of measurement"
      },
      {
        week: 2,
        title: "Describing categorical data",
        topics: "Frequency distribution of categorical data, Best practices for graphing categorical data, Mode and median for categorical variable"
      },
      {
        week: 3,
        title: "Describing numerical data",
        topics: "Frequency tables for numerical data, Measures of central tendency - Mean, median and mode, Quartiles and percentiles, Measures of dispersion - Range, variance, standard deviation and IQR, Five number summary"
      },
      {
        week: 4,
        title: "Association between two variables",
        topics: "Association between two categorical variables - Using relative frequencies in contingency tables, Association between two numerical variables - Scatterplot, covariance, Pearson correlation coefficient, Point bi-serial correlation coefficient"
      }
    ]
  },
  "qualifier-computational-thinking": {
    title: "Computational Thinking",
    level: "qualifier",
    price: 99, originalPrice: 499,
    description: "Problem-solving and algorithmic thinking fundamentals",
    thumbnail: "/courses/ct.png",
    syllabus: [
      {
        week: 1,
        title: "Variables, Initialization, Iterators, Filtering",
        topics: "Datatypes, Flowcharts, Sanity of data"
      },
      {
        week: 2,
        title: "Iteration, Filtering, Selection",
        topics: "Pseudocode, Finding max and min, AND operator"
      },
      {
        week: 3,
        title: "Multiple iterations (non-nested)",
        topics: "Three prizes problem, Procedures, Parameters, Side effects, OR operator"
      },
      {
        week: 4,
        title: "Nested iterations",
        topics: "Birthday paradox, Binning"
      }
    ]
  }
}

export default function CoursePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string
  const course = courseSyllabusData[courseId]
  const supabase = createClient()

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<LiveClass[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [previousSearch, setPreviousSearch] = useState("")

  useEffect(() => {
    checkAuthAndEnrollment()
  }, [])

  const checkAuthAndEnrollment = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setIsAuthenticated(!!user)
    
    if (user) {
      // Check if user is enrolled in this course
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single()
      
      setIsEnrolled(!!enrollment)
      
      // If enrolled, fetch classes for this course
      if (enrollment) {
        fetchClasses()
      }
    }
    
    setLoading(false)
  }

  const fetchClasses = async () => {
    setLoadingClasses(true)
    try {
      const response = await fetch("/api/live-classes")
      if (response.ok) {
        const data = await response.json()
        // Filter classes for this specific course
        const courseMap: { [key: string]: string } = {
          'qualifier-computational-thinking': 'ct',
          'qualifier-stats-1': 'stats-1',
          'qualifier-math-1': 'math-1'
        }
        const courseCode = courseMap[courseId]
        const filteredClasses = (data.classes || []).filter(
          (cls: LiveClass) => cls.course.toLowerCase() === courseCode
        )
        setClasses(filteredClasses)
      }
    } catch (error) {
      console.error('Error fetching classes:', error)
    } finally {
      setLoadingClasses(false)
    }
  }

  const handleEnroll = () => {
    if (!isAuthenticated) {
      setShowLogin(true)
      return
    }
    router.push(`/payment/${courseId}`)
  }

  const isUpcoming = (dateStr: string, timeStr: string) => {
    try {
      const classDate = new Date(dateStr)
      const [hours, minutes] = timeStr.split(':').map(Number)
      classDate.setHours(hours, minutes, 0, 0)
      const diffMins = Math.floor((classDate.getTime() - Date.now()) / 60000)
      return diffMins > -60
    } catch {
      return false
    }
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-white relative">
        <BeamsBackground />
        <Navbar isAuthenticated={isAuthenticated} />
        <div className="container mx-auto px-4 pt-32 text-center relative z-10">
          <h1 className="text-2xl font-bold text-black mb-4">Course Not Found</h1>
          <Link href="/courses">
            <Button className="bg-black hover:bg-black/80 text-white">Back to Courses</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Enrolled User View
  if (isEnrolled) {
    const upcomingClasses = classes.filter(cls => isUpcoming(cls.date, cls.time))
    const previousClasses = classes.filter(cls => !isUpcoming(cls.date, cls.time))
    const filteredPrevious = previousClasses.filter(cls =>
      !previousSearch.trim() || cls.topic.toLowerCase().includes(previousSearch.trim().toLowerCase())
    )

    return (
      <div className="min-h-screen bg-white relative">
        <BeamsBackground />
        <Navbar isAuthenticated={isAuthenticated} />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-24 pb-20 relative z-10">
          {/* Back Button */}
          <Link 
            href="/dashboard/courses"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Courses
          </Link>

          {/* Course Header */}
          <div className="flex items-start gap-8 mb-8">
            {/* Thumbnail */}
            <div className="w-80 h-48 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
              <img 
                src={course.thumbnail} 
                alt={course.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Course Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Badge className="bg-gray-100 text-black text-xs font-semibold px-3 py-1 rounded">
                  {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                </Badge>
                <Badge className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded">
                  Enrolled
                </Badge>
              </div>
              
              <h1 className="text-4xl font-bold text-black mb-3">
                {course.title}
              </h1>
              
              <p className="text-lg text-gray-600 mb-6">
                {course.description}
              </p>

              {/* Syllabus Button */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-black hover:bg-black/80 text-white px-6 py-3 gap-2">
                    <FileText className="w-4 h-4" />
                    View Syllabus
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Course Syllabus - 4 Weeks</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 mt-4">
                    {course.syllabus.map((week: any, index: number) => (
                      <div key={week.week} className="border-b border-gray-200 pb-4 last:border-0">
                        <div className="flex gap-4">
                          <Badge className="bg-black text-white text-sm font-semibold px-3 py-1 rounded h-fit">
                            Week {week.week}
                          </Badge>
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-black mb-2">
                              {week.title}
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {week.topics}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Classes Section */}
          <div className="space-y-8">
            {/* Upcoming Classes */}
            <div>
              <h2 className="text-2xl font-bold text-black mb-4">Upcoming Classes</h2>
              {loadingClasses ? (
                <div className="text-center py-8 text-gray-500">Loading classes...</div>
              ) : upcomingClasses.length === 0 ? (
                <Card className="bg-gray-50 border border-gray-200 rounded-lg">
                  <CardContent className="p-8 text-center">
                    <Video className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No upcoming classes scheduled</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingClasses.map((cls, idx) => (
                    <LiveClassCard
                      key={idx}
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

            {/* Previous Classes */}
            <div>
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="text-2xl font-bold text-black">Previous Classes</h2>
                  {previousClasses.length > 0 && (
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search by topic…"
                        value={previousSearch}
                        onChange={e => setPreviousSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 bg-white text-sm text-black focus:outline-none focus:border-black transition-colors"
                        suppressHydrationWarning
                      />
                      {previousSearch && (
                        <button onClick={() => setPreviousSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {previousClasses.length === 0 ? (
                <Card className="bg-gray-50 border border-gray-200 rounded-lg">
                  <CardContent className="p-8 text-center">
                    <p className="text-gray-600">No previous classes</p>
                  </CardContent>
                </Card>
              ) : filteredPrevious.length === 0 ? (
                <Card className="bg-gray-50 border border-gray-200 rounded-lg">
                  <CardContent className="p-8 text-center">
                    <p className="text-gray-600">No classes match &ldquo;{previousSearch}&rdquo;</p>
                    <button onClick={() => setPreviousSearch("")} className="mt-2 text-sm text-black underline underline-offset-2">Clear search</button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPrevious.map((cls, idx) => (
                    <LiveClassCard
                      key={idx}
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

        <Footer />
      </div>
    )
  }

  // Non-Enrolled User View (Original)

  return (
    <>
    <div className="min-h-screen bg-white relative">
      <BeamsBackground />
      <Navbar isAuthenticated={isAuthenticated} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl pt-24 pb-20 relative z-10">
        {/* Back Button */}
        <Link 
          href={isAuthenticated ? "/dashboard/courses" : "/courses"}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Courses
        </Link>

        {/* Course Header Card */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-lg mb-8">
          <CardContent className="p-8">
            <div className="flex items-start justify-between gap-8 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Badge className="bg-gray-100 text-black text-xs font-semibold px-3 py-1 rounded">
                    {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                  </Badge>
                  <Badge className="bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded">
                     Tamil
                  </Badge>
                </div>
                
                <h1 className="text-3xl font-bold text-black mb-3">
                  {course.title}
                </h1>
                
                <p className="text-base text-gray-600 mb-6">
                  {course.description}
                </p>

                <div className="flex items-center gap-6 text-sm text-gray-600 mb-6">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    <span>4 weeks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Self-paced</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    {course.originalPrice && (
                      <p className="text-sm text-gray-400 line-through">₹{course.originalPrice}</p>
                    )}
                    <p className="text-3xl font-bold text-black">₹{course.price}</p>
                  </div>
                  <Button 
                    onClick={handleEnroll}
                    className="bg-black hover:bg-black/80 text-white px-8 py-6 text-base font-semibold"
                  >
                    Enroll Now
                  </Button>
                </div>
              </div>
              
              {/* Course Thumbnail */}
              <div className="hidden md:block flex-shrink-0">
                <div className="w-96 h-54 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  <img 
                    src={course.thumbnail} 
                    alt={course.title}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: 'center' }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Course Syllabus */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-black">Course Syllabus</h2>
        </div>

        <Card className="bg-white border border-gray-200 shadow-sm rounded-lg">
          <CardContent className="p-8">
            <div className="space-y-6">
              {course.syllabus.map((week: any, index: number) => (
                <div key={week.week}>
                  <div className="flex gap-4">
                    {/* Week Number */}
                    <div className="flex-shrink-0">
                      <Badge className="bg-black text-white text-sm font-semibold px-3 py-1 rounded">
                        Week {week.week}
                      </Badge>
                    </div>

                    {/* Week Content */}
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-black mb-1">
                        {week.title}
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {week.topics}
                      </p>
                    </div>
                  </div>
                  {index < course.syllabus.length - 1 && (
                    <div className="border-b border-gray-200 mt-6"></div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Enroll Section */}
        <Card className="bg-gray-50 border border-gray-200 rounded-lg mt-8">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold text-black mb-3">Ready to start learning?</h3>
            <p className="text-gray-600 mb-6">
              Join thousands of students mastering {course.title}
            </p>
            <Button 
              onClick={handleEnroll}
              className="bg-black hover:bg-black/80 text-white px-12 py-6 text-lg font-semibold"
            >
              Enroll for ₹{course.price} <span className="text-sm font-normal line-through opacity-60">₹{course.originalPrice}</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>

    {/* Auth modals for unauthenticated enroll flow */}
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
