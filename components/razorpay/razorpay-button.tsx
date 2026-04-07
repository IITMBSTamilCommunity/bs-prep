"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

type RazorpayButtonProps = {
  onPaymentSuccess: (orderId: string, paymentId: string) => void
  onPaymentError: (error: string) => void
}

declare global {
  interface Window {
    Razorpay: any
  }
}

/**
 * Razorpay button component
 * Handles Razorpay checkout initialization and payment processing
 */
export function RazorpayButton({ onPaymentSuccess, onPaymentError }: RazorpayButtonProps) {
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleDonate() {
    if (!amount || Number(amount) <= 0) {
      onPaymentError("Please enter a valid amount")
      return
    }

    setIsLoading(true)

    try {
      // Step 1: Create Razorpay order
      const orderRes = await fetch("/api/donations/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      })

      if (!orderRes.ok) {
        const error = await orderRes.json()
        throw new Error(error.error || "Failed to create donation order")
      }

      const orderData = await orderRes.json()
      const { orderId, currency } = orderData

      // Step 2: Load Razorpay script
      if (!window.Razorpay) {
        const script = document.createElement("script")
        script.src = "https://checkout.razorpay.com/v1/checkout.js"
        script.async = true
        document.body.appendChild(script)

        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
        })
      }

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      if (!keyId) {
        throw new Error("Razorpay key not configured")
      }

      // Step 3: Open Razorpay checkout
      const razorpay = new window.Razorpay({
        key: keyId,
        order_id: orderId,
        amount: Number(amount) * 100, // Convert to paise
        currency,
        name: "BSPREP",
        description: "Support BSPREP - Help us keep learning accessible",
        image: "/logo.png",
        modal: {
          ondismiss() {
            setIsLoading(false)
            onPaymentError("Payment cancelled")
          },
        },
        handler(response: { razorpay_payment_id: string; razorpay_order_id: string }) {
          setIsLoading(false)
          onPaymentSuccess(response.razorpay_order_id, response.razorpay_payment_id)
          setAmount("") // Reset form
        },
        prefill: {
          name: "Supporter",
          email: "supporter@example.com",
        },
        notes: {
          order_id: orderId,
        },
      })

      razorpay.open()
    } catch (error) {
      setIsLoading(false)
      const message = error instanceof Error ? error.message : "Payment initiation failed"
      onPaymentError(message)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-black/20 bg-[#FAF8F5] p-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-black">Donation Amount (₹)</label>
        <input
          type="number"
          min="1"
          max="1000000"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isLoading}
          className="h-11 w-full rounded-md border border-black/30 bg-white px-3 text-sm outline-none focus:border-black disabled:opacity-50"
          placeholder="Enter amount in INR"
        />
        <p className="mt-2 text-xs text-slate-600">Minimum ₹10, Maximum ₹10,00,000</p>
      </div>

      <button
        onClick={handleDonate}
        disabled={isLoading || !amount}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-black bg-black px-4 text-sm font-semibold text-white transition hover:bg-[#111] disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Donate Now"
        )}
      </button>
    </div>
  )
}
