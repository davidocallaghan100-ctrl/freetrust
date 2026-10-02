'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ComposioProvider } from '@/lib/integrations/composioCatalog'

type IntegrationCard = {
  provider: ComposioProvider
  name: string
  icon: string
  description: string
  capabilities: string[]
  tone: string
  status: 'not_connected' | 'pending' | 'active' | 'error' | 'disconnected' | 'revoked'
  connected: boolean
  accountName: string | null
  lastVerifiedAt: string | null
  lastErrorCode: string | null
}

const STATUS_COPY: Record<IntegrationCard['status'], string> = {
  not_connected: 'Not connected',
  pending: 'Finish setup',
  active: 'Connected',
  error: 'Needs attention',
  disconnected: 'Disconnected',
  revoked: 'Connection revoked',
}

export default function IntegrationsTab() {
  const [providers, setProviders] = useState<IntegrationCard[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [busyProvider, setBusyProvider] = useState<ComposioProvider | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/integrations/composio', { cache: 'no-store' })
      const data = await response.json().catch(() => null) as { configured?: boolean; providers?: IntegrationCard[]; message?: string } | null
      if (!response.ok) throw new Error(data?.message ?? 'Could not load integrations.')
      setConfigured(data?.configured !== false)
      setProviders(Array.isArray(data?.providers) ? data.providers : [])
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load integrations.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function connect(provider: IntegrationCard) {
    setBusyProvider(provider.provider)
    setNotice(null)
    try {
      const response = await fetch('/api/integrations/composio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', provider: provider.provider }),
      })
      const data = await response.json().catch(() => null) as { redirectUrl?: string; message?: string } | null
      if (!response.ok || !data?.redirectUrl) throw new Error(data?.message ?? 'Could not start the connection.')
      window.location.assign(data.redirectUrl)
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not start the connection.' })
      setBusyProvider(null)
    }
  }

  async function disconnect(provider: IntegrationCard) {
    setBusyProvider(provider.provider)
    setNotice(null)
    try {
      const response = await fetch('/api/integrations/composio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect', provider: provider.provider }),
      })
      const data = await response.json().catch(() => null) as { message?: string } | null
      if (!response.ok) throw new Error(data?.message ?? 'Could not disconnect this app.')
      setNotice({ tone: 'success', text: `${provider.name} disconnected from FreeTrust.` })
      await load()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not disconnect this app.' })
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <div>
      <style>{`
        .integrations-hero { background: radial-gradient(circle at 18% 0%, rgba(56,189,248,0.18), transparent 45%), linear-gradient(135deg, rgba(14,116,144,0.18), rgba(30,41,59,0.78) 58%, rgba(49,46,129,0.18)); border: 1px solid rgba(56,189,248,0.28); border-radius: 18px; padding: 22px; margin-bottom: 20px; }
        .integrations-hero-row { display: flex; align-items: flex-start; gap: 14px; }
        .integrations-mark { width: 48px; height: 48px; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 48px; border-radius: 16px; background: rgba(15,23,42,0.58); border: 1px solid rgba(125,211,252,0.38); color: #67e8f9; font-size: 24px; box-shadow: 0 0 22px rgba(56,189,248,0.18); }
        .integrations-pill { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,0.6); border: 1px solid rgba(148,163,184,0.2); color: #bae6fd; font-size: 11px; font-weight: 800; }
        .integrations-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .integration-card { min-width: 0; background: rgba(30,41,59,0.78); border: 1px solid #334155; border-radius: 14px; padding: 16px; }
        .integration-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .integration-app-icon { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border-radius: 11px; background: rgba(15,23,42,0.74); border: 1px solid rgba(148,163,184,0.18); font-size: 19px; font-weight: 900; }
        .integration-status { color: #64748b; font-size: 11px; line-height: 1.35; margin-top: 2px; }
        .integration-status.active { color: #34d399; }
        .integration-status.pending, .integration-status.error, .integration-status.revoked { color: #fbbf24; }
        .integration-capabilities { display: flex; flex-wrap: wrap; gap: 5px; margin: 13px 0 15px; }
        .integration-capability { color: #94a3b8; background: rgba(15,23,42,0.55); border: 1px solid rgba(148,163,184,0.15); border-radius: 999px; padding: 4px 7px; font-size: 10px; }
        .integration-action { min-height: 44px; width: 100%; border-radius: 10px; padding: 0 11px; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
        .integration-action-primary { background: #38bdf8; color: #082f49; border: 1px solid #38bdf8; }
        .integration-action-secondary { background: transparent; color: #bae6fd; border: 1px solid rgba(125,211,252,0.38); }
        .integration-action:disabled { opacity: 0.6; cursor: wait; }
        .integration-native { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(14,116,144,0.1); border: 1px solid rgba(56,189,248,0.2); border-radius: 12px; padding: 14px; margin-top: 12px; }
        .integration-native-link { color: #7dd3fc; font-size: 12px; font-weight: 800; text-decoration: none; white-space: nowrap; }
        @media (max-width: 640px) { .integrations-hero { padding: 18px; } .integrations-grid { grid-template-columns: 1fr; } .integration-native { align-items: flex-start; flex-direction: column; } }
      `}</style>

      <section className="card integrations-hero">
        <div className="integrations-hero-row">
          <div className="integrations-mark" aria-hidden="true">✦</div>
          <div>
            <h2 className="section-title">Connect your tools</h2>
            <p className="section-desc" style={{ marginBottom: 0 }}>Give FreeTrust permission to work with the apps you already use. Every connection belongs to you and can be removed at any time.</p>
          </div>
        </div>
        <div className="integrations-pill"><span aria-hidden="true">🔒</span> Managed by Composio · member-owned accounts</div>
      </section>

      {notice && (
        <div style={{ marginBottom: 16, padding: '11px 13px', borderRadius: 10, border: `1px solid ${notice.tone === 'success' ? 'rgba(52,211,153,0.32)' : 'rgba(248,113,113,0.34)'}`, background: notice.tone === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(127,29,29,0.2)', color: notice.tone === 'success' ? '#86efac' : '#fecaca', fontSize: 13 }}>{notice.text}</div>
      )}

      {!configured && (
        <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.28)', background: 'rgba(120,53,15,0.18)', color: '#fde68a', fontSize: 13, lineHeight: 1.5 }}>
          App connections are being prepared. Composio still needs to be enabled on the FreeTrust server before a member can connect an app.
        </div>
      )}

      <div className="card">
        <h2 className="section-title">Available integrations</h2>
        <p className="section-desc">Choose an app to connect. FreeTrust only requests the permissions needed for the supported workflow.</p>
        {loading ? (
          <div style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0' }}>Checking your connections…</div>
        ) : (
          <div className="integrations-grid">
            {providers.map((provider) => {
              const busy = busyProvider === provider.provider
              const connected = provider.status === 'active'
              const actionLabel = connected ? 'Disconnect' : provider.status === 'pending' ? 'Continue setup' : 'Connect'
              return (
                <div className="integration-card" key={provider.provider}>
                  <div className="integration-card-top">
                    <span className="integration-app-icon" style={{ color: provider.tone }}>{provider.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 14 }}>{provider.name}</div>
                      <div className={`integration-status ${provider.status}`}>{connected ? '✓ ' : ''}{STATUS_COPY[provider.status]}</div>
                    </div>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45, minHeight: 52, margin: '12px 0 0' }}>{provider.description}</p>
                  {provider.accountName && connected && <div style={{ color: '#64748b', fontSize: 11, marginTop: 8, overflowWrap: 'anywhere' }}>{provider.accountName}</div>}
                  <div className="integration-capabilities">{provider.capabilities.map((capability) => <span className="integration-capability" key={capability}>{capability}</span>)}</div>
                  <button
                    type="button"
                    className={`integration-action ${connected ? 'integration-action-secondary' : 'integration-action-primary'}`}
                    onClick={() => connected ? disconnect(provider) : connect(provider)}
                    disabled={busy || !configured}
                  >
                    {busy ? 'Working…' : actionLabel}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="integration-native">
          <div>
            <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 800 }}>📅 Google Calendar</div>
            <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45, marginTop: 3 }}>Connected directly through FreeTrust for your gigs, events, and reminders.</div>
          </div>
          <Link className="integration-native-link" href="/settings/calendar">Manage Calendar →</Link>
        </div>
      </div>

      <p style={{ color: '#64748b', fontSize: 11, lineHeight: 1.5, textAlign: 'center', margin: '18px 8px 0' }}>Connections are encrypted and scoped to your account. FreeTrust does not receive or display your app passwords.</p>
    </div>
  )
}
