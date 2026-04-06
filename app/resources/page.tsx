"use client"

import { useMemo, useState, useEffect } from "react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoginModal } from "@/components/auth/login-modal"
import { SignUpModal } from "@/components/auth/signup-modal"
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal"
import { courseData } from "@/lib/gpa/course-data"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Loader2, Plus } from "lucide-react"

type LevelValue = "foundation" | "diploma" | "degree"
type DegreeValue = "data-science" | "electronic-systems"

type ResourceNote = {
  id: string
  degree: DegreeValue
  level: LevelValue
  subject: string
  notes_week_from: number
  notes_week_to: number
  title: string
  contributor_name: string
  notes_content_label: string
  drive_link: string
  created_at: string
}

const levelLabels: Record<LevelValue, string> = {
  foundation: "Foundation",
  diploma: "Diploma",
  degree: "Degree",
}

const degreeLabels: Record<DegreeValue, string> = {
  "data-science": "Data Science",
  "electronic-systems": "Electronic Systems",
}

const degreeValues = Object.keys(degreeLabels) as DegreeValue[]

const initialForm = {
  notesWeekFrom: "1",
  notesWeekTo: "12",
  contributorName: "",
  driveLink: "",
}

export default function ResourcesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [notes, setNotes] = useState<ResourceNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  const [selectedDegree, setSelectedDegree] = useState<DegreeValue>("data-science")
  const [selectedLevel, setSelectedLevel] = useState<LevelValue>("diploma")
  const [selectedSubject, setSelectedSubject] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [shouldOpenAfterSignIn, setShouldOpenAfterSignIn] = useState(false)
  const [showAddNotesDialog, setShowAddNotesDialog] = useState(false)
  const [addStep, setAddStep] = useState(1)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState(initialForm)

  const [loginOpen, setLoginOpen] = useState(false)
  const [signUpOpen, setSignUpOpen] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)

  const subjectsForSelection = useMemo(() => {
    const unique = new Set<string>()

    for (const course of courseData) {
      if (course.degree === selectedDegree && course.level === selectedLevel) {
        unique.add(course.name)
      }
    }

    return Array.from(unique)
  }, [selectedDegree, selectedLevel])

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return notes.filter((note) => {
      if (selectedSubject && note.subject !== selectedSubject) {
        return false
      }

      if (!query) {
        return true
      }

      return (
        note.title.toLowerCase().includes(query) ||
        note.contributor_name.toLowerCase().includes(query) ||
        note.notes_content_label.toLowerCase().includes(query)
      )
    })
  }, [notes, selectedSubject, searchQuery])

  const currentWeekFrom = Number(formData.notesWeekFrom)
  const currentWeekTo = Number(formData.notesWeekTo)
  const hasValidWeekRange = Number.isInteger(currentWeekFrom) && Number.isInteger(currentWeekTo) && currentWeekFrom > 0 && currentWeekTo >= currentWeekFrom
  const dynamicWeekLabel = hasValidWeekRange ? `Weeks ${currentWeekFrom}-${currentWeekTo}` : "Selected weeks"

  useEffect(() => {
    let isMounted = true

    const hydrateAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!isMounted) {
        return
      }

      const loggedIn = !!session
      setIsAuthenticated(loggedIn)
      setIsLoading(false)

      if (loggedIn && shouldOpenAfterSignIn) {
        setShowAuthPrompt(false)
        setShowAddNotesDialog(true)
        setShouldOpenAfterSignIn(false)
      }
    }

    hydrateAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session
      setIsAuthenticated(loggedIn)

      if (loggedIn && shouldOpenAfterSignIn) {
        setShowAuthPrompt(false)
        setShowAddNotesDialog(true)
        setShouldOpenAfterSignIn(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase, shouldOpenAfterSignIn])

  useEffect(() => {
    if (!subjectsForSelection.length) {
      setSelectedSubject("")
      return
    }

    if (!subjectsForSelection.includes(selectedSubject)) {
      setSelectedSubject(subjectsForSelection[0])
    }
  }, [subjectsForSelection, selectedSubject])

  useEffect(() => {
    if (!selectedSubject) {
      setNotes([])
      return
    }

    const loadNotes = async () => {
      setNotesLoading(true)
      setNotesError(null)

      try {
        const params = new URLSearchParams({
          degree: selectedDegree,
          level: selectedLevel,
          subject: selectedSubject,
        })

        const response = await fetch(`/api/resources/notes?${params.toString()}`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load notes")
        }

        setNotes(Array.isArray(payload.notes) ? payload.notes : [])
      } catch (error: unknown) {
        setNotesError(error instanceof Error ? error.message : "Failed to load notes")
      } finally {
        setNotesLoading(false)
      }
    }

    loadNotes()
  }, [selectedDegree, selectedLevel, selectedSubject])

  const resetAddNotesForm = () => {
    setFormData(initialForm)
    setAddStep(1)
    setFormError(null)
    setFormSuccess(null)
  }

  const handleOpenAddNotes = () => {
    if (!isAuthenticated) {
      setShouldOpenAfterSignIn(true)
      setShowAuthPrompt(true)
      return
    }

    setShowAddNotesDialog(true)
  }

  const openSignInModal = () => {
    setShowAuthPrompt(false)
    setLoginOpen(true)
  }

  const validateStep = () => {
    if (addStep === 1) {
      if (!selectedDegree || !selectedLevel || !selectedSubject) {
        setFormError("Please select degree, level, and subject.")
        return false
      }
    }

    if (addStep === 2) {
      const start = Number(formData.notesWeekFrom)
      const end = Number(formData.notesWeekTo)

      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 52) {
        setFormError("Please enter a valid week range.")
        return false
      }

      if (!formData.contributorName.trim()) {
        setFormError("Please enter your name.")
        return false
      }
    }

    if (addStep === 3) {
      if (!formData.driveLink.trim()) {
        setFormError("Please add Drive link.")
        return false
      }
    }

    setFormError(null)
    return true
  }

  const handleNext = () => {
    if (!validateStep()) {
      return
    }

    setAddStep((step) => Math.min(step + 1, 3))
  }

  const handleBack = () => {
    setFormError(null)
    setAddStep((step) => Math.max(step - 1, 1))
  }

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateStep()) {
      return
    }

    setSubmitting(true)
    setFormError(null)
    setFormSuccess(null)

    try {
      const response = await fetch("/api/resources/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          degree: selectedDegree,
          level: selectedLevel,
          subject: selectedSubject,
          notesWeekFrom: Number(formData.notesWeekFrom),
          notesWeekTo: Number(formData.notesWeekTo),
          contributorName: formData.contributorName,
          driveLink: formData.driveLink,
        }),
      })

      const payload = await response.json()

      if (response.status === 401) {
        setShowAddNotesDialog(false)
        setShouldOpenAfterSignIn(true)
        setShowAuthPrompt(true)
        return
      }

      if (!response.ok) {
        throw new Error(payload.error || "Failed to submit notes")
      }

      setFormSuccess("Submitted successfully. Your note is pending admin approval.")
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Failed to submit notes")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="rounded-2xl border border-[#E5DBC8] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Resources Notes</h1>
                <p className="max-w-2xl text-sm text-slate-700 sm:text-base">
                  Community-driven notes linked by subject from GPA tools. Browse approved links or submit your own notes for approval.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <Input
                  placeholder="Search notes"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 border-[#D8CCB2] bg-white text-black placeholder:text-slate-500 focus:border-black sm:w-72"
                />
                <Button
                  onClick={handleOpenAddNotes}
                  className="h-11 bg-black text-white hover:bg-black/85"
                  disabled={isLoading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Notes
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div>
                <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-700">Degree</Label>
                <select
                  value={selectedDegree}
                  onChange={(e) => setSelectedDegree(e.target.value as DegreeValue)}
                  className="h-11 w-full rounded-md border border-[#D8CCB2] bg-white px-3 text-black outline-none transition focus:border-black"
                >
                  {degreeValues.map((degree) => (
                    <option key={degree} value={degree} className="bg-white text-black">
                      {degreeLabels[degree]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-700">Level</Label>
                <div className="grid grid-cols-3 gap-2 rounded-md bg-[#F7F2E8] p-1">
                  {(Object.keys(levelLabels) as LevelValue[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSelectedLevel(level)}
                      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                        selectedLevel === level
                          ? "bg-black text-white"
                          : "bg-transparent text-slate-700 hover:bg-[#EFE6D5]"
                      }`}
                    >
                      {levelLabels[level]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-[#E5DBC8] bg-white p-3 shadow-sm">
              <h2 className="px-2 py-1 text-sm font-semibold text-black">Subjects</h2>
              <div className="mt-2 space-y-1">
                {subjectsForSelection.length === 0 && (
                  <p className="px-2 py-3 text-sm text-slate-600">No subjects found for this selection.</p>
                )}

                {subjectsForSelection.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => setSelectedSubject(subject)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                      selectedSubject === subject
                        ? "bg-black text-white"
                        : "text-slate-700 hover:bg-[#F7F2E8]"
                    }`}
                  >
                    <span className="truncate">{subject}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </button>
                ))}
              </div>
            </aside>

            <section className="space-y-4">
              {notesLoading && (
                <div className="flex h-36 items-center justify-center rounded-2xl border border-[#E5DBC8] bg-white shadow-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-black" />
                </div>
              )}

              {!notesLoading && notesError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {notesError}
                </div>
              )}

              {!notesLoading && !notesError && filteredNotes.length === 0 && (
                <div className="rounded-2xl border border-[#E5DBC8] bg-white px-5 py-8 text-center text-slate-700 shadow-sm">
                  No approved notes found for this subject yet.
                </div>
              )}

              {!notesLoading && !notesError && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredNotes.map((note) => (
                    <article
                      key={note.id}
                      className="rounded-xl border border-[#E5DBC8] bg-white p-4 shadow-sm"
                    >
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600">{note.contributor_name}</p>
                        <h3 className="line-clamp-2 text-base font-semibold text-black">{note.title}</h3>
                        <p className="inline-flex items-center rounded-md bg-[#F7F2E8] px-2.5 py-1 text-xs text-slate-700">
                          {note.notes_content_label}
                        </p>
                        <p className="text-xs text-slate-500">
                          Weeks {note.notes_week_from} to {note.notes_week_to}
                        </p>
                      </div>

                      <div className="mt-3">
                        <a href={note.drive_link} target="_blank" rel="noreferrer">
                          <Button variant="outline" className="h-9 w-full border-[#D8CCB2] bg-white text-black hover:bg-[#F7F2E8]">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open
                          </Button>
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />

      <Dialog open={showAuthPrompt} onOpenChange={setShowAuthPrompt}>
        <DialogContent className="max-w-md border-[#E5DBC8] bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-2xl text-black">Sign in required</DialogTitle>
            <DialogDescription className="text-slate-600">
              Please sign in first to add notes. After sign in, you can submit your Google Drive note link for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={openSignInModal} className="bg-black text-white hover:bg-black/85">
              Sign In
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAddNotesDialog}
        onOpenChange={(open) => {
          setShowAddNotesDialog(open)
          if (!open) {
            resetAddNotesForm()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#E5DBC8] bg-white text-black sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-black">Enter the details to upload your notes.</DialogTitle>
            <DialogDescription className="text-slate-600">
              Step {addStep} of 3
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitNote} className="space-y-5">
            <div className="grid grid-cols-3 gap-2 rounded-md bg-[#F7F2E8] p-1">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`rounded-md px-3 py-2 text-center text-sm font-medium ${
                    addStep >= step ? "bg-black text-white" : "bg-transparent text-slate-700"
                  }`}
                >
                  Step {step}
                </div>
              ))}
            </div>

            {addStep === 1 && (
              <div className="space-y-4 rounded-lg border border-[#E5DBC8] bg-[#FFFCF8] p-4">
                <div>
                  <Label className="mb-2 block text-slate-700">Degree</Label>
                  <select
                    value={selectedDegree}
                    onChange={(e) => setSelectedDegree(e.target.value as DegreeValue)}
                    className="h-11 w-full rounded-md border border-[#D8CCB2] bg-white px-3 text-black outline-none focus:border-black"
                  >
                    {degreeValues.map((degree) => (
                      <option key={degree} value={degree} className="bg-white text-black">
                        {degreeLabels[degree]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="mb-2 block text-slate-700">Levels</Label>
                  <div className="grid grid-cols-3 gap-2 rounded-md bg-[#F7F2E8] p-1">
                    {(Object.keys(levelLabels) as LevelValue[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSelectedLevel(level)}
                        className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                          selectedLevel === level
                            ? "bg-black text-white"
                            : "text-slate-700 hover:bg-[#EFE6D5]"
                        }`}
                      >
                        {levelLabels[level]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block text-slate-700">Subject</Label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="h-11 w-full rounded-md border border-[#D8CCB2] bg-white px-3 text-black outline-none focus:border-black"
                  >
                    {subjectsForSelection.map((subject) => (
                      <option key={subject} value={subject} className="bg-white text-black">
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {addStep === 2 && (
              <div className="space-y-4 rounded-lg border border-[#E5DBC8] bg-[#FFFCF8] p-4">
                <div>
                  <Label className="mb-2 block text-slate-700">Notes Week (From To)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={52}
                      value={formData.notesWeekFrom}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notesWeekFrom: e.target.value }))}
                      className="h-11 border-[#D8CCB2] bg-white text-black placeholder:text-slate-500"
                      placeholder="From"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={52}
                      value={formData.notesWeekTo}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notesWeekTo: e.target.value }))}
                      className="h-11 border-[#D8CCB2] bg-white text-black placeholder:text-slate-500"
                      placeholder="To"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="name" className="mb-2 block text-slate-700">Your Name</Label>
                  <Input
                    id="name"
                    value={formData.contributorName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contributorName: e.target.value }))}
                    className="h-11 border-[#D8CCB2] bg-white text-black placeholder:text-slate-500"
                    placeholder="Enter Your Name"
                  />
                </div>
              </div>
            )}

            {addStep === 3 && (
              <div className="space-y-4 rounded-lg border border-[#E5DBC8] bg-[#FFFCF8] p-4">
                <div>
                  <Label htmlFor="driveLink" className="mb-2 block text-slate-700">Upload Drive Link ({dynamicWeekLabel})</Label>
                  <Input
                    id="driveLink"
                    value={formData.driveLink}
                    onChange={(e) => setFormData((prev) => ({ ...prev, driveLink: e.target.value }))}
                    className="h-11 border-[#D8CCB2] bg-white text-black placeholder:text-slate-500"
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                <div className="rounded-md border border-[#D8CCB2] bg-[#F7F2E8] px-3 py-2 text-xs text-slate-700">
                  Submit for Approval: Only approved notes are shown in public resources.
                </div>
              </div>
            )}

            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="mr-2 inline h-4 w-4" />
                {formSuccess}
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={addStep === 1 || submitting || !!formSuccess}
                className="border-[#D8CCB2] bg-white text-black hover:bg-[#F7F2E8]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {addStep < 3 ? (
                <Button type="button" onClick={handleNext} className="bg-black text-white hover:bg-black/85">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {formSuccess ? (
                    <Button
                      type="button"
                      onClick={() => {
                        setShowAddNotesDialog(false)
                        resetAddNotesForm()
                      }}
                      className="bg-black text-white hover:bg-black/85"
                    >
                      Close
                    </Button>
                  ) : (
                    <Button type="submit" disabled={submitting} className="bg-black text-white hover:bg-black/85">
                      {submitting ? "Submitting..." : "Submit for Approval"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSwitchToSignUp={() => {
          setLoginOpen(false)
          setSignUpOpen(true)
        }}
        onSwitchToForgotPassword={() => {
          setLoginOpen(false)
          setForgotPasswordOpen(true)
        }}
      />
      <SignUpModal
        open={signUpOpen}
        onOpenChange={setSignUpOpen}
        onSwitchToLogin={() => {
          setSignUpOpen(false)
          setLoginOpen(true)
        }}
      />
      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
        onSwitchToLogin={() => {
          setForgotPasswordOpen(false)
          setLoginOpen(true)
        }}
      />
    </div>
  )
}
