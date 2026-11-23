'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import styles from './DeveloperHub.module.css'

type View = 'overview' | 'docs' | 'keys'
type Limits = { requestsPerMinute: number; requestsPerDay: number } | null
type DailyUsage = { date: string; requests: number }
type Activity = { id: string; method: string; path: string; status_code: number; response_time_ms: number; created_at: string }
type Dashboard = {
  activeApps: number
  activeKeys: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  days: number
  dailyUsage: DailyUsage[]
  recentActivity: Activity[]
}
type DeveloperApp = { id: string; name: string; description: string | null; status: 'active' | 'disabled'; created_at: string; updated_at: string }
type ApiKey = { id: string; name: string; key_prefix: string; scopes: string[]; expires_at: string | null; last_used_at: string | null; revoked_at: string | null; created_at: string }
type AppWithKeys = DeveloperApp & { keys: ApiKey[] }
type OneTimeSecret = { title: string; secret: string; notice: string }

const TAB_ITEMS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'docs', label: 'API docs' },
  { id: 'keys', label: 'API keys' },
]

function Icon({ name, size = 20 }: { name: 'shield' | 'code' | 'key' | 'apps' | 'book' | 'plus' | 'chart' | 'copy' | 'external'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  if (name === 'shield') return <svg {...common}><path d="M12 3 19 6v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z"/><path d="m10 12 1.4 1.4L14.7 10"/></svg>
  if (name === 'code') return <svg {...common}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></svg>
  if (name === 'key') return <svg {...common}><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 2 2-2 2 2 2-3 3-2-2-2 2"/></svg>
  if (name === 'apps') return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
  if (name === 'book') return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 10h6"/></svg>
  if (name === 'plus') return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>
  if (name === 'chart') return <svg {...common}><path d="M4 20h16M6 17v-5h3v5M11 17V7h3v10M16 17v-8h3v8"/></svg>
  if (name === 'copy') return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>
  return <svg {...common}><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>
}

function errorText(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error
  return fallback
}

function utcDateLabel(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  return new Intl.DateTimeFormat(undefined, days > 7 ? { month: 'numeric', day: 'numeric', timeZone: 'UTC' } : { weekday: 'short', timeZone: 'UTC' }).format(date)
}

function localTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function UsageChart({ data, days }: { data: DailyUsage[]; days: number }) {
  const points = useMemo(() => {
    if (!data.length) return []
    const max = Math.max(1, ...data.map(item => item.requests))
    const plotWidth = 560
    const plotHeight = 180
    return data.map((item, index) => ({
      ...item,
      x: 36 + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth),
      y: 20 + plotHeight - (item.requests / max) * plotHeight,
    }))
  }, [data])
  const hasUsage = data.some(item => item.requests > 0)
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const labelEvery = days === 7 ? 1 : days === 30 ? 5 : 15

  return (
    <svg className={styles.chart} viewBox="0 0 620 250" role="img" aria-label={hasUsage ? `API requests by UTC day for the last ${days} days` : 'No API usage recorded yet'}>
      {[20, 65, 110, 155, 200].map(y => <line key={`h${y}`} className={y === 200 ? styles.chartAxis : styles.chartGrid} x1="36" y1={y} x2="596" y2={y} />)}
      {Array.from({ length: 6 }, (_, index) => {
        const x = 36 + index * 112
        return <line key={`v${index}`} className={styles.chartGrid} x1={x} y1="20" x2={x} y2="200" />
      })}
      <line className={styles.chartAxis} x1="36" y1="20" x2="36" y2="200" />
      {hasUsage ? (
        <>
          <path className={styles.chartLine} d={line} />
          {points.map(point => point.requests > 0 ? <circle key={point.date} className={styles.chartPoint} cx={point.x} cy={point.y} r="4" /> : null)}
          {points.map((point, index) => index % labelEvery === 0 || index === points.length - 1
            ? <text key={`label-${point.date}`} className={styles.chartLabel} x={point.x} y="222">{utcDateLabel(point.date, days)}</text>
            : null)}
        </>
      ) : (
        <g>
          <circle className={styles.chartIconCircle} cx="316" cy="102" r="29" />
          <g transform="translate(304 90)" color="#d4deeb"><Icon name="chart" size={24} /></g>
          <text className={styles.emptyChart} x="316" y="151">Usage appears after your first request.</text>
        </g>
      )}
      {hasUsage && <text className={styles.chartLabel} x="316" y="244">Daily requests · UTC</text>}
    </svg>
  )
}

export default function DeveloperHubClient() {
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: View = rawTab === 'docs' || rawTab === 'keys' ? rawTab : 'overview'
  const [days, setDays] = useState(7)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [limits, setLimits] = useState<Limits>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [apps, setApps] = useState<AppWithKeys[]>([])
  const [appsLoading, setAppsLoading] = useState(true)
  const [appsError, setAppsError] = useState('')
  const [appName, setAppName] = useState('')
  const [appDescription, setAppDescription] = useState('')
  const [appSubmitting, setAppSubmitting] = useState(false)
  const [appNotice, setAppNotice] = useState('')
  const [keyNameByApp, setKeyNameByApp] = useState<Record<string, string>>({})
  const [expiryByApp, setExpiryByApp] = useState<Record<string, string>>({})
  const [workingKey, setWorkingKey] = useState('')
  const [secret, setSecret] = useState<OneTimeSecret | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (tab !== 'overview') return
    let cancelled = false
    setDashboardLoading(true)
    setDashboardError('')
    fetch(`/api/developer/dashboard?days=${days}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(errorText(body, 'Could not load Developer Hub data.'))
        return body as { dashboard: Dashboard; limits: Limits }
      })
      .then(body => {
        if (cancelled) return
        setDashboard(body.dashboard)
        setLimits(body.limits)
      })
      .catch(error => {
        if (cancelled) return
        setDashboard(null)
        setDashboardError(error instanceof Error ? error.message : 'Could not load Developer Hub data.')
      })
      .finally(() => { if (!cancelled) setDashboardLoading(false) })
    return () => { cancelled = true }
  }, [tab, days])

  useEffect(() => {
    if (tab !== 'keys') return
    let cancelled = false
    setAppsLoading(true)
    setAppsError('')
    fetch('/api/developer/apps', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(errorText(body, 'Could not load developer apps.'))
        return body as { apps: DeveloperApp[]; limits: Limits }
      })
      .then(async body => {
        const expanded = await Promise.all(body.apps.map(async app => {
          const response = await fetch(`/api/developer/apps/${app.id}/keys`, { cache: 'no-store' })
          const keyBody = await response.json().catch(() => ({})) as { keys?: ApiKey[]; error?: string }
          if (!response.ok) throw new Error(keyBody.error || `Could not load keys for ${app.name}.`)
          return { ...app, keys: keyBody.keys ?? [] }
        }))
        if (cancelled) return
        setApps(expanded)
        setLimits(body.limits)
      })
      .catch(error => {
        if (cancelled) return
        setApps([])
        setAppsError(error instanceof Error ? error.message : 'Could not load developer apps.')
      })
      .finally(() => { if (!cancelled) setAppsLoading(false) })
    return () => { cancelled = true }
  }, [tab])

  async function refreshApps() {
    const response = await fetch('/api/developer/apps', { cache: 'no-store' })
    const body = await response.json().catch(() => ({})) as { apps?: DeveloperApp[]; limits?: Limits; error?: string }
    if (!response.ok) throw new Error(body.error || 'Could not refresh developer apps.')
    const expanded = await Promise.all((body.apps ?? []).map(async app => {
      const keyResponse = await fetch(`/api/developer/apps/${app.id}/keys`, { cache: 'no-store' })
      const keyBody = await keyResponse.json().catch(() => ({})) as { keys?: ApiKey[]; error?: string }
      if (!keyResponse.ok) throw new Error(keyBody.error || `Could not load keys for ${app.name}.`)
      return { ...app, keys: keyBody.keys ?? [] }
    }))
    setApps(expanded)
    setLimits(body.limits ?? null)
  }

  async function createApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppSubmitting(true)
    setAppNotice('')
    setAppsError('')
    try {
      const response = await fetch('/api/developer/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: appName, description: appDescription || undefined }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(errorText(body, 'Could not create the app.'))
      setAppName('')
      setAppDescription('')
      setAppNotice('Developer app created.')
      await refreshApps()
    } catch (error) {
      setAppsError(error instanceof Error ? error.message : 'Could not create the app.')
    } finally {
      setAppSubmitting(false)
    }
  }

  async function createKey(app: AppWithKeys) {
    const name = keyNameByApp[app.id] || 'Read-only key'
    const expiresText = expiryByApp[app.id] ?? '90'
    const expiresInDays = expiresText === 'never' ? null : Number(expiresText)
    setWorkingKey(app.id)
    setActionError('')
    try {
      const response = await fetch(`/api/developer/apps/${app.id}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scopes: ['listings:read'], expiresInDays }),
      })
      const body = await response.json().catch(() => ({})) as { secret?: string; notice?: string; error?: string }
      if (!response.ok || !body.secret) throw new Error(body.error || 'Could not create the API key.')
      setSecret({ title: 'Your new API key', secret: body.secret, notice: body.notice || 'Copy this secret now. It will not be shown again.' })
      setSecretCopied(false)
      setKeyNameByApp(current => ({ ...current, [app.id]: '' }))
      await refreshApps()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not create the API key.')
    } finally {
      setWorkingKey('')
    }
  }

  async function revokeKey(app: AppWithKeys, key: ApiKey) {
    if (!window.confirm(`Revoke “${key.name}”? Requests using this key will stop working immediately.`)) return
    setWorkingKey(key.id)
    setActionError('')
    try {
      const response = await fetch(`/api/developer/apps/${app.id}/keys/${key.id}`, { method: 'DELETE' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(errorText(body, 'Could not revoke the API key.'))
      await refreshApps()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not revoke the API key.')
    } finally {
      setWorkingKey('')
    }
  }

  async function rotateKey(app: AppWithKeys, key: ApiKey) {
    if (!window.confirm(`Rotate “${key.name}”? The current key will be revoked and replaced.`)) return
    setWorkingKey(key.id)
    setActionError('')
    try {
      const response = await fetch(`/api/developer/apps/${app.id}/keys/${key.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: 90 }),
      })
      const body = await response.json().catch(() => ({})) as { secret?: string; notice?: string; error?: string }
      if (!response.ok || !body.secret) throw new Error(body.error || 'Could not rotate the API key.')
      setSecret({ title: 'Replacement API key', secret: body.secret, notice: body.notice || 'The old key was revoked. Copy this new key now.' })
      setSecretCopied(false)
      await refreshApps()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not rotate the API key.')
    } finally {
      setWorkingKey('')
    }
  }

  async function copySecret() {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret.secret)
      setSecretCopied(true)
    } catch {
      setSecretCopied(false)
      setActionError('Clipboard access was unavailable. Select and copy the key from the box above.')
    }
  }

  const metricValue = (value: number | undefined, emptyLabel: string) => value && value > 0 ? value.toLocaleString() : emptyLabel
  const dashboardDays = dashboard?.days ?? days

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <header className={styles.heading}>
          <h1 className={styles.title}>Developer &amp; AI Agent Hub</h1>
          <div className={styles.phaseBadge}><Icon name="shield" size={18} /> Phase 1 · read-only</div>
        </header>

        <nav className={styles.tabs} aria-label="Developer Hub">
          {TAB_ITEMS.map(item => (
            <Link
              key={item.id}
              href={item.id === 'overview' ? '/developer-hub' : `/developer-hub?tab=${item.id}`}
              className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
              aria-current={tab === item.id ? 'page' : undefined}
            >{item.label}</Link>
          ))}
        </nav>

        {tab === 'overview' && (
          <>
            <p className={styles.intro}>Welcome to your developer hub. Get safe, read-only access to public FreeTrust listings.</p>
            {dashboardError && <div className={styles.errorBox} role="alert">{dashboardError}</div>}
            <section className={styles.stats} aria-label="API overview metrics">
              <MetricCard icon="code" label="API requests" value={dashboardLoading ? 'Loading…' : dashboard ? metricValue(dashboard.totalRequests, 'No data yet') : 'Unavailable'} sub={dashboard?.totalRequests ? `Last ${dashboardDays} days` : '—'} />
              <MetricCard icon="key" label="Active keys" value={dashboardLoading ? 'Loading…' : dashboard ? metricValue(dashboard.activeKeys, 'None yet') : 'Unavailable'} sub={dashboard?.activeKeys ? 'Read-only access' : '—'} />
              <MetricCard icon="apps" label="Apps" value={dashboardLoading ? 'Loading…' : dashboard ? metricValue(dashboard.activeApps, 'None yet') : 'Unavailable'} sub={dashboard?.activeApps ? 'Member-owned' : '—'} />
            </section>

            <section className={styles.panel} aria-labelledby="api-usage-title">
              <div className={styles.panelHeading}>
                <h2 className={styles.panelTitle} id="api-usage-title">API usage</h2>
                <label>
                  <span className={styles.srOnly}>Usage period</span>
                  <select className={styles.periodSelect} value={days} onChange={event => setDays(Number(event.target.value))}>
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                </label>
              </div>
              {dashboardLoading ? <div className={styles.emptyState}>Loading usage…</div> : <UsageChart data={dashboard?.dailyUsage ?? []} days={dashboardDays} />}
              {dashboard && dashboard.totalRequests > 0 && (
                <div className={styles.chartSummary}>
                  <span className={styles.statusGood}>Successful: {dashboard.successfulRequests.toLocaleString()}</span>
                  <span className={dashboard.failedRequests ? styles.statusBad : ''}>Failed: {dashboard.failedRequests.toLocaleString()}</span>
                  <span>Daily buckets use UTC.</span>
                </div>
              )}
            </section>

            <section className={`${styles.panel} ${styles.started}`} aria-labelledby="get-started-title">
              <h2 className={styles.panelTitle} id="get-started-title">Get started</h2>
              <div className={styles.steps}>
                <div className={styles.step}><span className={styles.stepNumber}>1</span><span>Register an app</span></div>
                <div className={styles.step}><span className={styles.stepNumber}>2</span><span>Create a read-only key</span></div>
                <div className={styles.step}><span className={styles.stepNumber}>3</span><span>Make your first API request</span></div>
              </div>
              <div className={styles.actions}>
                <Link className={styles.buttonPrimary} href="/developer-hub?tab=keys"><Icon name="plus" size={20} /> Create developer app</Link>
                <Link className={styles.buttonSecondary} href="/developer-hub?tab=docs"><Icon name="book" size={20} /> Read API docs</Link>
              </div>
            </section>

            <div className={styles.notice}>
              <span className={styles.noticeIcon}><Icon name="shield" size={34} /></span>
              <span>Read-only access in Phase 1. Listing changes and transactions are not enabled.</span>
            </div>

            {dashboard?.recentActivity.length ? (
              <section className={styles.panel} aria-labelledby="recent-activity-title">
                <div className={styles.panelHeading}><h2 className={styles.panelTitle} id="recent-activity-title">Recent API activity</h2></div>
                <div className={styles.activityList}>
                  {dashboard.recentActivity.map(activity => (
                    <div className={styles.activityRow} key={activity.id}>
                      <span className={styles.activityPath}>{activity.method} {activity.path}</span>
                      <span className={activity.status_code < 400 ? styles.statusGood : styles.statusBad}>{activity.status_code}</span>
                      <time dateTime={activity.created_at}>{localTime(activity.created_at)}</time>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

        {tab === 'docs' && <DocsView />}

        {tab === 'keys' && (
          <section>
            <h2 className={styles.pageTitle}>API keys &amp; apps</h2>
            <p className={styles.pageIntro}>Create a developer app and issue a scoped key for read-only access to active public products and services. Secret values are shown once and stored only as hashes.</p>
            {!limits && (
              <div className={styles.notice}>
                <span className={styles.noticeIcon}><Icon name="shield" size={30} /></span>
                <span>Key creation is paused until FreeTrust request limits are configured. No quota values are assumed.</span>
              </div>
            )}
            {limits && <div className={styles.notice}><span className={styles.noticeIcon}><Icon name="shield" size={30} /></span><span>Each key is limited to {limits.requestsPerMinute.toLocaleString()} requests per minute and {limits.requestsPerDay.toLocaleString()} per UTC day.</span></div>}
            {appsError && <div className={styles.errorBox} role="alert">{appsError}</div>}
            {appNotice && <div className={styles.successBox} role="status">{appNotice}</div>}
            <form className={styles.subPanel} onSubmit={createApp}>
              <h3 className={styles.panelTitle}>Register an app</h3>
              <p className={styles.subtle} style={{ margin: '6px 0 14px' }}>Apps are owned by your FreeTrust member account. Organisation-level access is not part of Phase 1.</p>
              <div className={styles.formGrid}>
                <label className={styles.formField}>
                  App name
                  <input required minLength={2} maxLength={80} value={appName} onChange={event => setAppName(event.target.value)} placeholder="e.g. My inventory assistant" />
                </label>
                <label className={`${styles.formField} ${styles.formFull}`}>
                  Description <span className={styles.subtle}>Optional · up to 500 characters</span>
                  <textarea maxLength={500} value={appDescription} onChange={event => setAppDescription(event.target.value)} placeholder="What will this integration do?" />
                </label>
              </div>
              <div className={styles.formActions}><button className={styles.buttonPrimary} type="submit" disabled={appSubmitting}>{appSubmitting ? 'Creating…' : 'Create developer app'}</button></div>
            </form>

            <div className={styles.subPanel}>
              <div className={styles.panelHeading}>
                <h3 className={styles.panelTitle}>Your apps</h3>
                <span className={styles.subtle}>{appsLoading ? 'Loading…' : `${apps.length} ${apps.length === 1 ? 'app' : 'apps'}`}</span>
              </div>
              {appsLoading ? <div className={styles.emptyState}>Loading apps and API keys…</div> : apps.length === 0 && !appsError ? <div className={styles.emptyState}>No developer apps yet. Create one above to get started.</div> : null}
              {apps.map(app => (
                <article className={styles.appCard} key={app.id}>
                  <div className={styles.appHeader}>
                    <div><div className={styles.appName}>{app.name}</div><div className={styles.appDescription}>{app.description || 'No description provided.'}</div></div>
                    <span className={styles.subtle}>{app.status === 'active' ? 'Active' : 'Disabled'}</span>
                  </div>
                  <div className={styles.subtle} style={{ marginTop: 10 }}>API keys · {app.keys.length}</div>
                  {app.keys.length === 0 ? <div className={styles.emptyState}>No API keys yet.</div> : app.keys.map(key => {
                    const active = !key.revoked_at && (!key.expires_at || new Date(key.expires_at).getTime() > Date.now())
                    return (
                      <div className={styles.keyRow} key={key.id}>
                        <div>
                          <div className={styles.keyName}>{key.name} · <span className={active ? styles.statusGood : styles.statusBad}>{active ? 'Active' : 'Inactive'}</span></div>
                          <div className={styles.keyMeta}>{key.key_prefix}… · {key.scopes.join(', ')} · {key.last_used_at ? `used ${localTime(key.last_used_at)}` : 'never used'}</div>
                        </div>
                        <div className={styles.keyActions}>
                          {active && <button className={styles.buttonQuiet} type="button" disabled={!limits || workingKey === key.id} onClick={() => rotateKey(app, key)}>{workingKey === key.id ? 'Working…' : 'Rotate'}</button>}
                          {active && <button className={styles.buttonDanger} type="button" disabled={workingKey === key.id} onClick={() => revokeKey(app, key)}>Revoke</button>}
                        </div>
                      </div>
                    )
                  })}
                  <div className={styles.appCard} style={{ marginTop: 14 }}>
                    <div className={styles.keyHeader}>
                      <div><div className={styles.keyName}>Create a read-only key</div><div className={styles.subtle}>Scope: listings:read</div></div>
                    </div>
                    <div className={styles.formGrid} style={{ marginTop: 12 }}>
                      <label className={styles.formField}>
                        Key name
                        <input minLength={2} maxLength={80} value={keyNameByApp[app.id] ?? ''} onChange={event => setKeyNameByApp(current => ({ ...current, [app.id]: event.target.value }))} placeholder="e.g. Production server" />
                      </label>
                      <label className={styles.formField}>
                        Expiration
                        <select value={expiryByApp[app.id] ?? '90'} onChange={event => setExpiryByApp(current => ({ ...current, [app.id]: event.target.value }))}>
                          <option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option><option value="never">No expiry</option>
                        </select>
                      </label>
                    </div>
                    <div className={styles.formActions}>
                      <button className={styles.buttonSecondary} type="button" disabled={!limits || workingKey === app.id} onClick={() => createKey(app)}>{workingKey === app.id ? 'Creating…' : 'Generate API key'}</button>
                    </div>
                  </div>
                </article>
              ))}
              {actionError && <div className={styles.errorBox} role="alert">{actionError}</div>}
            </div>
          </section>
        )}
      </div>

      {secret && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="secret-title">
            <h2 className={styles.modalTitle} id="secret-title">{secret.title}</h2>
            <p className={styles.pageIntro} style={{ marginTop: 8 }}>{secret.notice} Store it in a server-side secret manager; do not put it in browser code or commit it to source control.</p>
            <code className={styles.secretValue}>{secret.secret}</code>
            <div className={styles.modalActions}>
              <button className={styles.buttonQuiet} type="button" onClick={copySecret}><Icon name="copy" size={18} /> {secretCopied ? 'Copied' : 'Copy key'}</button>
              <button className={styles.buttonPrimary} type="button" onClick={() => { setSecret(null); setSecretCopied(false) }}>I’ve saved it</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function MetricCard({ icon, label, value, sub }: { icon: 'code' | 'key' | 'apps'; label: string; value: string; sub: string }) {
  return (
    <article className={styles.statCard}>
      <div className={styles.statHead}><span className={styles.iconCircle}><Icon name={icon} size={20} /></span><span>{label}</span></div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statSub}>{sub}</div>
    </article>
  )
}

function DocsView() {
  const base = 'https://freetrust.co'
  const curl = `curl -H "Authorization: Bearer $FREETRUST_API_KEY" "${base}/api/v1/listings?type=product&per_page=20"`
  const javascript = `const response = await fetch("${base}/api/v1/listings?type=service", {\n  headers: { Authorization: \`Bearer \${process.env.FREETRUST_API_KEY}\` }\n});\nconst { data, meta } = await response.json();`
  const python = `import os\nimport requests\n\nresponse = requests.get(\n    "${base}/api/v1/listings",\n    params={"type": "product", "per_page": 20},\n    headers={"Authorization": f"Bearer {os.environ['FREETRUST_API_KEY']}"},\n    timeout=10,\n)\nresponse.raise_for_status()\nlistings = response.json()["data"]`

  return (
    <section>
      <h2 className={styles.pageTitle}>Read-only Listings API</h2>
      <p className={styles.pageIntro}>Version 1 exposes curated fields from active public FreeTrust products and services. It does not grant access to private member data, identity records, inventory changes, orders, or payments.</p>
      <div className={styles.notice}><span className={styles.noticeIcon}><Icon name="shield" size={30} /></span><span>Use API keys only from a trusted server. Do not embed secrets in websites, mobile apps, prompts, or public repositories. There is no separate sandbox environment in Phase 1.</span></div>

      <div className={styles.subPanel}>
        <h3 className={styles.panelTitle}>Authentication</h3>
        <div className={styles.docSection}><p>Send the secret as an HTTP bearer token. The only Phase 1 scope is <code className={styles.inlineCode}>listings:read</code>. The key is shown once during creation; FreeTrust stores only a SHA-256 hash.</p></div>
        <pre className={styles.codeBlock}>{curl}</pre>

        <div className={styles.docSection}>
          <h3>Endpoints</h3>
          <table className={styles.docTable}>
            <thead><tr><th>Method</th><th>Endpoint</th><th>Purpose</th></tr></thead>
            <tbody>
              <tr><td>GET</td><td><code>/api/v1/listings?type=product</code></td><td>List active products</td></tr>
              <tr><td>GET</td><td><code>/api/v1/listings?type=service</code></td><td>List active services</td></tr>
              <tr><td>GET</td><td><code>/api/v1/listings/{'{id}'}</code></td><td>Retrieve one active public listing</td></tr>
            </tbody>
          </table>
          <ul>
            <li>List parameters: <code className={styles.inlineCode}>page</code> (default 1), <code className={styles.inlineCode}>per_page</code> (default 20, maximum 50), and exact <code className={styles.inlineCode}>category</code>.</li>
            <li>Responses use a curated listing projection. Exact coordinates, private profile fields, raw database rows, orders, and payment details are not returned.</li>
            <li>Responses include <code className={styles.inlineCode}>X-Request-Id</code>, rate-limit headers, and paginated <code className={styles.inlineCode}>meta</code>.</li>
          </ul>
        </div>

        <div className={styles.docSection}>
          <h3>JavaScript</h3>
          <p>Keep the key in a server environment variable. Never place it in a client-side bundle.</p>
          <pre className={styles.codeBlock}>{javascript}</pre>
        </div>
        <div className={styles.docSection}>
          <h3>Python</h3>
          <pre className={styles.codeBlock}>{python}</pre>
        </div>

        <div className={styles.docSection}>
          <h3>Rate limits</h3>
          <p>The free Phase 1 pilot allows 60 requests per minute and 1,000 requests per UTC day for each API key. Separate keys have separate per-key quotas. The app also enforces an additional in-memory limit of 100 API requests per minute per client IP, shared across its API routes; it can affect multiple keys behind the same IP. No API usage fee is charged in Phase 1. Any future paid tier or usage billing will require published pricing and controls before it is introduced.</p>
        </div>
        <div className={styles.docSection}>
          <h3>Errors</h3>
          <table className={styles.docTable}>
            <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td>400</td><td>Invalid type, pagination, or category parameter</td></tr>
              <tr><td>401</td><td>Missing, invalid, expired, or revoked API key</td></tr>
              <tr><td>403</td><td>Key is missing the required read scope</td></tr>
              <tr><td>404</td><td>No active public listing matches the ID</td></tr>
              <tr><td>429</td><td>Per-key quota or the app-wide 100/minute per-IP limit was exceeded; per-key responses include Retry-After.</td></tr>
              <tr><td>500 / 503</td><td>Temporary service or provisioning issue</td></tr>
            </tbody>
          </table>
        </div>
        <div className={styles.docSection}>
          <h3>Phase 1 boundaries</h3>
          <ul>
            <li>Read-only product/service discovery only; no publish, edit, archive, order, booking, trust, identity, or payment scopes.</li>
            <li>No webhooks, OAuth authorization server, MCP server, billing, SDK, or isolated sandbox in this phase.</li>
            <li>API usage is recorded with app/key IDs, route, method, status, response time, and timestamp. IPs, user agents, secrets, and request bodies are excluded.</li>
          </ul>
        </div>
        <div className={styles.docSection}>
          <h3>OpenAPI</h3>
          <p><a href="/developer-api-v1.openapi.yaml" target="_blank" rel="noreferrer" className={styles.inlineCode}>Download the OpenAPI 3.1 specification</a></p>
        </div>
      </div>
    </section>
  )
}
