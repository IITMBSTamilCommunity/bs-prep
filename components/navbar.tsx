"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { Bell, User, Menu, X, ChevronDown, Settings } from "lucide-react"
import { LoginModal } from "@/components/auth/login-modal"
import { SignUpModal } from "@/components/auth/signup-modal"
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal"

interface NavbarProps {
  isAuthenticated?: boolean
  userRole?: string
}

export function Navbar({ isAuthenticated = false, userRole = "student" }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [scrolled, setScrolled] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [signUpOpen, setSignUpOpen] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([])
  const [seenIds, setSeenIds] = useState<string[]>([])
  const router = useRouter()
  const supabase = createClient()

  const getGoogleAvatarUrl = (currentUser: any): string | null => {
    if (!currentUser) return null

    const provider = currentUser?.app_metadata?.provider || currentUser?.app_metadata?.providers?.[0]
    if (provider !== 'google') return null

    return currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.picture || null
  }

  const googleAvatarUrl = getGoogleAvatarUrl(user)

  // Build a stable ID for a class notification
  const notifId = (cls: any) => `${cls.course}-${cls.date}-${cls.time}`

  // Load seen IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bsprep_seen_notifs')
      if (stored) setSeenIds(JSON.parse(stored))
    } catch {}
  }, [])

  // Fetch upcoming classes when authenticated
  useEffect(() => {
    if (!isAuthenticated) return
    const load = async () => {
      try {
        const res = await fetch('/api/live-classes')
        if (!res.ok) return
        const data = await res.json()
        const now = Date.now()
        const upcoming = (data.classes || []).filter((cls: any) => {
          try {
            const [h, m] = (cls.time || '0:0').split(':').map(Number)
            const d = new Date(cls.date)
            d.setHours(h, m, 0, 0)
            return d.getTime() + 60 * 60 * 1000 > now
          } catch { return true }
        })
        setUpcomingClasses(upcoming)
      } catch {}
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  const unreadCount = upcomingClasses.filter(cls => !seenIds.includes(notifId(cls))).length

  const markAllSeen = () => {
    const ids = upcomingClasses.map(notifId)
    const merged = Array.from(new Set([...seenIds, ...ids]))
    setSeenIds(merged)
    try { localStorage.setItem('bsprep_seen_notifs', JSON.stringify(merged)) } catch {}
  }

  const handleNotifOpen = (open: boolean) => {
    setNotifOpen(open)
    if (open) markAllSeen()
  }

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      supabase.auth.getUser().then(({ data }) => setUser(data.user))
    }
  }, [isAuthenticated])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <nav
      className={`sticky top-0 z-50 bg-[#FAF8F5]/95 backdrop-blur-lg transition-all duration-300 ${
        scrolled ? "border-b border-[#E5DBC8] shadow-sm" : "border-b border-[#F0E9D8]"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-3 flex-shrink-0 group">
            <img 
              src="/logo.jpeg" 
              alt="BSPrep Logo" 
              className="w-11 h-11 rounded-full object-cover group-hover:opacity-80 transition-opacity"
            />
            <span className="font-bold text-2xl hidden sm:inline text-black">
              BSPrep
            </span>
          </Link>

          {/* Desktop Navigation */}
          {!isAuthenticated && (
            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Home
              </Link>
              <Link href="/courses" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Courses
              </Link>
              <Link href="/quiz-prep" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Quiz Prep
              </Link>
              <Link href="/resources" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Resources
              </Link>
              <DropdownMenu open={toolsOpen} onOpenChange={setToolsOpen}>
                <DropdownMenuTrigger 
                  className="text-base font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all duration-300 flex items-center gap-1"
                  onMouseEnter={() => setToolsOpen(true)}
                  onMouseLeave={() => setToolsOpen(false)}
                  suppressHydrationWarning
                >
                  Tools
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${toolsOpen ? 'rotate-180' : ''}`} />
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="bg-white border-gray-200 shadow-lg min-w-[240px] p-2 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300"
                  onMouseEnter={() => setToolsOpen(true)}
                  onMouseLeave={() => setToolsOpen(false)}
                >
                  <DropdownMenuItem asChild className="rounded-md py-3 px-4 hover:bg-[#fdf6ec] focus:bg-[#fdf6ec]">
                    <Link href="/tools/gpa-calculator" className="cursor-pointer text-base font-medium text-slate-700 hover:text-slate-700 focus:text-slate-700 flex items-center gap-2">GPA Calculator</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-md py-3 px-4 hover:bg-[#fdf6ec] focus:bg-[#fdf6ec]">
                    <Link href="/tools/gpa-predictor" className="cursor-pointer text-base font-medium text-slate-700 hover:text-slate-700 focus:text-slate-700 flex items-center gap-2">GPA Predictor</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/support" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Support
              </Link>
              <Link href="/careers" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Careers
              </Link>
            </div>
          )}

          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Dashboard
              </Link>
              <Link href="/dashboard/courses" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Courses
              </Link>
              <Link href="/quiz-prep" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Quiz Prep
              </Link>
              <Link href="/compiler" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Compiler
              </Link>
              <Link href="/resources" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Resources
              </Link>
              <DropdownMenu open={toolsOpen} onOpenChange={setToolsOpen}>
                <DropdownMenuTrigger 
                  className="text-base font-medium text-slate-700 hover:text-black transition-all duration-300 flex items-center gap-1"
                  onMouseEnter={() => setToolsOpen(true)}
                  onMouseLeave={() => setToolsOpen(false)}
                  suppressHydrationWarning
                >
                  Tools
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${toolsOpen ? 'rotate-180' : ''}`} />
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="bg-white border-gray-200 shadow-lg min-w-[240px] p-2 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300"
                  onMouseEnter={() => setToolsOpen(true)}
                  onMouseLeave={() => setToolsOpen(false)}
                >
                  <DropdownMenuItem asChild className="rounded-md py-3 px-4 hover:bg-[#fdf6ec] focus:bg-[#fdf6ec]">
                    <Link href="/tools/gpa-calculator" className="cursor-pointer text-base font-medium text-slate-700 hover:text-slate-700 focus:text-slate-700 flex items-center gap-2">GPA Calculator</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-md py-3 px-4 hover:bg-[#fdf6ec] focus:bg-[#fdf6ec]">
                    <Link href="/tools/gpa-predictor" className="cursor-pointer text-base font-medium text-slate-700 hover:text-slate-700 focus:text-slate-700 flex items-center gap-2">GPA Predictor</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/support" className="text-base font-medium text-slate-700 hover:text-black transition-colors">
                Support
              </Link>
            </div>
          )}

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <DropdownMenu open={notifOpen} onOpenChange={handleNotifOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="relative p-2 text-slate-600 hover:text-black transition-colors">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 bg-white border-gray-200 shadow-xl p-0 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="font-bold text-black text-sm">Notifications</span>
                      {upcomingClasses.length > 0 && (
                        <span className="text-xs text-gray-500">{upcomingClasses.length} upcoming</span>
                      )}
                    </div>
                    {upcomingClasses.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-400">
                        No upcoming classes
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {upcomingClasses.map((cls, i) => {
                          const id = notifId(cls)
                          const isUnseen = !seenIds.includes(id)
                          const [h, min] = (cls.time || '0:0').split(':').map(Number)
                          const d = new Date(cls.date)
                          d.setHours(h, min, 0, 0)
                          const dateStr = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                          const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
                          const courseNames: Record<string, string> = {
                            'ct': 'Computational Thinking',
                            'math-1': 'Mathematics I',
                            'stats-1': 'Statistics I',
                            'math-2': 'Mathematics II',
                            'stats-2': 'Statistics II',
                          }
                          const courseName = courseNames[cls.course?.toLowerCase()] ?? cls.course
                          return (
                            <div key={i} className={`px-4 py-3 flex items-start gap-3 ${isUnseen ? 'bg-red-50' : 'bg-white'}`}>
                              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${isUnseen ? 'bg-red-500' : 'bg-gray-300'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{courseName}</p>
                                <p className="text-sm font-semibold text-black leading-snug">{cls.topic}</p>
                                <p className="text-xs text-gray-500 mt-1">{dateStr} &bull; {timeStr}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 bg-white hover:bg-gray-50 transition-colors">
                      {googleAvatarUrl ? (
                        <img
                          src={googleAvatarUrl}
                          alt="Profile"
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-5 h-5 text-slate-600" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white border-gray-200 shadow-lg">
                    <div className="px-3 py-2 text-sm text-slate-600 truncate">{user?.email}</div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer hover:bg-[#fdf6ec] focus:bg-[#fdf6ec]">
                      <Link href="/dashboard/settings" className="flex items-center gap-2 text-black">
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 cursor-pointer hover:bg-[#fdf6ec] focus:bg-[#fdf6ec]" onClick={handleLogout}>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  className="hidden sm:block border-slate-300 text-black hover:bg-slate-100 transition-all rounded-full"
                  onClick={() => setLoginOpen(true)}
                  suppressHydrationWarning
                >
                  Login
                </Button>
                <Button 
                  className="bg-black hover:bg-slate-800 text-white transition-all rounded-full"
                  onClick={() => setSignUpOpen(true)}
                  suppressHydrationWarning
                >
                  Sign Up
                </Button>
              </>
            )}

            {/* Mobile Menu Button */}
            <button className="md:hidden text-slate-700" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2 animate-in slide-in-from-top duration-300">
            {!isAuthenticated && (
              <>
                <Link href="/" className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all">
                  Home
                </Link>
                <Link
                  href="/courses"
                  className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all"
                >
                  Courses
                </Link>
                <Link
                  href="/quiz-prep"
                  className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all"
                >
                  Quiz Prep
                </Link>
                <Link
                  href="/resources"
                  className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all"
                >
                  Resources
                </Link>
                <div className="px-4 py-2 text-sm font-semibold text-slate-500">
                  Tools
                </div>
                <Link
                  href="/tools/gpa-calculator"
                  className="block px-6 py-2 text-sm text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all"
                >
                  GPA Calculator
                </Link>
                <Link
                  href="/tools/gpa-predictor"
                  className="block px-6 py-2 text-sm text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all"
                >
                  GPA Predictor
                </Link>
                <Link
                  href="/support"
                  className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all"
                >
                  Support
                </Link>
                <Link
                  href="/careers"
                  className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all"
                >
                  Careers
                </Link>
              </>
            )}

            {isAuthenticated && (
              <>
                <Link href="/dashboard" className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all">
                  Dashboard
                </Link>
                <Link href="/dashboard/courses" className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all">
                  Courses
                </Link>
                <Link href="/quiz-prep" className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all">
                  Quiz Prep
                </Link>
                <Link href="/compiler" className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all">
                  Compiler
                </Link>
                <Link href="/resources" className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all">
                  Resources
                </Link>
                <div className="px-4 py-2 text-sm font-semibold text-slate-500">
                  Tools
                </div>
                <Link href="/tools/gpa-calculator" className="block px-6 py-2 text-sm text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all">
                  GPA Calculator
                </Link>
                <Link href="/tools/gpa-predictor" className="block px-6 py-2 text-sm text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all">
                  GPA Predictor
                </Link>
                <Link href="/support" className="block px-4 py-2 text-sm font-medium text-slate-700 hover:text-black hover:bg-slate-50 rounded-lg transition-all">
                  Support
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Auth Modals */}
      <LoginModal 
        open={loginOpen} 
        onOpenChange={setLoginOpen}
        onSwitchToSignUp={() => {
          setLoginOpen(false)
          setSignUpOpen(true)
        }}
        onSwitchToForgotPassword={() => {
          setLoginOpen(false)
          setForgotPasswordOpen(true)
        }}
      />
      <SignUpModal 
        open={signUpOpen} 
        onOpenChange={setSignUpOpen}
        onSwitchToLogin={() => {
          setSignUpOpen(false)
          setLoginOpen(true)
        }}
      />
      <ForgotPasswordModal 
        open={forgotPasswordOpen} 
        onOpenChange={setForgotPasswordOpen}
        onSwitchToLogin={() => {
          setForgotPasswordOpen(false)
          setLoginOpen(true)
        }}
      />
    </nav>
  )
}
