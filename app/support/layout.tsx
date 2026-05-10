import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Support | Contact BSPrep",
  description: "Need help? Contact the BSPrep support team for any queries regarding our courses, tools, or community. We are here to help you succeed in your IITM BS journey.",
  keywords: ["BSPrep support", "contact us", "help desk", "IITM BS student support"],
}

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
