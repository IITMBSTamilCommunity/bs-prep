import { updateSession } from "@/lib/supabase/proxy"
import type { NextRequest } from "next/server"
import { NextResponse } from 'next/server'
import { addSecurityHeaders, getRateLimitHeaders } from './lib/security/headers'

// Simple in-memory rate limiter for proxy
const rateLimit = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded ? forwarded.split(',')[0].trim() : (realIp || 'unknown')
  return ip
}

function checkRateLimit(key: string, maxRequests: number, windowMs: number): {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
} {
  const now = Date.now()
  const record = rateLimit.get(key)

  // Clean up old entries
  for (const [k, v] of rateLimit.entries()) {
    if (v.resetTime < now) {
      rateLimit.delete(k)
    }
  }

  if (!record || record.resetTime < now) {
    const resetTime = now + windowMs
    rateLimit.set(key, { count: 1, resetTime })
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: resetTime
    }
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      reset: record.resetTime
    }
  }

  record.count++
  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - record.count,
    reset: record.resetTime
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let currentRateCheck: {
    allowed: boolean
    limit: number
    remaining: number
    reset: number
  } | null = null

  // Apply rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/enroll')) {
      const response = await updateSession(request)
      return addSecurityHeaders(response, request)
    }

    const key = getRateLimitKey(request)
    
    // Different rate limits for different endpoints
    let maxRequests = 120
    let windowMs = 60 * 1000 // 1 minute
    
    if (
      pathname.includes('/auth/') ||
      pathname.startsWith('/api/account/') ||
      pathname.startsWith('/api/profile')
    ) {
      maxRequests = 60
      windowMs = 15 * 60 * 1000 // 15 minutes for auth/account flows
    } else if (pathname.startsWith('/api/payment/webhook')) {
      maxRequests = 300
      windowMs = 60 * 1000 // 1 minute for webhook callbacks
    } else if (pathname.startsWith('/api/payment/')) {
      maxRequests = 120
      windowMs = 60 * 1000 // 1 minute for checkout/verify requests
    } else if (pathname.startsWith('/api/enroll')) {
      maxRequests = 10
      windowMs = 60 * 1000 // 1 minute for enrollment
    } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      maxRequests = 30
      windowMs = 60 * 1000 // 1 minute for write operations
    }

    const rateCheck = checkRateLimit(key, maxRequests, windowMs)
    currentRateCheck = rateCheck
    
    if (!rateCheck.allowed) {
      const response = NextResponse.json(
        { 
          error: 'Too many requests',
          message: 'Please try again later'
        },
        { status: 429 }
      )
      
      const headers = getRateLimitHeaders(
        rateCheck.limit,
        rateCheck.remaining,
        rateCheck.reset
      )
      
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      
      return addSecurityHeaders(response, request)
    }
  }

  // Handle Supabase session and authentication
  const response = await updateSession(request)

  if (pathname.startsWith('/dashboard/admin')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/users'
    return NextResponse.redirect(url)
  }

  // Block unauthenticated access to admin routes.
  if (pathname.startsWith('/admin') && pathname !== '/admin/signin') {
    const { createServerClient } = await import('@supabase/ssr')
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/signin'
      return NextResponse.redirect(url)
    }
  }
  
  // Add security headers to the response
  const securedResponse = addSecurityHeaders(response, request)
  
  // Add rate limit headers for API routes
  if (pathname.startsWith('/api/') && currentRateCheck) {
    const headers = getRateLimitHeaders(
      currentRateCheck.limit,
      currentRateCheck.remaining,
      currentRateCheck.reset
    )
    
    Object.entries(headers).forEach(([key, value]) => {
      securedResponse.headers.set(key, value)
    })
  }
  
  return securedResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}

