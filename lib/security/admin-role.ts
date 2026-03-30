import { createServiceRoleClient } from '@/lib/supabase/server'

export async function hasAdminRole(userId: string, userEmail?: string | null): Promise<boolean> {
  const supabase = createServiceRoleClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (!error && profile?.role?.toLowerCase() === 'admin') {
    return true
  }

  if (!userEmail) {
    return false
  }

  const { data: emailProfile, error: emailError } = await supabase
    .from('profiles')
    .select('role')
    .ilike('email', userEmail)
    .maybeSingle()

  if (emailError || !emailProfile?.role) {
    return false
  }

  return emailProfile.role.toLowerCase() === 'admin'
}
