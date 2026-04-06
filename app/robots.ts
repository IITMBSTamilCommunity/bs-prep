import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bsprep.in"

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/dashboard/",
          "/api/",
          "/auth/",
          "/compiler/",
          "/signin",
          "/signup",
          "/payment/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
