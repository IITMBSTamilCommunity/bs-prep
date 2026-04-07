"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"

type PostPaymentModalProps = {
  paymentId: string
  orderId: string
  defaultName?: string
  defaultEmail?: string
  onClose: () => void
  onSuccess: () => void
  onError: (error: string) => void
}

/**
 * Post-payment modal component
 * Collects donor name, email, and optional message/image after successful payment
 */
export function PostPaymentModal({ paymentId, orderId, defaultName = "", defaultEmail = "", onClose, onSuccess, onError }: PostPaymentModalProps) {
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [message, setMessage] = useState("")
  const [showPublic, setShowPublic] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      onError("Please upload a PNG, JPG, or WEBP image")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      onError("Image must be less than 5MB")
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let imageUrl: string | null = null

      // Upload image if provided
      if (imageFile) {
        const formData = new FormData()
        formData.append("file", imageFile)

        const uploadRes = await fetch("/api/donations/upload", {
          method: "POST",
          body: formData,
        })

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json()
          throw new Error(uploadData.error || "Failed to upload image")
        }

        const uploadData = await uploadRes.json()
        imageUrl = uploadData.url
      }

      // Submit donor details
      const completeRes = await fetch("/api/donations/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayPaymentId: paymentId,
          razorpayOrderId: orderId,
          name,
          email,
          message: message || null,
          showPublic,
          contributorImageUrl: imageUrl,
        }),
      })

      if (!completeRes.ok) {
        const completeData = await completeRes.json()
        throw new Error(completeData.error || "Failed to save donation details")
      }

      onSuccess()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete donation"
      onError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xl rounded-2xl border border-black/20 bg-[#FAF8F5] p-6 shadow-[0_30px_80px_rgba(20,20,20,0.25)] sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center rounded-full border border-black/20 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black">
              Payment Success
            </p>
            <h2 className="mt-3 text-2xl font-bold">Complete Your Donation</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-black/20 bg-white p-2 text-slate-600 transition hover:border-black/40 hover:text-black"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          Payment received! Please share your details so we can acknowledge your support.
        </p>

        {(defaultName || defaultEmail) ? (
          <p className="mt-3 rounded-lg border border-black/20 bg-white px-3 py-2 text-xs text-slate-700">
            Basic details were prefilled from your student account. You can edit them if needed.
          </p>
        ) : null}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <div className="rounded-lg border border-black/15 bg-white p-3">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
              className="h-11 w-full rounded-md border border-black/30 bg-white px-3 text-sm outline-none focus:border-black disabled:opacity-50"
              placeholder="Your name"
            />
            </div>

            {/* Email */}
            <div className="rounded-lg border border-black/15 bg-white p-3">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              className="h-11 w-full rounded-md border border-black/30 bg-white px-3 text-sm outline-none focus:border-black disabled:opacity-50"
              placeholder="your@email.com"
            />
            </div>
          </div>

          {/* Message */}
          <div className="rounded-lg border border-black/15 bg-white p-3">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Message <span className="text-xs text-slate-500">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 300))}
              disabled={isSubmitting}
              maxLength={300}
              className="h-28 w-full rounded-md border border-black/30 bg-white px-3 py-2 text-sm outline-none focus:border-black disabled:opacity-50"
              placeholder="Share why you support BSPREP... (max 300 chars)"
            />
            <p className="mt-1 text-right text-xs text-slate-500">{message.length}/300</p>
          </div>

          {/* Image Upload */}
          <div className="rounded-lg border border-black/15 bg-white p-3">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Photo <span className="text-xs text-slate-500">(optional, max 5MB)</span>
            </label>
            <div className="flex flex-col gap-3 rounded-md border border-dashed border-black/25 bg-[#FAF8F5] p-3 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/20 bg-white">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="px-2 text-center text-[11px] font-medium leading-4 text-slate-500">
                    Preview will appear here
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageChange}
                  disabled={isSubmitting}
                  className="block h-11 w-full max-w-full rounded-md border border-black/30 bg-white px-3 text-sm file:cursor-pointer file:rounded file:border file:border-black/20 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold disabled:opacity-50"
                />
                <p className="text-xs text-slate-500">Choose a photo or logo for the supporter wall.</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Accepted: PNG, JPG, WEBP</p>
          </div>

          {/* Show Public Toggle */}
          <label className="flex items-center gap-2 rounded-md border border-black/20 bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={showPublic}
              onChange={(e) => setShowPublic(e.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-[#D9D4CA]"
            />
            <span className="text-sm text-slate-700">
              Display my name on the supporter wall <span className="text-xs text-slate-500">(you can change this later)</span>
            </span>
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !name || !email}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-black bg-black px-4 font-semibold text-white transition hover:bg-[#111] disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Complete Donation"
            )}
          </button>

          <p className="text-center text-xs text-slate-500">
            By clicking "Complete", you agree to our privacy policy and confirm your details.
          </p>
        </form>
      </div>
    </div>
  )
}
