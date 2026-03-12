import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/api/",
          "/auth/",
          "/payment/",
        ],
      },
    ],
    sitemap: "https://bsprep.in/sitemap.xml",
  }
}
