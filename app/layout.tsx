import type React from "react"
import type { Metadata, Viewport } from "next"
import { Suspense } from "react"
import Script from "next/script"
import { Urbanist } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { BeamsBackground } from "@/components/beams-background"
import { LoadingProvider } from "@/components/loading-provider"
import { Loading } from "@/components/loading"
import "./globals.css"

const urbanist = Urbanist({ 
  subsets: ["latin"],
  variable: "--font-urbanist",
  display: "swap",
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bsprep.in"
const siteName = "BSPrep"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BSPrep | IITM BS Prep, GPA Tools, Notes and Community",
    template: "%s | BSPrep",
  },
  description: "BSPrep helps IITM BS students with GPA calculator tools, curated notes, quizzes, and community support for better academic outcomes.",
  keywords: [
    "IITM BS",
    "BS Data Science",
    "GPA calculator",
    "IITM BS notes",
    "IITM BS community",
    "online degree prep",
    "BSPrep",
  ],
  applicationName: siteName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: "BSPrep | IITM BS Prep, GPA Tools, Notes and Community",
    description: "Prepare smarter for IITM BS with GPA tools, notes, quiz prep, and community support.",
    images: [
      {
        url: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/logo.jpeg",
        width: 1200,
        height: 630,
        alt: "BSPrep",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BSPrep | IITM BS Prep, GPA Tools, Notes and Community",
    description: "Prepare smarter for IITM BS with GPA tools, notes, quiz prep, and community support.",
    images: ["https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/logo.jpeg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "5ODn-khJLlBmRAPlBkHz4w54nYhejaoLbrkwl_1-_NU",
  },
  icons: {
    icon: "/new-logo-favicon.png",
    apple: "/new-logo-favicon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={urbanist.variable} suppressHydrationWarning>
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-06EFDQ4LSM"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-06EFDQ4LSM');
          `}
        </Script>
        <Script id="seo-organization-jsonld" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: siteName,
            url: siteUrl,
            logo: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/logo.jpeg",
            sameAs: [
              "https://www.linkedin.com/",
              "https://github.com/",
            ],
          })}
        </Script>
        <Script id="seo-website-jsonld" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: siteName,
            url: siteUrl,
            potentialAction: {
              "@type": "SearchAction",
              target: `${siteUrl}/resources?search={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          })}
        </Script>
      </head>
      <body className={`font-sans antialiased ${urbanist.className}`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <BeamsBackground />
          <div className="relative z-10">
            <LoadingProvider>
              <Suspense fallback={<Loading />}>
                {children}
              </Suspense>

            </LoadingProvider>
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
