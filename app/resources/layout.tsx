import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "IITM BS Resources | Notes & Study Material",
  description: "Access curated study notes, resources, and community-contributed materials for all IITM BS subjects. Filter by degree, level, and subject to find what you need.",
  keywords: ["IITM BS notes", "study material", "resource bank", "contribute notes", "IITM BS degree resources"],
}

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
