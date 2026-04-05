import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasAdminRole } from '@/lib/security/admin-role'
import { getGoogleAccessToken } from '@/lib/google-auth'

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  SECURITY
 *  • Admin session is verified on every request (Supabase JWT + role check)
 *  • Service account key NEVER leaves the server — it is read from env at
 *    runtime and used only to obtain a short-lived Google OAuth2 token
 *  • No data is stored; all responses are ephemeral
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Simple in-memory cache (60 s TTL) ───────────────────────────────────────
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

function isRelevantDimension(name: string) {
  const normalized = name.trim().toLowerCase()
  return normalized.length > 0 && normalized !== '(not set)' && normalized !== '(other)'
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

// ─── GA4 helper ───────────────────────────────────────────────────────────────
async function runReport(
  propertyId: string,
  token: string,
  body: object,
) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
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
    throw new Error(`GA4 runReport error (${res.status}): ${err}`)
  }
  return res.json()
}

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
export async function GET() {
  const { error } = await verifyAdmin()
  if (error) {
    return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  }

  const CACHE_KEY = 'ga4_analytics'
  const cached = fromCache(CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) {
    return NextResponse.json({ error: 'GA4_PROPERTY_ID is not configured' }, { status: 500 })
  }

  try {
    const token = await getGoogleAccessToken([
      'https://www.googleapis.com/auth/analytics.readonly',
    ])

    const dateRange = { startDate: '30daysAgo', endDate: 'today' }

    const [overviewRaw, sourceRaw, countryRaw, deviceRaw, trendRaw] = await Promise.all([
      // 1. Overview KPIs
      runReport(propertyId, token, {
        dateRanges: [dateRange],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'eventCount' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
        ],
      }),
      // 2. By traffic source
      runReport(propertyId, token, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
      // 3. By country
      runReport(propertyId, token, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      // 4. By device
      runReport(propertyId, token, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
      // 5. Daily trend (sessions + users)
      runReport(propertyId, token, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
    ])

    // Parse KPIs
    const kpiRow = overviewRaw.rows?.[0]?.metricValues ?? []
    const overview = {
      totalUsers: Number(kpiRow[0]?.value ?? 0),
      sessions: Number(kpiRow[1]?.value ?? 0),
      activeUsers: Number(kpiRow[2]?.value ?? 0),
      eventCount: Number(kpiRow[3]?.value ?? 0),
      bounceRate: Number((Number(kpiRow[4]?.value ?? 0) * 100).toFixed(1)),
      avgSessionDuration: Number(Number(kpiRow[5]?.value ?? 0).toFixed(0)),
      newUsers: Number(kpiRow[6]?.value ?? 0),
      pageViews: Number(kpiRow[7]?.value ?? 0),
    }

    // Parse breakdowns
    const parseRows = (raw: { rows?: { dimensionValues: { value: string }[], metricValues: { value: string }[] }[] }, dimIdx: number, ...metricIdxs: number[]) =>
      (raw.rows ?? []).map((r) => ({
        name: r.dimensionValues[dimIdx].value,
        ...Object.fromEntries(
          metricIdxs.map((mi, i) => [`value${i}`, Number(r.metricValues[mi]?.value ?? 0)])
        ),
      }))

    const bySource = (sourceRaw.rows ?? [])
      .map((r: { dimensionValues: { value: string }[], metricValues: { value: string }[] }) => ({
        name: r.dimensionValues[0].value,
        sessions: Number(r.metricValues[0]?.value ?? 0),
        users: Number(r.metricValues[1]?.value ?? 0),
      }))
      .filter((row) => isRelevantDimension(row.name) && row.sessions > 0)

    const byCountry = (countryRaw.rows ?? [])
      .map((r: { dimensionValues: { value: string }[], metricValues: { value: string }[] }) => ({
        name: r.dimensionValues[0].value,
        sessions: Number(r.metricValues[0]?.value ?? 0),
        users: Number(r.metricValues[1]?.value ?? 0),
      }))
      .filter((row) => isRelevantDimension(row.name) && row.sessions > 0)

    const byDevice = (deviceRaw.rows ?? [])
      .map((r: { dimensionValues: { value: string }[], metricValues: { value: string }[] }) => ({
        name: r.dimensionValues[0].value,
        sessions: Number(r.metricValues[0]?.value ?? 0),
      }))
      .filter((row) => isRelevantDimension(row.name) && row.sessions > 0)

    const trend = (trendRaw.rows ?? []).map((r: { dimensionValues: { value: string }[], metricValues: { value: string }[] }) => {
      const d = r.dimensionValues[0].value // YYYYMMDD
      return {
        date: `${d.slice(4, 6)}/${d.slice(6, 8)}`,
        sessions: Number(r.metricValues[0]?.value ?? 0),
        users: Number(r.metricValues[1]?.value ?? 0),
        pageViews: Number(r.metricValues[2]?.value ?? 0),
      }
    })

    const result = { overview, bySource, byCountry, byDevice, trend }
    toCache(CACHE_KEY, result)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[analytics/route] Error:', err)
    return NextResponse.json(
      { error: 'Unable to load analytics data right now. Please try again shortly.' },
      { status: 500 },
    )
  }
}
