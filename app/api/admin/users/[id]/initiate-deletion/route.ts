import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { hasAdminRole } from '@/lib/security/admin-role'
import { writeRateLimiter } from '@/lib/rate-limit'

type Params = {
  params: Promise<{ id: string }>
}
// POST: Delete user directly (admin only)
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

    if (adminUser.id === userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account from this screen' },
        { status: 400 }
      )
    }

    const service = createServiceRoleClient()
    const { data: targetUserData, error: userError } = await service.auth.admin.getUserById(userId)
    const targetUser = targetUserData?.user

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const { data: targetProfile } = await service
      .from('profiles')
      .select('role, first_name, last_name')
      .eq('id', userId)
      .maybeSingle()

    if ((targetProfile?.role || '').toLowerCase() === 'admin') {
      const { count: adminCount, error: adminCountError } = await service
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')

      if (adminCountError) {
        console.error('Failed to count admins:', adminCountError)
        return NextResponse.json(
          { error: 'Failed to validate admin deletion' },
          { status: 500 }
        )
      }

      if ((adminCount ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin account' },
          { status: 400 }
        )
      }
    }

    // Delete user data in a safe order to avoid FK violations.
    await service.from('enrollments').delete().eq('user_id', userId)
    await service.from('quiz_attempts').delete().eq('student_id', userId)
    await service.from('mentor_requests').delete().or(`student_id.eq.${userId},mentor_id.eq.${userId}`)
    await service.from('leaderboard').delete().eq('student_id', userId)
    await service.from('login_attempts').delete().eq('user_id', userId)
    await service.from('announcements').delete().eq('created_by', userId)
    await service.from('user_announcements').delete().eq('user_id', userId)

    const { error: profileError } = await service.from('profiles').delete().eq('id', userId)
    if (profileError) {
      console.error('Failed to delete profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to delete user profile' },
        { status: 500 }
      )
    }

    const { error: deleteError } = await service.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete user account' },
        { status: 500 }
      )
    }

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
