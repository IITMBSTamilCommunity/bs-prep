import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasAdminRole } from '@/lib/security/admin-role'
import { getGoogleAccessToken } from '@/lib/google-auth'

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  SECURITY  — same guarantees as /api/admin/analytics/route.ts
 *  • Admin session required; service account key stays server-only
 *  • No data persisted; 60 s in-memory cache to respect rate limits
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface CacheEntry {
  data: unknown
  expiry: number
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

function fromCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expiry > Date.now()) return entry.data as T
  cache.delete(key)
  return null
}
function toCache(key: string, data: unknown) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS })
}

function isRelevantQuery(query?: string) {
  const normalized = (query ?? '').trim().toLowerCase()
  return normalized.length > 1 && normalized !== '(not set)'
}

function isRelevantPage(page?: string) {
  const value = (page ?? '').trim()
  if (!value) return false
  if (value.startsWith('/admin') || value.startsWith('/auth') || value.startsWith('/api')) return false
  return true
}


// ─── Admin auth guard ─────────────────────────────────────────────────────────
async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { user: null, error: 'Unauthorized' }
  const isAdmin = await hasAdminRole(user.id, user.email)
  if (!isAdmin) return { user: null, error: 'Forbidden' }
  return { user, error: null }
}

// ─── Search Console API helper ────────────────────────────────────────────────
async function querySearchConsole(token: string, siteUrl: string, body: object) {
  const encoded = encodeURIComponent(siteUrl)
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Search Console error (${res.status}): ${err}`)
  }
  return res.json()
}

// ─── GET /api/admin/search-console ───────────────────────────────────────────
export async function GET() {
  const { error } = await verifyAdmin()
  if (error) {
    return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  }

  const CACHE_KEY = 'gsc_data'
  const cached = fromCache(CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL
  if (!siteUrl) {
    return NextResponse.json({ error: 'SEARCH_CONSOLE_SITE_URL is not configured' }, { status: 500 })
  }

  try {
    const token = await getGoogleAccessToken([
      'https://www.googleapis.com/auth/webmasters.readonly',
    ])

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 90)

    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const [overviewRaw, queriesRaw, pagesRaw, trendRaw] = await Promise.all([
      // 1. Aggregate overview (no dimension)
      querySearchConsole(token, siteUrl, {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        type: 'web',
      }),
      // 2. Top queries
      querySearchConsole(token, siteUrl, {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query'],
        rowLimit: 10,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
        type: 'web',
      }),
      // 3. Top pages
      querySearchConsole(token, siteUrl, {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['page'],
        rowLimit: 10,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
        type: 'web',
      }),
      // 4. Daily trend (last 30 days)
      querySearchConsole(token, siteUrl, {
        startDate: fmt(new Date(Date.now() - 30 * 86400_000)),
        endDate: fmt(endDate),
        dimensions: ['date'],
        type: 'web',
      }),
    ])

    // Overview
    const overview = {
      clicks: overviewRaw.rows?.[0]?.clicks ?? 0,
      impressions: overviewRaw.rows?.[0]?.impressions ?? 0,
      ctr: Number(((overviewRaw.rows?.[0]?.ctr ?? 0) * 100).toFixed(2)),
      avgPosition: Number((overviewRaw.rows?.[0]?.position ?? 0).toFixed(1)),
    }

    // Aggregate all overview rows if more than one (happens when no dimension)
    if (overviewRaw.rows && overviewRaw.rows.length > 1) {
      let clicks = 0, impressions = 0, ctr = 0, pos = 0
      for (const row of overviewRaw.rows) {
        clicks += row.clicks ?? 0
        impressions += row.impressions ?? 0
        ctr += (row.ctr ?? 0) * (row.clicks ?? 0)
        pos += (row.position ?? 0)
      }
      overview.clicks = clicks
      overview.impressions = impressions
      overview.ctr = clicks > 0 ? Number(((ctr / clicks) * 100).toFixed(2)) : 0
      overview.avgPosition = Number((pos / overviewRaw.rows.length).toFixed(1))
    }

    const topQueries = (queriesRaw.rows ?? [])
      .map((r: { keys: string[], clicks: number, impressions: number, ctr: number, position: number }) => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Number((r.ctr * 100).toFixed(2)),
        position: Number(r.position.toFixed(1)),
      }))
      .filter((row) => isRelevantQuery(row.query) && row.impressions > 0)

    const topPages = (pagesRaw.rows ?? [])
      .map((r: { keys: string[], clicks: number, impressions: number, ctr: number, position: number }) => ({
        page: r.keys[0].replace(/^https?:\/\/[^/]+/, ''),
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Number((r.ctr * 100).toFixed(2)),
        position: Number(r.position.toFixed(1)),
      }))
      .filter((row) => isRelevantPage(row.page) && row.impressions > 0)

    const trend = (trendRaw.rows ?? []).map((r: { keys: string[], clicks: number, impressions: number }) => ({
      date: r.keys[0].slice(5), // MM-DD
      clicks: r.clicks,
      impressions: r.impressions,
    }))

    const result = { overview, topQueries, topPages, trend }
    toCache(CACHE_KEY, result)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[search-console/route] Error:', err)
    return NextResponse.json(
      { error: 'Unable to load Search Console data right now. Please try again shortly.' },
      { status: 500 },
    )
  }
}
