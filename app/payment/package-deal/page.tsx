"use client"

import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { BeamsBackground } from "@/components/beams-background"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  ArrowLeft, CreditCard, Lock, Check, Shield, Package, Star, FileText
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type RazorpaySuccessResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void
}

const BUNDLE_COURSES = [
  {
    id: "qualifier-math-1",
    title: "Mathematics for Data Science I",
    description: "Fundamental math concepts essential for data science",
    thumbnail: "/courses/math.png",
    weeks: 4,
    individualPrice: 499,
    syllabus: [
      { week: 1, title: "Set Theory - Number system, Sets and their operations", topics: "Relations and functions - Relations and their types, Functions and their types" },
      { week: 2, title: "Rectangular coordinate system, Straight Lines", topics: "Slope of a line, Parallel and perpendicular lines, Representations of a Line, General equations of a line, Straight-line fit" },
      { week: 3, title: "Quadratic Functions", topics: "Quadratic functions, Minima, maxima, vertex, and slope, Quadratic Equations" },
      { week: 4, title: "Algebra of Polynomials", topics: "Addition, subtraction, multiplication, and division, Algorithms, Graphs of Polynomials - X-intercepts, multiplicities, end behavior, and turning points, Graphing & polynomial creation" },
    ],
  },
  {
    id: "qualifier-stats-1",
    title: "Statistics for Data Science I",
    description: "Statistical thinking and analysis from the ground up",
    thumbnail: "/courses/stats.png",
    weeks: 4,
    individualPrice: 499,
    syllabus: [
      { week: 1, title: "Introduction and type of data", topics: "Types of data, Descriptive and Inferential statistics, Scales of measurement" },
      { week: 2, title: "Describing categorical data", topics: "Frequency distribution of categorical data, Best practices for graphing categorical data, Mode and median for categorical variable" },
      { week: 3, title: "Describing numerical data", topics: "Frequency tables for numerical data, Measures of central tendency - Mean, median and mode, Quartiles and percentiles, Measures of dispersion - Range, variance, standard deviation and IQR, Five number summary" },
      { week: 4, title: "Association between two variables", topics: "Association between two categorical variables - Using relative frequencies in contingency tables, Association between two numerical variables - Scatterplot, covariance, Pearson correlation coefficient, Point bi-serial correlation coefficient" },
    ],
  },
  {
    id: "qualifier-computational-thinking",
    title: "Computational Thinking",
    description: "Problem-solving and algorithmic thinking fundamentals",
    thumbnail: "/courses/ct.png",
    weeks: 4,
    individualPrice: 499,
    syllabus: [
      { week: 1, title: "Variables, Initialization, Iterators, Filtering", topics: "Datatypes, Flowcharts, Sanity of data" },
      { week: 2, title: "Iteration, Filtering, Selection", topics: "Pseudocode, Finding max and min, AND operator" },
      { week: 3, title: "Multiple iterations (non-nested)", topics: "Three prizes problem, Procedures, Parameters, Side effects, OR operator" },
      { week: 4, title: "Nested iterations", topics: "Birthday paradox, Binning" },
    ],
  },
]

const BUNDLE_PRICE = 249
const ORIGINAL_PRICE = BUNDLE_COURSES.reduce((s, c) => s + c.individualPrice, 0) // 1497

export default function PackageDealPage() {
  const router = useRouter()
  const supabase = createClient()

  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const [checkoutReady, setCheckoutReady] = useState(false)
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null)
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" })

  const showPopup = (title: string, message: string) => setPopup({ title, message })

  useEffect(() => {
    checkAuth()
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => setCheckoutReady(true)
    script.onerror = () => setCheckoutReady(false)
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Not signed in — send back to courses
      router.replace("/courses")
      return
    }
    setIsAuthenticated(true)
    setAuthChecked(true)
  }

  const handlePayment = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      showPopup("Missing Details", "Please fill all fields before continuing.")
      return
    }

    if (!razorpayKeyId) {
      showPopup("Configuration Required", "Payment is not configured. Please contact support.")
      return
    }

    setLoading(true)
    try {
      if (!checkoutReady) {
        showPopup("Gateway Loading", "Payment gateway is still loading. Please try again in a moment.")
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace("/courses")
        return
      }

      const orderResponse = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          isBundle: true,
          payer: formData,
        }),
      })

      const orderData = await orderResponse.json()
      if (!orderResponse.ok || !orderData?.orderId) {
        throw new Error(orderData?.error || "Failed to create payment order")
      }

      const keyId = typeof orderData.keyId === "string" ? orderData.keyId : razorpayKeyId
      if (!keyId) {
        throw new Error("Missing Razorpay public key configuration")
      }

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: "INR",
        name: "BSPrep",
        description: "Qualifier Bundle — All 3 Courses",
        image: "/logo.jpeg",
        order_id: orderData.orderId,
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone,
        },
        theme: { color: "#000000" },
        handler: async function (response: RazorpaySuccessResponse) {
          try {
            const verifyResponse = await fetch("/api/payment/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                courseId: "bundle",
              }),
            })

            const verifyData = await verifyResponse.json()
            if (!verifyResponse.ok) {
              throw new Error(verifyData?.error || "Payment verification failed")
            }

            showPopup("Payment Successful", "Your enrollment is confirmed.")
            router.push("/dashboard/courses")
          } catch (verifyError) {
            const message = verifyError instanceof Error ? verifyError.message : "Payment verification failed"
            showPopup("Payment Verification Failed", message)
            setLoading(false)
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false)
          },
        },
      }

      const RazorpayRef = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay
      if (!RazorpayRef) {
        throw new Error("Payment gateway unavailable. Please refresh and try again.")
      }

      const razorpay = new RazorpayRef(options)
      razorpay.open()
    } catch (error) {
      console.error("Payment error:", error)
      const message = error instanceof Error ? error.message : "Payment failed. Please try again."
      showPopup("Payment Failed", message)
      setLoading(false)
    }
  }

  // Show spinner while auth is being verified
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-white relative">
        <BeamsBackground />
        <Navbar isAuthenticated={false} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white relative">
      <BeamsBackground />
      <Navbar isAuthenticated={isAuthenticated} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl pt-24 pb-20 relative z-10">
        {/* Back Button */}
        <Link
          href="/dashboard/courses"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Courses
        </Link>

        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#51b206]/10 border border-[#51b206]/30 mb-3">
            <Star className="w-3.5 h-3.5 text-[#51b206]" />
            <span className="text-xs font-bold text-[#51b206] uppercase tracking-wide">Best Value</span>
          </div>
          <h1 className="text-3xl font-bold text-black mb-2">Qualifier Bundle — All 3 Courses</h1>
          <p className="text-gray-600">Enroll in all 3 available qualifier courses at once and save ₹{ORIGINAL_PRICE - BUNDLE_PRICE}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Bundle Summary */}
          <div className="space-y-5">
            {/* Courses included */}
            <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#51b206]" />
                  <h2 className="font-bold text-black text-base">Included in this bundle</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {BUNDLE_COURSES.map((course) => (
                    <div key={course.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="w-14 h-10 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-gray-50">
                        <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-black leading-tight">{course.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{course.weeks} weeks · Qualifier</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-xs text-gray-400 line-through">₹{course.individualPrice}</p>
                        {/* Syllabus popup */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="inline-flex items-center gap-1 text-xs font-semibold text-black border border-gray-300 hover:border-black hover:bg-black hover:text-white transition-all px-2.5 py-1 rounded-lg">
                              <FileText className="w-3 h-3" />
                              Syllabus
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-bold text-black">{course.title} — Syllabus</DialogTitle>
                              <p className="text-sm text-gray-500 mt-1">{course.weeks} Weeks · Qualifier Level</p>
                            </DialogHeader>
                            <div className="space-y-5 mt-4">
                              {course.syllabus.map((week) => (
                                <div key={week.week} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                                  <div className="flex gap-4">
                                    <Badge className="bg-black text-white text-xs font-semibold px-3 py-1 rounded h-fit shrink-0">
                                      Week {week.week}
                                    </Badge>
                                    <div className="flex-1">
                                      <h3 className="text-sm font-bold text-black mb-1.5">{week.title}</h3>
                                      <p className="text-sm text-gray-600 leading-relaxed">{week.topics}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price summary */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Individual total</span>
                    <span className="line-through">₹{ORIGINAL_PRICE}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-[#51b206]">
                    <span>Bundle discount</span>
                    <span>− ₹{ORIGINAL_PRICE - BUNDLE_PRICE}</span>
                  </div>
                  <div className="flex justify-between text-xl font-extrabold text-black pt-2 border-t border-gray-200">
                    <span>You pay</span>
                    <span>₹{BUNDLE_PRICE}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What you get */}
            <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
              <CardContent className="p-5 space-y-2.5">
                {[
                  "All 3 qualifier courses unlocked immediately",
                  "Expert-led video lectures in Tamil",
                  "Practice assignments and quizzes for each course",
                  "Live doubt-clearing sessions",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#51b206] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Lock className="w-4 h-4" />
              <span>Secure payment processing with Razorpay</span>
            </div>
          </div>

          {/* Right — Payment form */}
          <div className="space-y-5">
            <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-black mb-6 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Details
                </h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-black focus:outline-none focus:border-gray-400 transition-colors"
                      suppressHydrationWarning
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-black focus:outline-none focus:border-gray-400 transition-colors"
                      suppressHydrationWarning
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+91 1234567890"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-black focus:outline-none focus:border-gray-400 transition-colors"
                      suppressHydrationWarning
                    />
                  </div>
                </div>

                <Button
                  onClick={handlePayment}
                  disabled={loading}
                  className="w-full bg-black hover:bg-black/80 text-white py-6 text-lg font-semibold"
                  suppressHydrationWarning
                >
                  {loading ? "Processing..." : `Pay ₹${BUNDLE_PRICE} for All 3 Courses`}
                </Button>

                <p className="text-xs text-center text-gray-500 mt-4">
                  By completing this purchase, you agree to our Terms of Service and Privacy Policy
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border border-blue-200 rounded-xl">
              <CardContent className="p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">Secure Payment Gateway</p>
                  <p className="text-xs text-blue-700">
                    Your payment information is encrypted and secure. We use Razorpay's industry-standard security measures.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {popup ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c1016] p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100">{popup.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{popup.message}</p>
            <button
              type="button"
              onClick={() => setPopup(null)}
              className="mt-5 w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              OK
            </button>
          </div>
        </section>
      ) : null}

      <Footer />
    </div>
  )
}
