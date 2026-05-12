"use client"

import { useState, useEffect } from "react"
import { courseData } from "@/lib/gpa/course-data"
import { calculateScore } from "@/lib/gpa/calculate-score"
import { assignGrade } from "@/lib/gpa/grade-utils"
import type { Course } from "@/lib/gpa/types"
import dynamic from "next/dynamic"
import { Calculator, Plus, Trash2 } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

const BeamsBackground = dynamic(() => import("@/components/beams-background").then(mod => ({ default: mod.BeamsBackground })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-white -z-10" />
})

interface SemesterCourse {
  id: string
  name: string
  credits: number
  gradePoints: number
}

const gradePointsOptions = [
  { label: "S (10)", value: 10 },
  { label: "A (9)", value: 9 },
  { label: "B (8)", value: 8 },
  { label: "C (7)", value: 7 },
  { label: "D (6)", value: 6 },
  { label: "E (4)", value: 4 },
  { label: "U (0)", value: 0 },
]

export default function GPACalculator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user)
      setLoading(false)
    })
  }, [])

  const [activeTab, setActiveTab] = useState<"course" | "semester">("course")
  
  // Course Grade Calculator State
  const [selectedDegree, setSelectedDegree] = useState<"data-science" | "electronic-systems" | "">("")
  const [selectedLevel, setSelectedLevel] = useState<"foundation" | "diploma" | "degree" | "">("")
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [formValues, setFormValues] = useState<Record<string, number>>({})
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null)
  const [calculatedGrade, setCalculatedGrade] = useState<string | null>(null)

  // Semester GPA Calculator State
  const [semesterCourses, setSemesterCourses] = useState<SemesterCourse[]>([
    { id: "1", name: "", credits: 0, gradePoints: 0 },
  ])
  const [existingCGPA, setExistingCGPA] = useState<number | "">("")
  const [completedCredits, setCompletedCredits] = useState<number | "">("")

  const semesterResults = (() => {
    const validCourses = semesterCourses.filter((c) => c.credits > 0 && c.gradePoints > 0)
    const totalCredits = validCourses.reduce((sum, course) => sum + course.credits, 0)
    const totalGradePoints = validCourses.reduce((sum, course) => sum + course.credits * course.gradePoints, 0)
    
    if (totalCredits === 0) return null

    const sgpa = totalGradePoints / totalCredits
    
    let updatedCGPA = null
    if (existingCGPA !== "" && completedCredits !== "") {
      const currentTotalPoints = Number(existingCGPA) * Number(completedCredits)
      const newTotalPoints = currentTotalPoints + totalGradePoints
      const newTotalCredits = Number(completedCredits) + totalCredits
      updatedCGPA = newTotalPoints / newTotalCredits
    }

    return { sgpa, totalCredits, totalGradePoints, updatedCGPA }
  })()

  const availableLevels = selectedDegree
    ? Array.from(new Set(courseData.filter((c) => c.degree === selectedDegree).map((c) => c.level)))
    : []

  const availableCourses = selectedDegree && selectedLevel
      ? courseData.filter((c) => c.degree === selectedDegree && c.level === selectedLevel)
      : []

  const handleCalculate = () => {
    if (!selectedCourse) return
    try {
      const score = calculateScore(selectedCourse.id, formValues)
      const grade = assignGrade(score)
      setCalculatedScore(score)
      setCalculatedGrade(grade)
    } catch (error) {
      console.error("Error calculating score:", error)
    }
  }

  const addCourse = () => {
    setSemesterCourses([...semesterCourses, { id: Date.now().toString(), name: "", credits: 0, gradePoints: 0 }])
  }

  const removeCourse = (id: string) => {
    if (semesterCourses.length > 1) {
      setSemesterCourses(semesterCourses.filter((course) => course.id !== id))
    }
  }

  // Show navbar even during loading to prevent blank page flash
  if (loading) {
    return (
      <div className="min-h-screen bg-white relative">
        <BeamsBackground />
        <Navbar isAuthenticated={isAuthenticated} />
        <div className="container mx-auto px-4 py-20 flex items-center justify-center relative z-10">
          <div className="animate-spin w-12 h-12 border-4 border-black border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white relative">
      <BeamsBackground />
      <Navbar isAuthenticated={isAuthenticated} />
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-black mb-4">
            <Calculator className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-black">
            GPA Calculator
          </h1>
          <p className="text-gray-600 text-base max-w-2xl mx-auto">
            Calculate your course scores and semester GPA with precision
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg p-1.5 border border-gray-200 inline-flex gap-1">
            <button
              onClick={() => setActiveTab("course")}
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all ${
                activeTab === "course" 
                  ? "bg-black text-white" 
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Course Grade
            </button>
            <button
              onClick={() => setActiveTab("semester")}
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all ${
                activeTab === "semester" 
                  ? "bg-black text-white" 
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Semester GPA
            </button>
          </div>
        </div>

        {/* Course Grade Calculator */}
        {activeTab === "course" && (
          <Card className="bg-white border border-gray-200 shadow-sm max-w-5xl mx-auto rounded-lg">
            <CardHeader className="border-b border-gray-200 pb-4 pt-6">
              <CardTitle className="text-2xl font-bold text-black">Calculate Course Grade</CardTitle>
              <p className="text-gray-600 text-sm mt-1">Select your course and enter your scores to get your final grade</p>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Course Selection */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-black flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gray-100 text-black flex items-center justify-center text-xs font-bold">1</div>
                  Select Course
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-black">Degree Program</Label>
                    <Select value={selectedDegree} onValueChange={(v) => {
                      setSelectedDegree(v as any)
                      setSelectedLevel("")
                      setSelectedCourse(null)
                      setCalculatedScore(null)
                      setCalculatedGrade(null)
                    }}>
                      <SelectTrigger className="h-12 text-base bg-white border-gray-300 hover:border-black transition-colors text-black">
                        <SelectValue placeholder="Choose degree" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="data-science" className="text-black">Data Science</SelectItem>
                        <SelectItem value="electronic-systems" className="text-black">Electronic Systems</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-black">Level</Label>
                    <Select value={selectedLevel} onValueChange={(v) => {
                      setSelectedLevel(v as any)
                      setSelectedCourse(null)
                      setCalculatedScore(null)
                      setCalculatedGrade(null)
                    }} disabled={!selectedDegree}>
                      <SelectTrigger className="h-12 text-base bg-white border-gray-300 hover:border-black transition-colors text-black">
                        <SelectValue placeholder="Choose level" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {availableLevels.map((level) => (
                          <SelectItem key={level} value={level} className="text-black">
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-black">Course</Label>
                    <Select value={selectedCourse?.id || ""} onValueChange={(id) => {
                      const course = availableCourses.find((c) => c.id === id)
                      setSelectedCourse(course || null)
                      setFormValues({})
                      setCalculatedScore(null)
                      setCalculatedGrade(null)
                    }} disabled={!selectedLevel}>
                      <SelectTrigger className="h-12 text-base bg-white border-gray-300 hover:border-black transition-colors text-black">
                        <SelectValue placeholder="Choose course" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {availableCourses.map((course) => (
                          <SelectItem key={course.id} value={course.id} className="text-black">
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {selectedCourse && (
                <>
                  {/* Score Entry */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-black flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-gray-100 text-black flex items-center justify-center text-xs font-bold">2</div>
                      Enter Your Scores
                    </h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedCourse.formFields.map((field) => (
                          <div key={field.id} className="space-y-2">
                            <Label className="text-sm font-semibold text-black flex justify-between">
                              <span>{field.label}</span>
                              <span className="text-gray-600 text-xs">Max: {field.max}</span>
                            </Label>
                            <Input
                              type="number"
                              placeholder={`Enter score (0 - ${field.max})`}
                              value={formValues[field.id] || ""}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(Number(e.target.value), field.max))
                                setFormValues({ ...formValues, [field.id]: val })
                              }}
                              className="h-12 text-base bg-white border-gray-300 focus:border-black transition-colors text-black"
                            />
                            <p className="text-xs text-gray-600">{field.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-4">
                    <Button onClick={handleCalculate} className="flex-1 h-12 bg-black hover:bg-black/80 text-white text-base font-bold transition-all">
                      <Calculator className="w-5 h-5 mr-2" />
                      Calculate Grade
                    </Button>
                    <Button onClick={() => {
                      setFormValues({})
                      setCalculatedScore(null)
                      setCalculatedGrade(null)
                    }} variant="outline" className="h-12 px-8 border-gray-300 hover:border-black transition-colors font-semibold text-black">
                      Reset
                    </Button>
                  </div>

                  {/* Result */}
                  {calculatedScore !== null && calculatedGrade && (
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-8 text-center">
                      <p className="text-gray-700 text-sm uppercase tracking-wide mb-4 font-bold">Your Final Score</p>
                      <div className="flex items-center justify-center gap-8 flex-wrap">
                        <div>
                          <p className="text-6xl font-black text-black mb-2">
                            {calculatedScore.toFixed(2)}
                          </p>
                          <p className="text-gray-600 text-sm font-semibold">out of 100</p>
                        </div>
                        <div className="h-20 w-px bg-gray-300"></div>
                        <div>
                          <p className="text-gray-700 text-sm mb-2 font-semibold">Grade</p>
                          <div className="text-5xl font-black text-black">
                            {calculatedGrade}
                          </div>
                          <p className="text-sm font-semibold text-gray-600 mt-2">
                            {calculatedGrade === 'S' && '🏆 Outstanding!'}
                            {calculatedGrade === 'A' && '⭐ Excellent!'}
                            {calculatedGrade === 'B' && '👍 Great Job!'}
                            {calculatedGrade === 'C' && '✓ Good Work!'}
                            {calculatedGrade === 'D' && '📚 Keep Going!'}
                            {calculatedGrade === 'E' && '💪 Improvement Needed'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Semester GPA Calculator */}
        {activeTab === "semester" && (
          <Card className="bg-white border border-gray-200 shadow-sm max-w-5xl mx-auto rounded-lg">
            <CardHeader className="border-b border-gray-200 pb-4 pt-6">
              <CardTitle className="text-2xl font-bold text-black">Calculate Semester GPA</CardTitle>
              <p className="text-gray-600 text-sm mt-1">Add your courses and grades to calculate your GPA</p>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Existing History */}
              <div className="space-y-4 mb-8">
                <h3 className="text-base font-bold text-black flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gray-100 text-black flex items-center justify-center text-xs font-bold">1</div>
                  Existing Academic Standing
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 border border-gray-200 rounded-lg p-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-black">Current CGPA</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 8.5"
                      value={existingCGPA}
                      onChange={(e) => setExistingCGPA(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-12 text-base bg-white border-gray-300 focus:border-black transition-colors text-black"
                      step="0.01"
                      min="0"
                      max="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-black">Total Credits Completed</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 48"
                      value={completedCredits}
                      onChange={(e) => setCompletedCredits(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-12 text-base bg-white border-gray-300 focus:border-black transition-colors text-black"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-bold text-black flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gray-100 text-black flex items-center justify-center text-xs font-bold">2</div>
                  Current Semester Courses
                </h3>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 pb-2 border-b border-gray-200">
                <div className="col-span-4">
                  <Label className="text-xs uppercase tracking-wide text-gray-700 font-bold">Course Name</Label>
                </div>
                <div className="col-span-3">
                  <Label className="text-xs uppercase tracking-wide text-gray-700 font-bold">Credits</Label>
                </div>
                <div className="col-span-4">
                  <Label className="text-xs uppercase tracking-wide text-gray-700 font-bold">Grade</Label>
                </div>
                <div className="col-span-1"></div>
              </div>

              {/* Course Rows */}
              <div className="space-y-3">
                {semesterCourses.map((course, index) => (
                  <div key={course.id} className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="col-span-4">
                      <Input
                        placeholder="e.g., Mathematics I"
                        value={course.name}
                        onChange={(e) => setSemesterCourses(semesterCourses.map(c => 
                          c.id === course.id ? { ...c, name: e.target.value } : c
                        ))}
                        className="h-12 text-base bg-white border-gray-300 focus:border-black transition-colors text-black"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder="4"
                        value={course.credits || ""}
                        onChange={(e) => setSemesterCourses(semesterCourses.map(c => 
                          c.id === course.id ? { ...c, credits: Number(e.target.value) } : c
                        ))}
                        className="h-12 text-base bg-white border-gray-300 focus:border-black transition-colors text-black"
                        min="0"
                        max="10"
                      />
                    </div>
                    <div className="col-span-4">
                      <Select value={course.gradePoints.toString()} onValueChange={(v) => 
                        setSemesterCourses(semesterCourses.map(c => 
                          c.id === course.id ? { ...c, gradePoints: Number(v) } : c
                        ))
                      }>
                        <SelectTrigger className="h-12 text-base bg-white border-gray-300 hover:border-black transition-colors text-black">
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          {gradePointsOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value.toString()} className="text-black">{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      {semesterCourses.length > 1 && (
                        <Button 
                          onClick={() => removeCourse(course.id)} 
                          variant="ghost" 
                          size="icon" 
                          className="h-11 w-11 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={addCourse} variant="outline" className="w-full h-12 border-gray-300 border-2 border-dashed hover:border-black hover:bg-gray-50 transition-all font-semibold text-black">
                <Plus className="w-5 h-5 mr-2" />
                Add Another Course
              </Button>

              {semesterResults !== null && (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                    <div className="text-center pb-8 md:pb-0">
                      <p className="text-gray-700 text-sm uppercase tracking-wide mb-4 font-bold">Semester GPA (SGPA)</p>
                      <p className="text-7xl font-black text-black mb-3">{semesterResults.sgpa.toFixed(2)}</p>
                      <p className="text-xl font-bold text-gray-700">
                        {semesterResults.sgpa >= 9 ? "🌟 Excellent!" : semesterResults.sgpa >= 8 ? "✨ Very Good!" : semesterResults.sgpa >= 7 ? "👍 Good Work!" : "📚 Keep Going!"}
                      </p>
                    </div>
                    
                    {semesterResults.updatedCGPA !== null && (
                      <div className="text-center pt-8 md:pt-0 md:pl-8">
                        <p className="text-gray-700 text-sm uppercase tracking-wide mb-4 font-bold">Updated Total CGPA</p>
                        <p className="text-7xl font-black text-black mb-3">{semesterResults.updatedCGPA.toFixed(2)}</p>
                        <p className="text-sm font-semibold text-gray-500">Includes your current semester performance</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-6 pt-8 mt-8 border-t border-gray-200">
                    <div className="text-center">
                      <p className="text-gray-600 text-sm mb-2 font-semibold">Courses</p>
                      <p className="text-2xl font-bold text-black">{semesterResults.totalCredits > 0 ? semesterCourses.filter(c => c.credits > 0).length : 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600 text-sm mb-2 font-semibold">Credits</p>
                      <p className="text-2xl font-bold text-black">{semesterResults.totalCredits}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600 text-sm mb-2 font-semibold">Points</p>
                      <p className="text-2xl font-bold text-black">{semesterResults.totalGradePoints.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  )
}
