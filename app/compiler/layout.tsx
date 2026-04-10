import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Python Compiler | BSPrep",
  description: "Online Python 3 compiler — write, run, and share Python code in your browser.",
}

/**
 * Isolated layout for /compiler.
 * - No Navbar / Footer
 * - No BeamsBackground dotted canvas
 * - Body-level background is overridden so the compiler fills the full viewport cleanly
 */
export default function CompilerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="cc-layout-root">
      {children}
    </div>
  )
}
