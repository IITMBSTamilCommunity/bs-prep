import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Careers at BSPrep | Join Our Team",
  description: "Join the BSPrep team and help us build the best learning platform for IITM BS students. Explore career opportunities and internships.",
  keywords: ["BSPrep careers", "work with us", "IITM BS internship", "education technology jobs"],
}

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
