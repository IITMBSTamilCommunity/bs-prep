import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "IITM BS GPA Calculator | Calculate Your CGPA & GPA",
  description: "The most accurate GPA calculator for IITM BS students. Calculate your semester GPA and cumulative CGPA based on credits and grades.",
  keywords: ["GPA calculator IITM BS", "calculate CGPA", "IITM BS grades", "credit based GPA"],
}

export default function GPACalculatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
