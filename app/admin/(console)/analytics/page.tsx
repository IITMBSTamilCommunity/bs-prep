'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Users,
  Activity,
  Eye,
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  Clock,
  Globe,
  Monitor,
  Search,
  AlertCircle,
  BarChart2,
  CircleHelp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsOverview {
  totalUsers: number
  sessions: number
  activeUsers: number
  eventCount: number
  bounceRate: number
  avgSessionDuration: number
  newUsers: number
  pageViews: number
}

interface ByDim {
  name: string
  sessions: number
  users?: number
}

interface TrendPoint {
  date: string
  sessions: number
  users: number
  pageViews?: number
}

interface AnalyticsData {
  overview: AnalyticsOverview
  bySource: ByDim[]
  byCountry: ByDim[]
  byDevice: ByDim[]
  trend: TrendPoint[]
}

interface GscOverview {
  clicks: number
  impressions: number
  ctr: number
  avgPosition: number
}

interface GscRow {
  query?: string
  page?: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface GscTrend {
  date: string
  clicks: number
  impressions: number
}

interface GscData {
  overview: GscOverview
  topQueries: GscRow[]
  topPages: GscRow[]
  trend: GscTrend[]
}

// ─── Colours matching admin dark theme ────────────────────────────────────────
const COLORS = {
  blue: '#60a5fa',
  green: '#4ade80',
  purple: '#a78bfa',
  orange: '#fb923c',
  pink: '#f472b6',
  cyan: '#22d3ee',
  yellow: '#fbbf24',
  slate: '#94a3b8',
}
const PIE_COLORS = [COLORS.blue, COLORS.green, COLORS.purple]

// ─── Utility helpers ──────────────────────────────────────────────────────────
function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}m ${s}s`
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#070c15] p-5 animate-pulse">
      <div className="h-3 w-20 rounded bg-white/10 mb-3" />
      <div className="h-8 w-28 rounded bg-white/10 mb-2" />
      <div className="h-3 w-16 rounded bg-white/10" />
    </div>
  )
}

function SkeletonChart() {
  const bars = [42, 55, 68, 74, 36, 61, 48, 57, 71, 84, 66, 39]

  return (
    <div className="rounded-2xl border border-white/10 bg-[#070c15] p-5 animate-pulse h-72">
      <div className="h-4 w-40 rounded bg-white/10 mb-4" />
      <div className="flex items-end gap-2 h-44 mt-8 px-2">
        {bars.map((height, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-white/10"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  description?: string
  icon: React.ReactNode
  accent?: string
  trend?: 'up' | 'down' | null
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <CircleHelp className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-slate-300" />
      <span className="pointer-events-none absolute -top-2 left-1/2 z-20 hidden w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-slate-300 shadow-xl group-hover:block">
        {text}
      </span>
    </span>
  )
}

function KpiCard({ label, value, sub, description, icon, accent = COLORS.blue, trend }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#070c15] p-5 transition hover:border-white/20 hover:bg-[#0b1220] group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
          {description ? <HelpTip text={description} /> : null}
        </div>
        <span
          className="rounded-lg p-2 transition group-hover:scale-110"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold text-slate-100">{value}</p>
      {sub && (
        <div className="mt-1 flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-rose-400" />}
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
      )}
    </div>
  )
}

interface ErrorBannerProps {
  message: string
  onRetry: () => void
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-rose-400 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-rose-300">Failed to load data</p>
        <p className="mt-1 text-xs text-rose-400/80">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
      >
        Retry
      </button>
    </div>
  )
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#0b1220',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.75rem',
    color: '#cbd5e1',
    fontSize: 12,
  },
  itemStyle: { color: '#94a3b8' },
  labelStyle: { color: '#e2e8f0', marginBottom: 4 },
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition ${
        active
          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Data table ───────────────────────────────────────────────────────────────
interface ColDef {
  key: string
  label: string
  helpText?: string
  align?: 'left' | 'right'
  render?: (row: Record<string, unknown>) => React.ReactNode
}

function DataTable({ cols, rows }: { cols: ColDef[]; rows: Record<string, unknown>[] }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500 py-4 text-center">No data available</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            {cols.map((c) => (
              <th
                key={c.key}
                className={`pb-3 text-xs uppercase tracking-widest text-slate-500 font-medium ${
                  c.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                <span className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'justify-end' : ''}`}>
                  {c.label}
                  {c.helpText ? <HelpTip text={c.helpText} /> : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-white/5 hover:bg-white/3 transition"
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`py-3 text-slate-300 ${
                    c.align === 'right' ? 'text-right tabular-nums' : ''
                  }`}
                >
                  {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title,
  description,
  children,
  className = '',
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#070c15] p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          {title}
        </h3>
        {description ? <HelpTip text={description} /> : null}
      </div>
      {children}
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab] = useState<'analytics' | 'search'>('analytics')
  const [gaData, setGaData] = useState<AnalyticsData | null>(null)
  const [gscData, setGscData] = useState<GscData | null>(null)
  const [gaError, setGaError] = useState<string | null>(null)
  const [gscError, setGscError] = useState<string | null>(null)
  const [gaLoading, setGaLoading] = useState(true)
  const [gscLoading, setGscLoading] = useState(true)

  const fetchGA = useCallback(async () => {
    setGaLoading(true)
    setGaError(null)
    try {
      const res = await fetch('/api/admin/analytics')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setGaData(await res.json())
    } catch (e) {
      setGaError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setGaLoading(false)
    }
  }, [])

  const fetchGSC = useCallback(async () => {
    setGscLoading(true)
    setGscError(null)
    try {
      const res = await fetch('/api/admin/search-console')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setGscData(await res.json())
    } catch (e) {
      setGscError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setGscLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGA()
    fetchGSC()
  }, [fetchGA, fetchGSC])

  const filteredGaData = useMemo(() => {
    if (!gaData) return null
    const validLabel = (value: string) => {
      const normalized = value.trim().toLowerCase()
      return normalized.length > 0 && normalized !== '(not set)' && normalized !== '(other)'
    }

    return {
      ...gaData,
      bySource: gaData.bySource.filter((item) => validLabel(item.name) && item.sessions > 0),
      byCountry: gaData.byCountry.filter((item) => validLabel(item.name) && item.sessions > 0),
      byDevice: gaData.byDevice.filter((item) => validLabel(item.name) && item.sessions > 0),
    }
  }, [gaData])

  const filteredGscData = useMemo(() => {
    if (!gscData) return null
    const hiddenPathPrefixes = ['/admin', '/auth', '/api']
    const isRelevantPage = (page: string) => {
      if (!page) return false
      return !hiddenPathPrefixes.some((prefix) => page.startsWith(prefix))
    }

    return {
      ...gscData,
      topQueries: gscData.topQueries.filter((row) => (row.query || '').trim().length > 1 && row.impressions > 0),
      topPages: gscData.topPages.filter((row) => isRelevantPage(row.page || '') && row.impressions > 0),
    }
  }, [gscData])

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header>
        <div>
          <h1 className="text-4xl font-semibold uppercase italic tracking-tight text-white">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Live data from Google Analytics 4 and Search Console. Use the top-right refresh in admin header.
          </p>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        <TabBtn
          active={tab === 'analytics'}
          onClick={() => setTab('analytics')}
          icon={<BarChart2 className="h-4 w-4" />}
          label="Google Analytics"
        />
        <TabBtn
          active={tab === 'search'}
          onClick={() => setTab('search')}
          icon={<Search className="h-4 w-4" />}
          label="Search Console"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ANALYTICS TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'analytics' && (
        <div className="space-y-5">
          {gaError && <ErrorBanner message={gaError} onRetry={fetchGA} />}

          {/* KPI cards */}
          {gaLoading ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredGaData ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <KpiCard
                label="Total Users"
                value={fmtNum(filteredGaData.overview.totalUsers)}
                sub="Unique visitors"
                description="Distinct people who visited the site at least once during the selected date range."
                icon={<Users className="h-4 w-4" />}
                accent={COLORS.blue}
              />
              <KpiCard
                label="Sessions"
                value={fmtNum(filteredGaData.overview.sessions)}
                sub="Total sessions"
                description="Total visits. One user can create multiple sessions if they return later."
                icon={<Activity className="h-4 w-4" />}
                accent={COLORS.green}
              />
              <KpiCard
                label="Active Users"
                value={fmtNum(filteredGaData.overview.activeUsers)}
                sub="In last 30 days"
                description="Users with at least one engaged session in the selected period."
                icon={<TrendingUp className="h-4 w-4" />}
                accent={COLORS.purple}
              />
              <KpiCard
                label="New Users"
                value={fmtNum(filteredGaData.overview.newUsers)}
                sub="First visit"
                description="First-time visitors who had their first recorded interaction in this period."
                icon={<Users className="h-4 w-4" />}
                accent={COLORS.cyan}
              />
              <KpiCard
                label="Page Views"
                value={fmtNum(filteredGaData.overview.pageViews)}
                sub="Screen views"
                description="Total page or screen views, including repeat views from the same user."
                icon={<Eye className="h-4 w-4" />}
                accent={COLORS.orange}
              />
              <KpiCard
                label="Events"
                value={fmtNum(filteredGaData.overview.eventCount)}
                sub="All events"
                description="All tracked actions such as page views, clicks, and custom events."
                icon={<MousePointerClick className="h-4 w-4" />}
                accent={COLORS.yellow}
              />
              <KpiCard
                label="Bounce Rate"
                value={`${filteredGaData.overview.bounceRate}%`}
                sub="Single-page sessions"
                description="Percentage of sessions that were not engaged. Lower values are generally better."
                icon={<TrendingDown className="h-4 w-4" />}
                accent={COLORS.pink}
                trend={filteredGaData.overview.bounceRate < 50 ? 'up' : 'down'}
              />
              <KpiCard
                label="Avg. Session"
                value={fmtDuration(filteredGaData.overview.avgSessionDuration)}
                sub="Time on site"
                description="Average duration of a session from start to end."
                icon={<Clock className="h-4 w-4" />}
                accent={COLORS.slate}
              />
            </div>
          ) : null}

          {/* Trend chart */}
          {gaLoading ? (
            <SkeletonChart />
          ) : filteredGaData?.trend.length ? (
            <Section
              title="Sessions & Users — Last 30 Days"
              description="Daily movement of visits and unique users to quickly spot growth or drop patterns."
            >
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={filteredGaData.trend} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: COLORS.slate, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.floor(filteredGaData.trend.length / 7)}
                  />
                  <YAxis
                    tick={{ fill: COLORS.slate, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={fmtNum}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    name="Sessions"
                    stroke={COLORS.blue}
                    strokeWidth={2}
                    fill="url(#gradSessions)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    name="Users"
                    stroke={COLORS.green}
                    strokeWidth={2}
                    fill="url(#gradUsers)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          ) : null}

          {/* Source + Device row */}
          {!gaLoading && filteredGaData && (
            <div className="grid gap-5 md:grid-cols-2">
              {/* Traffic source */}
              <Section
                title="Traffic by Source"
                description="Sessions grouped by acquisition channel to show where your traffic is coming from."
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={filteredGaData.bySource}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: COLORS.slate, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={fmtNum}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: COLORS.slate, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="sessions" name="Sessions" fill={COLORS.blue} radius={[0, 4, 4, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </Section>

              {/* Device breakdown */}
              <Section
                title="Device Breakdown"
                description="Share of sessions by desktop, mobile, and tablet devices."
              >
                <div className="flex items-center justify-between h-55">
                  <ResponsiveContainer width="60%" height="100%">
                    <PieChart>
                      <Pie
                        data={filteredGaData.byDevice}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        dataKey="sessions"
                        paddingAngle={4}
                      >
                        {filteredGaData.byDevice.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} formatter={(v) => [fmtNum(Number(v)), 'Sessions']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-3 pr-2">
                    {filteredGaData.byDevice.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <div>
                          <p className="text-xs font-medium text-slate-300 capitalize">{d.name}</p>
                          <p className="text-xs text-slate-500">{fmtNum(d.sessions)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* Top countries */}
          {!gaLoading && filteredGaData && (
            <Section
              title="Top Countries"
              description="Countries ranked by session volume for the selected period."
            >
              <DataTable
                cols={[
                  {
                    key: 'name',
                    label: 'Country',
                    helpText: 'Visitor country identified from analytics session location data.',
                    render: (r) => (
                      <span className="flex items-center gap-2">
                        <Globe className="h-3 w-3 text-slate-600" />
                        {String(r.name)}
                      </span>
                    ),
                  },
                  {
                    key: 'sessions',
                    label: 'Sessions',
                    helpText: 'Total visits from that country, including repeat visits by the same user.',
                    align: 'right',
                    render: (r) => fmtNum(Number(r.sessions)),
                  },
                  {
                    key: 'users',
                    label: 'Users',
                    helpText: 'Distinct users from that country in the selected date range.',
                    align: 'right',
                    render: (r) => fmtNum(Number(r.users ?? 0)),
                  },
                ]}
                rows={filteredGaData.byCountry as unknown as Record<string, unknown>[]}
              />
            </Section>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SEARCH CONSOLE TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'search' && (
        <div className="space-y-5">
          {gscError && <ErrorBanner message={gscError} onRetry={fetchGSC} />}

          {/* KPI cards */}
          {gscLoading ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredGscData ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <KpiCard
                label="Total Clicks"
                value={fmtNum(filteredGscData.overview.clicks)}
                sub="Last 90 days"
                description="Number of times users clicked your result from Google Search."
                icon={<MousePointerClick className="h-4 w-4" />}
                accent={COLORS.blue}
              />
              <KpiCard
                label="Impressions"
                value={fmtNum(filteredGscData.overview.impressions)}
                sub="Search appearances"
                description="How often any page from your site appeared in Google Search results."
                icon={<Eye className="h-4 w-4" />}
                accent={COLORS.green}
              />
              <KpiCard
                label="Avg. CTR"
                value={`${filteredGscData.overview.ctr}%`}
                sub="Click-through rate"
                description="Click-through rate = clicks divided by impressions, shown as a percentage."
                icon={<TrendingUp className="h-4 w-4" />}
                accent={COLORS.purple}
                trend={filteredGscData.overview.ctr > 3 ? 'up' : 'down'}
              />
              <KpiCard
                label="Avg. Position"
                value={String(filteredGscData.overview.avgPosition)}
                sub="Search ranking"
                description="Average ranking position in Google Search. Lower values are better."
                icon={<Monitor className="h-4 w-4" />}
                accent={COLORS.orange}
                trend={filteredGscData.overview.avgPosition <= 10 ? 'up' : 'down'}
              />
            </div>
          ) : null}

          {/* Trend chart */}
          {gscLoading ? (
            <SkeletonChart />
          ) : filteredGscData?.trend.length ? (
            <Section
              title="Clicks & Impressions — Last 30 Days"
              description="Daily organic search performance trend from Google Search Console."
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={filteredGscData.trend} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: COLORS.slate, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.floor(filteredGscData.trend.length / 7)}
                  />
                  <YAxis
                    tick={{ fill: COLORS.slate, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={fmtNum}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    name="Clicks"
                    stroke={COLORS.blue}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: COLORS.blue }}
                  />
                  <Line
                    type="monotone"
                    dataKey="impressions"
                    name="Impressions"
                    stroke={COLORS.purple}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: COLORS.purple }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          ) : null}

          {/* Top queries + pages */}
          {!gscLoading && filteredGscData && (
            <div className="grid gap-5 md:grid-cols-2">
              <Section
                title="Top Queries"
                description="Search terms that are driving the most visibility and clicks."
              >
                <DataTable
                  cols={[
                    { key: 'query', label: 'Query', helpText: 'Exact term users typed in Google Search.' },
                    {
                      key: 'clicks',
                      label: 'Clicks',
                      helpText: 'Times users clicked your result for this query.',
                      align: 'right',
                      render: (r) => fmtNum(Number(r.clicks)),
                    },
                    {
                      key: 'ctr',
                      label: 'CTR',
                      helpText: 'Click-through rate for this query: clicks divided by impressions.',
                      align: 'right',
                      render: (r) => (
                        <span className="text-purple-400">{Number(r.ctr).toFixed(1)}%</span>
                      ),
                    },
                    {
                      key: 'position',
                      label: 'Pos.',
                      helpText: 'Average search ranking position. Lower is better.',
                      align: 'right',
                      render: (r) => (
                        <span
                          className={
                            Number(r.position) <= 10
                              ? 'text-emerald-400'
                              : Number(r.position) <= 30
                              ? 'text-yellow-400'
                              : 'text-slate-500'
                          }
                        >
                          {Number(r.position).toFixed(1)}
                        </span>
                      ),
                    },
                  ]}
                  rows={filteredGscData.topQueries as unknown as Record<string, unknown>[]}
                />
              </Section>

              <Section
                title="Top Pages"
                description="Public pages with the strongest organic search performance."
              >
                <DataTable
                  cols={[
                    {
                      key: 'page',
                      label: 'Page',
                      helpText: 'Page path shown in Google Search results.',
                      render: (r) => (
                        <span
                          className="block max-w-50 truncate text-blue-400"
                          title={String(r.page)}
                        >
                          {String(r.page)}
                        </span>
                      ),
                    },
                    {
                      key: 'clicks',
                      label: 'Clicks',
                      helpText: 'Times users clicked this page from Google Search.',
                      align: 'right',
                      render: (r) => fmtNum(Number(r.clicks)),
                    },
                    {
                      key: 'position',
                      label: 'Pos.',
                      helpText: 'Average Google ranking for this page. Lower is better.',
                      align: 'right',
                      render: (r) => (
                        <span
                          className={
                            Number(r.position) <= 10
                              ? 'text-emerald-400'
                              : Number(r.position) <= 30
                              ? 'text-yellow-400'
                              : 'text-slate-500'
                          }
                        >
                          {Number(r.position).toFixed(1)}
                        </span>
                      ),
                    },
                  ]}
                  rows={filteredGscData.topPages as unknown as Record<string, unknown>[]}
                />
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
