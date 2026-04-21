"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ChevronLeft, ChevronRight, Clock } from "lucide-react"

// Same course data as parent page
const courseData: Record<string, any> = {
  "qualifier-math-1": {
    title: "Mathematics for Data Science I",
    videos: [
      { week: 1, title: "Week 1 - Part 1", description: "Introduction to mathematical foundations", duration: "45:30", youtubeId: "21e6j8G-njE" },
      { week: 1, title: "Week 1 - Part 2", description: "Vectors and matrices basics", duration: "52:15", youtubeId: "vJvx_NtHrmA" },
      { week: 1, title: "Week 1 - Part 3", description: "Matrix operations", duration: "48:20", youtubeId: "0IUbec8P_ok" },
      { week: 2, title: "Week 2 - Part 1", description: "Linear transformations", duration: "50:10", youtubeId: "Yfn_BOY_0YI" },
      { week: 2, title: "Week 2 - Part 2", description: "Advanced matrix concepts", duration: "55:45", youtubeId: "ACoKBjv4E_8" }
    ]
  },
  "qualifier-stats-1": {
    title: "Statistics for Data Science I",
    videos: [
      { week: 1, title: "Week 1 - Introduction", description: "Fundamentals of statistics", duration: "46:35", youtubeId: "KnQ3EiRiePA" },
      { week: 2, title: "Week 2 - Descriptive Statistics", description: "Measures of central tendency", duration: "52:13", youtubeId: "0yqZiTCwGlc" },
      { week: 3, title: "Week 3 - Probability Basics", description: "Introduction to probability theory", duration: "61:32", youtubeId: "7tC9xgjFzoc" },
      { week: 4, title: "Week 4 - Statistical Inference", description: "Hypothesis testing fundamentals", duration: "48:43", youtubeId: "zk_LyywNlFQ" }
    ]
  },
  "qualifier-computational-thinking": {
    title: "Computational Thinking",
    videos: [
      { week: 1, title: "Week 1 - Introduction", description: "What is computational thinking?", duration: "42:15", youtubeId: "hH7xlmnNvR8" },
      { week: 2, title: "Week 2 - Algorithms", description: "Basic algorithmic concepts", duration: "50:20", youtubeId: "IGRGpZD_mrc" },
      { week: 2, title: "Week 2-4 - Pseudocode", description: "Writing pseudocode effectively", duration: "45:30", youtubeId: "LHM0ymdQ9jw" },
      { week: 3, title: "Week 3 - Practice Problems", description: "Solving computational problems", duration: "52:40", youtubeId: "W8JeI7fyW0A" },
      { week: 4, title: "Week 4 - Advanced Topics", description: "Complex problem solving", duration: "48:05", youtubeId: "IvcVmO9BY78" }
    ]
  },
  "qualifier-english-1": {
    title: "English I",
    videos: [
      { week: 1, title: "Week 1 - Sounds and Words", description: "Vowel and consonant sounds", duration: "62:52", youtubeId: "YLRCCeQR95o" },
      { week: 2, title: "Week 2 - Parts of Speech", description: "Nouns, pronouns, verbs, adjectives and adverbs", duration: "58:10", youtubeId: "YLRCCeQR95o" },
      { week: 3, title: "Week 3 - Sentences", description: "Phrases and idioms", duration: "54:18", youtubeId: "9SLWfl6icMU" },
      { week: 4, title: "Week 4 - Speaking Skills", description: "Spoken English preliminaries", duration: "55:30", youtubeId: "9SLWfl6icMU" }
    ]
  },
  "foundation-math-2": {
    title: "Mathematics for Data Science II",
    videos: []
  },
  "foundation-stats-2": {
    title: "Statistics for Data Science II",
    videos: []
  },
  "foundation-programming-python": {
    title: "Programming in Python",
    videos: []
  },
  "foundation-english-2": {
    title: "English II",
    videos: []
  }
}

export default function VideoPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string
  const weekId = params.weekId as string
  
  const course = courseData[courseId]
  if (!course) {
    return <div>Course not found</div>
  }

  const weekNumber = parseInt(weekId.replace("week-", ""))
  const currentVideo = course.videos.find((v: any) => v.week === weekNumber)
  const currentIndex = course.videos.findIndex((v: any) => v.week === weekNumber)

  if (!currentVideo) {
    return <div>Video not found</div>
  }

  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < course.videos.length - 1

  const handlePrevious = () => {
    if (hasPrevious) {
      const prevVideo = course.videos[currentIndex - 1]
      router.push(`/courses/${courseId}/week-${prevVideo.week}`)
    }
  }

  const handleNext = () => {
    if (hasNext) {
      const nextVideo = course.videos[currentIndex + 1]
      router.push(`/courses/${courseId}/week-${nextVideo.week}`)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar isAuthenticated={false} />

      <div className="pt-20 pb-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <Link 
            href={`/courses/${courseId}`}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-[#51b206] transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Course
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Video Player */}
            <div className="lg:col-span-2">
              {/* YouTube Video Embed */}
              <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl mb-6">
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${currentVideo.youtubeId}?rel=0&modestbranding=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>

              {/* Video Info */}
              <Card className="bg-black/80 backdrop-blur-sm border-slate-800 mb-6">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Badge className="bg-slate-700 text-slate-300 hover:bg-slate-700 mb-3">
                        Week {currentVideo.week} of {course.videos.length}
                      </Badge>
                      <h1 className="text-3xl font-bold text-white mb-2">
                        {currentVideo.title}
                      </h1>
                      <p className="text-slate-400">
                        {currentVideo.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{currentVideo.duration}</span>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handlePrevious}
                      disabled={!hasPrevious}
                      variant="outline"
                      className="flex-1 border-slate-700 hover:border-[#51b206] hover:bg-[#51b206]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Previous Video
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={!hasNext}
                      className="flex-1 bg-[#51b206] hover:bg-[#51b206]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next Video
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Course Description */}
              <Card className="bg-black/80 backdrop-blur-sm border-slate-800">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-white mb-4">About This Course</h2>
                  <p className="text-slate-400 mb-4">
                    {course.title} is designed to provide you with comprehensive knowledge and hands-on experience. 
                    Each week builds upon the previous one, ensuring a smooth learning curve.
                  </p>
                  <p className="text-slate-400">
                    This course is completely free and accessible to all IITM BS students. 
                    Watch at your own pace and revisit any topic as needed.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Course Content */}
            <div className="lg:col-span-1">
              <Card className="bg-black/80 backdrop-blur-sm border-slate-800 sticky top-24">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-white mb-4">Course Content</h2>
                  
                  <div className="space-y-2">
                    {course.videos.map((video: any, index: number) => {
                      const isActive = video.week === weekNumber
                      const isWatched = index < currentIndex

                      return (
                        <Link
                          key={index}
                          href={`/courses/${courseId}/week-${video.week}`}
                          className={`block p-4 rounded-lg border transition-all ${
                            isActive
                              ? "bg-[#51b206]/20 border-[#51b206]/50"
                              : isWatched
                              ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                              : "bg-slate-900/50 border-slate-800 hover:bg-slate-900"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              isActive
                                ? "bg-[#51b206] text-white"
                                : isWatched
                                ? "bg-slate-600 text-slate-300"
                                : "bg-slate-800 text-slate-500"
                            }`}>
                              {video.week}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-semibold mb-1 ${
                                isActive ? "text-[#51b206]" : "text-white"
                              }`}>
                                {video.title}
                              </h3>
                              <p className="text-xs text-slate-500">{video.duration}</p>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
