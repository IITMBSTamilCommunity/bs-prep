"use client"

import { usePathname } from "next/navigation"

export function Loading() {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith("/admin")

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isAdminRoute ? "bg-black/20 backdrop-blur-sm" : "bg-white"
      }`}
    >
      <div className="text-center space-y-4">
        {/* Loading Text */}
        <h3 className="text-2xl font-bold">
          <span
            className={`bg-linear-to-r bg-clip-text text-transparent ${
              isAdminRoute
                ? "from-slate-200 to-slate-400"
                : "from-slate-900 to-slate-600 dark:from-white dark:to-slate-400"
            }`}
          >
            Loading...
          </span>
        </h3>
        
        {/* Simple Spinner */}
        <div className="flex justify-center">
          <div
            className={`w-8 h-8 border-2 rounded-full animate-spin ${
              isAdminRoute
                ? "border-slate-500/40 border-t-slate-200"
                : "border-slate-200 dark:border-slate-800 border-t-slate-900 dark:border-t-white"
            }`}
          ></div>
        </div>
      </div>
    </div>
  )
}
