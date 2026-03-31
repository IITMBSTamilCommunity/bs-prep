import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasAdminRole } from '@/lib/security/admin-role'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { user: null, supabase, error: 'Unauthorized' }

  const isAdmin = await hasAdminRole(user.id, user.email)
  if (!isAdmin) return { user: null, supabase, error: 'Forbidden' }

  return { user, supabase, error: null }
}

// GET /api/admin/users — list all users
export async function GET() {
  const { error } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  const service = createServiceRoleClient()

  const { data: profileRows, error: profileError } = await service
    .from('profiles')
    .select('id, first_name, last_name, email, role, created_at, avatar_url, phone')

  if (profileError) {
    return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 })
  }

  const profilesById = new Map(
    (profileRows ?? []).map((row) => [row.id, row]),
  )

  const allUsers: Array<{
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    role: string
    avatar_url: string | null
    phone: string | null
    created_at: string
  }> = []

  let page = 1
  const perPage = 200

  while (true) {
    const { data: adminData, error: adminError } = await service.auth.admin.listUsers({
      page,
      perPage,
    })

    if (adminError) {
      return NextResponse.json({ error: 'Failed to fetch auth users' }, { status: 500 })
    }

    const batch = adminData?.users ?? []
    if (batch.length === 0) {
      break
    }

    for (const authUser of batch) {
      const profile = profilesById.get(authUser.id)
      const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>

      const metadataFullName =
        (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
        (typeof metadata.name === 'string' && metadata.name.trim()) ||
        null

      const [derivedFirst, ...derivedLastParts] = metadataFullName ? metadataFullName.split(' ') : []
      const derivedLast = derivedLastParts.join(' ').trim()

      const firstName = profile?.first_name ?? (derivedFirst || null)
      const lastName = profile?.last_name ?? (derivedLast || null)
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || metadataFullName || null

      const metadataAvatar =
        (typeof metadata.avatar_url === 'string' && metadata.avatar_url) ||
        (typeof metadata.picture === 'string' && metadata.picture) ||
        null

      allUsers.push({
        id: authUser.id,
        email: profile?.email || authUser.email || 'unknown',
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        role: profile?.role || 'user',
        avatar_url: profile?.avatar_url || metadataAvatar,
        phone: profile?.phone || null,
        created_at: profile?.created_at || authUser.created_at,
      })
    }

    if (batch.length < perPage) {
      break
    }

    page += 1
  }

  allUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ users: allUsers })
}
