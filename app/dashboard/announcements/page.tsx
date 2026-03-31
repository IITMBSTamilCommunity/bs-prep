import { redirect } from "next/navigation"

export default function DashboardAnnouncementsRedirectPage() {
  redirect("/admin/announcements")
}
