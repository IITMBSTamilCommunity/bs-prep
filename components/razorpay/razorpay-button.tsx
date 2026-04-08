"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

type RazorpayButtonProps = {
  onPaymentSuccess: (orderId: string, paymentId: string) => void
  onPaymentError: (error: string) => void
}

const MIN_DONATION_INR = 10
const MAX_DONATION_INR = 500000
const MAX_DONATION_LABEL = "5,00,000"
const SUGGESTED_AMOUNTS = [199, 499, 999, 1999]

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
    const amountValue = Number(amount)
    if (!Number.isFinite(amountValue) || amountValue < MIN_DONATION_INR || amountValue > MAX_DONATION_INR) {
      onPaymentError(`Please enter an amount between ₹${MIN_DONATION_INR} and ₹${MAX_DONATION_LABEL}`)
      return
    }

    setIsLoading(true)

    try {
      // Step 1: Create Razorpay order
      const orderRes = await fetch("/api/donations/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountValue }),
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
        amount: amountValue * 100, // Convert to paise
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
    <div className="space-y-4 rounded-2xl border border-[#E6DAC6] bg-[#F8F4ED] p-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-900">Donation Amount (₹)</label>
        <input
          type="number"
          min={MIN_DONATION_INR}
          max={MAX_DONATION_INR}
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isLoading}
          className="h-11 w-full rounded-md border border-[#D8D0C3] bg-white px-3 text-sm outline-none focus:border-rose-400 disabled:opacity-50"
          placeholder="Enter amount in INR"
        />
        <p className="mt-2 text-xs text-rose-700">Minimum ₹{MIN_DONATION_INR}, Maximum ₹{MAX_DONATION_LABEL}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_AMOUNTS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAmount(String(value))}
            disabled={isLoading}
            className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-500"
          >
            ₹{value.toLocaleString("en-IN")}
          </button>
        ))}
      </div>

      <button
        onClick={handleDonate}
        disabled={
          isLoading ||
          !amount ||
          !Number.isFinite(Number(amount)) ||
          Number(amount) < MIN_DONATION_INR ||
          Number(amount) > MAX_DONATION_INR
        }
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
