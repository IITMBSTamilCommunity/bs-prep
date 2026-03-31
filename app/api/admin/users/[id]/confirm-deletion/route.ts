import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { hasAdminRole } from '@/lib/security/admin-role'
import { writeRateLimiter } from '@/lib/rate-limit'

type Params = {
  params: Promise<{ id: string }>
}

// POST: Confirm user deletion by verifying OTP
export async function POST(req: NextRequest, { params }: Params) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await writeRateLimiter.check(ip)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  try {
    const { id: userId } = await params
    const text = await req.text()

    if (!text || text.length > 1000) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    const body = JSON.parse(text)
    const { otp } = body

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
      return NextResponse.json(
        { error: 'Invalid OTP format' },
        { status: 400 }
      )
    }

    // Verify admin access
    const supabase = await createClient()
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const isAdmin = await hasAdminRole(adminUser.id, adminUser.email)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const service = createServiceRoleClient()

    // Get the OTP record
    const { data: otpRecord, error: otpFetchError } = await service
      .from('deletion_otp_codes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (otpFetchError || !otpRecord) {
      return NextResponse.json(
        { error: 'No deletion request found for this user' },
        { status: 404 }
      )
    }

    // Check if OTP has expired
    const expiresAt = new Date(otpRecord.expires_at)
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 410 }
      )
    }

    // Check attempts (max 3 attempts)
    if (otpRecord.attempts >= 3) {
      return NextResponse.json(
        { 
          message: 'Maximum OTP attempts exceeded. Please request a new one.',
          attempts_remaining: 0
        },
        { status: 429 }
      )
    }

    // Verify OTP
    if (otpRecord.otp_code !== otp.trim()) {
      // Increment attempts
      await service
        .from('deletion_otp_codes')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('user_id', userId)

      const attemptsLeft = 3 - (otpRecord.attempts + 1)
      return NextResponse.json(
        { 
          message: `Invalid OTP`,
          attempts_remaining: attemptsLeft
        },
        { status: 401 }
      )
    }

    // Mark OTP as verified
    await service
      .from('deletion_otp_codes')
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq('user_id', userId)

    // Get target user info
    const { data: targetUser, error: userError } = await service.auth.admin.getUserById(userId)

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if target user is an admin - final check
    const { data: targetProfile } = await service
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (targetProfile?.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot delete admin accounts.' },
        { status: 403 }
      )
    }

    // Delete user data in correct order (respecting FK constraints)
    // 1. Delete enrollments
    await service.from('enrollments').delete().eq('user_id', userId)

    // 2. Delete quiz attempts
    await service.from('quiz_attempts').delete().eq('student_id', userId)

    // 3. Delete mentor requests
    await service
      .from('mentor_requests')
      .delete()
      .or(`student_id.eq.${userId},mentor_id.eq.${userId}`)

    // 4. Delete leaderboard entry
    await service.from('leaderboard').delete().eq('student_id', userId)

    // 5. Delete login attempts
    await service.from('login_attempts').delete().eq('user_id', userId)

    // 6. Delete announcements created by user
    await service.from('announcements').delete().eq('created_by', userId)

    // 7. Delete profile
    const { error: profileError } = await service.from('profiles').delete().eq('id', userId)

    if (profileError) {
      console.error('Failed to delete profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to delete user profile' },
        { status: 500 }
      )
    }

    // 8. Delete auth user
    const { error: deleteError } = await service.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete user account' },
        { status: 500 }
      )
    }

    // 9. Clean up OTP record
    await service.from('deletion_otp_codes').delete().eq('user_id', userId)

    return NextResponse.json(
      {
        success: true,
        message: 'User account has been successfully deleted',
        deleted_user_email: targetUser.email,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
