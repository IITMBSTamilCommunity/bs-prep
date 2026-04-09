import { NextRequest, NextResponse } from 'next/server'

export function getSecurityHeaders() {
  const headers = new Headers()
  
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
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://cdnjs.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://checkout.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://cdn.jsdelivr.net",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')
  
  headers.set('Content-Security-Policy', csp)
  
  // HSTS (HTTP Strict Transport Security)
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  
  return headers
}

export function addSecurityHeaders(response: NextResponse) {
  const securityHeaders = getSecurityHeaders()
  
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
