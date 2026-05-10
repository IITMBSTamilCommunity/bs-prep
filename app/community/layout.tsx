import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "IITM BS Community | Student Support & Networking",
  description: "Connect with fellow IITM BS students. Share resources, ask doubts, and build your network with the largest Tamil-speaking IITM BS student community.",
  keywords: ["IITM BS community", "student forum", "IITM BS networking", "study groups"],
}

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
