import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "IITM BS GPA Predictor | Forecast Your Future CGPA",
  description: "Predict your future CGPA in the IITM BS degree. Plan your grades for upcoming semesters and see how they impact your overall academic standing.",
  keywords: ["GPA predictor IITM BS", "forecast CGPA", "academic planning", "IITM BS degree progress"],
}

export default function GPAPredictorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
