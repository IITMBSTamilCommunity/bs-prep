import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  const nextPath = requestUrl.searchParams.get('next') || '/dashboard'
  const safeNextPath = nextPath.startsWith('/') ? nextPath : '/dashboard'

  if (code) {
    const supabase = await createClient()
    
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.message)}`)
      }

      // For Google OAuth users, seed profile avatar from Google metadata if profile avatar is still empty.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const provider = user.app_metadata?.provider || user.app_metadata?.providers?.[0]
        const googleAvatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null

        if (provider === 'google' && googleAvatarUrl) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single()

          if (!profile?.avatar_url) {
            const { error: avatarUpdateError } = await supabase
              .from('profiles')
              .update({ avatar_url: googleAvatarUrl })
              .eq('id', user.id)

            if (avatarUpdateError) {
              console.error('Google avatar sync error:', avatarUpdateError)
            }
          }
        }

      }
      
      // Successful authentication - redirect to requested local path.
      return NextResponse.redirect(`${origin}${safeNextPath}`)
    } catch (err) {
      console.error('Unexpected error during auth callback:', err)
      return NextResponse.redirect(`${origin}/?error=authentication_failed`)
    }
  }

  // No code provided - redirect to home
  return NextResponse.redirect(`${origin}/`)
}
