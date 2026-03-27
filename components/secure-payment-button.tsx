'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface SecurePaymentProps {
  courseId: string
  isBundle?: boolean
  amount: number
  courseName: string
  onSuccess?: () => void
}

export function SecurePaymentButton({
  courseId,
  isBundle = false,
  amount,
  courseName,
  onSuccess,
}: SecurePaymentProps) {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadRazorpayScript()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadRazorpayScript = () => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
  }

  const handlePayment = async () => {
    if (!user) {
      alert('Please log in first')
      return
    }

    setLoading(true)

    try {
      // Get JWT token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Authentication required')
      }

      // Step 1: Create order on secure backend
      const orderResponse = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          courseId: isBundle ? 'bundle' : courseId,
          isBundle,
        }),
      })

      if (!orderResponse.ok) {
        const error = await orderResponse.json()
        throw new Error(error.error || 'Failed to create order')
      }

      const order = await orderResponse.json()

      // Step 2: Open Razorpay checkout with order details
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'BSPrep',
        description: courseName,
        prefill: {
          email: user.email,
          name: user.user_metadata?.full_name || '',
        },
        theme: {
          color: '#000000',
        },
        handler: async (response: any) => {
          try {
            // Step 3: Verify payment signature on backend (critical security step)
            const verifyResponse = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                courseId: isBundle ? 'bundle' : courseId,
              }),
            })

            if (!verifyResponse.ok) {
              const error = await verifyResponse.json()
              throw new Error(error.error || 'Payment verification failed')
            }

            // Success! User is enrolled
            alert('Payment successful! You can now access the course.')
            onSuccess?.()
          } catch (error) {
            console.error('Verification error:', error)
            alert('Payment verification failed. Please contact support if amount was deducted.')
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false)
          },
        },
      }

      const razorpay = new (window as any).Razorpay(options)
      razorpay.open()
    } catch (error) {
      console.error('Payment error:', error)
      alert(error instanceof Error ? error.message : 'Payment failed. Please try again.')
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center text-sm text-gray-500">
        Please log in to purchase
      </div>
    )
  }

  return (
    <Button
      onClick={handlePayment}
      disabled={loading}
      className="w-full bg-black hover:bg-black/80 text-white"
    >
      {loading ? 'Processing...' : `Pay ₹${(amount / 100).toFixed(0)}`}
    </Button>
  )
}
