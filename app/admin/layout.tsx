import type { Metadata } from "next"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": 0,
      "max-image-preview": "none",
      "max-video-preview": -1,
    },
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}