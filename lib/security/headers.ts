import { NextRequest, NextResponse } from 'next/server'

function isPrivateOrLocalHost(hostname: string): boolean {
  if (!hostname) return false
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
  if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return true

  const match = hostname.match(/^172\.(\d{1,3})\./)
  if (match) {
    const secondOctet = Number(match[1])
    return secondOctet >= 16 && secondOctet <= 31
  }

  return false
}

export function getSecurityHeaders(request?: NextRequest) {
  const headers = new Headers()

  const hostname = request?.nextUrl.hostname ?? ''
  const forwardedProto = request?.headers.get('x-forwarded-proto')
  const protocol = forwardedProto ? `${forwardedProto}:` : request?.nextUrl.protocol
  const isLocalHost = isPrivateOrLocalHost(hostname)
  const isProduction = process.env.NODE_ENV === 'production'
  const isSecureContext = protocol === 'https:'
  const enforceHttpsUpgrade = isProduction && isSecureContext && !isLocalHost
  
  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff')
  
  // XSS Protection
  headers.set('X-XSS-Protection', '1; mode=block')
  
  // Referrer Policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissions Policy
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://cdnjs.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net https://www.noupe.com https://noupe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://cdn.jsdelivr.net https://www.noupe.com https://noupe.com",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.noupe.com https://noupe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(enforceHttpsUpgrade ? ["upgrade-insecure-requests"] : [])
  ].join('; ')
  
  headers.set('Content-Security-Policy', csp)
  
  // HSTS (HTTP Strict Transport Security)
  if (enforceHttpsUpgrade) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  return headers
}

export function addSecurityHeaders(response: NextResponse, request?: NextRequest) {
  const securityHeaders = getSecurityHeaders(request)
  
  securityHeaders.forEach((value, key) => {
    response.headers.set(key, value)
  })
  
  return response
}

export function getRateLimitHeaders(limit: number, remaining: number, reset: number) {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(reset).toISOString()
  }
}
