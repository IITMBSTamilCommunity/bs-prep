import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bsprep.in"

// Static public routes with SEO priority/frequency hints
const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1.0,
  },
  {
    url: `${BASE_URL}/courses`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${BASE_URL}/community`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/announcements`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  },
  {
    url: `${BASE_URL}/quiz-prep`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    url: `${BASE_URL}/resources`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  },
  {
    url: `${BASE_URL}/tools`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: `${BASE_URL}/tools/gpa-calculator`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: `${BASE_URL}/tools/gpa-predictor`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: `${BASE_URL}/careers`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: `${BASE_URL}/careers/mentor-faculty`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    url: `${BASE_URL}/support`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    url: `${BASE_URL}/privacy`,
    lastModified: new Date(),
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    url: `${BASE_URL}/terms`,
    lastModified: new Date(),
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    url: `${BASE_URL}/disclaimer`,
    lastModified: new Date(),
    changeFrequency: "yearly",
    priority: 0.3,
  },
]

async function getCourseRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: courses, error } = await supabase
      .from("courses")
      .select("id, updated_at")

    if (error || !courses) return []

    return courses.map((course) => ({
      url: `${BASE_URL}/courses/${course.id}`,
      lastModified: course.updated_at ? new Date(course.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courseRoutes = await getCourseRoutes()
  return [...staticRoutes, ...courseRoutes]
}
