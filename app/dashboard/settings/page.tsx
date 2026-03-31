"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { User, Lock, CheckCircle, Trash2, AlertTriangle } from "lucide-react"

export default function SettingsPage() {
  const supabase = createClient()

  // Profile details
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [role, setRole] = useState("")
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)

  // Password change
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingProfile(false)
        return
      }
      setEmail(user.email ?? "")

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, role")
        .eq("id", user.id)
        .single()

      if (profile) {
        setFirstName(profile.first_name ?? "")
        setLastName(profile.last_name ?? "")
        setRole(profile.role ?? "student")
      }
      setLoadingProfile(false)
    }
    load()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(false)
    setIsSavingProfile(true)

    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setProfileError(data.error || "Failed to update profile")
      setIsSavingProfile(false)
      return
    }

    setProfileSuccess(true)
    setIsSavingProfile(false)
  }

  const handleDeleteAccount = async () => {
    setDeleteError(null)
    setIsDeletingAccount(true)
    const res = await fetch('/api/account/delete', { method: 'DELETE' })
    if (res.ok) {
      await supabase.auth.signOut()
      window.location.href = '/'
    } else {
      const data = await res.json()
      setDeleteError(data.error ?? 'Failed to delete account')
      setIsDeletingAccount(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setIsChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setIsChangingPassword(false)

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess(true)
      setNewPassword("")
      setConfirmPassword("")
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <h1 className="text-3xl font-bold text-black">Settings</h1>

      {/* Profile Details */}
      <Card className="p-6 bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-black">Profile Details</h2>
        </div>

        {loadingProfile ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="first-name" className="text-sm font-medium text-gray-500">First Name</Label>
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                  className="h-11 bg-white border-gray-300 focus:border-black text-black"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="last-name" className="text-sm font-medium text-gray-500">Last Name</Label>
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                  className="h-11 bg-white border-gray-300 focus:border-black text-black"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Email Address</Label>
              <div className="h-11 px-3 flex items-center bg-gray-50 border border-gray-200 rounded-lg text-black">
                {email}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Role</Label>
              <div className="h-11 px-3 flex items-center bg-gray-50 border border-gray-200 rounded-lg text-black capitalize">
                {role || "student"}
              </div>
            </div>

            {profileError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Profile updated successfully.
              </div>
            )}

            <Button
              type="submit"
              disabled={isSavingProfile}
              className="w-full h-11 bg-black hover:bg-black/80 text-white font-semibold"
            >
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        )}
      </Card>

      {/* Change Password */}
      <Card className="p-6 bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-black">Change Password</h2>
        </div>

        {passwordSuccess ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">Password updated successfully!</span>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-semibold text-black">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="h-11 bg-white border-gray-300 focus:border-black text-black"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-semibold text-black">
                Confirm New Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11 bg-white border-gray-300 focus:border-black text-black"
              />
            </div>

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {passwordError}
              </div>
            )}

            <Button
              type="submit"
              disabled={isChangingPassword}
              className="w-full h-11 bg-black hover:bg-black/80 text-white font-semibold"
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 bg-white border border-red-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-red-700">Delete Account</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Permanently deletes your account and all associated data — profile, enrollments, and everything else. This cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete my account
          </Button>
        ) : (
          <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm font-medium">Type <strong>DELETE</strong> to confirm</span>
            </div>
            <Input
              placeholder="Type DELETE here"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              className="h-11 bg-white border-red-300 focus:border-red-500 text-black"
            />
            {deleteError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-sm text-red-700">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-gray-300 text-gray-700"
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); setDeleteError(null) }}
                disabled={isDeletingAccount}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
                onClick={handleDeleteAccount}
                disabled={deleteInput !== "DELETE" || isDeletingAccount}
              >
                {isDeletingAccount ? "Deleting..." : "Permanently Delete"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
