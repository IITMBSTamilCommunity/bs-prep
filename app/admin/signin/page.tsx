"use client"

import Link from "next/link"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams } from "next/navigation"

export default function AdminSignInPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const hasAccessDeniedError = searchParams.get("error") === "access_denied"

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?next=/admin`

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      })

      if (signInError) {
        throw signInError
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#05070b] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[78vh] w-full max-w-3xl items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14161a] p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]">
          <h1 className="text-center text-[38px] font-semibold tracking-tight leading-none">Admin Portal</h1>
          <p className="mt-2 text-center text-xl text-slate-300">Sign in to access your account</p>
          <p className="mx-auto mt-6 max-w-sm text-center text-base leading-relaxed text-slate-400">
            Use your official account to continue. Only approved admin accounts can access the admin console.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-white text-base font-medium text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <img src="https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/google-logo.svg" alt="Google" className="h-5 w-5" />
            {isLoading ? "Signing in..." : "Continue with Google"}
          </button>

          <Link
            href="/"
            className="mt-3 flex h-12 w-full items-center justify-center rounded-lg border border-white/10 bg-[#090b10] text-base font-medium text-white transition hover:bg-[#0d1018]"
          >
            Back to Home
          </Link>

          {hasAccessDeniedError ? (
            <p className="mt-4 text-center text-sm text-rose-400">
              This account does not have admin access.
            </p>
          ) : null}
          {error ? <p className="mt-4 text-center text-sm text-rose-400">{error}</p> : null}

          <p className="mt-6 text-center text-sm text-slate-500">
            By continuing, you agree to our terms and privacy policy.
          </p>
        </section>
      </div>
    </main>
  )
}
