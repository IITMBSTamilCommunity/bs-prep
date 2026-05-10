import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "IITM BS Quiz Prep | Practice Tests & Mock Exams",
  description: "Prepare for your IITM BS quizzes and exams with our practice tests. Real-time feedback, detailed solutions, and comprehensive question banks.",
  keywords: ["IITM BS quiz prep", "mock exams", "practice tests", "IITM BS exam preparation"],
}

export default function QuizPrepLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
