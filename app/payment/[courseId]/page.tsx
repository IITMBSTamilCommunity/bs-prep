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

// Course data matching the course detail page
const coursePaymentData: Record<string, any> = {
  "qualifier-math-1": {
    title: "Mathematics for Data Science I",
    level: "qualifier",
    price: 99,
    description: "Fundamental mathematics concepts for data science",
    thumbnail: "/courses/math.jpg",
    weeks: 12,
  },
  "qualifier-stats-1": {
    title: "Statistics for Data Science I",
    level: "qualifier",
    price: 99,
    description: "Introduction to statistical thinking and analysis",
    thumbnail: "/courses/stats.jpg",
    weeks: 12,
  },
  "qualifier-computational-thinking": {
    title: "Computational Thinking",
    level: "qualifier",
    price: 99,
    description: "Problem-solving and algorithmic thinking fundamentals",
    thumbnail: "/courses/ct.jpg",
    weeks: 12,
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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })

  useEffect(() => {
    checkAuth()
    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setIsAuthenticated(!!user)
  }

  const handlePayment = async () => {
    // Validate form
    if (!formData.name || !formData.email || !formData.phone) {
      alert('Please fill all fields')
      return
    }

    if (!razorpayKeyId) {
      alert('Razorpay is not configured. Please set NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local and restart the app.')
      return
    }

    setLoading(true)

    try {
      // STEP 1: Create order on your backend
      // Uncomment when you have backend API ready
      /*
      const orderResponse = await fetch('/api/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: course.price * 100, // Razorpay expects amount in paise
          currency: 'INR',
          courseId: courseId
        })
      })
      const orderData = await orderResponse.json()
      */

      // STEP 2: Initialize Razorpay
      const options = {
        // Get these from Razorpay Dashboard: https://dashboard.razorpay.com/app/website-app-settings/api-keys
        key: razorpayKeyId,
        amount: course.price * 100, // Amount in paise (₹99 = 9900 paise)
        currency: 'INR',
        name: 'IITM BS',
        description: course.title,
        image: '/logo.png', // Your logo
        // order_id: orderData.orderId, // Uncomment when using backend
        
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
        handler: async function (response: any) {
          // Payment successful
          console.log('Payment Success:', response)
          
          // STEP 3: Verify payment on backend (IMPORTANT for security)
          /*
          const verifyResponse = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              courseId: courseId,
              userId: user?.id
            })
          })
          
          if (verifyResponse.ok) {
            // Enroll user in course
            await enrollUser()
          }
          */
          
          alert('Payment successful! Payment ID: ' + response.razorpay_payment_id)
          // Redirect to course page
          router.push(`/courses/${courseId}`)
        },
        
        // Error handler
        modal: {
          ondismiss: function() {
            setLoading(false)
          }
        }
      }

      // @ts-ignore - Razorpay is loaded via script
      const razorpay = new window.Razorpay(options)
      razorpay.open()
      
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment failed. Please try again.')
      setLoading(false)
    }
  }

  const handleDemoEnroll = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in first')
        setLoading(false)
        return
      }

      // Check if already enrolled
      const { data: existing } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single()

      if (existing) {
        alert('You are already enrolled in this course!')
        router.push(`/dashboard/courses`)
        return
      }

      const { error } = await supabase
        .from('enrollments')
        .insert({ user_id: user.id, course_id: courseId, payment_status: 'completed' })

      if (error) throw error
      router.push(`/dashboard`)
    } catch (err) {
      console.error('Demo enroll error:', err)
      alert('Enrollment failed. Please try again.')
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
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">Certificate of completion</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">Lifetime access to course materials</span>
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

      <Footer />
    </div>
  )
}
