import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { hasAdminRole } from '@/lib/security/admin-role'
import { writeRateLimiter } from '@/lib/rate-limit'
import crypto from 'crypto'

type Params = {
  params: Promise<{ id: string }>
}

// Helper to generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Helper to send OTP email (placeholder - implement with your email service)
async function sendOTPEmail(email: string, otp: string, userName: string): Promise<{ success: boolean; message?: string }> {
  try {
    // TODO: Integrate with email service (SendGrid, Resend, AWS SES, etc.)
    // For development, log to console. In production, implement actual email sending.
    console.log(`\n========================================`)
    console.log(`OTP DELETION REQUEST for ${userName} (${email})`)
    console.log(`OTP Code: ${otp}`)
    console.log(`Valid for 15 minutes`)
    console.log(`========================================\n`)
    
    // In production, uncomment and use your email service:
    // const response = await fetch('https://api.sendgrid.com/v3/mail/send', { ... })
    
    // For now, return success (OTP visible in server logs)
    return { success: true, message: 'OTP generated (check server logs for OTP code)' }
  } catch (error) {
    console.error('Failed to send OTP email:', error)
    return { success: false, message: 'Failed to generate OTP' }
  }
}

// POST: Initiate user deletion by generating and sending OTP
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

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
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

    // Get the user to be deleted
    const service = createServiceRoleClient()
    const { data: targetUser, error: userError } = await service.auth.admin.getUserById(userId)

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if target user is an admin - admins cannot delete other admins
    const { data: targetProfile } = await service
      .from('profiles')
      .select('role, first_name, last_name')
      .eq('id', userId)
      .maybeSingle()

    if (targetProfile?.role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot delete admin accounts. Only general users can be deleted.' },
        { status: 403 }
      )
    }

    // Generate OTP
    const otp = generateOTP()

    // Store OTP in database with 15-minute expiration
    const { error: otpError } = await service
      .from('deletion_otp_codes')
      .upsert(
        {
          user_id: userId,
          email: targetUser.email || '',
          otp_code: otp,
          is_verified: false,
          attempts: 0,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          deleted_by_admin_id: adminUser.id,
        },
        {
          onConflict: 'user_id,email',
        }
      )

    if (otpError) {
      console.error('Failed to store OTP:', otpError)
      return NextResponse.json(
        { error: 'Failed to generate OTP' },
        { status: 500 }
      )
    }

    // Send OTP via email (or log in development)
    const userName = targetProfile?.first_name || targetUser.email?.split('@')[0] || 'User'
    const emailResult = await sendOTPEmail(targetUser.email || '', otp, userName)

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.message || 'Failed to generate OTP' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'OTP generated and ready for verification',
        email: targetUser.email,
        masked_email: targetUser.email ? `${targetUser.email.substring(0, 2)}***@${targetUser.email.split('@')[1]}` : 'user email',
        // For development/testing only - remove in production once email service is integrated
        otp_for_testing: process.env.NODE_ENV === 'development' ? otp : undefined,
        otp_message: emailResult.message,
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
