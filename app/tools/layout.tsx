import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "IITM BS GPA Tools | Calculator & Predictor",
  description: "Calculate your IITM BS GPA easily with our tools. Plan your semesters, predict your CGPA, and track your academic progress with BSPrep tools.",
  keywords: ["IITM BS GPA calculator", "GPA predictor", "CGPA calculator IITM", "IITM BS student tools"],
}

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
