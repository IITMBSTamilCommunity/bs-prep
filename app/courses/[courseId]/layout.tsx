import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: { courseId: string }
}

const courseData: Record<string, any> = {
  "qualifier-math-1": {
    title: "Mathematics for Data Science I",
    description: "Master fundamental math concepts for IITM BS Qualifier with expert Tamil video lectures.",
  },
  "qualifier-stats-1": {
    title: "Statistics for Data Science I",
    description: "Learn statistical thinking and analysis for IITM BS Qualifier with expert Tamil video lectures.",
  },
  "qualifier-computational-thinking": {
    title: "Computational Thinking",
    description: "Build problem-solving and algorithmic thinking fundamentals for IITM BS Qualifier.",
  },
  "qualifier-english-1": {
    title: "English I",
    description: "Essential communication skills for IITM BS Qualifier students.",
  }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const id = params.courseId
  const course = courseData[id]

  if (!course) {
    return {
      title: "Course Not Found",
    }
  }

  return {
    title: course.title,
    description: course.description,
    openGraph: {
      title: `${course.title} | BSPrep`,
      description: course.description,
      images: ['/og-image.png'],
    },
  }
}

export default function CourseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
