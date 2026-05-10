import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "IITM BS Courses | Tamil Video Lectures",
  description: "Master IITM BS subjects with comprehensive video courses in Tamil. Qualified mentors, live sessions, and structured study material for Mathematics, Statistics, and more.",
  keywords: ["IITM BS courses", "Tamil video lectures", "IITM BS Qualifier prep", "Math for Data Science Tamil", "Statistics for Data Science Tamil"],
}

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
