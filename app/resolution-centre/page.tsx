'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Dispute {
  id: string
  order_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  order?: { id: string; title: string | null; amount: number | null; status: string | null } | null
  raiser?: { full_name: string | null } | null
  against?: { full_name: string | null } | null
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatAmount(amount: number | null | undefined): string {
  return typeof amount === 'number' ? `€${amount.toFixed(2)}` : 'Amount unavailable'
}

export default function ResolutionCentrePage() {
  const router = useRouter()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDisputes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/disputes', { cache: 'no-store' })
      const data = await response.json().catch(() => ({})) as { disputes?: Dispute[]; error?: string }
      if (response.status === 401) {
        router.replace('/login?redirect=/resolution-centre')
        return
      }
      if (!response.ok) throw new Error(data.error ?? `Unable to load disputes (HTTP ${response.status})`)
      setDisputes(data.disputes ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your disputes')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void loadDisputes() }, [loadDisputes])

  return (
    <main style={{ minHeight: '100vh', background: 'var(--ft-bg)', color: 'var(--ft-text)', padding: '5rem 1rem 6rem', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/messages" style={{ color: 'var(--ft-text-tertiary)', textDecoration: 'none', fontSize: 13 }}>
          ← Back to Messages
        </Link>

        <header style={{ margin: '1.25rem 0 1.5rem' }}>
          <div style={{ fontSize: 12, color: 'var(--ft-accent)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>FreeTrust support</div>
          <h1 style={{ margin: '0.35rem 0 0.45rem', fontSize: 28, letterSpacing: '-0.04em' }}>Resolution Centre</h1>
          <p style={{ margin: 0, color: 'var(--ft-text-tertiary)', lineHeight: 1.5 }}>
            Review your order issues and continue an open dispute with the other member or FreeTrust support.
          </p>
        </header>

        {loading && (
          <div role="status" style={{ background: 'var(--ft-surface)', border: '1px solid var(--ft-border-strong)', borderRadius: 16, padding: '2rem', textAlign: 'center', color: 'var(--ft-text-tertiary)' }}>
            Loading your disputes…
          </div>
        )}

        {!loading && error && (
          <div role="alert" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.28)', borderRadius: 16, padding: '1.25rem', color: '#fca5a5' }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Couldn&apos;t load the Resolution Centre</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: '#fecaca' }}>{error}</div>
            <button type="button" onClick={() => void loadDisputes()} style={{ marginTop: 14, background: 'rgba(56,189,248,0.12)', color: 'var(--ft-accent)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 9, padding: '0.55rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && disputes.length === 0 && (
          <div style={{ background: 'var(--ft-surface)', border: '1px solid var(--ft-border-strong)', borderRadius: 16, padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🛡️</div>
            <h2 style={{ margin: '0 0 0.45rem', fontSize: 18 }}>No open disputes</h2>
            <p style={{ margin: 0, color: 'var(--ft-text-tertiary)', fontSize: 13, lineHeight: 1.5 }}>
              If something goes wrong with an order, open its dispute flow and it will appear here.
            </p>
            <Link href="/orders" style={{ display: 'inline-block', marginTop: 18, background: 'linear-gradient(135deg,var(--ft-accent),#0284c7)', color: 'var(--ft-bg)', borderRadius: 9, padding: '0.65rem 1rem', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
              View Orders
            </Link>
          </div>
        )}

        {!loading && !error && disputes.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {disputes.map(dispute => {
              const statusLabel = dispute.status.replace(/_/g, ' ')
              return (
                <article key={dispute.id} style={{ background: 'var(--ft-surface)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: 16, padding: '1rem 1.1rem', boxShadow: '0 12px 30px rgba(0,0,0,0.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(248,113,113,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0 }}>⚠️</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis' }}>{dispute.order?.title || 'Order dispute'}</h2>
                        <span style={{ background: 'rgba(248,113,113,0.12)', color: '#fca5a5', borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 800, textTransform: 'capitalize' }}>{statusLabel}</span>
                      </div>
                      <div style={{ marginTop: 5, color: 'var(--ft-text-tertiary)', fontSize: 12 }}>
                        {formatAmount(dispute.order?.amount)} · Opened {formatDate(dispute.created_at)}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: 'grid', gap: 6, fontSize: 13 }}>
                    <div><span style={{ color: 'var(--ft-text-faint)' }}>Reason:</span> <span style={{ color: 'var(--ft-text-secondary)' }}>{dispute.reason}</span></div>
                    {dispute.details && <div style={{ color: 'var(--ft-text-tertiary)', lineHeight: 1.5 }}>{dispute.details}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                    <Link href={`/orders/${dispute.order_id}`} style={{ flex: '1 1 140px', textAlign: 'center', textDecoration: 'none', background: 'rgba(56,189,248,0.1)', color: 'var(--ft-accent)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 9, padding: '0.6rem 0.75rem', fontSize: 12, fontWeight: 800 }}>
                      Open Order
                    </Link>
                    <Link href={`/orders/${dispute.order_id}/dispute`} style={{ flex: '1 1 140px', textAlign: 'center', textDecoration: 'none', background: 'rgba(248,113,113,0.1)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 9, padding: '0.6rem 0.75rem', fontSize: 12, fontWeight: 800 }}>
                      Continue Dispute
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
