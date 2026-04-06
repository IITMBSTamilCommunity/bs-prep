"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { BeamsBackground } from "@/components/beams-background"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CreditCard, Lock, Check, Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

type RazorpaySuccessResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void
}

// Course data matching the course detail page
const coursePaymentData: Record<string, any> = {
  "qualifier-math-1": {
    title: "Mathematics for Data Science I",
    level: "qualifier",
    price: 99,
    description: "Fundamental mathematics concepts for data science",
    thumbnail: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/courses/math.png",
    weeks: 4,
  },
  "qualifier-stats-1": {
    title: "Statistics for Data Science I",
    level: "qualifier",
    price: 99,
    description: "Introduction to statistical thinking and analysis",
    thumbnail: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/courses/stats.png",
    weeks: 4,
  },
  "qualifier-computational-thinking": {
    title: "Computational Thinking",
    level: "qualifier",
    price: 99,
    description: "Problem-solving and algorithmic thinking fundamentals",
    thumbnail: "https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/courses/ct.png",
    weeks: 4,
  },
}

export default function PaymentPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string
  const course = coursePaymentData[courseId]
  const supabase = createClient()

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const [checkoutReady, setCheckoutReady] = useState(false)
  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })

  const showPopup = (title: string, message: string) => setPopup({ title, message })

  useEffect(() => {
    checkAuth()
    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
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
    setIsAuthenticated(!!user)
  }

  const handlePayment = async () => {
    // Validate form
    if (!formData.name || !formData.email || !formData.phone) {
      showPopup('Missing Details', 'Please fill all fields before continuing.')
      return
    }

    if (!razorpayKeyId) {
      showPopup('Configuration Required', 'Payment is not configured. Please contact support.')
      return
    }

    setLoading(true)

    try {
      if (!checkoutReady) {
        showPopup('Gateway Loading', 'Payment gateway is still loading. Please try again in a moment.')
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        router.replace('/courses')
        return
      }

      const orderResponse = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          courseId,
          isBundle: false,
          payer: formData,
        }),
      })
      const orderData = await orderResponse.json()
      if (!orderResponse.ok || !orderData?.orderId) {
        throw new Error(orderData?.error || 'Failed to create payment order')
      }

      const keyId = typeof orderData.keyId === 'string' ? orderData.keyId : razorpayKeyId
      if (!keyId) {
        throw new Error('Missing Razorpay public key configuration')
      }

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'BSPrep',
        description: course.title,
        image: 'https://cdn.jsdelivr.net/gh/PRODHOSH/bs-prep@main/public/logo.jpeg',
        order_id: orderData.orderId,
        
        // Prefill customer details
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone
        },
        
        // Customize colors to match your theme
        theme: {
          color: '#000000' // Black to match your design
        },
        
        // Success handler
        handler: async function (response: RazorpaySuccessResponse) {
          try {
            const verifyResponse = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                courseId,
              })
            })

            const verifyData = await verifyResponse.json()
            if (!verifyResponse.ok) {
              throw new Error(verifyData?.error || 'Payment verification failed')
            }

            showPopup('Payment Successful', 'Your enrollment is confirmed.')
            router.push('/dashboard/courses')
          } catch (verifyError) {
            const message = verifyError instanceof Error ? verifyError.message : 'Payment verification failed'
            showPopup('Payment Verification Failed', message)
            setLoading(false)
          }
        },
        
        // Error handler
        modal: {
          ondismiss: function() {
            setLoading(false)
          }
        }
      }

      const RazorpayRef = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay
      if (!RazorpayRef) {
        throw new Error('Payment gateway unavailable. Please refresh and try again.')
      }

      const razorpay = new RazorpayRef(options)
      razorpay.open()
      
    } catch (error) {
      console.error('Payment error:', error)
      const message = error instanceof Error ? error.message : 'Payment failed. Please try again.'
      showPopup('Payment Failed', message)
      setLoading(false)
    }
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-white relative">
        <BeamsBackground />
        <Navbar isAuthenticated={isAuthenticated} />
        <div className="container mx-auto px-4 pt-32 text-center relative z-10">
          <h1 className="text-2xl font-bold text-black mb-4">Course Not Found</h1>
          <Link href={isAuthenticated ? "/dashboard/courses" : "/courses"}>
            <Button className="bg-black hover:bg-black/80 text-white">Back to Courses</Button>
          </Link>
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
          href={isAuthenticated ? `/dashboard/courses` : `/courses/${courseId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Course{isAuthenticated ? "s" : ""}
        </Link>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Complete Your Enrollment</h1>
          <p className="text-gray-600">You're one step away from starting your learning journey</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Course Summary */}
          <div className="space-y-6">
            {/* Course Info Card */}
            <Card className="bg-white border border-gray-200 shadow-sm rounded-lg">
              <CardContent className="p-6">
                {/* Course Thumbnail */}
                <div className="w-full aspect-video bg-gray-50 rounded-xl overflow-hidden border border-gray-200 mb-4">
                  <img 
                    src={course.thumbnail} 
                    alt={course.title}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: 'center' }}
                  />
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Badge className="bg-gray-100 text-black text-xs font-semibold px-3 py-1 rounded">
                    {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                  </Badge>
                  <Badge className="bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded">
                    🇮🇳 Tamil
                  </Badge>
                </div>
                
                <h2 className="text-2xl font-bold text-black mb-3">{course.title}</h2>
                <p className="text-gray-600 mb-6">{course.description}</p>

                {/* Course Features */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{course.weeks} weeks of comprehensive content</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">Expert-led video lectures in Tamil</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">Practice assignments and quizzes</span>
                  </div>
                </div>

                {/* Price */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-700">Total Amount</span>
                    <span className="text-3xl font-bold text-black">₹{course.price}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Badge */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Lock className="w-4 h-4" />
              <span>Secure payment processing with Razorpay</span>
            </div>
          </div>

          {/* Payment Section */}
          <div className="space-y-6">
            {/* Payment Card */}
            <Card className="bg-white border border-gray-200 shadow-sm rounded-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-black mb-6 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Details
                </h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-black focus:outline-none focus:border-gray-400 transition-colors"
                      suppressHydrationWarning
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-black focus:outline-none focus:border-gray-400 transition-colors"
                      suppressHydrationWarning
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 1234567890"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
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
                  {loading ? "Processing..." : `Pay ₹${course.price}`}
                </Button>

                <p className="text-xs text-center text-gray-500 mt-4">
                  By completing this purchase, you agree to our Terms of Service and Privacy Policy
                </p>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-blue-50 border border-blue-200 rounded-lg">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Secure Payment Gateway</p>
                    <p className="text-xs text-blue-700">
                      Your payment information is encrypted and secure. We use Razorpay's industry-standard security measures.
                    </p>
                  </div>
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
